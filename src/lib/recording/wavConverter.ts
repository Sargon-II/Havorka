/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Streaming WAV Converter (16 kHz, 16-bit mono PCM)
 * Decodes audio via AudioContext / OfflineAudioContext per segment
 * and streams WAV chunks into a standard audio/wav Blob without extra dependencies.
 */

export const MAX_SAFE_WAV_DURATION_SEC = 3600; // 60 minutes

export interface WavConversionCheck {
  totalDurationSec: number;
  exceedsLimit: boolean;
}

/**
 * Checks the total duration of audio blobs before full conversion
 */
export async function checkWavConversionDuration(blobs: Blob[]): Promise<WavConversionCheck> {
  let totalDurationSec = 0;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return { totalDurationSec: 0, exceedsLimit: false };
  }
  const ctx = new AudioCtx();
  try {
    for (const blob of blobs) {
      const ab = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab);
      totalDurationSec += decoded.duration;
    }
  } finally {
    ctx.close().catch(() => {});
  }

  return {
    totalDurationSec,
    exceedsLimit: totalDurationSec > MAX_SAFE_WAV_DURATION_SEC,
  };
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createWavHeader(numSamples: number, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length = 36 + dataSize
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  return buffer;
}

/**
 * Converts Float32Array samples (-1.0 to 1.0) into a 16-bit PCM Uint8Array
 */
function floatTo16BitPCM(floatSamples: Float32Array, start: number, end: number): Uint8Array {
  const count = end - start;
  const buffer = new ArrayBuffer(count * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < count; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[start + i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

/**
 * Decodes a single audio Blob and resamples to 16000 Hz 1-channel mono Float32Array
 */
async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('AudioContext не поддерживается в данной среде');
  }

  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer);
  } finally {
    decodeCtx.close().catch(() => {});
  }

  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.round(decoded.duration * targetSampleRate));

  // Resample via OfflineAudioContext with high quality
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

export interface ConvertWavOptions {
  onProgress?: (percent: number, message: string) => void;
  chunkSampleCount?: number; // default 32768
}

/**
 * Converts one or multiple audio Blobs (segments) into a single 16 kHz 16-bit mono WAV Blob.
 * Processes audio in chunks to prevent high memory spikes.
 */
export async function convertSegmentsToWavBlob(
  segments: Blob[],
  options?: ConvertWavOptions
): Promise<Blob> {
  if (segments.length === 0) {
    throw new Error('Нет аудио сегментов для конвертации');
  }

  const onProgress = options?.onProgress;
  const chunkSampleCount = options?.chunkSampleCount || 32768;

  // 1. Decode and resample each segment to 16 kHz mono Float32Array
  const monoSegments: Float32Array[] = [];
  let totalSamples = 0;

  for (let i = 0; i < segments.length; i++) {
    onProgress?.(
      Math.round(((i + 0.1) / segments.length) * 50),
      `Декодирование части ${i + 1} из ${segments.length}...`
    );
    const monoData = await decodeTo16kMono(segments[i]);
    monoSegments.push(monoData);
    totalSamples += monoData.length;
  }

  // 2. Generate standard 44-byte WAV header for total samples
  const header = createWavHeader(totalSamples, 16000, 1, 16);
  const blobParts: BlobPart[] = [header];

  // 3. Stream PCM samples into chunked typed arrays
  let processedSamples = 0;
  for (let sIdx = 0; sIdx < monoSegments.length; sIdx++) {
    const data = monoSegments[sIdx];
    const len = data.length;

    for (let offset = 0; offset < len; offset += chunkSampleCount) {
      const end = Math.min(offset + chunkSampleCount, len);
      const pcmChunk = floatTo16BitPCM(data, offset, end);
      blobParts.push(pcmChunk);

      processedSamples += end - offset;
      const progressPercent = 50 + Math.round((processedSamples / totalSamples) * 50);
      onProgress?.(Math.min(99, progressPercent), 'Запись потокового WAV...');
    }
  }

  onProgress?.(100, 'Готово!');
  return new Blob(blobParts, { type: 'audio/wav' });
}
