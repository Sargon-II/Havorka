/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getKV, setKV } from './db';

const memoryCache = new Map<string, any>();
const listeners = new Set<(key: string, value: any) => void>();

function notifyListeners(key: string, value: any) {
  listeners.forEach((listener) => listener(key, value));
}

/**
 * React hook that persists state into IndexedDB (kv store).
 * Prevents UI flickering using an in-memory cache and synchronization bus.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => Promise<void>, boolean] {
  const [state, setStateInternal] = useState<T>(() => {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }
    // Safe pre-load from localStorage if available before IDB resolves
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            return JSON.parse(raw);
          } catch {
            return raw as unknown as T;
          }
        }
      } catch {
        // ignore
      }
    }
    return initialValue;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!memoryCache.has(key));
  const isMountedRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    isMountedRef.current = true;

    // Load from IndexedDB
    let isCancelled = false;
    getKV<T>(key)
      .then((stored) => {
        if (!isCancelled && isMountedRef.current) {
          if (stored !== undefined) {
            memoryCache.set(key, stored);
            setStateInternal(stored);
          } else if (memoryCache.has(key)) {
            setStateInternal(memoryCache.get(key));
          } else {
            memoryCache.set(key, stateRef.current);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn(`[usePersistentState] Error loading key "${key}":`, err);
        if (!isCancelled && isMountedRef.current) {
          setIsLoading(false);
        }
      });

    // Listen for changes from other hook instances with the same key
    const onKeyChange = (changedKey: string, newValue: any) => {
      if (changedKey === key && isMountedRef.current) {
        setStateInternal(newValue);
      }
    };
    listeners.add(onKeyChange);

    return () => {
      isCancelled = true;
      isMountedRef.current = false;
      listeners.delete(onKeyChange);
    };
  }, [key]);

  const setValue = useCallback(
    async (valueOrUpdater: T | ((prev: T) => T)) => {
      const nextValue =
        typeof valueOrUpdater === 'function'
          ? (valueOrUpdater as (prev: T) => T)(stateRef.current)
          : valueOrUpdater;

      stateRef.current = nextValue;
      memoryCache.set(key, nextValue);
      setStateInternal(nextValue);
      notifyListeners(key, nextValue);

      try {
        await setKV(key, nextValue);
      } catch (err) {
        console.error(`[usePersistentState] Failed to save key "${key}" to IndexedDB:`, err);
      }
    },
    [key]
  );

  return [state, setValue, isLoading];
}
