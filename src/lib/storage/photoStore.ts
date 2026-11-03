/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDB, getKV, setKV } from './db';

export interface CulturalPhotoMeta {
  id: string;
  category: 'utensils' | 'buildings' | 'costume' | 'inventory' | 'other';
  title: string;
  age: string;
  description: string;
  timestamp: string;
  createdAt?: number;
}

const PHOTOS_META_KV_KEY = 'field_cultural_photos_meta';
const PHOTOS_LEGACY_LOCALSTORAGE_KEY = 'field_cultural_photos';
const PHOTOS_MIGRATED_FLAG = 'havorka_photos_migrated_v2';

/**
 * Saves a photo Blob directly to IndexedDB photos object store
 */
export async function savePhotoBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put('photos', {
    id,
    blob,
    mimeType: blob.type || 'image/jpeg',
    createdAt: Date.now(),
  });
}

/**
 * Retrieves a photo Blob from IndexedDB
 */
export async function getPhotoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    const record = await db.get('photos', id);
    return record?.blob || null;
  } catch (err) {
    console.error(`[photoStore] Error retrieving photo ${id}:`, err);
    return null;
  }
}

/**
 * Deletes a photo Blob from IndexedDB
 */
export async function deletePhotoBlob(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('photos', id);
  } catch (err) {
    console.error(`[photoStore] Error deleting photo ${id}:`, err);
  }
}

/**
 * Loads HTMLImageElement from a URL or object URL
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for processing: ' + e));
    img.src = url;
  });
}

/**
 * Resizes an image so the long side does not exceed 1600 px,
 * and encodes it as a high-quality JPEG Blob (quality 0.8).
 */
export async function processImageTo1600JpegBlob(
  source: Blob | string
): Promise<{ blob: Blob; width: number; height: number }> {
  let img: HTMLImageElement;
  let urlToRevoke: string | null = null;

  if (typeof source === 'string') {
    img = await loadImageFromUrl(source);
  } else {
    urlToRevoke = URL.createObjectURL(source);
    img = await loadImageFromUrl(urlToRevoke);
  }

  try {
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    // Calculate scaled dimensions (max long edge 1600 px)
    const maxEdge = 1600;
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (origWidth > maxEdge || origHeight > maxEdge) {
      if (origWidth >= origHeight) {
        targetWidth = maxEdge;
        targetHeight = Math.max(1, Math.round((origHeight * maxEdge) / origWidth));
      } else {
        targetHeight = maxEdge;
        targetWidth = Math.max(1, Math.round((origWidth * maxEdge) / origHeight));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to encode image to JPEG blob'));
        },
        'image/jpeg',
        0.8
      );
    });

    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    if (urlToRevoke) {
      URL.revokeObjectURL(urlToRevoke);
    }
  }
}

/**
 * Converts a base64 data URL string to a standard Blob
 */
export async function base64DataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Reads photo metadata array from IndexedDB kv store
 */
export async function getStoredCulturalPhotosMeta(): Promise<CulturalPhotoMeta[]> {
  const meta = await getKV<CulturalPhotoMeta[]>(PHOTOS_META_KV_KEY);
  return meta || [];
}

/**
 * Saves photo metadata array to IndexedDB kv store
 */
export async function saveStoredCulturalPhotosMeta(meta: CulturalPhotoMeta[]): Promise<void> {
  await setKV(PHOTOS_META_KV_KEY, meta);
}

/**
 * Requirement 3: Migrates existing field_cultural_photos from localStorage to IndexedDB.
 * Does not delete the old key until all blobs and metadata are successfully written and read back.
 */
export async function migrateLegacyPhotosFromLocalStorage(): Promise<CulturalPhotoMeta[] | null> {
  if (typeof window === 'undefined') return null;

  // Check if already migrated
  const alreadyMigrated = await getKV<boolean>(PHOTOS_MIGRATED_FLAG);
  if (alreadyMigrated) {
    return null;
  }

  const raw = localStorage.getItem(PHOTOS_LEGACY_LOCALSTORAGE_KEY);
  if (!raw) {
    await setKV(PHOTOS_MIGRATED_FLAG, true);
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      await setKV(PHOTOS_MIGRATED_FLAG, true);
      return null;
    }

    console.log(`[photoStore] Migrating ${parsed.length} photos from localStorage to IndexedDB...`);
    const migratedMeta: CulturalPhotoMeta[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const photoId = item.id || `photo_migrated_${i}_${Date.now()}`;

      if (item.imgData) {
        // Convert base64 to 1600px JPEG Blob
        const originalBlob = await base64DataUrlToBlob(item.imgData);
        const { blob: jpegBlob } = await processImageTo1600JpegBlob(originalBlob);

        // Store Blob in IndexedDB photos store
        await savePhotoBlob(photoId, jpegBlob);

        // Verify write
        const readBack = await getPhotoBlob(photoId);
        if (!readBack || readBack.size === 0) {
          throw new Error(`Verification failed for migrated photo blob: ${photoId}`);
        }
      }

      // Add clean metadata record without imgData
      migratedMeta.push({
        id: photoId,
        category: item.category || 'utensils',
        title: item.title || 'Предмет материальной культуры',
        age: item.age || 'неизвестно',
        description: item.description || '',
        timestamp: item.timestamp || '',
        createdAt: item.createdAt || Date.now(),
      });
    }

    // Save metadata array in IndexedDB kv store
    await saveStoredCulturalPhotosMeta(migratedMeta);

    // Verify metadata array
    const verifiedMeta = await getStoredCulturalPhotosMeta();
    if (!verifiedMeta || verifiedMeta.length !== migratedMeta.length) {
      throw new Error('Verification failed for photo metadata in IndexedDB');
    }

    // Set migration flag and remove old key only after new data is verified
    await setKV(PHOTOS_MIGRATED_FLAG, true);
    localStorage.removeItem(PHOTOS_LEGACY_LOCALSTORAGE_KEY);
    console.log(`[photoStore] Successfully migrated ${migratedMeta.length} photos to IndexedDB and cleared old localStorage key.`);

    return migratedMeta;
  } catch (err) {
    console.error('[photoStore] Migration from localStorage failed:', err);
    return null;
  }
}
