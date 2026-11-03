/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';

export const getClient = (): GoogleGenAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    // Gracefully dispatch event to open the non-blocking API key modal in the UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-api-key-gate'));
    }
    throw new Error('API_KEY_MISSING');
  }
  return new GoogleGenAI({ apiKey });
};

export interface AnalyzeRequest {
  action?: string;
  text?: string;
  prompt: string;
  schemaType?: 'questionnaire' | 'linguistic';
  audio?: {
    data: string; // Base64 chunk
    mimeType: string;
  };
}

export const generateText = async (req: AnalyzeRequest): Promise<string> => {
  const apiKey = getApiKey();

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {})
      },
      body: JSON.stringify({
        action: req.action,
        text: req.text,
        prompt: req.prompt,
        schemaType: req.schemaType,
        userApiKey: apiKey,
        audio: req.audio
      })
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        throw new Error(`HTTP_ERROR_${response.status}`);
      }
      throw new Error(errorData.message || errorData.error || 'GEMINI_API_ERROR');
    }

    const data = await response.json();
    return data.result || '';
  } catch (error: any) {
    console.error('Error calling proxy API:', error);
    throw error;
  }
};
