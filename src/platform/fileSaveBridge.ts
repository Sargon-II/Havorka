/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerPlugin } from '@capacitor/core';

export interface FileSavePluginInterface {
  initTempFile(options: { filename: string }): Promise<{ tempFilePath: string }>;
  appendTempChunk(options: { tempFilePath: string; chunkBase64: string }): Promise<{ bytesWritten: number; totalSize: number }>;
  saveWithSAF(options: {
    tempFilePath: string;
    suggestedName: string;
    mimeType: string;
  }): Promise<{
    success?: boolean;
    cancelled?: boolean;
    uri?: string;
    displayName?: string;
    bytesWritten?: number;
  }>;
  shareTempFile(options: {
    tempFilePath: string;
    filename: string;
    mimeType: string;
    dialogTitle?: string;
  }): Promise<{ shared: boolean }>;
  cleanTempFile(options: { tempFilePath: string }): Promise<{ cleaned: boolean }>;
}

export const FileSave = registerPlugin<FileSavePluginInterface>('FileSave');
