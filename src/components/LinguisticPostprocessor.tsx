/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Check, 
  Download, 
  Tag, 
  Trash2, 
  Edit2, 
  AlertCircle, 
  FileUp, 
  Loader2, 
  Sparkles, 
  HelpCircle, 
  RefreshCw, 
  Layers,
  ChevronRight,
  Info,
  Plus,
  X,
  Key
} from 'lucide-react';
import { TranscriptSegment } from '../types';
import { parseInterview } from '../lib/parser';
import { parsePdfOnClient } from '../lib/pdfParser';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, AlignmentType, UnderlineType } from 'docx';
import JSZip from 'jszip';
import { Language, translations } from '../lib/translations';
import { gsap } from 'gsap';
import { getApiKey, clearApiKey } from '../lib/apiKey';

import {
  TAG_DEFINITIONS,
  BaseCodeType,
  RegisterType,
  ContactPhenomenonType,
  DiscourseType,
  SociolectType,
  SpeakerProfile,
  SpanAnnotation,
  TurnFacetAnnotation,
  tagsForRegion,
  validateFacetAnnotation,
  TagDefinition
} from '../lib/tag-schema';

interface HistoryItem {
  id: string;
  timestamp: string;
  metadata: {
    researcher: string;
    informantCode: string;
    location: string;
  };
  segments: TranscriptSegment[];
  spans: SpanAnnotation[];
  turnFacets: Record<string, TurnFacetAnnotation>;
  speakerProfiles: Record<string, SpeakerProfile>;
}

interface LinguisticPostprocessorProps {
  researcherName: string;
  onResearcherNameChange?: (name: string) => void;
  lang: Language;
}

export default function LinguisticPostprocessor({ researcherName, onResearcherNameChange, lang }: LinguisticPostprocessorProps) {
  // Traditional segments (turn text containers)
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [rawText, setRawText] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  
  // Metadata Passport
  const [metadata, setMetadata] = useState({
    researcher: researcherName,
    informantCode: 'В-78 Гродно',
    location: 'г. Гродно, Гродненская область',
  });

  // Faceted Annotation States
  const [turnFacets, setTurnFacets] = useState<Record<string, TurnFacetAnnotation>>({});
  const [spans, setSpans] = useState<SpanAnnotation[]>([]);
  const [speakerProfiles, setSpeakerProfiles] = useState<Record<string, SpeakerProfile>>({});

  // Active word selection trackers for span tagging (segmentId -> array of selected word indices)
  const [selectedWordIndices, setSelectedWordIndices] = useState<Record<string, number[]>>({});

  // Hovered definitional tooltip trace
  const [hoveredTagDef, setHoveredTagDef] = useState<TagDefinition | null>(null);

  // Segment editing states
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editSpeaker, setEditSpeaker] = useState('');
  const [editText, setEditText] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newSpeakerName, setNewSpeakerName] = useState('');

  // File uploading/loading state
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // History memory for past parsed transcripts
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  // Load static Grodno dialect material representing the realistic Eastern-European contact environment
  const loadGrodnoSample = () => {
    // 1. Text representing authentic regional Grodno dialect interactions
    const sampleText = `Вера Ивановна: Ой , дзеўчаткі , у нас тут говар быў просты , тутэйшы . Кожны дзень трэба было клямку на фортцы мацаваць , каб вецер не адчыніў . А бацька заўсёды па-польску маліўся , пацера адмаўляў перад абразом .
Интервьюер: А как к вам относились приезжие или молодёжь , которые в городском совете работали ?
Вера Ивановна: Дык прыехаў адзін малады начальнік і кажа : « Обращайтесь в установленном порядке в исполнительный комитет , мы рассмотрим ваше заявление » . А мы і слоў такіх не ведаем , у нас усё па-простаму .`;

    setRawText(sampleText);
    const parsed = parseInterview(sampleText);
    setSegments(parsed);

    if (parsed.length >= 3) {
      const id1 = parsed[0].id;
      const id2 = parsed[1].id;
      const id3 = parsed[2].id;

      // Seed default speaker passports (Sociolect is designated once)
      const defaultSpeakers: Record<string, SpeakerProfile> = {
        'Вера Ивановна': { speakerName: 'Вера Ивановна', sociolect: 'older_gen' },
        'Интервьюер': { speakerName: 'Интервьюер', sociolect: 'none' }
      };
      setSpeakerProfiles(defaultSpeakers);

      // Seed turn-level facets (Base Code & Registers)
      const defaultFacets: Record<string, TurnFacetAnnotation> = {
        [id1]: { segmentId: id1, baseCode: 'prosta', registers: ['colloquial', 'religious'] },
        [id2]: { segmentId: id2, baseCode: 'ru', registers: ['colloquial'] },
        [id3]: { segmentId: id3, baseCode: 'prosta', registers: ['colloquial', 'official'] }
      };
      setTurnFacets(defaultFacets);

      // Seed word level span annotations
      // segment 1 tokens:
      // "Ой" [0], "," [1], "дзеўчаткі" [2], "," [3], "у" [4], "нас" [5], "тут" [6], "говар" [7], "быў" [8], "просты" [9], "," [10], "тутэйшы" [11], "." [12], "Кожны" [13], "дзень" [14], "трэба" [15], "было" [16], "клямку" [17], "на" [18], "фортцы" [19], "мацаваць" [20], "," [21], "каб" [22], "вецер" [23], "не" [24], "адчыніў" [25], "." [26], "А" [27], "бацька" [28], "заўсёды" [29], "па-польску" [30], "маліўся" [31], "," [32], "пацера" [33], "адмаўляў" [34], "перад" [35], "абразом" [36], "." [37]
      const defaultSpans: SpanAnnotation[] = [
        {
          id: 'span-1',
          segmentId: id1,
          text: 'клямку',
          startChar: 17,
          endChar: 17,
          tagId: 'polonism',
          axis: 'contact',
          note: 'Польское klamka. Северо-западная лексическая кайма.'
        },
        {
          id: 'span-2',
          segmentId: id1,
          text: 'фортцы',
          startChar: 19,
          endChar: 19,
          tagId: 'polonism',
          axis: 'contact',
          note: 'Форточка, створка (польск. fortka).'
        },
        {
          id: 'span-3',
          segmentId: id1,
          text: 'пацера адмаўляў',
          startChar: 33,
          endChar: 34,
          tagId: 'polonism',
          axis: 'contact',
          note: 'Молитва (польск. pacierz).'
        },
        {
          id: 'span-4',
          segmentId: id3,
          text: 'Дык',
          startChar: 0,
          endChar: 0,
          tagId: 'marker',
          axis: 'discourse',
          note: 'Белорусский прагматический маркер.'
        },
        {
          id: 'span-5',
          segmentId: id3,
          text: 'Обращайтесь в установленном порядке в исполнительный комитет , мы рассмотрим ваше заявление',
          startChar: 8,
          endChar: 21,
          tagId: 'cs',
          axis: 'discourse',
          note: 'Межфразовое переключение в официальный деловой регистр.'
        }
      ];
      setSpans(defaultSpans);
    }
  };

  // Sync researcher name from props
  useEffect(() => {
    setMetadata(prev => {
      if (prev.researcher === researcherName) return prev;
      const next = { ...prev, researcher: researcherName };
      localStorage.setItem('linguistic_meta_facet', JSON.stringify(next));
      return next;
    });
  }, [researcherName]);

  // Load or generate initial state
  useEffect(() => {
    const savedSegments = localStorage.getItem('linguistic_segments_facet');
    const savedSpans = localStorage.getItem('linguistic_spans_facet');
    const savedFacets = localStorage.getItem('linguistic_facets_facet');
    const savedSpeakers = localStorage.getItem('linguistic_speakers_facet');
    const savedMeta = localStorage.getItem('linguistic_meta_facet');

    if (savedSegments && savedSpans && savedFacets && savedSpeakers) {
      try {
        setSegments(JSON.parse(savedSegments));
        setSpans(JSON.parse(savedSpans));
        setTurnFacets(JSON.parse(savedFacets));
        setSpeakerProfiles(JSON.parse(savedSpeakers));
        if (savedMeta) {
          const parsedMeta = JSON.parse(savedMeta);
          setMetadata({
            ...parsedMeta,
            researcher: researcherName || parsedMeta.researcher
          });
        }
      } catch (e) {
        console.error('Failed to parse saved state, loading Grodno defaults', e);
        loadGrodnoSample();
      }
    } else {
      loadGrodnoSample();
    }
  }, []);

  // Loaded or generate initial history state
  useEffect(() => {
    const savedHistory = localStorage.getItem('linguistic_history_facet');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse saved history, loading seed defaults', e);
      }
    } else {
      const seedHistory: HistoryItem[] = [
        {
          id: 'hist-seed-1',
          timestamp: '17.06.2026, 12:40',
          metadata: {
            informantCode: 'М-82 Поставы',
            researcher: researcherName || 'Слобожанин М.М.',
            location: 'г. Поставы, Витебская область'
          },
          segments: [
            { id: 'h1l-1', speaker: 'Информант', text: 'У нас тутака ровар кажуць, а хто кажа веласіпед. Гэта адно і тое ж, але па-нашаму ровар.', tags: [] },
            { id: 'h1l-2', speaker: 'Интервьюер', text: 'А як часта вы на ровары ездзіце?', tags: [] },
            { id: 'h1l-3', speaker: 'Информант', text: 'Ды кожны дзень у краму трэба з’ездзіць.', tags: [] }
          ],
          spans: [],
          turnFacets: {
            'h1l-1': { segmentId: 'h1l-1', baseCode: 'prosta', registers: ['colloquial'] },
            'h1l-2': { segmentId: 'h1l-2', baseCode: 'ru', registers: ['colloquial'] },
            'h1l-3': { segmentId: 'h1l-3', baseCode: 'prosta', registers: ['colloquial'] }
          },
          speakerProfiles: {
            'Информант': { speakerName: 'Информант', sociolect: 'older_gen' },
            'Интервьюер': { speakerName: 'Интервьюер', sociolect: 'none' }
          }
        },
        {
          id: 'hist-seed-2',
          timestamp: '15.06.2026, 16:15',
          metadata: {
            informantCode: 'К-44 Кличев',
            researcher: researcherName || 'Слобожанин М.М.',
            location: 'д. Дмитриевка, Кличевский р-н'
          },
          segments: [
            { id: 'h2l-1', speaker: 'Информант', text: 'Каб пагода была добрая, дык і сена грэбці лягчэй будзе.', tags: [] },
            { id: 'h2l-2', speaker: 'Интервьюер', text: 'А хто вам дапамагае?', tags: [] }
          ],
          spans: [],
          turnFacets: {
            'h2l-1': { segmentId: 'h2l-1', baseCode: 'prosta', registers: ['colloquial'] },
            'h2l-2': { segmentId: 'h2l-2', baseCode: 'ru', registers: ['colloquial'] }
          },
          speakerProfiles: {
            'Информант': { speakerName: 'Информант', sociolect: 'older_gen' },
            'Интервьюер': { speakerName: 'Интервьюер', sociolect: 'none' }
          }
        }
      ];
      setHistory(seedHistory);
      localStorage.setItem('linguistic_history_facet', JSON.stringify(seedHistory));
    }
  }, [researcherName]);

  const saveCurrentToHistory = () => {
    if (segments.length === 0) return;
    
    const newItem: HistoryItem = {
      id: `hist-${Date.now()}`,
      timestamp: new Date().toLocaleString('ru-RU', { hour12: false }),
      metadata: { ...metadata },
      segments: [...segments],
      spans: [...spans],
      turnFacets: { ...turnFacets },
      speakerProfiles: { ...speakerProfiles }
    };
    
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('linguistic_history_facet', JSON.stringify(updatedHistory));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setSegments(item.segments);
    setSpans(item.spans);
    setTurnFacets(item.turnFacets);
    setSpeakerProfiles(item.speakerProfiles);
    setMetadata(item.metadata);
    saveState(item.segments, item.spans, item.turnFacets, item.speakerProfiles, item.metadata);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('linguistic_history_facet', JSON.stringify(updatedHistory));
  };

  const exportAllReportsToDocxArchive = async () => {
    const diarySaved = localStorage.getItem('field_diary');
    let diaryEntries: any[] = [];
    if (diarySaved) {
      try {
        diaryEntries = JSON.parse(diarySaved);
      } catch (e) {
        console.error('Error parsing diary entries:', e);
      }
    }

    if (history.length === 0 && diaryEntries.length === 0) {
      alert(lang === 'ru' 
        ? 'История отчетов и полевой дневник пусты. Заполните данные для выгрузки.' 
        : lang === 'by'
        ? 'Гісторыі справаздач і палявы дзённік пустыя. Запоўніце дадзеныя для выгрузкі.'
        : '报告历史与田野日记均为空值，请录入相关数据后再行导出。');
      return;
    }

    try {
      const zip = new JSZip();

      // 1. Compile Дневник исследователя.docx
      const diaryDoc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Полевой дневник исследователя и реестр экспедиции",
                  bold: true,
                  size: 32,
                })
              ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `Дата архивации: `, bold: true }),
                new TextRun({ text: new Date().toLocaleDateString('ru-RU') })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Всего заметок в полевом дневнике: `, bold: true }),
                new TextRun({ text: String(diaryEntries.length) })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Всего сеансов расшифровок в памяти: `, bold: true }),
                new TextRun({ text: String(history.length) })
              ]
            }),
            new Paragraph({ text: "" }),

            // Part I
            new Paragraph({
              children: [
                new TextRun({ text: "РАЗДЕЛ I. ЗАМЕТКИ ИЗ ПОЛЕВОГО ДНЕВНИКА", bold: true, size: 24, color: "7C7948" })
              ]
            }),
            new Paragraph({ text: "" }),
            ...(diaryEntries.length === 0 
              ? [new Paragraph({ children: [new TextRun({ text: "Заметок полевого дневника не обнаружено.", italics: true })] })]
              : diaryEntries.flatMap((entry: any) => [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `• ${entry.informantName || 'Аноним'} `, bold: true }),
                      new TextRun({ text: `(${entry.location || 'Локация не указана'}) `, color: "B66029" }),
                      new TextRun({ text: `[${entry.timestamp || ''}]`, size: 18, color: "696969" }),
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `  "${entry.notes}"`, italics: true, color: "2c3e50" })
                    ],
                    indent: { left: 240 }
                  }),
                  new Paragraph({ text: "" })
                ])
            ),

            new Paragraph({ text: "" }),
            // Part II
            new Paragraph({
              children: [
                new TextRun({ text: "РАЗДЕЛ II. РЕЕСТР И АННОТАЦИИ РАСШИФРОВОК", bold: true, size: 24, color: "7C7948" })
              ]
            }),
            new Paragraph({ text: "" }),
            ...(history.length === 0
              ? [new Paragraph({ children: [new TextRun({ text: "Расшифровок в памяти не обнаружено.", italics: true })] })]
              : history.flatMap((item: any, index: number) => {
                  const totalSgs = item.segments ? item.segments.length : 0;
                  return [
                    new Paragraph({
                      children: [
                        new TextRun({ text: `${index + 1}. Код информанта: ${item.metadata.informantCode || '—'} `, bold: true }),
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: `   Исследователь (фио): `, bold: true, size: 18 }),
                        new TextRun({ text: `${item.metadata.researcher || '—'} | `, size: 18 }),
                        new TextRun({ text: `Локация: `, bold: true, size: 18 }),
                        new TextRun({ text: `${item.metadata.location || '—'} | `, size: 18 }),
                        new TextRun({ text: `Реплик: `, bold: true, size: 18 }),
                        new TextRun({ text: `${totalSgs} фр. | `, size: 18 }),
                        new TextRun({ text: `Дата: `, bold: true, size: 18 }),
                        new TextRun({ text: `${item.timestamp || '—'}`, size: 18 })
                      ],
                      indent: { left: 240 }
                    }),
                    new Paragraph({ text: "" })
                  ];
                })
            )
          ]
        }]
      });

      const diaryBlob = await Packer.toBlob(diaryDoc);
      zip.file("Дневник исследователя.docx", diaryBlob);

      // 2. Compile and package each transcript in history
      for (let index = 0; index < history.length; index++) {
        const item = history[index];
        const hMeta = item.metadata;
        const hSegments = item.segments || [];
        const hSpans = item.spans || [];
        const hTurnFacets = item.turnFacets || {};
        const hSpeakerProfiles = item.speakerProfiles || {};

        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Социолингвистический полевой протокол (Фасетная модель)",
                    bold: true,
                    size: 32,
                  })
                ]
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Код информанта: `, bold: true }),
                  new TextRun({ text: hMeta.informantCode || '—' })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Исследователь: `, bold: true }),
                  new TextRun({ text: hMeta.researcher || '—' })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Локация: `, bold: true }),
                  new TextRun({ text: hMeta.location || '—' })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Дата сохранения: `, bold: true }),
                  new TextRun({ text: item.timestamp || new Date().toLocaleDateString('ru-RU') })
                ]
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: lang === 'zh' ? "说话人画像卡 (Sociolect Profiles)" : lang === 'ru' ? "ПАСПОРТ СПИКЕРОВ (Социолекты)" : "ПАШПАРТ СПІКЕРАЎ (Сацыялекты)", bold: true, size: 24 })
                ]
              }),
              ...(Object.entries(hSpeakerProfiles) as [string, SpeakerProfile][]).map(([name, profile]) => {
                const def = TAG_DEFINITIONS[profile.sociolect];
                return new Paragraph({
                  bullet: { level: 0 },
                  children: [
                    new TextRun({ text: `${name}: `, bold: true }),
                    new TextRun({ text: def ? (lang === 'zh' ? def.labelZh : lang === 'ru' ? def.labelRu : def.labelBy) : (lang === 'zh' ? '普通口语标注基准（标准音）' : 'Литературная норма') })
                  ]
                });
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: lang === 'zh' ? "访谈对话与分句多维标注" : lang === 'ru' ? "СТЕНОГРАММА И РАЗМЕТКА РЕПЛИК" : "СТЭНАГРАМА І РАЗМЕТКА РЭПЛІК", bold: true, size: 24 })
                ]
              }),
              new Paragraph({ text: "" }),

              ...hSegments.map((seg, idx) => {
                const parentFacet = hTurnFacets[seg.id] || { baseCode: 'ru', registers: [] };
                const baseCodeDef = TAG_DEFINITIONS[parentFacet.baseCode];
                const registerDefs = parentFacet.registers.map(r => TAG_DEFINITIONS[r]?.labelRu || r).join(', ');
                
                const speakerProf = hSpeakerProfiles[seg.speaker] as SpeakerProfile | undefined;
                const socioLabel = speakerProf && TAG_DEFINITIONS[speakerProf.sociolect]
                  ? ` ↳ ${TAG_DEFINITIONS[speakerProf.sociolect].labelRu}`
                  : '';

                const segmentSpans = hSpans.filter(s => s.segmentId === seg.id);
                const tokens = seg.text.split(/\s+/);

                const lineChildren: TextRun[] = [];
                for (let i = 0; i < tokens.length; i++) {
                  const foundSpan = segmentSpans.find(s => s.startChar <= i && i <= s.endChar);
                  if (foundSpan && i === foundSpan.startChar) {
                    const spanWords = tokens.slice(foundSpan.startChar, foundSpan.endChar + 1).join(' ');
                    const definition = TAG_DEFINITIONS[foundSpan.tagId];
                    const label = definition ? definition.labelRu : foundSpan.tagId;
                    
                    lineChildren.push(
                      new TextRun({
                        text: ` [${spanWords}]`,
                        bold: true,
                        color: foundSpan.axis === 'contact' ? "228B22" : "696969",
                        underline: { type: UnderlineType.SINGLE, color: foundSpan.axis === 'contact' ? "228B22" : "696969" }
                      }),
                      new TextRun({
                        text: `(${label})`,
                        size: 16,
                        color: "B66029",
                        italics: true
                      }),
                      new TextRun({ text: " " })
                    );
                    i = foundSpan.endChar;
                  } else {
                    lineChildren.push(new TextRun({ text: tokens[i] + " " }));
                  }
                }

                const paraGroup = [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${seg.speaker}${socioLabel} [${idx + 1}]`, bold: true }),
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Код основной оси: `, bold: true, size: 18 }),
                      new TextRun({ text: baseCodeDef ? baseCodeDef.labelRu : 'Русский х.', size: 18 }),
                      new TextRun({ text: ` | Регистры: `, bold: true, size: 18 }),
                      new TextRun({ text: registerDefs || 'Обыденный', size: 18 })
                    ]
                  }),
                  new Paragraph({
                    children: lineChildren,
                    indent: { left: 240 }
                  })
                ];

                if (seg.analysisNotes) {
                  paraGroup.push(
                    new Paragraph({
                      children: [
                        new TextRun({ text: `Пометка: `, bold: true, size: 18, color: "7C7948" }),
                        new TextRun({ text: seg.analysisNotes, italics: true, size: 18, color: "7C7948" })
                      ],
                      indent: { left: 240 }
                    })
                  );
                }

                paraGroup.push(new Paragraph({ text: "" }));
                return paraGroup;
              }).flat()
            ]
          }]
        });

        const fileBlob = await Packer.toBlob(doc);
        const safeInfCode = hMeta.informantCode ? hMeta.informantCode.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]/g, '') : `отчет_${index + 1}`;
        zip.file(`Расшифровка_${safeInfCode}.docx`, fileBlob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Экспедиция_Архив_Документов_${new Date().toLocaleDateString('ru-RU').replace(/\//g, '-')}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("ZIP packaging error:", err);
      alert("Ошибка при упаковке архива: " + err.message);
    }
  };

  // Save changes to localStorage
  const saveState = (
    segs: TranscriptSegment[], 
    sps: SpanAnnotation[], 
    facs: Record<string, TurnFacetAnnotation>, 
    sprofiles: Record<string, SpeakerProfile>,
    metaObj = metadata
  ) => {
    localStorage.setItem('linguistic_segments_facet', JSON.stringify(segs));
    localStorage.setItem('linguistic_spans_facet', JSON.stringify(sps));
    localStorage.setItem('linguistic_facets_facet', JSON.stringify(facs));
    localStorage.setItem('linguistic_speakers_facet', JSON.stringify(sprofiles));
    localStorage.setItem('linguistic_meta_facet', JSON.stringify(metaObj));
  };

  // Stagger elements mounting
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.gsap-postprocess-header', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      gsap.fromTo('.gsap-sidebar-card', 
        { opacity: 0, y: 12 }, 
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1 }
      );
      gsap.fromTo('.gsap-segment-card', 
        { opacity: 0, y: 12 }, 
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.2 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [segments.length]);

  // File parsing logic
  const processFile = async (file: File) => {
    setFileLoading(true);
    setUploadError('');
    const fileName = file.name.toLowerCase();
    
    try {
      let extractedText = '';
      if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        extractedText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('File reader error'));
          reader.readAsText(file);
        });
      } else if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (fileName.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        extractedText = await parsePdfOnClient(arrayBuffer);
      } else {
        throw new Error(lang === 'ru' ? 'Кодификатор принимает только .txt, .docx, .pdf, .md' : lang === 'by' ? 'Кодыфікатар прымае толькі .txt, .docx, .pdf, .md' : '转写文本标注工具仅支持读取 .txt, .docx, .pdf, .md 格式文件');
      }

      setRawText(extractedText);
      const parsed = parseInterview(extractedText);
      setSegments(parsed);

      // Auto-extract unique speakers
      const activeSpeakers = Array.from(new Set(parsed.map(s => s.speaker)));
      const newProfiles: Record<string, SpeakerProfile> = {};
      const newFacets: Record<string, TurnFacetAnnotation> = {};

      activeSpeakers.forEach(sp => {
        const isInterviewer = sp.toLowerCase().includes('интервьюер') || sp.toLowerCase().includes('исследователь');
        newProfiles[sp] = {
          speakerName: sp,
          sociolect: isInterviewer ? 'none' : 'older_gen'
        };
      });

      parsed.forEach(seg => {
        const sp = seg.speaker;
        const isInterviewer = sp.toLowerCase().includes('интервьюер') || sp.toLowerCase().includes('исследователь');
        newFacets[seg.id] = {
          segmentId: seg.id,
          baseCode: isInterviewer ? 'ru' : 'trasianka',
          registers: ['colloquial']
        };
      });

      setSpeakerProfiles(newProfiles);
      setTurnFacets(newFacets);
      setSpans([]);
      saveState(parsed, [], newFacets, newProfiles);
      setFileLoading(false);
    } catch (err: any) {
      setUploadError(err.message || 'Error processing file');
      setFileLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    const parsed = parseInterview(rawText);
    setSegments(parsed);

    // Bootstrap profiles & facets (dynamic from transcript, no old leftovers)
    const activeSpeakers = Array.from(new Set(parsed.map(s => s.speaker)));
    const newProfiles: Record<string, SpeakerProfile> = {};
    const newFacets: Record<string, TurnFacetAnnotation> = {};

    activeSpeakers.forEach(sp => {
      const isInterviewer = sp.toLowerCase().includes('интервью') || sp.toLowerCase().includes('исследователь') || sp.toLowerCase().includes('wait');
      newProfiles[sp] = {
        speakerName: sp,
        sociolect: isInterviewer ? 'none' : 'older_gen'
      };
    });

    parsed.forEach(seg => {
      const isInterviewer = seg.speaker.toLowerCase().includes('интервью') || seg.speaker.toLowerCase().includes('исследователь') || seg.speaker.toLowerCase().includes('wait');
      newFacets[seg.id] = {
        segmentId: seg.id,
        baseCode: isInterviewer ? 'ru' : 'prosta',
        registers: ['colloquial']
      };
    });

    setSpeakerProfiles(newProfiles);
    setTurnFacets(newFacets);
    setSpans([]);
    saveState(parsed, [], newFacets, newProfiles);
  };

  // Master State mutators
  const changeBaseCode = (segmentId: string, code: BaseCodeType) => {
    const updated = {
      ...turnFacets,
      [segmentId]: {
        ...turnFacets[segmentId],
        baseCode: code
      }
    };
    setTurnFacets(updated);
    saveState(segments, spans, updated, speakerProfiles);
  };

  const toggleRegister = (segmentId: string, reg: RegisterType) => {
    const current = turnFacets[segmentId] || { baseCode: 'ru', registers: [] };
    const hasReg = current.registers.includes(reg);
    const nextRegs = hasReg 
      ? current.registers.filter(r => r !== reg)
      : [...current.registers, reg];

    const updated = {
      ...turnFacets,
      [segmentId]: {
        ...current,
        registers: nextRegs
      }
    };
    setTurnFacets(updated);
    saveState(segments, spans, updated, speakerProfiles);
  };

  const changeSpeakerSociolect = (speakerName: string, sociolect: SociolectType | 'none') => {
    const updated = {
      ...speakerProfiles,
      [speakerName]: {
        speakerName,
        sociolect
      }
    };
    setSpeakerProfiles(updated);
    saveState(segments, spans, turnFacets, updated);
  };

  const addManualSpeaker = () => {
    const trimmed = newSpeakerName.trim();
    if (!trimmed) return;
    if (speakerProfiles[trimmed]) {
      alert(lang === 'ru' ? 'Такой спикер уже добавлен.' : lang === 'by' ? 'Такі спікер ужо дададзены.' : '该发言人姓名已存在（已被录入）。');
      return;
    }
    const updated = {
      ...speakerProfiles,
      [trimmed]: {
        speakerName: trimmed,
        sociolect: 'none' as const
      }
    };
    setSpeakerProfiles(updated);
    setNewSpeakerName('');
    saveState(segments, spans, turnFacets, updated);
  };

  const deleteSpeakerProfile = (speakerName: string) => {
    const updated = { ...speakerProfiles };
    delete updated[speakerName];
    setSpeakerProfiles(updated);
    saveState(segments, spans, turnFacets, updated);
  };

  // Word token span selection
  const handleWordClick = (segmentId: string, wordIdx: number) => {
    const current = selectedWordIndices[segmentId] || [];
    let next: number[] = [];

    if (current.length === 0) {
      next = [wordIdx];
    } else if (current.length === 1) {
      // Range selection
      const start = Math.min(current[0], wordIdx);
      const end = Math.max(current[0], wordIdx);
      next = [];
      for (let i = start; i <= end; i++) {
        next.push(i);
      }
    } else {
      // Reset and pick new start
      next = [wordIdx];
    }

    setSelectedWordIndices({
      ...selectedWordIndices,
      [segmentId]: next
    });
  };

  const clearWordSelection = (segmentId: string) => {
    const updated = { ...selectedWordIndices };
    delete updated[segmentId];
    setSelectedWordIndices(updated);
  };

  // Add precise span annotation
  const addSpanAnnotation = (segmentId: string, tagId: any, axis: 'contact' | 'discourse') => {
    const indices = selectedWordIndices[segmentId];
    if (!indices || indices.length === 0) return;

    const seg = segments.find(s => s.id === segmentId);
    if (!seg) return;

    const words = seg.text.split(/\s+/);
    const selectedWords = indices.map(idx => words[idx]).join(' ');

    const newSpan: SpanAnnotation = {
      id: `span-custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      segmentId,
      text: selectedWords,
      startChar: Math.min(...indices),
      endChar: Math.max(...indices),
      tagId,
      axis,
      note: ''
    };

    const nextSpans = [...spans, newSpan];
    setSpans(nextSpans);
    clearWordSelection(segmentId);
    saveState(segments, nextSpans, turnFacets, speakerProfiles);
  };

  const deleteSpanAnnotation = (spanId: string) => {
    const nextSpans = spans.filter(s => s.id !== spanId);
    setSpans(nextSpans);
    saveState(segments, nextSpans, turnFacets, speakerProfiles);
  };

  const updateSpanNote = (spanId: string, note: string) => {
    const nextSpans = spans.map(s => {
      if (s.id === spanId) return { ...s, note };
      return s;
    });
    setSpans(nextSpans);
    saveState(segments, nextSpans, turnFacets, speakerProfiles);
  };

  // Turn segments operations
  const deleteSegment = (id: string) => {
    const cardEl = document.getElementById(`segment-card-facet-${id}`);
    if (cardEl) {
      gsap.to(cardEl, {
        opacity: 0,
        height: 0,
        y: -10,
        padding: 0,
        marginBottom: 0,
        duration: 0.3,
        ease: 'power2.out',
        onComplete: () => {
          const updated = segments.filter(seg => seg.id !== id);
          const updatedSpans = spans.filter(s => s.segmentId !== id);
          setSegments(updated);
          setSpans(updatedSpans);
          saveState(updated, updatedSpans, turnFacets, speakerProfiles);
        }
      });
    } else {
      const updated = segments.filter(seg => seg.id !== id);
      const updatedSpans = spans.filter(s => s.segmentId !== id);
      setSegments(updated);
      setSpans(updatedSpans);
      saveState(updated, updatedSpans, turnFacets, speakerProfiles);
    }
  };

  const startEditSegment = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setEditSpeaker(seg.speaker);
    setEditText(seg.text);
    const existing = turnFacets[seg.id];
    setEditNotes(seg.analysisNotes || '');
  };

  const saveSegmentEdit = () => {
    const prevTextMatched = segments.find(s => s.id === editingSegmentId)?.text;
    const isTextChanged = prevTextMatched !== editText.trim();

    const updated = segments.map(seg => {
      if (seg.id === editingSegmentId) {
        return {
          ...seg,
          speaker: editSpeaker.trim() || seg.speaker,
          text: editText.trim() || seg.text,
          analysisNotes: editNotes.trim() || undefined
        };
      }
      return seg;
    });

    // If text changed, spans indices might become invalid, delete spans associated with this segment
    let nextSpans = spans;
    if (isTextChanged) {
      nextSpans = spans.filter(s => s.segmentId !== editingSegmentId);
      setSpans(nextSpans);
    }

    setSegments(updated);
    saveState(updated, nextSpans, turnFacets, speakerProfiles);
    setEditingSegmentId(null);
  };

  // Export protocols
  const exportMarkdownProtocol = () => {
    let md = lang === 'zh' 
      ? `## 社会语言学田野研究报告 (分面/多维特征标记模型)\n\n`
      : `## Социолингвистический полевой протокол (Фасетная модель исследований)\n\n`;
    md += lang === 'zh' ? `**受访者代号:** ${metadata.informantCode || '—'}\n` : `**Код информанта:** ${metadata.informantCode || '—'}\n`;
    md += lang === 'zh' ? `**调查研究员:** ${metadata.researcher || '—'}\n` : `**Исследователь:** ${metadata.researcher || '—'}\n`;
    md += lang === 'zh' ? `**调研地点:** ${metadata.location || '—'}\n` : `**Локация выезда:** ${metadata.location || '—'}\n`;
    md += `**Дата экспорта:** ${new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'ru-RU')}\n`;
    md += `\n---\n\n`;

    md += lang === 'zh' 
      ? `### 说话人画像卡 (Sociolect Profiles):\n` 
      : lang === 'ru' 
        ? `### ПАСПОРТ СПИКЕРОВ (Социолекты):\n` 
        : `### ПАСПАРТЫ СПІКЕРАЎ (Сацыялекты):\n`;
    (Object.entries(speakerProfiles) as [string, SpeakerProfile][]).forEach(([name, profile]) => {
      const def = TAG_DEFINITIONS[profile.sociolect];
      const defaultLabel = lang === 'zh' ? '普通口语标注基准（标准音）' : 'Литературная норма';
      md += `- **${name}**: ${def ? (lang === 'zh' ? def.labelZh : lang === 'ru' ? def.labelRu : def.labelBy) : defaultLabel}\n`;
    });
    md += `\n---\n\n` + (lang === 'zh' 
      ? `### 访谈对话与分句多维标注:\n\n` 
      : lang === 'ru' 
        ? `### СТЕНОГРАММА И РАЗМЕТКА РЕПЛИК:\n\n` 
        : `### СТЭНАГРАМА І РАЗМЕТКА РЭПЛІК:\n\n`);

    segments.forEach((seg, idx) => {
      const parentFacet = turnFacets[seg.id] || { baseCode: 'ru', registers: [] };
      const baseCodeDef = TAG_DEFINITIONS[parentFacet.baseCode];
      const registerDefs = parentFacet.registers.map(r => {
        const tagD = TAG_DEFINITIONS[r];
        return tagD ? (lang === 'zh' ? tagD.labelZh : lang === 'ru' ? tagD.labelRu : tagD.labelBy) : r;
      }).join(', ');
      const speakerProf = speakerProfiles[seg.speaker] as SpeakerProfile | undefined;
      const sociolectLabel = speakerProf && TAG_DEFINITIONS[speakerProf.sociolect] 
        ? ` ↳ ${lang === 'zh' ? TAG_DEFINITIONS[speakerProf.sociolect].labelZh : lang === 'ru' ? TAG_DEFINITIONS[speakerProf.sociolect].labelRu : TAG_DEFINITIONS[speakerProf.sociolect].labelBy}`
        : '';

      md += `**${seg.speaker}${sociolectLabel} [` + (lang === 'zh' ? `对白句 #${idx + 1}` : `Реплика #${idx + 1}`) + `]**\n`;
      const baseCodeLabel = baseCodeDef ? (lang === 'zh' ? baseCodeDef.labelZh : lang === 'ru' ? baseCodeDef.labelRu : baseCodeDef.labelBy) : '—';
      md += lang === 'zh' ? `* 基础语码变体: _${baseCodeLabel}_ \n` : `* Базовый код: _${baseCodeLabel}_ \n`;
      const defaultRegLabel = lang === 'zh' ? '日常普通口语' : 'Обыденно-разговорный';
      md += lang === 'zh' ? `* 语用寄存器/语体: _${registerDefs || defaultRegLabel}_ \n` : `* Регистры: _${registerDefs || 'Обыденно-разговорный'}_ \n`;
      
      // Render text with inline bracketed spans
      const tokens = seg.text.split(/\s+/);
      const segSpans = spans.filter(s => s.segmentId === seg.id);
      
      let textWithSpans = '';
      for (let i = 0; i < tokens.length; i++) {
        const foundSpan = segSpans.find(s => s.startChar <= i && i <= s.endChar);
        if (foundSpan && i === foundSpan.startChar) {
          const spanWords = tokens.slice(foundSpan.startChar, foundSpan.endChar + 1).join(' ');
          const tagDef = TAG_DEFINITIONS[foundSpan.tagId];
          const tagLabel = tagDef ? (lang === 'zh' ? tagDef.labelZh : lang === 'ru' ? tagDef.labelRu : tagDef.labelBy) : foundSpan.tagId;
          textWithSpans += ` **[${spanWords}]**^{${tagLabel}${foundSpan.note ? `: ${foundSpan.note}` : ''}} `;
          i = foundSpan.endChar; // skip
        } else {
          textWithSpans += tokens[i] + ' ';
        }
      }

      md += `> ${textWithSpans.trim()}\n`;
      if (seg.analysisNotes) {
        md += `\n` + (lang === 'zh' ? `_人类学特征/语音备注:_` : `_Лингвистическая пометка:_`) + ` ${seg.analysisNotes}\n`;
      }
      md += `\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `faceted_protocol_${metadata.informantCode || 'report'}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDocxProtocol = () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: lang === 'zh' ? "社会语言学田野研究报告 (多分面模型)" : "Социолингвистический полевой протокол (Фасетная модель)",
                  bold: true,
                  size: 32,
                })
              ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? `受访者代号: ` : `Код информанта: `, bold: true }),
                new TextRun({ text: metadata.informantCode || '—' })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? `分析调查员: ` : `Исследователь: `, bold: true }),
                new TextRun({ text: metadata.researcher || '—' })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? `实地地点: ` : `Локация: `, bold: true }),
                new TextRun({ text: metadata.location || '—' })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? `导出日期: ` : `Дата: `, bold: true }),
                new TextRun({ text: new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'ru-RU') })
              ]
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? "说话人画像卡 (Sociolect Profiles)" : lang === 'ru' ? "ПАСПОРТ СПИКЕРОВ (Социолекты)" : "ПАШПАРТ СПІКЕРАЎ (Сацыялекты)", bold: true, size: 24 })
              ]
            }),
            ...(Object.entries(speakerProfiles) as [string, SpeakerProfile][]).map(([name, profile]) => {
              const def = TAG_DEFINITIONS[profile.sociolect];
              const defaultLabel = lang === 'zh' ? '普通口语标注基准（标准音）' : 'Литературная норма';
              return new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${name}: `, bold: true }),
                  new TextRun({ text: def ? (lang === 'zh' ? def.labelZh : lang === 'ru' ? def.labelRu : def.labelBy) : defaultLabel })
                ]
              });
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: lang === 'zh' ? "访谈对话与分句多维标注" : lang === 'ru' ? "СТЕНОГРАММА И РАЗМЕТКА РЕПЛИК" : "СТЭНАГРАМА І РАЗМЕТКА РЭПЛІК", bold: true, size: 24 })
              ]
            }),
            new Paragraph({ text: "" }),

            ...segments.map((seg, idx) => {
              const parentFacet = turnFacets[seg.id] || { baseCode: 'ru', registers: [] };
              const baseCodeDef = TAG_DEFINITIONS[parentFacet.baseCode];
              const registerDefs = parentFacet.registers.map(r => {
                const tagD = TAG_DEFINITIONS[r];
                return tagD ? (lang === 'zh' ? tagD.labelZh : lang === 'ru' ? tagD.labelRu : tagD.labelBy) : r;
              }).join(', ');
              
              const speakerProf = speakerProfiles[seg.speaker] as SpeakerProfile | undefined;
              const socioLabel = speakerProf && TAG_DEFINITIONS[speakerProf.sociolect]
                ? ` ↳ ${lang === 'zh' ? TAG_DEFINITIONS[speakerProf.sociolect].labelZh : lang === 'ru' ? TAG_DEFINITIONS[speakerProf.sociolect].labelRu : TAG_DEFINITIONS[speakerProf.sociolect].labelBy}`
                : '';

              const segmentSpans = spans.filter(s => s.segmentId === seg.id);
              const tokens = seg.text.split(/\s+/);

              const lineChildren: TextRun[] = [];
              for (let i = 0; i < tokens.length; i++) {
                const foundSpan = segmentSpans.find(s => s.startChar <= i && i <= s.endChar);
                if (foundSpan && i === foundSpan.startChar) {
                  const spanWords = tokens.slice(foundSpan.startChar, foundSpan.endChar + 1).join(' ');
                  const definition = TAG_DEFINITIONS[foundSpan.tagId];
                  const label = definition ? (lang === 'zh' ? definition.labelZh : lang === 'ru' ? definition.labelRu : definition.labelBy) : foundSpan.tagId;
                  
                  lineChildren.push(
                    new TextRun({
                      text: ` [${spanWords}]`,
                      bold: true,
                      color: foundSpan.axis === 'contact' ? "228B22" : "696969",
                      underline: { type: UnderlineType.SINGLE, color: foundSpan.axis === 'contact' ? "228B22" : "696969" }
                    }),
                    new TextRun({
                      text: `(${label})`,
                      size: 16,
                      color: "B66029",
                      italics: true
                    }),
                    new TextRun({ text: " " })
                  );
                  i = foundSpan.endChar;
                } else {
                  lineChildren.push(new TextRun({ text: tokens[i] + " " }));
                }
              }

              const defaultBaseLabel = lang === 'zh' ? '普通话/标准音' : 'Русский х.';
              const defaultRegLabel = lang === 'zh' ? '日常口语' : 'Обыденный';
              const paraGroup = [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${seg.speaker}${socioLabel} [${idx + 1}]`, bold: true }),
                  ]
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: lang === 'zh' ? `基础代码: ` : `Код основной оси: `, bold: true, size: 18 }),
                    new TextRun({ text: baseCodeDef ? (lang === 'zh' ? baseCodeDef.labelZh : lang === 'ru' ? baseCodeDef.labelRu : baseCodeDef.labelBy) : defaultBaseLabel, size: 18 }),
                    new TextRun({ text: lang === 'zh' ? ` | 寄存器语体: ` : ` | Регистры: `, bold: true, size: 18 }),
                    new TextRun({ text: registerDefs || defaultRegLabel, size: 18 })
                  ]
                }),
                new Paragraph({
                  children: lineChildren,
                  indent: { left: 240 }
                })
              ];

              if (seg.analysisNotes) {
                paraGroup.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: lang === 'zh' ? `备注: ` : `Пометка: `, bold: true, size: 18, color: "7C7948" }),
                      new TextRun({ text: seg.analysisNotes, italics: true, size: 18, color: "7C7948" })
                    ],
                    indent: { left: 240 }
                  })
                );
              }

              paraGroup.push(new Paragraph({ text: "" }));
              return paraGroup;
            }).flat()
          ]
        }]
      });

      Packer.toBlob(doc).then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `faceted_protocol_${metadata.informantCode || 'report'}.docx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } catch (e: any) {
      console.error("docx error:", e);
      alert("DOCX generation error: " + e.message);
    }
  };

  const copyMarkdownToClipboard = () => {
    let md = `### PROTOCOL [${metadata.informantCode}]\n\n`;
    segments.forEach((seg, idx) => {
      const parentFacet = turnFacets[seg.id] || { baseCode: 'ru', registers: [] };
      const baseCodeDef = TAG_DEFINITIONS[parentFacet.baseCode];
      md += `${seg.speaker} (Код: ${baseCodeDef ? baseCodeDef.labelRu : '—'} | Регистры: ${parentFacet.registers.join(', ') || 'обыденно-разговорный'}):\n`;
      md += `${seg.text}\n\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  // Resolve list of active Contact and Discourse tags filtered dynamically by region configuration
  const activeFilteredContactTags = tagsForRegion(
    metadata.location, 
    Object.values(TAG_DEFINITIONS).filter(t => t.axis === 'contact')
  );
  
  const activeDiscourseTags = Object.values(TAG_DEFINITIONS).filter(t => t.axis === 'discourse');

  return (
    <div ref={containerRef} className="space-y-12 max-w-7xl mx-auto px-1 md:px-0">
      {/* Overview Block */}
      <div className="gsap-postprocess-header bg-white p-6 md:p-8 border border-sahara-surface-dim/40 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div>
          <span className="font-sans text-xs uppercase tracking-widest font-black text-sahara-primary block mb-1">
            {lang === 'ru' ? 'ФАСЕТНАЯ СОЦИОЛИНГВИСТИЧЕСКАЯ КАТЕГОРИЗАЦИЯ' : lang === 'by' ? 'ФАСЭТНАЯ САЦЫЯЛІНГВІСТЫЧНАЯ КАТЭГАРЫЗАЦЫЯ' : '多维社会语言学分面研究标注分类学'}
          </span>
          <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-sahara-primary leading-tight">
            {lang === 'ru' ? 'Фасетный кодификатор и полотно' : lang === 'by' ? 'Фасэтны кадыфікатар і палатно' : '多维分面标注画幅与交互语料库'}
          </h2>
          <p className="font-serif text-sm text-sahara-secondary mt-2 max-w-3xl leading-relaxed">
            {lang === 'ru' 
              ? 'Экспедиционный рабочий инструмент под белорусские реалии. Плоский список заменен на 5 ортогональных осей: Базовый код (1 отметка), Регистры (мульти), Социолекты (на паспорте спикера), а также точечные Контактные явления и Дискурс (на фрагмент слова).'
              : lang === 'by'
              ? 'Экспедыцыйны працоўны інструмент пад беларускія рэаліі. Плоскі спіс заменены на 5 артаганальных восяў: Базавы код (1 адзнака), Рэгістры (мульці), Сацыялекты (на пашпарце спікера), а таксама кропкавыя Кантактныя з’явы і Дыскарс (на фрагмент слова).'
              : '专为在野与地方文献研究定制的语言特征分面标注面板。通过5个正交评估维度深度解构：基础代码变体（单选1个）、寄存器语用体（允许多选）、社会语体（绑定于说话人画像卡）、段落级干涉以及动态话语标记语（高保真精细对准到词/短语片段）。'}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={copyMarkdownToClipboard}
            className="px-5 py-3 bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary text-sahara-secondary hover:text-sahara-primary rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-2xs"
          >
            {copiedText ? t.btnCopied : t.btnCopyMdShort}
          </button>
          
          <button
            onClick={exportMarkdownProtocol}
            className="px-5 py-3 bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary text-sahara-secondary hover:text-sahara-primary rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
          >
            <Download className="w-4 h-4" />
            {lang === 'ru' ? 'MD-Фасет' : lang === 'by' ? 'MD-Фасэт' : '导出 Markdown 报告'}
          </button>

          <button
            onClick={exportDocxProtocol}
            className="px-5 py-3 bg-sahara-primary hover:bg-sahara-primary/95 text-white rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-[1.01]"
          >
            <Download className="w-4 h-4" />
            {lang === 'ru' ? 'Экспорт DOCX (Фасет)' : lang === 'by' ? 'Экспарт DOCX (Фасэт)' : '导出 Word 报告'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Passport & Paste Workspace */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Metadata Passport info */}
          <div className="gsap-sidebar-card bg-white border border-sahara-surface-dim/40 rounded-xl p-8 space-y-5 shadow-xs">
            <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block mb-1">
              {t.lpPassport}
            </span>
            <div className="space-y-4">
              <div>
                <label className="block font-sans text-[11px] uppercase font-black text-sahara-primary tracking-wider mb-1.5">{t.lpInformantCode}</label>
                <input
                  type="text"
                  value={metadata.informantCode}
                  onChange={(e) => {
                    const next = { ...metadata, informantCode: e.target.value };
                    setMetadata(next);
                    saveState(segments, spans, turnFacets, speakerProfiles, next);
                  }}
                  className="w-full h-10 px-3 py-1.5 text-sm rounded-md bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium text-sahara-onbackground"
                />
              </div>
              <div>
                <label className="block font-sans text-[11px] uppercase font-black text-sahara-primary tracking-wider mb-1.5">{t.lpResearcherCode}</label>
                <input
                  type="text"
                  value={metadata.researcher}
                  onChange={(e) => {
                    const next = { ...metadata, researcher: e.target.value };
                    setMetadata(next);
                    saveState(segments, spans, turnFacets, speakerProfiles, next);
                    if (onResearcherNameChange) {
                      onResearcherNameChange(e.target.value);
                    }
                  }}
                  className="w-full h-10 px-3 py-1.5 text-sm rounded-md bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium text-sahara-onbackground"
                />
              </div>
              <div>
                <label className="block font-sans text-[11px] uppercase font-black text-sahara-primary tracking-wider mb-1.5">{t.lpLocation}</label>
                <input
                  type="text"
                  placeholder="д. Поречье, Гродненский р-н"
                  value={metadata.location}
                  onChange={(e) => {
                    const next = { ...metadata, location: e.target.value };
                    setMetadata(next);
                    saveState(segments, spans, turnFacets, speakerProfiles, next);
                  }}
                  className="w-full h-10 px-3 py-1.5 text-sm rounded-md bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium text-sahara-onbackground"
                />
              </div>
            </div>
          </div>

          {/* Speaker passports - designates sociolect profile ONCE, turns inherit dynamically */}
          <div className="gsap-sidebar-card bg-[#fbfafd]/95 border-2 border-sahara-primary/10 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs hover:border-sahara-primary/20 transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block">
                {lang === 'ru' ? 'ПАСПОРТ СПИКЕРОВ (Социолекты)' : lang === 'by' ? 'ПАШПАРТ СПІКЕРАЎ (Сацыялекты)' : '说话人画像卡与社会变体标定'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    const defaultSpeakers: Record<string, SpeakerProfile> = {
                      'Вера Ивановна': { speakerName: 'Вера Ивановна', sociolect: 'older_gen' },
                      'Интервьюер': { speakerName: 'Интервьюер', sociolect: 'none' }
                    };
                    setSpeakerProfiles(defaultSpeakers);
                    saveState(segments, spans, turnFacets, defaultSpeakers);
                  }}
                  title={lang === 'ru' ? 'Восстановить базовых спикеров' : lang === 'by' ? 'Аднавіць базавых спікераў' : '重置并加载默认发言人'}
                  className="text-[9px] uppercase font-sans font-black bg-white hover:bg-sahara-clay/20 text-[#B66029] border border-[#B66029]/40 px-2 py-0.5 rounded cursor-pointer transition-all shadow-3xs"
                >
                  {lang === 'ru' ? 'Базовые 2' : lang === 'by' ? 'Базавыя 2' : '默认两位'}
                </button>
                <span className="text-[10px] uppercase font-mono font-bold bg-sahara-clay/20 text-sahara-primary px-2 py-0.5 rounded-sm select-none">
                  维度 5
                </span>
              </div>
            </div>
            
            <p className="font-serif text-xs text-sahara-secondary/85 leading-relaxed">
              {lang === 'ru' 
                ? 'Задайте социолектный типаж информанта один раз. Все его фразы ниже унаследуют этот статус условным пунктирным бейджем ↳.'
                : lang === 'by'
                ? 'Задайце сацыялектны тыпаж інфарманта адзін раз. Усе яго фразы ніжэй успадкуюць гэты статус пункцірным бэйджкам ↳.'
                : '在此统一设定受访发言人的社会变体类型。设定完成后，其句子的发音特性由虚线派生标识 ↳ 动态渲染。'}
            </p>

            {Object.keys(speakerProfiles).length === 0 ? (
              <p className="text-xs italic text-sahara-secondary/60 font-serif">
                {lang === 'ru' ? 'Спикеры не определены. Загрузите пример или вставьте текст.' : lang === 'by' ? 'Спікеры не вызначаны. Загрузіце прыклад ці ўстаўце тэкст.' : '尚未创建任何发言人。请加载格罗德诺样例或直接贴入文本分句。'}
              </p>
            ) : (
              <div className="space-y-4 pt-1">
                {(Object.entries(speakerProfiles) as [string, SpeakerProfile][]).map(([name, profile]) => {
                  return (
                    <div key={name} className="bg-white border border-sahara-surface-dim/35 p-3 rounded-lg space-y-2 shadow-3xs hover:border-sahara-primary/35 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-xs font-black text-sahara-onbackground block truncate">
                          {name}
                        </span>
                        <button
                          onClick={() => deleteSpeakerProfile(name)}
                          title={lang === 'ru' ? 'Удалить спикера' : lang === 'by' ? 'Выдаліць спікера' : '删除该群组发言人'}
                          className="text-sahara-secondary/40 hover:text-red-700 hover:bg-rose-50 p-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={profile.sociolect}
                        onChange={(e) => changeSpeakerSociolect(name, e.target.value as any)}
                        className="w-full text-xs font-medium font-sans p-1.5 rounded-md border border-sahara-surface-dim/55 bg-white focus:outline-none focus:ring-1 focus:ring-sahara-primary text-sahara-secondary"
                      >
                        <option value="none">{lang === 'ru' ? 'Норма устной речи' : lang === 'by' ? 'Норма вуснага маўлення' : '普通话口语（标准无明显变体）'}</option>
                        <option value="older_gen">{lang === 'ru' ? '👵 Старшее поколение (Сельский диалект)' : lang === 'by' ? '👵 Старэйшае пакаленне (Вясковы дыялект)' : '👵 年长一代方言（质朴传统土话/老派老龄言语）'}</option>
                        <option value="urban_shift">{lang === 'ru' ? '🏢 Городской сдвиг (Просторечие)' : lang === 'by' ? '🏢 Гарадскі зрух (Простамоўе)' : '🏢 城镇过渡语态（城市市井俗语、特拉相卡混合音）'}</option>
                        <option value="young_shift">{lang === 'ru' ? '📱 Молодежный сдвиг (Смешанный сленг)' : lang === 'by' ? '📱 Моладзевы зрух (Змяшаны слэнг)' : '📱 青年新流行潮（城市混合网络俚语/数字外来词）'}</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual Speaker Adder Form */}
            <div className="pt-4 border-t border-sahara-surface-dim/35 space-y-2">
              <label className="block font-sans text-[11px] uppercase font-black text-sahara-primary tracking-wider">
                {lang === 'ru' ? 'Добавить спикера вручную' : lang === 'by' ? 'Дадаць спікера ўручную' : '手动新增学者/受访发言人'}
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={lang === 'ru' ? 'Имя спикера...' : lang === 'by' ? 'Імя спікера...' : '输入发言人姓名...'}
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addManualSpeaker();
                    }
                  }}
                  className="flex-1 h-8 px-2.5 text-xs rounded-md bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans text-sahara-onbackground"
                />
                <button
                  type="button"
                  onClick={addManualSpeaker}
                  className="h-8 w-8 flex items-center justify-center rounded-md bg-sahara-primary text-white hover:bg-sahara-primary/90 transition-colors cursor-pointer"
                  title={lang === 'ru' ? 'Добавить' : lang === 'by' ? 'Дадаць' : '一键添加'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* API Key BYOK configuration embedded inside Section 5 */}
            <div className="pt-4 border-t border-sahara-surface-dim/35 space-y-2">
              <label className="block font-sans text-[11px] uppercase font-black text-sahara-primary tracking-wider">
                {lang === 'ru' ? 'Интеграция с ИИ (Gemini API)' : lang === 'by' ? 'Інтэграцыя з ІІ (Gemini API)' : '人工智能系统集成与密钥认证'}
              </label>
              <button
                type="button"
                onClick={() => {
                  const key = getApiKey();
                  if (key) {
                    const confirmMsg = lang === 'ru' 
                      ? 'Вы уверены, что хотите выйти и сбросить API Ключ?' 
                      : lang === 'by' 
                        ? 'Вы ўпэўненыя, што хочаце выйсці і скінуць API Ключ?' 
                        : '您确定要清除 API 密钥吗？';
                    if (confirm(confirmMsg)) {
                      clearApiKey();
                      window.location.reload();
                    }
                  } else {
                    window.dispatchEvent(new CustomEvent('open-api-key-gate'));
                  }
                }}
                className={`w-full py-2 px-3 border shadow-2xs rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans ${
                  getApiKey()
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:text-red-600 hover:bg-rose-50 hover:border-rose-200'
                    : 'bg-sahara-primary text-white border-sahara-primary hover:bg-sahara-hover'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>
                  {getApiKey()
                    ? (lang === 'ru' ? 'Активен (Сбросить)' : lang === 'by' ? 'Актыўны (Скінуць)' : '密钥有效（一键注销）')
                    : (lang === 'ru' ? 'Подключить Gemini API Key' : lang === 'by' ? 'Падключыць Gemini API Key' : '绑定 Gemini API 密钥')}
                </span>
              </button>
            </div>
          </div>

          {/* History memory of past parsed transcripts card */}
          <div className="gsap-sidebar-card bg-[#faf8f6]/70 border border-sahara-surface-dim/40 rounded-xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block">
                {lang === 'ru' ? 'ПАМЯТЬ ПРОШЛЫХ ТЕКСТОВ' : 'ПАМЯЦЬ МІНУЛЫХ ТЭКСТАЎ'}
              </span>
              <span className="text-[10px] uppercase font-mono font-bold bg-sahara-clay/20 text-sahara-primary px-2 py-0.5 rounded-sm">
                {lang === 'ru' ? `Архив (${history.length})` : lang === 'by' ? `Архіў (${history.length})` : `语言学报告库 (${history.length})`}
              </span>
            </div>

            <p className="font-sans text-xs text-sahara-secondary/85 leading-normal">
              {lang === 'ru' 
                ? 'Ранее размеченные тексты в памяти. Нажмите для загрузки на полотно или удалите по одной.'
                : lang === 'by'
                ? 'Раней размечаныя тэксты ў памяці. Націсніце для загрузкі на палатно альбо выдаліце па адной.'
                : '历史保存过的对白及标注卡快照。单点击可以将所备份的信息瞬间复原到右侧画布上。'}
            </p>

            {history.length === 0 ? (
              <p className="text-xs italic text-sahara-secondary/50 font-sans py-1">
                {lang === 'ru' ? 'Архив пуст. Нажмите кнопку ниже для сохранения текущего снимка.' : lang === 'by' ? 'Архіў пусты. Націсніце кнопку ніжэй для захавання бягучага здымка.' : '暂无任何历史评估快照，您可以点击下方按钮将右手画幅信息备份至此。'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => loadFromHistory(item)}
                    className="group flex items-center justify-between p-2.5 rounded-lg border bg-white hover:bg-sahara-clay/10 border-sahara-surface-dim/30 hover:border-sahara-primary/50 transition-all cursor-pointer shadow-3xs"
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-sans text-xs font-black text-sahara-onbackground leading-tight">
                          {item.metadata.informantCode || 'Без шифра'}
                        </span>
                        <span className="text-[9px] font-mono font-medium text-sahara-secondary/40 shrink-0">
                          {item.timestamp.split(',')[0]}
                        </span>
                      </div>
                      <p className="font-sans text-[10px] text-sahara-secondary/65 truncate mt-0.5">
                        {item.metadata.location || '—'}
                      </p>
                    </div>

                    <button
                      onClick={(e) => deleteFromHistory(item.id, e)}
                      title={lang === 'ru' ? 'Удалить' : lang === 'by' ? 'Выдаліць' : '删除快照'}
                      className="p-1 hover:bg-rose-50 text-sahara-secondary/40 hover:text-[#ba1a1a] rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {segments.length > 0 && (
              <button
                type="button"
                onClick={saveCurrentToHistory}
                className="w-full py-2 bg-sahara-primary hover:bg-sahara-primary/95 text-white rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-xs text-center flex items-center justify-center gap-1.5"
              >
                <span>{lang === 'ru' ? '+ Сделать снимок в память' : lang === 'by' ? '+ Зрабіць здымак у памяць' : '+ 另存当前快照备份'}</span>
              </button>
            )}
          </div>

          {/* Paste sandbox text transcript */}
          <div className="gsap-sidebar-card bg-white border border-sahara-surface-dim/40 rounded-xl p-8 space-y-6 shadow-xs">
            <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block mb-1">
              {lang === 'zh' ? '分析报告整合存档' : 'Экспорт и разбор'}
            </span>
            
            <p className="font-sans text-sm text-sahara-secondary leading-relaxed">
              {lang === 'zh' ? '一键打包下载整合所有分析结果与调查日志，或在下方直接对录音文本进行分拆标定。' : 'Экспортируйте собранный архив всех отчетов или разметьте новый текст ниже.'}
            </p>

            {/* Export all reports card (replacing old file loading template card as requested) */}
            <div 
              onClick={exportAllReportsToDocxArchive}
              className="border border-sahara-primary/30 p-5 rounded-xl text-center bg-sahara-clay/10 hover:bg-sahara-clay/20 cursor-pointer transition-all shadow-2xs group"
            >
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <Download className="w-8 h-8 text-sahara-primary mx-auto group-hover:scale-110 transition-transform" />
                <span className="font-sans text-xs font-black text-sahara-primary uppercase tracking-widest block">
                  {lang === 'ru' ? 'Экспорт всего архива (.zip)' : lang === 'by' ? 'Экспарт усяго архіва (.zip)' : '整合一键打包下载 (.zip)'}
                </span>
                <span className="font-sans text-[11px] text-sahara-secondary/70 italic block">
                  {lang === 'ru' ? 'Дневник исследователя + расшифровки в DOCX' : lang === 'by' ? 'Дзённік даследчыка + расшыфроўкі ў DOCX' : '包含调查日记、全部录音标注报告的 Word 文档集'}
                </span>
              </div>
            </div>

            {/* Subtle File input loader as alternate option */}
            <div className="flex items-center justify-between text-xs border-t border-sahara-surface-dim/20 pt-4">
              <span className="text-sahara-secondary">
                {lang === 'ru' ? 'Загрузить новый файл:' : lang === 'by' ? 'Загрузіць новы файл:' : '上传待处理实地文件:'}
              </span>
              <label htmlFor="file-upload" className="font-bold text-sahara-primary hover:underline cursor-pointer flex items-center gap-1">
                <FileUp className="w-3.5 h-3.5" />
                {lang === 'ru' ? 'Выбрать' : lang === 'by' ? 'Выбраць' : '浏览文件'}
              </label>
              <input 
                id="file-upload"
                type="file" 
                accept=".txt,.docx,.pdf,.md" 
                onChange={handleFileUpload}
                className="hidden" 
              />
            </div>
            
            {uploadError && (
              <p className="text-[#ba1a1a] font-sans text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {uploadError}
              </p>
            )}

            <form onSubmit={handleTextSubmit} className="space-y-5">
              <textarea
                rows={7}
                placeholder="Speaker 1: Text dialogue..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full p-4 font-mono text-xs sm:text-sm rounded-md bg-sahara-clay/10 border border-sahara-surface-dim/45 focus:outline-none focus:ring-2 focus:ring-sahara-primary leading-relaxed text-sahara-onbackground"
              ></textarea>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={loadGrodnoSample}
                  className="py-2.5 px-2 rounded-md text-xs sm:text-sm font-black uppercase tracking-wider bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary text-sahara-secondary hover:text-sahara-primary transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {lang === 'ru' ? 'Пример' : lang === 'by' ? 'Прыклад' : '示例'}
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-2 rounded-md text-xs sm:text-sm font-black uppercase tracking-wider bg-sahara-primary hover:bg-sahara-primary/95 text-white transition-all cursor-pointer shadow-md"
                >
                  {t.btnParse}
                </button>
              </div>
            </form>
          </div>

          {/* Codifier axis operational index & Kappa (κ) reliability inspector */}
          <div className="gsap-sidebar-card bg-sahara-clay/10 border border-sahara-primary/10 rounded-xl p-8 space-y-4 shadow-xs relative">
            <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block">
              {lang === 'ru' ? 'ДЕФИНИЦИИ И НАДЕЖНОСТЬ κ' : lang === 'by' ? 'ДЭФІНІЦЫІ І НАДЗЕЙНАСЦЬ κ' : '标记大纲释义与专家间信度指数 κ'}
            </span>
            <p className="font-serif text-xs text-sahara-secondary leading-relaxed">
              {lang === 'ru' 
                ? 'Наведите на любой чип на «полотне», чтобы прочесть операциональное определение под надежность согласия оценщиков.'
                : lang === 'by'
                ? 'Навядзіце на любы чып на «палатне», каб прачытаць аперацыянальнае азначэнне пад надзейнасць згоды ацэншчыкаў.'
                : '鼠标悬浮在右侧任何带有色块的标记按钮上，即可于此快速查看对齐一致性信度的科学定义标准。'}
            </p>

            <div className="bg-white/80 p-4 border border-sahara-surface-dim/60 rounded-lg text-xs min-h-[140px] flex flex-col justify-between">
              {hoveredTagDef ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${hoveredTagDef.color}`}>
                      {lang === 'zh' ? hoveredTagDef.labelZh : lang === 'ru' ? hoveredTagDef.labelRu : hoveredTagDef.labelBy}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-sahara-secondary font-bold">
                      {lang === 'zh' ? `维度: ${
                        hoveredTagDef.axis === 'base' ? '基础语言' :
                        hoveredTagDef.axis === 'register' ? '寄存器语体' :
                        hoveredTagDef.axis === 'contact' ? '接触语言现象' :
                        hoveredTagDef.axis === 'discourse' ? '话语标记标定' :
                        hoveredTagDef.axis === 'sociolect' ? '口语社会语体' :
                        hoveredTagDef.axis
                      }` : `Ось: ${hoveredTagDef.axis}`}
                    </span>
                  </div>
                  <p className="font-serif text-sahara-onbackground leading-snug">
                    {lang === 'zh' ? hoveredTagDef.definitionZh : lang === 'ru' ? hoveredTagDef.definitionRu : hoveredTagDef.definitionBy}
                  </p>
                  <div className="pt-1.5 border-t border-sahara-surface-dim/30">
                    <strong className="text-[10px] text-sahara-primary uppercase tracking-tight block">{lang === 'zh' ? '在野语境范例:' : 'Пример в полете:'}</strong>
                    <span className="font-serif italic text-sahara-secondary block mt-0.5 leading-snug">
                      {lang === 'zh' ? hoveredTagDef.exampleRu : lang === 'ru' ? hoveredTagDef.exampleRu : hoveredTagDef.exampleBy}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full text-sahara-secondary/50 italic font-serif py-4">
                  <Info className="w-8 h-8 text-sahara-secondary/30 mb-2" />
                  <span>{lang === 'ru' ? 'Наведите мышь на чип классификатора ниже, чтобы раскрыть стандарт кодирования' : lang === 'by' ? 'Навядзіце мышь на чып класіфікатара ніжэй, каб раскрыць стандарт кадавання' : '请将光标移至任何代号/标记卡上，即可在此自动展现实地标注指引规范'}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-sahara-surface-dim/20 text-[11px] font-sans text-sahara-secondary flex items-start gap-1.5 leading-relaxed">
              <span className="text-emerald-700 font-extrabold">●</span>
              <span>
                {lang === 'zh' ? (
                  metadata.location.toLowerCase().includes('гродно') || metadata.location.toLowerCase().includes('grodno') 
                    ? '格罗德诺特殊区位过滤器触发：立陶宛/波罗本地带借词判定保持开启，南部波列西耶特征隐藏以防干扰。' 
                    : '标准多因子判定：默认地缘特征空间特征过滤器已正常就绪。'
                ) : metadata.location.toLowerCase().includes('гродно') 
                  ? 'Гродненский локус: Литовские балтизмы активны для разметки, южные украинизмы скрыты.' 
                  : 'Активные правила фильтрации тегов по умолчанию.'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Faceted Annotating Workspace */}
        <div id="prompt-library-container" className="lg:col-span-8 space-y-8">
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 shadow-xs">
            
            <div className="flex items-center justify-between mb-6 border-b border-sahara-surface-dim/30 pb-4">
              <span className="font-sans text-xs uppercase font-black text-sahara-primary tracking-widest flex items-center gap-2">
                <Layers className="w-5 h-5 text-sahara-primary animate-pulse" />
                {lang === 'ru' ? 'ЛИНГВИСТИЧЕСКОЕ «ПОЛОТНО» (РАЗМЕТКА ФАСЕТОВ)' : lang === 'by' ? 'ЛІНГВІСТЫЧНАЕ «ПАЛАТНО» (РАЗМЕТКА ФАСЭТАЎ)' : '社会语言学分面画幅与交互标记区'}
              </span>
              <span className="text-sahara-primary text-[11px] font-mono uppercase bg-sahara-clay/20 border border-sahara-primary/10 rounded-md px-3 py-1 font-black">
                {t.lpReplics} {segments.length}
              </span>
            </div>

            {segments.length === 0 ? (
              <div className="text-center py-24 bg-sahara-clay/10 rounded-xl border border-dashed border-sahara-surface-dim/40 p-8">
                <AlertCircle className="w-10 h-10 text-sahara-secondary/30 mx-auto mb-3" />
                <p className="font-serif text-sm text-sahara-secondary italic">
                  {lang === 'ru' 
                    ? 'Нет разложенных реплик. Нажмите «Пример» слева.' 
                    : lang === 'by' 
                      ? 'Няма раскладзеных рэплік. Націсніце «Прыклад» злева.' 
                      : '暂无展开的录音片段，请在左侧点击“示例”。'}
                </p>
              </div>
            ) : (
              <div className="space-y-12">
                {segments.map((seg, idx) => {
                  const speakerProfile = speakerProfiles[seg.speaker] || { speakerName: seg.speaker, sociolect: 'none' };
                  const facet = turnFacets[seg.id] || { baseCode: 'ru', registers: ['colloquial'] };
                  const isEditing = editingSegmentId === seg.id;
                  
                  // Extract words/tokens
                  const words = seg.text.split(/\s+/);
                  const selectedIndices = selectedWordIndices[seg.id] || [];

                  // Find spans belonging to this replica
                  const segmentSpans = spans.filter(s => s.segmentId === seg.id);

                  // Validate this turn's annotation schema compliance
                  const validation = validateFacetAnnotation(facet, segmentSpans, speakerProfile);

                  const isInterviewer = seg.speaker.toLowerCase().includes('интервью') || seg.speaker.toLowerCase().includes('исследоват');

                  return (
                    <div
                      key={seg.id}
                      id={`segment-card-facet-${seg.id}`}
                      className="relative group bg-[#faf8f6]/50 border border-sahara-surface-dim/50 rounded-2xl p-6 space-y-6 transition-all hover:bg-white hover:shadow-2xs"
                    >
                      {/* Interactive metadata, actions headers */}
                      {!isEditing && (
                        <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => startEditSegment(seg)}
                            className="p-1.5 rounded-md bg-white hover:bg-sahara-background text-sahara-secondary hover:text-sahara-primary border border-sahara-surface-dim/60 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSegment(seg.id)}
                            className="p-1.5 rounded-md bg-white hover:bg-sahara-background text-sahara-secondary hover:text-[#ba1a1a] border border-sahara-surface-dim/60 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-5 bg-white p-4 border border-sahara-surface-dim/50 rounded-xl">
                          <div className="flex items-center gap-3 border-b border-sahara-surface-dim/20 pb-3">
                            <span className="font-mono text-xs bg-sahara-clay/20 border border-sahara-primary/10 rounded-md text-sahara-primary px-2 py-0.5 font-bold">
                              #{idx + 1}
                            </span>
                            <div className="flex flex-col flex-1">
                              <label className="text-[10px] uppercase font-bold text-sahara-primary tracking-wider mb-1">{t.lpSpeakerLabel}</label>
                              <input
                                type="text"
                                className="h-10 px-3 py-1 text-xs sm:text-sm font-black font-sans uppercase tracking-widest bg-white border border-sahara-surface-dim/55 rounded-md w-60 focus:outline-none focus:ring-2 focus:ring-sahara-primary text-sahara-onbackground"
                                value={editSpeaker}
                                onChange={(e) => setEditSpeaker(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-sahara-primary tracking-wider mb-1">{t.lpEditTitle}</label>
                            <textarea
                              rows={3}
                              className="w-full p-3 font-sans text-sm bg-sahara-clay/5 border border-sahara-surface-dim/50 rounded-md focus:outline-none focus:ring-2 focus:ring-sahara-primary leading-relaxed text-sahara-onbackground"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="text-[10px] uppercase font-bold text-sahara-primary tracking-wider mb-1">{t.lpLabelCaption}</label>
                            <textarea
                              rows={2}
                              className="w-full p-3 font-sans text-sm bg-sahara-clay/5 border border-sahara-surface-dim/50 rounded-md focus:outline-none focus:ring-2 focus:ring-sahara-primary text-sahara-onbackground"
                              placeholder="..."
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                            />
                          </div>

                          <div className="flex justify-end gap-3">
                            <button
                               onClick={() => setEditingSegmentId(null)}
                              className="px-5 py-2.5 bg-white border border-sahara-surface-dim/55 hover:bg-sahara-background rounded-md text-sahara-secondary font-sans text-xs uppercase font-extrabold tracking-wider cursor-pointer"
                            >
                              {t.lpCancel}
                            </button>
                            <button
                              onClick={saveSegmentEdit}
                              className="px-5 py-2.5 bg-sahara-primary hover:bg-sahara-primary/95 text-white rounded-md font-sans text-xs uppercase font-extrabold tracking-wider cursor-pointer"
                            >
                              {t.lpSave}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Standard view of a replica turn card
                        <div className="space-y-5">
                          {/* Top row - index, speaker name, sociolect inheritance badge */}
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sahara-surface-dim/20 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs bg-sahara-clay/20 border border-sahara-primary/10 text-sahara-primary px-2 py-0.5 rounded-md font-bold">
                                #{idx + 1}
                              </span>
                              
                              <span className="font-sans font-black text-sm uppercase tracking-wider text-sahara-onbackground">
                                {seg.speaker}
                              </span>

                              {/* Sociolect Inherited Badge (Dotted Indicator ↳) */}
                              {speakerProfile.sociolect !== 'none' && TAG_DEFINITIONS[speakerProfile.sociolect] ? (
                                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-sans font-extrabold px-2.5 py-0.5 bg-sahara-clay/20 text-sahara-primary border border-sahara-primary/20 rounded-full select-none">
                                  <span className="font-light">↳</span>
                                  <span>{lang === 'zh' ? TAG_DEFINITIONS[speakerProfile.sociolect].labelZh : lang === 'ru' ? TAG_DEFINITIONS[speakerProfile.sociolect].labelRu : TAG_DEFINITIONS[speakerProfile.sociolect].labelBy}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-sahara-secondary/30 italic">
                                  {lang === 'zh' ? '↳ 常规标准口语（无特别社会变体）' : lang === 'ru' ? '↳ литературная норма' : '↳ літаратурная норма'}
                                </span>
                              )}
                            </div>

                            {/* Verification indicator */}
                            {!validation.valid && (
                              <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded px-2.5 py-0.5 font-bold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {validation.errors[0]}
                              </div>
                            )}
                          </div>

                          {/* Orthogonal Facets Config Panel (Exquisite list rows) */}
                          <div className="bg-white border border-sahara-surface-dim/30 p-4 rounded-xl space-y-3.5 shadow-3xs">
                            {/* Axis 1: Base Code - Terracotta (Radio selecting exactly one) */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pb-3 border-b border-sahara-surface-dim/20">
                              <div className="sm:w-28 shrink-0 flex items-center justify-between">
                                <span className="text-[10px] font-sans font-black uppercase text-sahara-primary tracking-widest block">
                                  {lang === 'zh' ? '1. 基础主要代码体' : lang === 'ru' ? '1. БАЗОВЫЙ КОД' : '1. БАЗАВЫ КОД'}
                                </span>
                                <span className="text-[10px] uppercase font-mono font-bold text-sahara-primary/50 text-right pr-2">
                                  {lang === 'zh' ? '单选' : lang === 'ru' ? 'один' : 'адзін'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                {(['bel', 'ru', 'trasianka', 'prosta', 'polish', 'foreign'] as BaseCodeType[]).map(codeKey => {
                                  const def = TAG_DEFINITIONS[codeKey];
                                  if (!def) return null;
                                  const isSelected = facet.baseCode === codeKey;
                                  return (
                                    <button
                                      key={codeKey}
                                      onClick={() => changeBaseCode(seg.id, codeKey)}
                                      onMouseEnter={() => setHoveredTagDef(def)}
                                      onMouseLeave={() => setHoveredTagDef(null)}
                                      className={`text-[10px] font-sans font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-sahara-primary border-sahara-primary text-white scale-[1.02] shadow-2xs'
                                          : 'bg-white border-sahara-surface-dim hover:bg-sahara-clay/10 text-sahara-secondary'
                                      }`}
                                    >
                                      {lang === 'zh' ? def.labelZh : lang === 'ru' ? def.labelRu.replace(' х.', '') : def.labelBy.replace(' х.', '')}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Axis 2: Register - Ochre / Amber (Checkbox selecting multiple) */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <div className="sm:w-28 shrink-0 flex items-center justify-between">
                                <span className="text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest block">
                                  {lang === 'zh' ? '2. 语阶/寄存器语体' : lang === 'ru' ? '2. РЕГИСТР' : '2. РЭГІСТР'}
                                </span>
                                <span className="text-[10px] uppercase font-mono font-bold text-[#B66029]/50 text-right pr-2">
                                  {lang === 'zh' ? '多选' : lang === 'ru' ? 'мульти' : 'мульці'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                                {(['colloquial', 'official', 'religious', 'folk'] as RegisterType[]).map(regKey => {
                                  const def = TAG_DEFINITIONS[regKey];
                                  if (!def) return null;
                                  const isSelected = facet.registers.includes(regKey);
                                  return (
                                    <button
                                      key={regKey}
                                      onClick={() => toggleRegister(seg.id, regKey)}
                                      onMouseEnter={() => setHoveredTagDef(def)}
                                      onMouseLeave={() => setHoveredTagDef(null)}
                                      className={`text-[10px] font-sans font-black px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#B66029] border-[#B66029] text-white scale-[1.02] shadow-2xs'
                                          : 'bg-white border-sahara-surface-dim hover:bg-sahara-clay/10 text-sahara-secondary'
                                      }`}
                                    >
                                      {lang === 'zh' ? def.labelZh : lang === 'ru' ? def.labelRu : def.labelBy}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Words selection canvas row */}
                          <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-sans font-black uppercase tracking-wider text-sahara-secondary block mb-1">
                              {lang === 'zh' ? '3. 单词精细保真交互画布（支持选取词/词组）' : lang === 'ru' ? '3. ИНТЕРАКТИВНОЕ ПОЛОТНО СЛОВ' : '3. ІНТЭРАКТЫЎНАЕ ПАЛАТНО СЛОЎ'}
                            </span>

                            {/* Token canvas block */}
                            <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-4 sm:p-6 block leading-loose min-h-[50px] select-none">
                              {words.map((word, wordIdx) => {
                                // Check if this index belongs to any selected range
                                const isSelectionTarget = selectedIndices.includes(wordIdx);

                                // Check if this index is a component of an overall registered span
                                const matchingSpan = segmentSpans.find(s => s.startChar <= wordIdx && wordIdx <= s.endChar);
                                
                                let spanHighlightClasses = '';
                                if (matchingSpan) {
                                  spanHighlightClasses = matchingSpan.axis === 'contact'
                                    ? 'bg-green-100/90 text-green-950 border-b-2 border-green-600 font-bold hover:bg-green-200/90'
                                    : 'bg-stone-150 text-stone-900 border-b-2 border-stone-500 font-bold hover:bg-stone-250';
                                }

                                return (
                                  <span
                                    key={wordIdx}
                                    onClick={() => handleWordClick(seg.id, wordIdx)}
                                    className={`inline-block mr-1.5 px-1 py-0.5 text-sm sm:text-base cursor-pointer rounded transition-all transform hover:scale-[1.05] ${
                                      isSelectionTarget 
                                        ? 'bg-amber-100 ring-2 ring-amber-500 text-amber-950 scale-[1.05]' 
                                        : matchingSpan 
                                          ? spanHighlightClasses 
                                          : 'text-sahara-onbackground hover:bg-sahara-clay/20'
                                    }`}
                                    title={matchingSpan ? `${matchingSpan.tagId}: ${matchingSpan.note || ''}` : lang === 'zh' ? '点击可叠加选中或取消，双击/长按开始贴附标签' : 'Нажмите, чтобы выделить фрагмент'}
                                  >
                                    {word}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Span Insertion Prompt Bar */}
                            {selectedIndices.length > 0 && (
                              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-sans font-black uppercase text-amber-800 tracking-wider">
                                    {lang === 'zh' ? '已选片段:' : lang === 'ru' ? 'Выделенный фрагмент:' : 'Вылучаны фрагмент:'} «{selectedIndices.map(idx => words[idx]).join(' ')}»
                                  </span>
                                  <button
                                    onClick={() => clearWordSelection(seg.id)}
                                    className="text-xs text-amber-800 hover:underline font-black uppercase tracking-tight"
                                  >
                                    {t.lpCancel}
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  {/* Axis 3: Contact Insertions */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-sans font-black uppercase tracking-wider text-emerald-800 block">
                                      {lang === 'zh' ? '+ 标注至维度 3：接触语言现象 (绿色)' : lang === 'ru' ? '+ Добавить в Ось 3: Контактные явления (зелёный)' : '+ Дадаць у Ось 3: Кантактныя з’явы (зялёны)'}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {activeFilteredContactTags.map(tagDef => (
                                        <button
                                          key={tagDef.id}
                                          onClick={() => addSpanAnnotation(seg.id, tagDef.id, 'contact')}
                                          onMouseEnter={() => setHoveredTagDef(tagDef)}
                                          onMouseLeave={() => setHoveredTagDef(null)}
                                          className="text-[9px] font-sans font-black uppercase tracking-tight px-2 py-1 rounded bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 transition-all cursor-pointer"
                                        >
                                          {lang === 'zh' ? tagDef.labelZh : lang === 'ru' ? tagDef.labelRu : tagDef.labelBy}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Axis 4: Discourse Insertions */}
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-sans font-black uppercase tracking-wider text-stone-700 block">
                                      {lang === 'zh' ? '+ 标注至维度 4：话语标记与互动层级面 (灰色)' : lang === 'ru' ? '+ Добавить в Ось 4: Дискурс (серый)' : '+ Дадаць у Ось 4: Дыскарс (шэры)'}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {activeDiscourseTags.map(tagDef => (
                                        <button
                                          key={tagDef.id}
                                          onClick={() => addSpanAnnotation(seg.id, tagDef.id, 'discourse')}
                                          onMouseEnter={() => setHoveredTagDef(tagDef)}
                                          onMouseLeave={() => setHoveredTagDef(null)}
                                          className="text-[9px] font-sans font-black uppercase tracking-tight px-2 py-1 rounded bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 transition-all cursor-pointer"
                                        >
                                          {lang === 'zh' ? tagDef.labelZh : lang === 'ru' ? tagDef.labelRu : tagDef.labelBy}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Live view of annotated word fragments inside this single turn */}
                          {segmentSpans.length > 0 && (
                            <div className="border-t border-sahara-surface-dim/20 pt-4 space-y-2.5">
                              <span className="text-[10px] font-sans font-black uppercase tracking-wider text-sahara-primary block">
                                {lang === 'zh' ? '当前转步中已标注的所有片段:' : lang === 'ru' ? 'РАЗМЕЧЕННЫЕ ФРАГМЕНТЫ В РЕПЛИКЕ:' : 'РАЗМЕЧАНЫЯ ФРАГМЕНТЫ Ў РЭПЛІЦЫ:'}
                              </span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {segmentSpans.map(span => {
                                  const tagDef = TAG_DEFINITIONS[span.tagId];
                                  const tagLabel = tagDef ? (lang === 'zh' ? tagDef.labelZh : lang === 'ru' ? tagDef.labelRu : tagDef.labelBy) : span.tagId;
                                  
                                  return (
                                    <div
                                      key={span.id}
                                      className="bg-white border border-sahara-surface-dim/50 p-3 rounded-lg flex flex-col justify-between gap-2 shadow-3xs hover:border-sahara-primary/30 transition-all"
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-serif font-black text-xs text-sahara-onbackground">
                                            «{span.text}»
                                          </span>
                                          <span className={`text-[8px] font-sans font-black uppercase px-1.5 py-0.5 rounded ${
                                            span.axis === 'contact' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-stone-50 text-stone-800 border border-stone-200'
                                          }`}>
                                            {tagLabel}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => deleteSpanAnnotation(span.id)}
                                          className="p-1 text-sahara-secondary/30 hover:text-red-700 hover:bg-rose-50 rounded-sm cursor-pointer"
                                          title="Delete span"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* Note taking input inline for qualitative sociolinguist annotators */}
                                      <input
                                        type="text"
                                        placeholder={lang === 'zh' ? '细化语言学释义与补充说明...' : lang === 'ru' ? 'Лингвистическое толкование...' : 'Лінгвістычнае тлумачэнне...'}
                                        value={span.note || ''}
                                        onChange={(e) => updateSpanNote(span.id, e.target.value)}
                                        className="w-full text-[11px] font-sans border-0 border-b border-dashed border-sahara-surface-dim/40 focus:border-sahara-primary focus:outline-none focus:ring-0 px-0.5 py-0.5 text-sahara-secondary bg-transparent placeholder-sahara-secondary/30"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Footer and commentary of the turn */}
                          <div className="mt-5 bg-sahara-clay/5 border-t border-sahara-surface-dim/15 pt-4 rounded-b-lg flex items-start justify-between gap-4">
                            <div className="font-sans text-xs sm:text-sm text-sahara-secondary italic leading-relaxed">
                              <strong className="font-sans text-xs uppercase font-black text-sahara-primary tracking-wider mr-2 not-italic">{t.lpLabelCaption}</strong>
                              {seg.analysisNotes ? (
                                <span className="text-sahara-onbackground font-medium font-sans text-xs">{seg.analysisNotes}</span>
                              ) : (
                                <span className="text-sahara-secondary/50 font-serif leading-none block sm:inline mt-1 sm:mt-0">{t.lpPlaceholderEmptyNote}</span>
                              )}
                            </div>
                            
                            <button
                              onClick={() => startEditSegment(seg)}
                              className="font-sans text-xs font-black uppercase tracking-widest text-sahara-primary hover:text-[#86400f] transition-colors whitespace-nowrap cursor-pointer mt-1 sm:mt-0"
                            >
                              {t.lpEditLabel}
                            </button>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
