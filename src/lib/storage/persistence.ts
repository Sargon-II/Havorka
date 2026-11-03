/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StoragePersistenceStatus {
  supported: boolean;
  persisted: boolean;
  quota?: number;
  usage?: number;
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage Persistence] navigator.storage.persist() returned: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Storage Persistence] Error requesting storage persistence:', err);
      return false;
    }
  }
  return false;
}

export async function getStoragePersistenceStatus(): Promise<StoragePersistenceStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false };
  }

  try {
    const isPersisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    let quota: number | undefined;
    let usage: number | undefined;

    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota;
      usage = estimate.usage;
    }

    return {
      supported: true,
      persisted: isPersisted,
      quota,
      usage,
    };
  } catch (err) {
    console.warn('[Storage Persistence] Error getting persistence status:', err);
    return { supported: false, persisted: false };
  }
}
