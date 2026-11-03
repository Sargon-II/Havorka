/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const KEY_STORAGE = 'user_gemini_api_key';

export const getApiKey = (): string | null =>
  localStorage.getItem(KEY_STORAGE);

export const setApiKey = (key: string): void =>
  localStorage.setItem(KEY_STORAGE, key.trim());

export const clearApiKey = (): void =>
  localStorage.removeItem(KEY_STORAGE);

export const hasApiKey = (): boolean => !!getApiKey();
