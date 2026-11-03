/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDB } from '../storage/db';
import { isCapacitorPlatform, isTauriPlatform } from '../../platform/files';

const MAX_LINES = 800;
const MAX_BYTES = 60 * 1024; // ~60 KB ring buffer limit
const BATCH_INTERVAL_MS = 5000;

let buffer: string[] = [];
let bufferBytes = 0;
let sessionStartTime: number | null = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let writeTimeout: any = null;
let hasPendingWrite = false;

const encoder = new TextEncoder();

function getLineByteLength(line: string): number {
  return encoder.encode(line).length + 1; // includes newline
}

function computeByteSize(lines: string[]): number {
  return lines.reduce((acc, l) => acc + getLineByteLength(l), 0);
}

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}.${tenths}`;
}

/**
 * Initializes the in-memory ring buffer from IndexedDB kv store if not loaded.
 */
export async function initDiagnosticLog(): Promise<void> {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const db = await getDB();
        const stored = await db.get('kv', 'diag');
        if (Array.isArray(stored)) {
          buffer = stored.filter((item): item is string => typeof item === 'string');
          bufferBytes = computeByteSize(buffer);
        }
      } catch (err) {
        console.warn('[Diagnostics] Failed to read diag log from IndexedDB:', err);
      } finally {
        isInitialized = true;
      }
    })();
  }
  return initPromise;
}

/**
 * Sets or resets the reference start timestamp for recording session.
 */
export function setDiagnosticSessionStart(startTime: number | null): void {
  sessionStartTime = startTime;
}

/**
 * Adds an event to the compact diagnostics ring buffer.
 * Formatted as "mm:ss.t код деталь" (relative time from session start).
 * Writes to IndexedDB are batched (<= once per 5s), with immediate flush on
 * errors, background events (VIS_HIDDEN), and stop (STOP).
 */
export function logEvent(code: string, detail?: string): void {
  const elapsedMs = Math.max(0, sessionStartTime ? Date.now() - sessionStartTime : 0);
  const timeStr = formatElapsed(elapsedMs);
  const line = detail ? `${timeStr} ${code} ${detail}` : `${timeStr} ${code}`;

  const lineBytes = getLineByteLength(line);
  buffer.push(line);
  bufferBytes += lineBytes;

  // Enforce ring buffer capacity: max 800 lines and ~60 KB
  while (buffer.length > MAX_LINES || bufferBytes > MAX_BYTES) {
    const evicted = buffer.shift();
    if (evicted) {
      bufferBytes -= getLineByteLength(evicted);
    }
  }

  hasPendingWrite = true;

  // Immediate flush conditions: errors, going to background, or stopping recording
  const isImmediate = code.includes('ERR') || code === 'VIS_HIDDEN' || code === 'STOP';

  if (isImmediate) {
    flushDiagnosticLog().catch(() => {});
  } else {
    scheduleBatchedSave();
  }
}

function scheduleBatchedSave(): void {
  if (writeTimeout) return;
  writeTimeout = setTimeout(() => {
    writeTimeout = null;
    if (hasPendingWrite) {
      flushDiagnosticLog().catch(() => {});
    }
  }, BATCH_INTERVAL_MS);
}

/**
 * Flushes pending diagnostic logs to IndexedDB immediately.
 */
export async function flushDiagnosticLog(): Promise<void> {
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  if (!hasPendingWrite) return;
  hasPendingWrite = false;

  try {
    const db = await getDB();
    await db.put('kv', [...buffer], 'diag');
  } catch (err) {
    console.warn('[Diagnostics] Failed to persist diag log to IndexedDB:', err);
  }
}

/**
 * Returns current log lines.
 */
export async function getDiagnosticLog(): Promise<string[]> {
  await initDiagnosticLog();
  return [...buffer];
}

/**
 * Returns diagnostic log metrics (lines count and byte size).
 */
export async function getDiagnosticLogStats(): Promise<{ count: number; bytes: number; maxLines: number; maxBytes: number }> {
  await initDiagnosticLog();
  return {
    count: buffer.length,
    bytes: bufferBytes,
    maxLines: MAX_LINES,
    maxBytes: MAX_BYTES,
  };
}

/**
 * Clears the diagnostics log from memory and IndexedDB.
 */
export async function clearDiagnosticLog(): Promise<void> {
  await initDiagnosticLog();
  buffer = [];
  bufferBytes = 0;
  hasPendingWrite = false;
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  try {
    const db = await getDB();
    await db.put('kv', [], 'diag');
  } catch (err) {
    console.warn('[Diagnostics] Failed to clear diag log in IndexedDB:', err);
  }
}

/**
 * Builds the complete text document with metadata header for export.
 */
export function buildDiagnosticExportContent(lines: string[]): string {
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

  // Extract WebView / Browser info
  let webViewInfo = 'Standard Browser';
  if (/wv\b|Version\/[\d.]+/i.test(ua)) {
    const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
    const verMatch = ua.match(/Version\/([\d.]+)/);
    webViewInfo = `Android System WebView (Chrome ${chromeMatch ? chromeMatch[1] : 'unknown'}, Version ${verMatch ? verMatch[1] : 'unknown'})`;
  } else if (/Chrome\/([\d.]+)/.test(ua)) {
    const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
    webViewInfo = `Chromium/Chrome ${chromeMatch ? chromeMatch[1] : 'unknown'}`;
  } else if (/Firefox\/([\d.]+)/.test(ua)) {
    const ffMatch = ua.match(/Firefox\/([\d.]+)/);
    webViewInfo = `Firefox ${ffMatch ? ffMatch[1] : 'unknown'}`;
  } else if (/Safari\/([\d.]+)/.test(ua)) {
    webViewInfo = 'Apple Safari';
  }

  // Extract Device Model info
  let deviceModel = 'Generic Device';
  const androidMatch = ua.match(/Android\s+([0-9.]+)?;\s*([^;)]+)\)/);
  if (androidMatch) {
    const androidVer = androidMatch[1] ? `Android ${androidMatch[1]}` : 'Android';
    const rawModel = androidMatch[2].replace(/\s*Build\/.*$/, '').replace(/;\s*wv$/, '').trim();
    deviceModel = `${rawModel} (${androidVer})`;
  } else if (/Windows NT/i.test(ua)) {
    deviceModel = 'Windows PC';
  } else if (/Macintosh/i.test(ua)) {
    deviceModel = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    deviceModel = 'Linux Device';
  } else if (/iPhone|iPad/i.test(ua)) {
    deviceModel = 'Apple iOS Device';
  }

  const platformType = isCapacitorPlatform()
    ? 'Capacitor (Android Native)'
    : isTauriPlatform()
    ? 'Tauri (Desktop Native)'
    : 'Web PWA / Browser';

  const header = [
    '================================================================',
    'ETNOFIELD RECORDING DIAGNOSTIC LOG',
    '================================================================',
    `Export Date:     ${dateStr}`,
    `App Version:     0.1.0`,
    `Platform:        ${platformType}`,
    `Device / OS:     ${deviceModel}`,
    `WebView/Browser: ${webViewInfo}`,
    `User Agent:      ${ua}`,
    `Total Events:    ${lines.length}`,
    '================================================================',
    '',
    lines.length > 0 ? lines.join('\n') : '[Журнал пуст / No events recorded]',
    '',
  ].join('\n');

  return header;
}
