/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  promptAndroidSaveTarget,
  createSaveProgressTracker,
  showSaveNotification,
} from './fileSaveDialog';

/**
 * Platform detection flags
 */
export function isCapacitorPlatform(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    Boolean((window as any).Capacitor.isNativePlatform())
  );
}

export function isTauriPlatform(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Detect file extension from MIME type for audio recordings (m4a, webm, ogg, wav)
 */
export function getAudioExtension(mimeType?: string): 'm4a' | 'webm' | 'ogg' | 'wav' {
  if (!mimeType) return 'm4a';
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'm4a';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg') || lower.includes('opus')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  return 'm4a';
}

/**
 * Standardize audio MIME type for exporting or streaming
 */
export function getAudioMimeType(mimeTypeOrExt?: string): string {
  if (!mimeTypeOrExt) return 'audio/mp4';
  const lower = mimeTypeOrExt.toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a') || lower === 'm4a' || lower.includes('aac')) {
    return 'audio/mp4';
  }
  if (lower.includes('webm') || lower === 'webm') return 'audio/webm';
  if (lower.includes('ogg') || lower === 'ogg' || lower.includes('opus')) return 'audio/ogg';
  if (lower.includes('wav') || lower === 'wav') return 'audio/wav';
  return 'audio/mp4';
}


/**
 * 2 MB chunk size for streaming large files without large memory allocations
 */
const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Files larger than 20 MB display a real-time progress indicator
 */
const PROGRESS_THRESHOLD = 20 * 1024 * 1024; // 20 MB

/**
 * Helper to slice Blob into an ArrayBuffer and Uint8Array
 */
async function chunkToUint8Array(chunk: Blob): Promise<Uint8Array> {
  const buffer = await chunk.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Helper to encode Uint8Array chunk to Base64 in sub-slices to prevent call-stack overflow
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const subChunkSize = 32768;
  for (let i = 0; i < len; i += subChunkSize) {
    const sub = bytes.subarray(i, Math.min(i + subChunkSize, len));
    binary += String.fromCharCode.apply(null, sub as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Standard Web download using an <a> element with download attribute (Web: unchanged)
 */
function saveViaWeb(blob: Blob, filename: string): void {
  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Defer revoking to allow browser download pipeline to capture stream
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 3000);
}

/**
 * Capacitor native saving for Android:
 * 1. Prompts user: «Сохранить на устройство» (SAF) vs «Поделиться» (Share sheet), with option to remember preference.
 * 2. Streams Blob in 2 MB chunks into app cache temporary file (never loading entire file as Base64 in memory).
 * 3. Copies via SAF or hands off to Share sheet.
 * 4. Shows progress for files > 20 MB and clear completion/error feedback.
 */
async function saveViaCapacitor(blob: Blob, filename: string, mime: string): Promise<void> {
  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;
  const totalBytes = blob.size;
  const isLarge = totalBytes >= PROGRESS_THRESHOLD;

  // 1. Prompt user choice if not remembered
  const choice = await promptAndroidSaveTarget({
    filename: safeFilename,
    sizeBytes: totalBytes,
  });

  if (choice === 'cancel') {
    showSaveNotification({
      type: 'info',
      title: 'Экспорт отменён',
      message: `Сохранение файла «${safeFilename}» отменено пользователем.`,
    });
    return;
  }

  // 2. Start progress tracker for large files
  const tracker = isLarge ? createSaveProgressTracker(safeFilename, totalBytes) : null;

  let tempFilePath: string | null = null;
  try {
    const { FileSave } = await import('./fileSaveBridge');

    // 3. Initialize temporary file in app cache
    const initRes = await FileSave.initTempFile({ filename: safeFilename });
    tempFilePath = initRes.tempFilePath;

    // 4. Stream chunks (2 MB each) to avoid high memory footprint
    for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
      const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, totalBytes));
      const bytes = await chunkToUint8Array(slice);
      const chunkBase64 = uint8ToBase64(bytes);

      await FileSave.appendTempChunk({
        tempFilePath,
        chunkBase64,
      });

      const currentLoaded = Math.min(offset + slice.size, totalBytes);
      tracker?.update(currentLoaded);
    }

    // 5. Route to selected action
    if (choice === 'device') {
      const safRes = await FileSave.saveWithSAF({
        tempFilePath,
        suggestedName: safeFilename,
        mimeType: mime || '*/*',
      });

      if (safRes.cancelled) {
        tracker?.close();
        await FileSave.cleanTempFile({ tempFilePath }).catch(() => {});
        showSaveNotification({
          type: 'info',
          title: 'Экспорт отменён',
          message: 'Выбор папки отменён пользователем.',
        });
        return;
      }

      const savedName = safRes.displayName || safeFilename;
      tracker?.finish(`Файл сохранён: ${savedName}`);
      showSaveNotification({
        type: 'success',
        title: 'Файл успешно сохранён',
        message: `Файл «${savedName}» сохранён на устройство через системный проводник.`,
      });
    } else {
      // Choice: 'share'
      await FileSave.shareTempFile({
        tempFilePath,
        filename: safeFilename,
        mimeType: mime || '*/*',
        dialogTitle: 'Поделиться файлом',
      });

      tracker?.finish('Файл передан в меню «Поделиться»');
      showSaveNotification({
        type: 'success',
        title: 'Экспорт выполнен',
        message: `Файл «${safeFilename}» передан в системное меню «Поделиться».`,
      });
    }
  } catch (err: any) {
    if (tempFilePath) {
      try {
        const { FileSave } = await import('./fileSaveBridge');
        await FileSave.cleanTempFile({ tempFilePath });
      } catch (_) {}
    }
    const errMsg = err?.message || String(err);
    tracker?.error(errMsg);
    showSaveNotification({
      type: 'error',
      title: 'Ошибка сохранения файла',
      message: `Не удалось сохранить «${safeFilename}»: ${errMsg}`,
    });
    throw err;
  }
}

/**
 * Tauri native saving: opens save dialog and streams large files in chunks
 */
async function saveViaTauri(blob: Blob, filename: string, mime: string): Promise<void> {
  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;
  const totalBytes = blob.size;
  const isLarge = totalBytes >= PROGRESS_THRESHOLD;

  const { save } = await import('@tauri-apps/plugin-dialog');
  const selectedPath = await save({
    defaultPath: safeFilename,
  });

  if (!selectedPath) {
    return;
  }

  const tracker = isLarge ? createSaveProgressTracker(safeFilename, totalBytes) : null;

  try {
    const { create } = await import('@tauri-apps/plugin-fs');
    const fileHandle = await create(selectedPath);

    try {
      for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
        const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, totalBytes));
        const bytes = await chunkToUint8Array(slice);
        await fileHandle.write(bytes);

        const currentLoaded = Math.min(offset + slice.size, totalBytes);
        tracker?.update(currentLoaded);
      }
    } finally {
      await fileHandle.close();
    }

    tracker?.finish(`Файл сохранён: ${selectedPath}`);
    showSaveNotification({
      type: 'success',
      title: 'Файл успешно сохранён',
      message: `Файл сохранён по пути: ${selectedPath}`,
    });
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    tracker?.error(errMsg);
    showSaveNotification({
      type: 'error',
      title: 'Ошибка сохранения файла',
      message: `Не удалось сохранить «${safeFilename}»: ${errMsg}`,
    });
    throw err;
  }
}

/**
 * Universal file saving function working across Web, Capacitor, and Tauri.
 *
 * @param blob Binary data of the file to save
 * @param filename Default filename or path
 * @param mime MIME type (e.g., 'audio/mpeg', 'audio/webm', 'application/zip', 'text/markdown')
 */
export async function saveFile(blob: Blob, filename: string, mime: string): Promise<void> {
  try {
    if (isCapacitorPlatform()) {
      await saveViaCapacitor(blob, filename, mime);
      return;
    }

    if (isTauriPlatform()) {
      await saveViaTauri(blob, filename, mime);
      return;
    }

    // Default: Web browser environment
    saveViaWeb(blob, filename);
  } catch (error: any) {
    console.error(`[saveFile] Error saving file "${filename}":`, error);
    throw error;
  }
}
