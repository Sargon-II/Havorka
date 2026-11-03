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

  // Dynamic import of @capacitor/filesystem
  const fsModuleName = '@capacitor/filesystem';
  const { Filesystem, Directory } = await import(/* @vite-ignore */ fsModuleName);

  const writeResult = await Filesystem.writeFile({
    path: safeFilename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  // Dynamic import of @capacitor/share
  const shareModuleName = '@capacitor/share';
  const { Share } = await import(/* @vite-ignore */ shareModuleName);

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

  // Dynamic import of @tauri-apps/plugin-dialog
  const dialogModuleName = '@tauri-apps/plugin-dialog';
  const { save } = await import(/* @vite-ignore */ dialogModuleName);

  const selectedPath = await save({
    defaultPath: safeFilename,
  });

  // User cancelled the save dialog
  if (!selectedPath) {
    return;
  }

  // Dynamic import of @tauri-apps/plugin-fs
  const fsModuleName = '@tauri-apps/plugin-fs';
  const { writeFile } = await import(/* @vite-ignore */ fsModuleName);

  const buffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  await writeFile(selectedPath, uint8);
}

/**
 * Universal file saving function working across Web, Capacitor, and Tauri.
 *
 * @param blob Binary data of the file to save
 * @param filename Default filename or path
 * @param mime MIME type (e.g., 'audio/mpeg', 'application/zip', 'text/markdown')
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
