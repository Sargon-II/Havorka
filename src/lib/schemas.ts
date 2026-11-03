/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const questionnaireSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Название опросника" },
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Заголовок блока, например 'Блок 1: Языковая биография'" },
          description: { type: "STRING", description: "Краткое описание блока" },
          colorToken: { type: "STRING", description: "Цветовой маркер: amber, teal, violet, slate, or terracotta" },
          questions: {
            type: "ARRAY",
            items: { type: "STRING", description: "Текст вопроса" }
          }
        },
        required: ["title", "questions"]
      }
    }
  },
  required: ["blocks"]
} as const;

export const linguisticSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "Краткий вывод о языковой ситуации информанта" },
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          speaker: { type: "STRING", description: "Имя или ярлык говорящего" },
          text: { type: "STRING", description: "Текст реплики" },
          tags: {
            type: "ARRAY",
            items: { type: "STRING", description: "Теги, например: trasianka, code_switching, russian, belarusian, polish, mixed_home_speech, generation_older" }
          },
          analysis: { type: "STRING", description: "Лингвистические комментарии: особенности произношения, заимствования, лексика" }
        },
        required: ["speaker", "text", "tags"]
      }
    },
    biography: {
      type: "OBJECT",
      properties: {
        primaryLanguage: { type: "STRING", description: "Основной язык" },
        homeLanguage: { type: "STRING", description: "Язык общения в семье" },
        generationalPattern: { type: "STRING", description: "Поколенческий паттерн языка" },
        trasiankaUsage: { type: "STRING", description: "Использование трасянки или смешанной речи" },
        codeSwitchingNotes: { type: "STRING", description: "Особенности переключения кодов" }
      }
    }
  },
  required: ["summary", "segments"]
} as const;
