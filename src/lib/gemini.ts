/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getApiKey } from './apiKey';
import { questionnaireSchema, linguisticSchema } from './schemas';

export const getClient = (overrideKey?: string): GoogleGenAI => {
  const apiKey = (overrideKey || getApiKey() || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
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
  userApiKey?: string;
  audio?: {
    data: string; // Base64 chunk
    mimeType: string;
  };
}

export const generateText = async (req: AnalyzeRequest): Promise<string> => {
  const apiKey = (req.userApiKey || getApiKey() || '').trim();

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-api-key-gate'));
    }
    throw new Error('API_KEY_MISSING');
  }

  const ai = new GoogleGenAI({ apiKey });

  if (!req.text && !req.audio && !req.prompt) {
    throw new Error('MISSING_CONTENT: Отсутствует текст или аудио файл для анализа.');
  }

  let finalPrompt = req.prompt || 'Проанализируй данный текст.';
  let responseMimeType: string | undefined = undefined;
  let responseSchema: any = undefined;
  let temperature: number | undefined = undefined;

  if (req.schemaType === 'questionnaire') {
    responseMimeType = 'application/json';
    responseSchema = questionnaireSchema;
    temperature = 0.2;
  } else if (req.schemaType === 'linguistic') {
    responseMimeType = 'application/json';
    responseSchema = linguisticSchema;
    temperature = 0.2;
  }

  const contents: any[] = [{ text: finalPrompt }];

  if (req.audio && req.audio.data && req.audio.mimeType) {
    // Check if base64 size > ~15 MB (approx. 20,000,000 characters)
    const approximateBytes = (req.audio.data.length * 3) / 4;
    const isLargeAudio = approximateBytes > 15 * 1024 * 1024;

    if (isLargeAudio) {
      try {
        const binaryString = atob(req.audio.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: req.audio.mimeType });
        const uploadResult = await ai.files.upload({
          file: blob,
          config: {
            mimeType: req.audio.mimeType
          }
        });

        contents.push({
          fileData: {
            fileUri: uploadResult.uri,
            mimeType: uploadResult.mimeType || req.audio.mimeType
          }
        });
      } catch (uploadError) {
        console.warn('Files API upload failed, falling back to inlineData:', uploadError);
        contents.push({
          inlineData: {
            data: req.audio.data,
            mimeType: req.audio.mimeType
          }
        });
      }
    } else {
      contents.push({
        inlineData: {
          data: req.audio.data,
          mimeType: req.audio.mimeType
        }
      });
    }
  } else if (req.text) {
    contents.push({ text: `ДАННЫЕ ДЛЯ АНАЛИЗА:\n${req.text}` });
  }

  const config = responseMimeType
    ? {
        responseMimeType,
        responseSchema,
        temperature
      }
    : undefined;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config
    });
  } catch (primaryError: any) {
    const errMsg = String(primaryError?.message || primaryError).toLowerCase();
    const isTransient =
      errMsg.includes('503') ||
      errMsg.includes('unavailable') ||
      errMsg.includes('demand') ||
      errMsg.includes('limit') ||
      errMsg.includes('quota') ||
      errMsg.includes('overload') ||
      errMsg.includes('spike');

    if (isTransient) {
      console.warn(
        'Primary model gemini-3.5-flash overloaded/unavailable. Attempting fallback to gemini-3.1-flash-lite. Error was:',
        primaryError?.message
      );
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents,
        config
      });
    } else {
      throw primaryError;
    }
  }

  return response.text || '';
};
