/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  enabled: boolean;
  notes?: string;
  tags?: string[];
}

export interface QuestionBlock {
  id: string;
  title: string;
  description: string;
  colorToken: 'amber' | 'teal' | 'violet' | 'slate' | 'terracotta';
  enabled: boolean;
  questions: Question[];
}

export interface Questionnaire {
  id: string;
  title: string;
  blocks: QuestionBlock[];
  createdAt: string;
}

export interface PromptPack {
  id: string;
  title: string;
  stage: 'decryption' | 'linguistic' | 'fieldwork' | 'postprocess';
  modelTarget: 'google-ai-studio' | 'qwen' | 'deepseek' | 'universal';
  description: string;
  promptText: string;
  caution?: string;
  tags: string[];
}

export interface ModelGuide {
  id: string;
  modelName: 'google-ai-studio' | 'qwen' | 'deepseek';
  title: string;
  recommendedModel: string;
  steps: string[];
  tips: string[];
  workflow: string;
}

export interface InformantScenario {
  id: string;
  title: string;
  situation: string;
  wrongReaction: string;
  rightReaction: string;
  recommendedPrompts: string[];
  ethicsNotes: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  tags: string[]; // e.g. 'belarusian', 'russian', 'polish', 'trasianka', 'code_switching', 'mixed_home_speech', 'generation_older'
  analysisNotes?: string;
}

export type BelarusLinguisticTag =
  | 'belarusian'
  | 'russian'
  | 'polish'
  | 'trasianka'
  | 'code_switching'
  | 'mixed_home_speech'
  | 'generation_older'
  | 'generation_younger'
  | 'religious_register'
  | 'official_register'
  | 'village_speech'
  | 'urban_shift';
