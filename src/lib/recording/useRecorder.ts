/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RobustAudioRecorder,
  RecorderStatus,
  findUnfinishedSessions,
  exportSessionBlob,
  exportSessionSegments,
  exportSessionZip,
  cleanupSessionChunks,
  ExportedAudioSegment,
} from './recorder';
import { SessionRecord, getDB } from '../storage/db';

export interface RecorderAlert {
  text: string;
  type: 'warning' | 'error' | 'info';
}

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [alert, setAlert] = useState<RecorderAlert | null>(null);
  const [requiresUserGesture, setRequiresUserGesture] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionRecord | null>(null);
  const [unfinishedSessions, setUnfinishedSessions] = useState<SessionRecord[]>([]);

  const recorderRef = useRef<RobustAudioRecorder | null>(null);

  // Initialize recorder instance and find unfinished sessions on mount
  useEffect(() => {
    const recorder = new RobustAudioRecorder({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onAudioLevel: (lvl) => {
        setAudioLevel(lvl);
      },
      onAlert: (text, type) => {
        setAlert({ text, type });
      },
      onClearAlert: () => {
        setAlert(null);
      },
      onRequiresUserGesture: (req) => {
        setRequiresUserGesture(req);
      },
      onSessionUpdated: (session) => {
        setCurrentSession(session);
      },
    });

    recorderRef.current = recorder;

    // Check for unfinished sessions from previous runs or crashes
    findUnfinishedSessions()
      .then((sessions) => {
        if (sessions.length > 0) {
          console.log(`[useRecorder] Found ${sessions.length} unfinished recording session(s):`, sessions);
          setUnfinishedSessions(sessions);
        }
      })
      .catch((err) => {
        console.warn('[useRecorder] Error checking for unfinished sessions:', err);
      });

    return () => {
      if (recorder.getStatus() === 'recording' || recorder.getStatus() === 'paused') {
        recorder.pause().catch(() => {});
      }
    };
  }, []);

  const startRecording = useCallback(
    async (sessionMeta?: {
      informant?: string;
      location?: string;
      date?: string;
      researcher?: string;
      existingSessionId?: string;
    }) => {
      if (!recorderRef.current) return '';
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      const sid = await recorderRef.current.start(sessionMeta);
      return sid;
    },
    [audioUrl]
  );

  const pauseRecording = useCallback(async () => {
    if (!recorderRef.current) return;
    await recorderRef.current.pause();
  }, []);

  const resumeRecording = useCallback(async () => {
    if (!recorderRef.current) return;
    await recorderRef.current.resume();
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current) return null;
    const blob = await recorderRef.current.stop();
    if (blob) {
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    }
    return blob;
  }, []);

  const resumeWithUserGesture = useCallback(async () => {
    if (!recorderRef.current) return;
    await recorderRef.current.resumeWithUserGesture();
  }, []);

  const recoverSession = useCallback(async (session: SessionRecord): Promise<Blob | null> => {
    const segments = await exportSessionSegments(session.id);
    let blob: Blob | null = null;
    if (segments.length === 1) {
      blob = segments[0].blob;
      setAudioBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } else if (segments.length > 1) {
      // First segment preview for UI audio player
      setAudioBlob(segments[0].blob);
      const url = URL.createObjectURL(segments[0].blob);
      setAudioUrl(url);
    }

    setCurrentSession(session);
    setUnfinishedSessions((prev) => prev.filter((s) => s.id !== session.id));

    // Mark session as completed
    const db = await getDB();
    session.status = 'completed';
    session.updatedAt = Date.now();
    await db.put('sessions', session);
    return blob;
  }, []);

  const discardUnfinishedSession = useCallback(async (sessionId: string) => {
    await cleanupSessionChunks(sessionId);
    const db = await getDB();
    await db.delete('sessions', sessionId);
    setUnfinishedSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const cleanupAudio = useCallback(async () => {
    const sid = recorderRef.current?.getSessionId() || currentSession?.id;
    if (sid) {
      await cleanupSessionChunks(sid);
    }
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl, currentSession]);

  const getRealElapsedTimeMs = useCallback((): number => {
    return recorderRef.current?.getRealElapsedTimeMs() || 0;
  }, []);

  return {
    status,
    audioLevel,
    alert,
    requiresUserGesture,
    audioBlob,
    audioUrl,
    currentSession,
    unfinishedSessions,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resumeWithUserGesture,
    recoverSession,
    discardUnfinishedSession,
    cleanupAudio,
    getRealElapsedTimeMs,
    setAudioBlob,
    setAudioUrl,
  };
}
