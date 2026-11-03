/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TranscriptSegment } from '../types';

export type InterviewFormat = 'timecode_speaker' | 'export_format' | 'speaker_only' | 'bullet_dialog' | 'plain';

/**
 * Checks if a line opens a new speaking turn (replica).
 * If it matches, we parse out metadata like speaker name, language, and timecode.
 */
interface ParsedTurnHeader {
  speaker: string;
  timecode?: string;
  speakerLang?: string;
  cleanText: string;
}

// Regex cases
const REGEX_TIMECODE_SPEAKER = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^:]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.*)$/;
const REGEX_TIMECODE_SPEAKER_NO_BRACKETS = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]+?)(?:\s*\(([^)]+)\))?\s*:\s*(.*)$/;
const REGEX_EXPORT_FORMAT = /^([^:]+?)\s*\[Реплика\s+#\d+\](?:\s*\(([^)]+)\))?\s*:\s*(.*)$/;
const REGEX_SPEAKER_ONLY = /^([A-ZА-ЯЁІЎa-zа-яёіў\d\s.()"-]{2,40})(?:\s*\(([^)]+)\))?\s*:\s*(.*)$/;
const REGEX_BULLET_DIALOG = /^[-—–]\s*(.*)$/;

export function parseTurnHeader(line: string): ParsedTurnHeader | null {
  // 1. Export format: "Информант [Реплика #1] (Трасянка): Текст"
  let match = line.match(REGEX_EXPORT_FORMAT);
  if (match) {
    return {
      speaker: match[1].trim(),
      speakerLang: match[2]?.trim(),
      cleanText: match[3].trim()
    };
  }

  // 2. Timecode + Speaker: "[08:14] Спикер 1 (Русский): Текст"
  match = line.match(REGEX_TIMECODE_SPEAKER);
  if (match) {
    return {
      timecode: match[1].trim(),
      speaker: match[2].trim(),
      speakerLang: match[3]?.trim(),
      cleanText: match[4].trim()
    };
  }

  // 3. Timecode + Speaker without brackets: "08:14 Спикер 1 (Русский): Текст"
  match = line.match(REGEX_TIMECODE_SPEAKER_NO_BRACKETS);
  if (match) {
    return {
      timecode: match[1].trim(),
      speaker: match[2].trim(),
      speakerLang: match[3]?.trim(),
      cleanText: match[4].trim()
    };
  }

  // 4. Speaker only: "Интервьюер: Текст" or "Вера Ивановна (беларуская): Текст"
  // To avoid false positives on mid-sentence colons, we check that speaker name doesn't contain common punctuation 
  // and starts on a capitalized letter or number.
  match = line.match(REGEX_SPEAKER_ONLY);
  if (match) {
    const potentialSpeaker = match[1].trim();
    // Exclude if it looks like a sentence starting (contains too many words or lowercase)
    const words = potentialSpeaker.split(/\s+/);
    const isTooLong = words.length > 5;
    const hasForbiddenChars = /[?,.!;]/g.test(potentialSpeaker);
    
    if (!isTooLong && !hasForbiddenChars) {
      return {
        speaker: potentialSpeaker,
        speakerLang: match[2]?.trim(),
        cleanText: match[3].trim()
      };
    }
  }

  // 5. Bullet dialog layout: "- Дзедка, а куды ісці?" or "— А вунь туды."
  match = line.match(REGEX_BULLET_DIALOG);
  if (match) {
    return {
      speaker: 'Собеседник', // default dialog participant
      cleanText: match[1].trim()
    };
  }

  return null;
}

/**
 * Detects the dominant format of the raw text for better parser feedback
 */
export function detectFormat(text: string): InterviewFormat {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).slice(0, 30);
  if (lines.length === 0) return 'plain';

  let countTimecode = 0;
  let countExport = 0;
  let countSpeakerOnly = 0;
  let countBullets = 0;

  for (const line of lines) {
    if (REGEX_EXPORT_FORMAT.test(line)) countExport++;
    else if (REGEX_TIMECODE_SPEAKER.test(line) || REGEX_TIMECODE_SPEAKER_NO_BRACKETS.test(line)) countTimecode++;
    else {
      const header = parseTurnHeader(line);
      if (header) {
        if (header.speaker === 'Собеседник' && REGEX_BULLET_DIALOG.test(line)) countBullets++;
        else countSpeakerOnly++;
      }
    }
  }

  const threshold = Math.min(5, Math.ceil(lines.length * 0.15));

  if (countExport > threshold) return 'export_format';
  if (countTimecode > threshold) return 'timecode_speaker';
  if (countBullets > threshold) return 'bullet_dialog';
  if (countSpeakerOnly > threshold) return 'speaker_only';

  return 'plain';
}

/**
 * Offline rule-based tagger for sociological/linguistic annotation on Belarusian bilingualism
 * and other linguistic traits.
 */
export function offlineRuleTagger(text: string, speaker: string, speakerLang?: string): string[] {
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerSpeaker = speaker.toLowerCase();

  // Speaker-based heuristics
  if (lowerSpeaker.includes('интервьюер') || lowerSpeaker.includes('исследователь')) {
    tags.push('official_register');
  }
  if (lowerSpeaker.includes('бабушка') || lowerSpeaker.includes('дедушка') || lowerSpeaker.includes('бабка') || lowerSpeaker.includes('дзядуля') || lowerSpeaker.includes('бабуля') || lowerSpeaker.includes('старик') || lowerSpeaker.includes('старуха')) {
    tags.push('generation_older');
    tags.push('village_speech');
  }
  if (lowerSpeaker.includes('внук') || lowerSpeaker.includes('внучка') || lowerSpeaker.includes('студент') || lowerSpeaker.includes('школьник')) {
    tags.push('generation_younger');
  }

  // Language parameter heuristics
  if (speakerLang) {
    const lang = speakerLang.toLowerCase();
    if (lang.includes('белар') || lang.includes('by') || lang.includes('bel')) {
      tags.push('belarusian');
    }
    if (lang.includes('трас') || lang.includes('tras')) {
      tags.push('trasianka');
    }
    if (lang.includes('рус') || lang.includes('ru')) {
      tags.push('russian');
    }
    if (lang.includes('поль') || lang.includes('pl')) {
      tags.push('polish');
    }
  }

  // Alphabet check
  const hasBelarusianChars = /[іўІЎ]/.test(text) || (/[ыеёа-яа-яёіў]/i.test(text) && !/[иъщыэ]/i.test(text) && /[яеёркамынст]/i.test(text)); // Approximate check for pure BY
  const hasRussianChars = /[иыэъщ]/i.test(text);
  const hasPolishChars = /[łąęśćźżółńŁĄĘŚĆŹŻÓŃ]/i.test(text);
  const hasEnglishChars = /[a-zA-Z]/.test(text);
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(text);

  // Core Belarusian words
  const beWords = /\b(гэта|яны|быў|ёсць|дзякуй|але|калі|яшчэ|вельмі|размаўляць|добра|маці|бацька|мова|краіна|што|як|дзе|куды)\b/i;
  // Belarusian orthography or dialect markers
  const trasiankaWords = /\b(пайшоўшы|здзелаў|прышоў|каторы|шчыра|дзяк|новы|плошча|картошка|бульба)\b/i;
  // Local dialect / field vocabulary ("полонизмы", village speech)
  const villageWords = /\b(цэбар|калейка|трэба|ровар|пацера|хата|дзедка|бабка|чуваць|кошык|капліца|касцёл|кляштар|гаспадар|бульбаш|парабак|пан|рэч)\b/i;
  // Polish typical vocab
  const plWords = /\b(kościół|dzisiaj|pan|pani|bardzo|tak|nie|dobrze|dziękuję|dzień|jutro)\b/i;

  if (hasChineseChars) {
    tags.push('code_switching');
  }
  if (hasEnglishChars && (hasRussianChars || hasBelarusianChars)) {
    tags.push('code_switching');
  }

  // Determine language tag
  if (hasBelarusianChars || beWords.test(lowerText)) {
    if (hasRussianChars) {
      if (!tags.includes('trasianka')) tags.push('trasianka');
      if (!tags.includes('code_switching')) tags.push('code_switching');
    } else {
      if (!tags.includes('belarusian')) tags.push('belarusian');
    }
  } else if (hasPolishChars || plWords.test(lowerText)) {
    if (!tags.includes('polish')) tags.push('polish');
    if (!tags.includes('code_switching') && (hasRussianChars || hasBelarusianChars)) tags.push('code_switching');
  } else if (hasRussianChars) {
    if (!tags.includes('russian')) tags.push('russian');
  }

  // Dialect / Village features
  if (villageWords.test(lowerText)) {
    if (!tags.includes('village_speech')) tags.push('village_speech');
  }

  // Trasianka markers
  if (trasiankaWords.test(lowerText)) {
    if (!tags.includes('trasianka')) tags.push('trasianka');
    if (!tags.includes('code_switching')) tags.push('code_switching');
  }

  // Code switching defaults
  if (tags.includes('belarusian') && tags.includes('russian')) {
    if (!tags.includes('code_switching')) tags.push('code_switching');
  }

  // Avoid empty tags
  if (tags.length === 0) {
    tags.push('russian'); // Default fallback based on region usage
  }

  return Array.from(new Set(tags));
}

/**
 * Universal robust interview parser that handles hard-wrapped text, multi-line replicas,
 * timecodes, and merges paragraphs correctly.
 */
export function parseInterview(text: string): TranscriptSegment[] {
  if (!text || text.trim().length === 0) return [];

  const rawLines = text.split('\n');
  const segments: TranscriptSegment[] = [];

  let currentSegment: TranscriptSegment | null = null;
  let seqId = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (line.length === 0) continue;

    // Check if line starts a new speaking turn (replica)
    const turnHeader = parseTurnHeader(line);

    if (turnHeader) {
      // If we have a previous active segment, push it first
      if (currentSegment) {
        // Run rule tagger offline
        currentSegment.tags = offlineRuleTagger(currentSegment.text, currentSegment.speaker, currentSegment.analysisNotes);
        segments.push(currentSegment);
      }

      seqId++;
      let metaNotes = '';
      if (turnHeader.timecode && turnHeader.speakerLang) {
        metaNotes = `[${turnHeader.timecode}] [${turnHeader.speakerLang}]`;
      } else if (turnHeader.timecode) {
        metaNotes = `[${turnHeader.timecode}]`;
      } else if (turnHeader.speakerLang) {
        metaNotes = `[${turnHeader.speakerLang}]`;
      }

      currentSegment = {
        id: `seg-${Date.now()}-${seqId}-${Math.random().toString(36).substr(2, 5)}`,
        speaker: turnHeader.speaker,
        text: turnHeader.cleanText,
        tags: [],
        analysisNotes: metaNotes ? metaNotes : undefined
      };
    } else {
      // It is a continuation of the previous replica (hard-wrap or new paragraph in same turn)
      if (currentSegment) {
        // If it starts with punctuation, don't put a space (though normally we do)
        const gap = /^[.,!?;:]/.test(line) ? '' : ' ';
        currentSegment.text += gap + line;
      } else {
        // Fallback for lines before any speaker has been detected
        seqId++;
        currentSegment = {
          id: `seg-${Date.now()}-${seqId}-${Math.random().toString(36).substr(2, 5)}`,
          speaker: 'Информант',
          text: line,
          tags: []
        };
      }
    }
  }

  // Push final segment if any
  if (currentSegment) {
    currentSegment.tags = offlineRuleTagger(currentSegment.text, currentSegment.speaker, currentSegment.analysisNotes);
    segments.push(currentSegment);
  }

  // Second pass: Clean double spaces and line-break structures
  return segments.map(seg => {
    seg.text = seg.text.replace(/\s+/g, ' ').trim();
    return seg;
  });
}
