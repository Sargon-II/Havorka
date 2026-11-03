/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDB, SessionRecord, AudioGap, AudioSegmentMeta, AudioChunkRecord } from '../storage/db';
import {
  isCapacitorAndroid,
  startNativeForegroundService,
  stopNativeForegroundService,
  addAudioFocusListener,
} from '../../platform/nativeRecording';
import { logEvent, setDiagnosticSessionStart } from '../diagnostics/log';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'interrupted';

export interface RecorderCallbacks {
  onStatusChange?: (status: RecorderStatus) => void;
  onAudioLevel?: (level: number) => void;
  onAlert?: (message: string, type: 'warning' | 'error' | 'info') => void;
  onClearAlert?: () => void;
  onRequiresUserGesture?: (required: boolean) => void;
  onSessionUpdated?: (session: SessionRecord) => void;
}

export function playAlertChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // ignore
  }
}

export function triggerVibration() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }
}

export class RobustAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private wakeLock: any = null;

  private sessionId: string | null = null;
  private sessionStartTime = 0;
  private currentSegmentIndex = 0;
  private currentChunkIndex = 0;
  private currentSegmentStartTime = 0;
  private status: RecorderStatus = 'idle';

  private silenceTimer: number | null = null;
  private silenceDurationMs = 0;
  private levelRafId: number | null = null;

  private retryCount = 0;
  private isIntentionallyStopped = false;
  private currentGap: AudioGap | null = null;
  private callbacks: RecorderCallbacks;
  private nativeFocusListener?: { remove: () => Promise<void> };

  private lastChunkTimestamp = 0;
  private minuteChunksCount = 0;
  private minuteMaxIntervalSec = 0;
  private minuteLevelSum = 0;
  private minuteLevelCount = 0;
  private minuteLevelMax = 0;
  private pulseIntervalId: any = null;

  private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (this.status === 'recording' || this.status === 'interrupted') {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  private visibilityChangeHandler = async () => {
    if (this.status !== 'recording') return;

    if (document.visibilityState === 'hidden') {
      logEvent('VIS_HIDDEN');
      this.recordGapStart('visibility_hidden');
    } else if (document.visibilityState === 'visible') {
      logEvent('VIS_VISIBLE');
      this.recordGapEnd();
      this.requestWakeLock();

      // Check stream health after returning from background
      if (!this.audioTrack || this.audioTrack.readyState !== 'live' || this.audioTrack.muted) {
        console.warn('[Recorder] Stream dead or muted after background return, initiating recovery');
        this.handleInterruption('Вкладка возвращена из фона, микрофон перезапускается...');
      }
    }
  };

  private deviceChangeHandler = async () => {
    if (this.status !== 'recording') return;
    console.warn('[Recorder] Audio device changed (headphones/bluetooth/mic disconnected)');
    logEvent('DEV_CHANGE');
    this.callbacks.onAlert?.('Аудиоустройство изменилось, переподключение микрофона...', 'warning');
    playAlertChime();
    triggerVibration();
    this.handleInterruption('Аудиоустройство изменилось');
  };

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: RecorderCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getStatus(): RecorderStatus {
    return this.status;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getRealElapsedTimeMs(): number {
    if (!this.sessionStartTime) return 0;
    return Date.now() - this.sessionStartTime;
  }

  public async start(sessionMeta?: {
    informant?: string;
    location?: string;
    date?: string;
    researcher?: string;
    existingSessionId?: string;
  }): Promise<string> {
    this.isIntentionallyStopped = false;
    this.retryCount = 0;

    const db = await getDB();
    if (sessionMeta?.existingSessionId) {
      this.sessionId = sessionMeta.existingSessionId;
      const existing = await db.get('sessions', this.sessionId);
      if (existing) {
        this.sessionStartTime = existing.createdAt;
        this.currentSegmentIndex = existing.segments.length;
      } else {
        this.sessionStartTime = Date.now();
        this.currentSegmentIndex = 0;
      }
    } else {
      this.sessionId = `session_${Date.now()}`;
      this.sessionStartTime = Date.now();
      this.currentSegmentIndex = 0;

      const newSession: SessionRecord = {
        id: this.sessionId,
        createdAt: this.sessionStartTime,
        updatedAt: Date.now(),
        status: 'recording',
        informant: sessionMeta?.informant || '',
        location: sessionMeta?.location || '',
        date: sessionMeta?.date || new Date().toISOString().split('T')[0],
        researcher: sessionMeta?.researcher || '',
        segments: [],
        gaps: [],
      };
      await db.put('sessions', newSession);
    }

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
    }

    setDiagnosticSessionStart(this.sessionStartTime);
    logEvent('START');

    await this.startNewSegment();
    await this.requestWakeLock();

    return this.sessionId;
  }

  private async startNewSegment(): Promise<void> {
    try {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (gumErr: any) {
        logEvent('GUM_ERR', gumErr?.name || gumErr?.message || 'denied');
        throw gumErr;
      }

      this.audioTrack = this.stream.getAudioTracks()[0];
      if (!this.audioTrack) {
        logEvent('GUM_ERR', 'NO_AUDIO_TRACK');
        throw new Error('NO_AUDIO_TRACK');
      }

      const trackSettings = this.audioTrack.getSettings ? this.audioTrack.getSettings() : {};
      const gumDetails = [
        trackSettings.sampleRate ? `rate=${trackSettings.sampleRate}` : '',
        trackSettings.channelCount ? `ch=${trackSettings.channelCount}` : '',
      ].filter(Boolean).join(' ');
      logEvent('GUM_OK', gumDetails || undefined);

      // Start Android Foreground Service and bind AudioFocus monitoring
      if (isCapacitorAndroid()) {
        try {
          const serviceRes = await startNativeForegroundService();
          logEvent('SRV_START_OK', `notif=${serviceRes.notificationsGranted}`);
          if (!serviceRes.notificationsGranted) {
            this.callbacks.onAlert?.(
              'Уведомления отключены. Включите их в настройках для контроля фоновой записи.',
              'warning'
            );
          }
        } catch (serviceErr: any) {
          console.error('[Recorder] Failed to start native foreground service:', serviceErr);
          logEvent('SRV_START_ERR', serviceErr.message || String(serviceErr));
          this.audioTrack.stop();
          this.stream?.getTracks().forEach((t) => t.stop());
          throw new Error(`Не удалось запустить фоновую службу Android: ${serviceErr.message || serviceErr}`);
        }

        if (!this.nativeFocusListener) {
          this.nativeFocusListener = await addAudioFocusListener(async (event) => {
            if (event.type === 'gain') {
              logEvent('FOCUS_GAIN');
              console.log('[Recorder] Audio focus regained');
              this.callbacks.onAlert?.(
                'Аудиофокус восстановлен. Нажмите «Продолжить запись», чтобы возобновить интервью.',
                'info'
              );
              this.callbacks.onRequiresUserGesture?.(true);
              return;
            }

            logEvent('FOCUS_LOSS', `type=${event.type}`);
            if (event.type === 'can_duck') {
              return;
            }
            if (event.type === 'loss' || event.type === 'loss_transient') {
              console.warn('[Recorder] Audio focus lost (call / other app)');
              this.recordGapStart('audio_focus_loss');
              this.callbacks.onAlert?.(
                'Запись приостановлена: входящий звонок или другое приложение перехватило микрофон. Завершите разговор и нажмите «Продолжить запись».',
                'error'
              );
              playAlertChime();
              triggerVibration();
              await this.pause();
              this.callbacks.onRequiresUserGesture?.(true);
            }
          });
        }
      }

      // Track listeners
      this.audioTrack.onmute = () => {
        console.warn('[Recorder] Audio track muted by OS/hardware');
        logEvent('TRK_MUTE');
        this.recordGapStart('track_muted');
        this.callbacks.onAlert?.('Микрофон занят или отключён системой!', 'error');
        playAlertChime();
        triggerVibration();
      };

      this.audioTrack.onunmute = () => {
        console.log('[Recorder] Audio track unmuted');
        logEvent('TRK_UNMUTE');
        this.recordGapEnd();
        this.callbacks.onClearAlert?.();
      };

      this.audioTrack.onended = () => {
        if (!this.isIntentionallyStopped) {
          console.warn('[Recorder] Audio track ended unexpectedly');
          logEvent('TRK_ENDED');
          this.recordGapStart('track_ended');
          this.handleInterruption('Поток микрофона прерван (track ended)');
        }
      };

      // Set up silence detection & audio level analyser
      this.setupAudioAnalysis(this.stream);

      // Select supported audio MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/wav',
      ];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = selectedMimeType
        ? new MediaRecorder(this.stream, { mimeType: selectedMimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder = recorder;
      this.currentChunkIndex = 0;
      this.currentSegmentStartTime = Date.now();
      const startOffsetMs = this.getRealElapsedTimeMs();

      // Register segment in DB
      const segmentMeta: AudioSegmentMeta = {
        segmentIndex: this.currentSegmentIndex,
        startTime: this.currentSegmentStartTime,
        startOffsetMs,
        chunksCount: 0,
        mimeType: selectedMimeType || recorder.mimeType,
      };

      const db = await getDB();
      if (this.sessionId) {
        const session = await db.get('sessions', this.sessionId);
        if (session) {
          session.segments.push(segmentMeta);
          session.status = 'recording';
          session.updatedAt = Date.now();
          await db.put('sessions', session);
          this.callbacks.onSessionUpdated?.(session);
        }
      }

      logEvent('SEG_OPEN', `seg=${this.currentSegmentIndex}`);

      // MediaRecorder events
      recorder.ondataavailable = async (event) => {
        const now = Date.now();
        const intervalSec = this.lastChunkTimestamp > 0
          ? (now - this.lastChunkTimestamp) / 1000
          : (now - this.currentSegmentStartTime) / 1000;
        this.lastChunkTimestamp = now;

        const size = event.data?.size ?? 0;
        if (intervalSec > 15 || size === 0) {
          logEvent('CHUNK_ANOMALY', `int=${intervalSec.toFixed(1)}s size=${size}`);
        }

        this.minuteChunksCount++;
        if (intervalSec > this.minuteMaxIntervalSec) {
          this.minuteMaxIntervalSec = intervalSec;
        }

        if (event.data && size > 0 && this.sessionId) {
          const chunkRecord: AudioChunkRecord = {
            sessionId: this.sessionId,
            segmentIndex: this.currentSegmentIndex,
            chunkIndex: this.currentChunkIndex++,
            data: event.data,
            timestamp: Date.now(),
          };

          try {
            const dbInstance = await getDB();
            await dbInstance.put('audioChunks', chunkRecord);

            // Update segment chunks count
            const session = await dbInstance.get('sessions', this.sessionId);
            if (session && session.segments[this.currentSegmentIndex]) {
              session.segments[this.currentSegmentIndex].chunksCount = this.currentChunkIndex;
              session.updatedAt = Date.now();
              await dbInstance.put('sessions', session);
            }
          } catch (storageErr) {
            console.error('[Recorder] Failed to persist audio chunk into IndexedDB:', storageErr);
          }
        }
      };

      recorder.onerror = (event: any) => {
        const errorDetail = event.error?.name || event.error?.message || 'unknown';
        console.error('[Recorder] MediaRecorder error:', event.error || event);
        logEvent('REC_ERR', errorDetail);
        this.handleInterruption('Ошибка MediaRecorder');
      };

      recorder.onstop = () => {
        console.log(`[Recorder] Segment ${this.currentSegmentIndex} stopped`);
      };

      // 10000ms timeslice as requested
      recorder.start(10000);
      this.lastChunkTimestamp = Date.now();
      this.startPulseTimer();
      this.status = 'recording';
      this.callbacks.onStatusChange?.('recording');
      this.callbacks.onClearAlert?.();
      this.callbacks.onRequiresUserGesture?.(false);
    } catch (err: any) {
      console.error('[Recorder] Failed to start segment:', err);
      this.handleInterruption(err.message || 'Не удалось получить доступ к микрофону');
    }
  }

  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let lastCheckTime = Date.now();

      const monitorLevel = () => {
        if (!this.analyser || this.status !== 'recording') return;

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const level = sum / (buffer.length * 255); // 0.0 to 1.0
        this.callbacks.onAudioLevel?.(level);

        this.minuteLevelSum += level;
        this.minuteLevelCount++;
        if (level > this.minuteLevelMax) {
          this.minuteLevelMax = level;
        }

        const now = Date.now();
        const delta = now - lastCheckTime;
        lastCheckTime = now;

        // Silence detector: level < 0.005
        if (level < 0.005) {
          this.silenceDurationMs += delta;
          if (this.silenceDurationMs > 10000) {
            this.callbacks.onAlert?.('Нет звука с микрофона (тишина > 10 сек)', 'warning');
          }
        } else {
          if (this.silenceDurationMs > 10000) {
            this.callbacks.onClearAlert?.();
          }
          this.silenceDurationMs = 0;
        }

        this.levelRafId = requestAnimationFrame(monitorLevel);
      };

      this.levelRafId = requestAnimationFrame(monitorLevel);
    } catch (e) {
      console.warn('[Recorder] AudioContext analysis not available:', e);
    }
  }

  private startPulseTimer(): void {
    this.stopPulseTimer();
    this.minuteChunksCount = 0;
    this.minuteMaxIntervalSec = 0;
    this.minuteLevelSum = 0;
    this.minuteLevelCount = 0;
    this.minuteLevelMax = 0;

    this.pulseIntervalId = setInterval(() => {
      if (this.status !== 'recording') return;

      const avgLvl = this.minuteLevelCount > 0
        ? Math.round((this.minuteLevelSum / this.minuteLevelCount) * 100)
        : 0;
      const maxLvl = Math.round(this.minuteLevelMax * 100);
      const maxInt = this.minuteMaxIntervalSec.toFixed(1);

      logEvent('PULSE', `chunks=${this.minuteChunksCount} max_int=${maxInt}s avg_lvl=${avgLvl} max_lvl=${maxLvl}`);

      this.minuteChunksCount = 0;
      this.minuteMaxIntervalSec = 0;
      this.minuteLevelSum = 0;
      this.minuteLevelCount = 0;
      this.minuteLevelMax = 0;
    }, 60000);
  }

  private stopPulseTimer(): void {
    if (this.pulseIntervalId) {
      clearInterval(this.pulseIntervalId);
      this.pulseIntervalId = null;
    }
  }

  private recordGapStart(reason: AudioGap['reason']) {
    this.currentGap = {
      startTime: Date.now(),
      reason,
    };
  }

  private async recordGapEnd() {
    if (this.currentGap && this.sessionId) {
      this.currentGap.endTime = Date.now();
      try {
        const db = await getDB();
        const session = await db.get('sessions', this.sessionId);
        if (session) {
          session.gaps.push({ ...this.currentGap });
          session.updatedAt = Date.now();
          await db.put('sessions', session);
          this.callbacks.onSessionUpdated?.(session);
        }
      } catch (err) {
        console.warn('[Recorder] Failed to record gap:', err);
      }
      this.currentGap = null;
    }
  }

  private async handleInterruption(reasonDescription: string) {
    if (this.isIntentionallyStopped) return;

    this.stopPulseTimer();
    logEvent('SEG_CLOSE', `seg=${this.currentSegmentIndex} reason=${reasonDescription}`);

    this.status = 'interrupted';
    this.callbacks.onStatusChange?.('interrupted');
    this.callbacks.onAlert?.(`Запись прервана: ${reasonDescription}`, 'error');
    playAlertChime();
    triggerVibration();

    // Close current segment
    this.cleanupCurrentStream();

    if (this.retryCount < 3) {
      this.retryCount++;
      logEvent('RECOVERY', `attempt=${this.retryCount}/3`);
      const delayMs = 2000;
      console.log(`[Recorder] Attempting auto-recovery in ${delayMs}ms (attempt ${this.retryCount}/3)...`);
      this.callbacks.onAlert?.(
        `Переподключение микрофона (попытка ${this.retryCount} из 3)...`,
        'warning'
      );

      setTimeout(async () => {
        if (this.isIntentionallyStopped) return;
        this.currentSegmentIndex++;
        try {
          await this.startNewSegment();
        } catch {
          // If auto attempt failed, retry or prompt user
          if (this.retryCount >= 3) {
            this.callbacks.onRequiresUserGesture?.(true);
            this.callbacks.onAlert?.(
              'Требуется жест пользователя. Нажмите «Продолжить запись», чтобы возобновить захват микрофона.',
              'error'
            );
          }
        }
      }, delayMs);
    } else {
      console.warn('[Recorder] Max auto-recovery attempts reached. Waiting for user gesture.');
      this.callbacks.onRequiresUserGesture?.(true);
      this.callbacks.onAlert?.(
        'Автоматическое переподключение не удалось. Нажмите «Продолжить запись» для повторного запроса микрофона.',
        'error'
      );
    }
  }

  public async resumeWithUserGesture(): Promise<void> {
    this.retryCount = 0;
    this.currentSegmentIndex++;
    this.callbacks.onRequiresUserGesture?.(false);
    this.callbacks.onClearAlert?.();
    await this.startNewSegment();
  }

  public async pause(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.stopPulseTimer();
      logEvent('SEG_CLOSE', `seg=${this.currentSegmentIndex} reason=manual_pause`);
      this.mediaRecorder.pause();
      this.status = 'paused';
      this.callbacks.onStatusChange?.('paused');
      this.recordGapStart('manual_pause');

      if (isCapacitorAndroid()) {
        logEvent('SRV_STOP');
        await stopNativeForegroundService().catch(console.error);
      }

      if (this.sessionId) {
        const db = await getDB();
        const session = await db.get('sessions', this.sessionId);
        if (session) {
          session.status = 'paused';
          session.updatedAt = Date.now();
          await db.put('sessions', session);
          this.callbacks.onSessionUpdated?.(session);
        }
      }
    }
  }

  public async resume(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      if (isCapacitorAndroid()) {
        try {
          const serviceRes = await startNativeForegroundService();
          logEvent('SRV_START_OK', `notif=${serviceRes.notificationsGranted}`);
        } catch (serviceErr: any) {
          logEvent('SRV_START_ERR', serviceErr?.message || String(serviceErr));
        }
      }
      this.lastChunkTimestamp = Date.now();
      this.startPulseTimer();
      this.mediaRecorder.resume();
      this.status = 'recording';
      this.callbacks.onStatusChange?.('recording');
      this.recordGapEnd();

      if (this.sessionId) {
        const db = await getDB();
        const session = await db.get('sessions', this.sessionId);
        if (session) {
          session.status = 'recording';
          session.updatedAt = Date.now();
          await db.put('sessions', session);
          this.callbacks.onSessionUpdated?.(session);
        }
      }
    }
  }

  public async stop(): Promise<Blob | null> {
    this.isIntentionallyStopped = true;
    this.stopPulseTimer();
    logEvent('SEG_CLOSE', `seg=${this.currentSegmentIndex} reason=completed`);
    this.status = 'idle';
    this.callbacks.onStatusChange?.('idle');
    this.callbacks.onClearAlert?.();
    this.callbacks.onRequiresUserGesture?.(false);

    if (isCapacitorAndroid()) {
      logEvent('SRV_STOP');
      await stopNativeForegroundService().catch(console.error);
      if (this.nativeFocusListener) {
        await this.nativeFocusListener.remove().catch(console.error);
        this.nativeFocusListener = undefined;
      }
    }

    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    if (navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
    }

    this.releaseWakeLock();

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.requestData();
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping mediaRecorder:', e);
      }
    }

    this.cleanupCurrentStream();

    logEvent('STOP');
    setDiagnosticSessionStart(null);

    if (this.sessionId) {
      const db = await getDB();
      const session = await db.get('sessions', this.sessionId);
      if (session) {
        session.status = 'completed';
        session.updatedAt = Date.now();
        await db.put('sessions', session);
      }

      // Build composite audio blob
      return await exportSessionBlob(this.sessionId);
    }

    return null;
  }

  private cleanupCurrentStream() {
    if (this.levelRafId) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.audioTrack = null;
    }
    if (isCapacitorAndroid()) {
      stopNativeForegroundService().catch(() => {});
    }
  }

  private async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        logEvent('WL_ACQ');
      } catch (err: any) {
        console.warn('[Recorder] WakeLock request error:', err);
        logEvent('WL_ERR', err?.message || String(err));
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
      logEvent('WL_REL');
    }
  }
}

/**
 * Reconstructs a complete audio Blob from all segments and chunks of a session in IndexedDB
 */
export async function exportSessionBlob(sessionId: string): Promise<Blob | null> {
  const db = await getDB();
  const chunks = await db.getAllFromIndex('audioChunks', 'by_session', sessionId);
  if (!chunks || chunks.length === 0) return null;

  // Sort chunks by segmentIndex ASC, then chunkIndex ASC
  chunks.sort((a, b) => {
    if (a.segmentIndex !== b.segmentIndex) {
      return a.segmentIndex - b.segmentIndex;
    }
    return a.chunkIndex - b.chunkIndex;
  });

  const blobParts = chunks.map((c) => c.data);
  const mimeType = chunks[0]?.data?.type || 'audio/webm';
  return new Blob(blobParts, { type: mimeType });
}

/**
 * Clean up all stored audio chunks for a session after export/saving
 */
export async function cleanupSessionChunks(sessionId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('audioChunks', 'readwrite');
  const index = tx.store.index('by_session');
  let cursor = await index.openCursor(sessionId);

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  console.log(`[Recorder] Cleaned up audio chunks for session: ${sessionId}`);
}

/**
 * Checks for unfinished sessions from previous runs/crashes
 */
export async function findUnfinishedSessions(): Promise<SessionRecord[]> {
  const db = await getDB();
  const allSessions = await db.getAll('sessions');
  return allSessions.filter((s) => s.status === 'recording' || s.status === 'interrupted' || s.status === 'paused');
}
