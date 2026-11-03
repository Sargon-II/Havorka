/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface AudioGap {
  startTime: number;
  endTime?: number;
  reason:
    | 'track_muted'
    | 'track_ended'
    | 'silence_detected'
    | 'device_changed'
    | 'visibility_hidden'
    | 'recorder_crashed'
    | 'manual_pause';
}

export interface AudioSegmentMeta {
  segmentIndex: number;
  startTime: number;
  startOffsetMs: number;
  endTime?: number;
  chunksCount: number;
  mimeType?: string;
}

export interface SessionRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: 'recording' | 'paused' | 'interrupted' | 'completed';
  informant: string;
  location: string;
  date: string;
  researcher: string;
  segments: AudioSegmentMeta[];
  gaps: AudioGap[];
  questionStatuses?: Record<string, string>;
  questionNotes?: Record<string, string>;
  questionMarkedTimes?: Record<string, number>;
  culturalPhotos?: any[];
}

export interface AudioChunkRecord {
  sessionId: string;
  segmentIndex: number;
  chunkIndex: number;
  data: Blob;
  timestamp: number;
}

export interface EtnofieldDB extends DBSchema {
  kv: {
    key: string;
    value: any;
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: {
      'by_status': string;
      'by_updated': number;
    };
  };
  audioChunks: {
    key: [string, number, number]; // [sessionId, segmentIndex, chunkIndex]
    value: AudioChunkRecord;
    indexes: {
      'by_session': string;
      'by_session_segment': [string, number];
    };
  };
}

const DB_NAME = 'etnofield_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<EtnofieldDB>> | null = null;

export const getDB = (): Promise<IDBPDatabase<EtnofieldDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<EtnofieldDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Key-Value store
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }

        // 2. Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by_status', 'status');
          sessionStore.createIndex('by_updated', 'updatedAt');
        }

        // 3. Audio Chunks store
        if (!db.objectStoreNames.contains('audioChunks')) {
          const chunkStore = db.createObjectStore('audioChunks', {
            keyPath: ['sessionId', 'segmentIndex', 'chunkIndex'],
          });
          chunkStore.createIndex('by_session', 'sessionId');
          chunkStore.createIndex('by_session_segment', ['sessionId', 'segmentIndex']);
        }
      },
    });
  }
  return dbPromise;
};

// Generic KV helpers
export async function getKV<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('kv', key);
}

export async function setKV<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('kv', value, key);
}

export async function deleteKV(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('kv', key);
}
