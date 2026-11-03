/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getKV, setKV } from './db';

const MIGRATION_FLAG = 'havorka_storage_migrated_v1';

export const KEYS_TO_MIGRATE = [
  'field_diary',
  'linguistic_history_facet',
  'linguistic_segments_facet',
  'linguistic_spans_facet',
  'linguistic_facets_facet',
  'linguistic_speakers_facet',
  'linguistic_meta_facet',
  'custom_prompt_packs',
  'questionnaire_active_mode',
  'field_session_informant',
  'field_session_location',
  'field_session_date',
  'researcher_name',
  'field_session_statuses',
  'field_session_notes',
  'field_session_marked_times',
  'field_cultural_photos',
  'sociologist_questionnaire',
  'app_lang',
  'app_font_size',
  'app_font_weight',
];

export async function migrateLocalStorageToIDB(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Check if already migrated
  const flagInStorage = localStorage.getItem(MIGRATION_FLAG);
  const flagInIDB = await getKV<boolean>(MIGRATION_FLAG);
  if (flagInStorage === 'true' || flagInIDB) {
    return false;
  }

  try {
    const keysMigrated: string[] = [];

    for (const key of KEYS_TO_MIGRATE) {
      // NEVER migrate API key
      if (key === 'user_gemini_api_key') continue;

      const raw = localStorage.getItem(key);
      if (raw !== null) {
        let parsed: any = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }

        // Write to IndexedDB
        await setKV(key, parsed);

        // Read back to verify
        const readBack = await getKV(key);
        if (readBack === undefined && parsed !== undefined) {
          throw new Error(`Migration verification failed for key: ${key}`);
        }

        keysMigrated.push(key);
      }
    }

    // Set migration completion flag only after all keys are verified
    localStorage.setItem(MIGRATION_FLAG, 'true');
    await setKV(MIGRATION_FLAG, true);
    console.log(`[Storage Migration] Successfully migrated ${keysMigrated.length} keys to IndexedDB:`, keysMigrated);
    return true;
  } catch (err) {
    console.error('[Storage Migration] Error during migration to IndexedDB:', err);
    return false;
  }
}
