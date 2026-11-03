/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
 * Detect file extension from MIME type for audio recordings
 */
export function getAudioExtension(mimeType?: string): string {
  if (!mimeType) return 'mp3';
  const lower = mimeType.toLowerCase();
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'mp4';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  return 'mp3';
}

/**
 * Convert Blob to Base64 string (without data URL scheme prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob as Base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Standard Web download using an <a> element with download attribute
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
 * Capacitor native saving: writes file to cache directory and triggers native Share sheet
 */
async function saveViaCapacitor(blob: Blob, filename: string, mime: string): Promise<void> {
  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;
  const base64 = await blobToBase64(blob);

  // Literal dynamic import of @capacitor/filesystem (code-split into separate chunk)
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  const writeResult = await Filesystem.writeFile({
    path: safeFilename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  // Literal dynamic import of @capacitor/share (code-split into separate chunk)
  const { Share } = await import('@capacitor/share');

  await Share.share({
    title: safeFilename,
    text: safeFilename,
    url: writeResult.uri,
    dialogTitle: 'Сохранить или экспортировать файл',
  });
}

/**
 * Tauri native saving: opens native Save File Dialog and writes bytes using @tauri-apps/plugin-fs
 */
async function saveViaTauri(blob: Blob, filename: string, mime: string): Promise<void> {
  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;

  // Literal dynamic import of @tauri-apps/plugin-dialog (code-split into separate chunk)
  const { save } = await import('@tauri-apps/plugin-dialog');

  const selectedPath = await save({
    defaultPath: safeFilename,
  });

  // User cancelled the save dialog
  if (!selectedPath) {
    return;
  }

  // Literal dynamic import of @tauri-apps/plugin-fs (code-split into separate chunk)
  const { writeFile } = await import('@tauri-apps/plugin-fs');

  const buffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  await writeFile(selectedPath, uint8);
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
    const userMessage = error?.message || String(error);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(`Не удалось сохранить файл "${filename}".\n\nПричина: ${userMessage}`);
    }
    throw error;
  }
}
