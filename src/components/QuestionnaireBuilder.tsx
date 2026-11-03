/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileDown, Sparkles, Plus, ToggleLeft, ToggleRight, Trash2, Edit2, 
  RefreshCw, EyeOff, Eye, Clipboard, AlertCircle, Check, X, HelpCircle, 
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Save, Calendar, 
  MapPin, User, Clock, CheckSquare, Award, ArrowUp, ArrowDown, BookOpen,
  Camera, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Questionnaire, QuestionBlock, Question } from '../types';
import { Language, translations } from '../lib/translations';
import { gsap } from 'gsap';
import { decodeGeminiError, DecodedError } from '../lib/errorDecoder';
import { generateText } from '../lib/gemini';
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } from 'docx';
import { usePersistentState } from '../lib/storage/usePersistentState';
import { getKV, setKV } from '../lib/storage/db';
import { useRecorder } from '../lib/recording/useRecorder';
import { exportSessionBlob } from '../lib/recording/recorder';
import { saveFile } from '../platform/files';

interface QuestionnaireBuilderProps {
  questionnaire: Questionnaire;
  onChange: (updated: Questionnaire) => void;
  lang: Language;
  researcherName?: string;
}

// Internal Localized terms for advanced field operations
const localT = {
  ru: {
    modeField: 'Полевой режим (Интервью)',
    modeEditor: 'Редактор анкеты (Шаблоны)',
    sessionPassport: 'ПАСПОРТ АКТИВНОГО ПОЛЕВОГО ИНТЕРВЬЮ',
    sessionInactive: 'СЕССИЯ НЕ НАЧАТА',
    sessionActive: 'ИДЁТ ЗАПИСЬ СЕССИИ',
    labelInformant: 'ШИФР ИНФОРМАНТА',
    labelLocation: 'ЛОКАЦИЯ ВЫЕЗДА',
    labelResearcher: 'ИССЛЕДОВАТЕЛЬ',
    labelDate: 'ДАТА ИНТЕРВЬЮ',
    labelTimer: 'СЕКУНДОМЕР И ТАЙМКОДЫ',
    btnStartTimer: 'Запуск записи',
    btnPauseTimer: 'Пауза',
    btnResetTimer: 'Сбросить',
    timeElapsed: 'Время записи',
    
    qProgress: 'Вопрос {current} из {total}',
    qProgressCompleted: 'Задано: {done}  |  Пропущено: {skipped}  |  Уточнить: {later}',
    
    statusAsked: 'Задан / Есть ответ',
    statusSkipped: 'Пропущен информантом',
    statusFollowup: 'Уточнить позже',
    statusUnasked: 'Не задан',
    
    noteLabel: 'ПОЛЕВАЯ ЗАМЕТКА / ВЫСКАЗЫВАНИЕ ИНФОРМАНТА:',
    notePlaceholder: 'Внесите реплику информанта, диалектные слова или свои заметки...',
    btnInsertTimecode: 'Вставить таймкод {time}',
    btnPushToDiary: '➜ в дневник исследователя',
    btnPushToDiarySuccess: 'Событие успешно скопировано в Дневник исследователя!',
    
    navPrev: 'Назад',
    navNext: 'Следующий вопрос',
    keyboardTip: 'Совет: используйте стрелочки ↑ и ↓ на клавиатуре для быстрого переключения вопросов',
    finishSessionTitle: 'СБОРКА ПРОТОКОЛА И СОХРАНЕНИЕ СЕССИИ',
    finishSessionDesc: 'Вы можете независимо экспортировать подробный размеченный протокол опроса со всеми таймкодами отметки и полевыми заметками в профессиональный формат .docx, либо сохранить его в Хронике Дневника на Дашборде.',
    btnFinishSession: 'Скачать протокол .DOCX с таймкодами',
    btnSaveToDiaryOnly: 'Записать сессию в Полевой дневник',
    btnResetAnswers: 'Очистить и начать новое интервью',
    confirmReset: 'Вы уверены, что хотите сбросить все текущие ответы, статусы и заметки этой сессии? Данные будут потеряны.',
    sessionFinishedMsg: 'Запись остановлена! Отчет с шифрами успешно сохранен в дневник и загружен в Вашу папку «Полевые записи» в разделе Загрузки устройства.',
    
    editorInlineAdd: 'Добавить новый вопрос в этот раздел',
    editorInlineSave: 'Сохранить',
    editorInlineCancel: 'Отмена',
    editorBlockEdit: 'Редактировать раздел'
  },
  by: {
    modeField: 'Палявы рэжым (Інтэрв’ю)',
    modeEditor: 'Рэдактар анкеты (Шаблоны)',
    sessionPassport: 'ПАШПАРТ АКТЫЎНАГА ПАЛЯВОГА ІНТЭРВ’Ю',
    sessionInactive: 'СЭСІЯ НЕ ПАЧАТА',
    sessionActive: 'ІДЗЕ ЗАПІС СЭСІІ',
    labelInformant: 'ШЫФР ІНФАРМАНТА',
    labelLocation: 'ЛАКАЦЫЯ НАЗІРАННЯ',
    labelResearcher: 'ДАСЛЕДЧЫК',
    labelDate: 'ДАТА ІНТЭРВ’Ю',
    labelTimer: 'СЕКУНДАМЕР І ТАЙМКОДЫ',
    btnStartTimer: 'Запуск запісу',
    btnPauseTimer: 'Паўза',
    btnResetTimer: 'Скінуць',
    timeElapsed: 'Час запісу',
    
    qProgress: 'Пытанне {current} з {total}',
    qProgressCompleted: 'Зададзена: {done}  |  Прапушчана: {skipped}  |  Удакладніць: {later}',
    
    statusAsked: 'Зададзена / Ёсць адказ',
    statusSkipped: 'Прапушчана інфармантам',
    statusFollowup: 'Удакладніць пазней',
    statusUnasked: 'Не зададзена',
    
    noteLabel: 'ПАЛЯВАЯ СКАРГЛА / ВЫКАЗВАННЕ ІНФАРМАНТА:',
    notePlaceholder: 'Унясіце рэпліку інфарманта, дыялектныя словы ці свае нататкі...',
    btnInsertTimecode: 'Уставіць таймкод {time}',
    btnPushToDiary: '➜ у дзённік даследчыка',
    btnPushToDiarySuccess: 'Падзея паспяхова скапіявана ў Дзённік даследчыка!',
    
    navPrev: 'Назад',
    navNext: 'Наступнае пытанне',
    keyboardTip: 'Парада: выкарыстоўвайце стрэлачкі ↑ і ↓ на клавіятуры для хуткага пераключэння пытанняў',
    finishSessionTitle: 'ЗБОРКА ПРАТАКОЛА І ЗАХАВАННЕ СЭСІІ',
    finishSessionDesc: 'Вы можаце незалежна экспартаваць падрабязны размечаны пратакол апытання з усімі таймкодамі адзнакі і палявымі нататкамі ў прафесійны фармат .docx, альбо захаваць яго ў Хроніцы Дзённіка на Дашбордзе.',
    btnFinishSession: 'Спампаваць пратакол .DOCX з таймкодамі',
    btnSaveToDiaryOnly: 'Запісаць сесію ў Палявы дзённік',
    btnResetAnswers: 'Ачысціць і пачаць новае інтэрв’ю',
    confirmReset: 'Вы ўпэўнены, што хочаце скінуць усе бягучыя адказы, статусы і нататкі гэтай сесіі? Дадзеныя будуць страчаныя.',
    sessionFinishedMsg: 'Запіс спынены! Справаздача з шыфрамі паспяхова захавана ў дзённік і спампавана ў Вашу тэчку «Полевыя запісы» ў раздзеле Спампоўкі прылады.',
    
    editorInlineAdd: 'Дадаць новае пытанне ў гэты раздзел',
    editorInlineSave: 'Захаваць',
    editorInlineCancel: 'Адмена',
    editorBlockEdit: 'Рэдагаваць раздзел'
  },
  zh: {
    modeField: '实地调查模式 (现场提问与笔记)',
    modeEditor: '问卷模板编辑器',
    sessionPassport: '当前实地访谈会话护照',
    sessionInactive: '会话未开始',
    sessionActive: '录音计时器进行中',
    labelInformant: '发音人代码 / 编号',
    labelLocation: '调研实地地点',
    labelResearcher: '调查人姓名',
    labelDate: '调研日期',
    labelTimer: '录音设备计时码',
    btnStartTimer: '启动计时',
    btnPauseTimer: '暂停',
    btnResetTimer: '重置',
    timeElapsed: '已录制时长',
    
    qProgress: '问题 {current} / 共 {total} 个',
    qProgressCompleted: '已提问: {done}  |  已跳过: {skipped}  |  待补充: {later}',
    
    statusAsked: '已提问 / 有效回答',
    statusSkipped: '发音人跳过/不答',
    statusFollowup: '留待后续追问',
    statusUnasked: '尚未提问',
    
    noteLabel: '田野现场札记 / 发音人声学现象快速转写:',
    notePlaceholder: '在此快速记录发音人口语特色、词汇混合、发音变体或现场插曲...',
    btnInsertTimecode: '插入当前计时戳 {time}',
    btnPushToDiary: '➜ 导出至田野日记',
    btnPushToDiarySuccess: '已成功将此段落备份导入至日记中！',
    
    navPrev: '上一个',
    navNext: '下一个',
    keyboardTip: '温馨提示：您可以在键盘上按 ↑ 或 ↓ 方向键来无感切换问题',
    finishSessionTitle: '归档、导出与协议生成器',
    finishSessionDesc: '您可以在此独立下载带有高精度计时标记与标注状态的 Microsoft Word (.docx) 格式专业调研协议，或一键归档存回至主页的学术田野日记。',
    btnFinishSession: '导出并下载带有时间戳的 Word .DOCX 协议',
    btnSaveToDiaryOnly: '将会话归档存入黑板田野日记',
    btnResetAnswers: '清空并开始下一次新访谈',
    confirmReset: '确定要清空本次访谈记录的状态与全部快速笔记吗？清除后不可撤销。',
    sessionFinishedMsg: '录音已停止！带编号的实地报告已保存至田野日记中，并已自动下载至设备“下载(Downloads)”目录下的“Полевые записи”文件夹中。',
    
    editorInlineAdd: '在此分支下新增访谈提问',
    editorInlineSave: '保存',
    editorInlineCancel: '取消',
    editorBlockEdit: '编辑本版块描述属性'
  }
};

export default function QuestionnaireBuilder({ questionnaire, onChange, lang, researcherName }: QuestionnaireBuilderProps) {
  // Modes: 'field' (large, warm, offline interview assistant) or 'editor' (management)
  const [activeMode, setActiveMode] = usePersistentState<'field' | 'editor'>('questionnaire_active_mode', 'field');

  // Session variables
  const [sessionInformant, setSessionInformant] = usePersistentState<string>('field_session_informant', '');
  const [sessionLocation, setSessionLocation] = usePersistentState<string>('field_session_location', '');
  const [sessionDate, setSessionDate] = usePersistentState<string>('field_session_date', new Date().toISOString().split('T')[0]);
  const [sessionResearcher, setSessionResearcher] = usePersistentState<string>('researcher_name', researcherName || '');

  // Robust Audio Recorder hook and stopwatch tracking
  const [timerActive, setTimerActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const {
    status: recorderStatus,
    audioLevel,
    alert: recorderAlert,
    requiresUserGesture,
    audioBlob,
    audioUrl,
    currentSession,
    unfinishedSessions,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resumeWithUserGesture,
    recoverSession,
    discardUnfinishedSession,
    cleanupAudio,
    getRealElapsedTimeMs,
    setAudioBlob,
    setAudioUrl,
  } = useRecorder();

  // Question individual responses status mapping (global keys)
  const [questionStatuses, setQuestionStatuses] = usePersistentState<Record<string, 'unasked' | 'asked' | 'skipped' | 'later'>>('field_session_statuses', {});
  const [questionNotes, setQuestionNotes] = usePersistentState<Record<string, string>>('field_session_notes', {});
  const [questionMarkedTimes, setQuestionMarkedTimes] = usePersistentState<Record<string, string>>('field_session_marked_times', {});

  // Selected question flat pointer active carousel
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // CulturalPhoto interface for material culture photofixation and attribution
  interface CulturalPhoto {
    id: string;
    imgData: string; // base64 string
    category: 'utensils' | 'buildings' | 'costume' | 'inventory' | 'other';
    title: string;
    age: string;
    description: string;
    timestamp: string; // stopwatch epoch timestamp e.g. "04:12"
  }

  // Material Culture Photos attributes state
  const [culturalPhotos, setCulturalPhotos] = usePersistentState<CulturalPhoto[]>('field_cultural_photos', []);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Photo attribution form states
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoCategory, setPhotoCategory] = useState<'utensils' | 'buildings' | 'costume' | 'inventory' | 'other'>('utensils');
  const [photoAge, setPhotoAge] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');

  // States for the inline Template Editor modes (no window.prompts!)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [addingQuestionToBlockId, setAddingQuestionToBlockId] = useState<string | null>(null);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockTitle, setEditingBlockTitle] = useState('');
  const [editingBlockDesc, setEditingBlockDesc] = useState('');

  // Legacy external import states
  const [importText, setImportText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [decodedError, setDecodedError] = useState<DecodedError | null>(null);
  const [isAiInAction, setIsAiInAction] = useState(false);
  const [showDisabledQuestions, setShowDisabledQuestions] = useState(true);
  const [activeImportTab, setActiveImportTab] = useState<'paste' | 'preset'>('paste');

  // Multi-language system translation mappings
  const t = translations[lang];
  const lt = localT[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // GSAP animation triggering for list
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.gsap-q-header', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      gsap.fromTo('.gsap-q-sidebar', { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', delay: 0.1 });
      gsap.fromTo('.gsap-q-card', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, ease: 'power2.out', delay: 0.2 });
    }, containerRef);
    return () => ctx.revert();
  }, [questionnaire.blocks.length, activeMode]);

  // Sync timers with robust recorder state and real elapsed time
  useEffect(() => {
    if (recorderStatus === 'recording') {
      setTimerActive(true);
      const interval = setInterval(() => {
        const ms = getRealElapsedTimeMs();
        setSecondsElapsed(Math.floor(ms / 1000));
      }, 500);
      return () => clearInterval(interval);
    } else if (recorderStatus === 'paused') {
      setTimerActive(false);
      const ms = getRealElapsedTimeMs();
      setSecondsElapsed(Math.floor(ms / 1000));
    } else {
      setTimerActive(false);
    }
  }, [recorderStatus, getRealElapsedTimeMs]);

  // Pre-load researcher name changes
  useEffect(() => {
    if (researcherName && researcherName !== 'Введите ФИО' && researcherName !== 'Увядзіце ПІБ' && researcherName !== '请输入姓名') {
      setSessionResearcher(researcherName);
    }
  }, [researcherName, setSessionResearcher]);

  // Help notification utility
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Generate flat questions mapping
  const flatQuestions = questionnaire.blocks
    .filter(b => b.enabled)
    .flatMap((b, bi) => b.questions.filter(q => q.enabled).map((q, qi) => ({
      ...q,
      blockId: b.id,
      blockTitle: b.title,
      blockIndex: bi,
      questionIndexInBlock: qi,
      colorToken: b.colorToken
    })));

  // Listen to keyboard up/down arrows for fast tactile controls in field (under un-focused states)
  useEffect(() => {
    if (activeMode !== 'field') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveQuestionIndex(prev => Math.min(prev + 1, Math.max(0, flatQuestions.length - 1)));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveQuestionIndex(prev => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, flatQuestions.length]);

  // Stopwatch standard calculation
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hrs > 0 ? String(hrs).padStart(2, '0') : null,
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  // Safe update wrapper
  const updateQuestionnaire = (updated: Questionnaire) => {
    onChange(updated);
    setKV('sociologist_questionnaire', updated).catch(console.error);
  };

  // Rule-based text file parser
  const parseLocally = (rawText: string) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const mockBlocks: QuestionBlock[] = [];
    let currentBlock: QuestionBlock | null = null;
    let colorIndex = 0;
    const colors: ('violet' | 'teal' | 'amber' | 'terracotta' | 'slate')[] = ['violet', 'teal', 'amber', 'terracotta', 'slate'];

    lines.forEach((line, index) => {
      const lineUpper = line.toUpperCase();
      const isHeader = lineUpper.startsWith('БЛОК') || 
                       lineUpper.startsWith('РАЗДЕЛ') || 
                       lineUpper.startsWith('ТЕМА') || 
                       lineUpper.startsWith('BLOCK') || 
                       lineUpper.startsWith('SECTION') || 
                       lineUpper.startsWith('THEME') || 
                       lineUpper.startsWith('板块') || 
                       lineUpper.startsWith('主题') || 
                       lineUpper.startsWith('章节') || 
                       (line.length < 60 && /^[А-ЯЁ\s\d\-:]{5,}$/.test(line));

      if (isHeader) {
        if (currentBlock) mockBlocks.push(currentBlock);
        colorIndex = mockBlocks.length % colors.length;
        currentBlock = {
          id: `block-${Date.now()}-${mockBlocks.length}`,
          title: line,
          description: lang === 'ru' ? 'Распознанный тематический блок вопросов.' : lang === 'by' ? 'Распазнаны тэматычны блок пытанняў.' : '解析的主题问题板块。',
          colorToken: colors[colorIndex],
          enabled: true,
          questions: []
        };
      } else {
        if (!currentBlock) {
          currentBlock = {
            id: `block-default-${Date.now()}`,
            title: lang === 'ru' ? 'Блок 1: Основные вопросы' : lang === 'by' ? 'Блок 1: Асноўныя пытанні' : '板块 1: 核心问题',
            description: lang === 'ru' ? 'Основные вопросы полевого исследования.' : lang === 'by' ? 'Асноўныя пытанні палявога даследавання.' : '实地调研的基础问题。',
            colorToken: 'slate',
            enabled: true,
            questions: []
          };
        }

        const cleanedText = line.replace(/^\d+[\.\)\-]\s*/, '').replace(/^\d+\.\d+[\.\)\-]?\s*/, '');
        const questionId = `q-${Date.now()}-${currentBlock.questions.length}-${index}`;
        currentBlock.questions.push({
          id: questionId,
          text: cleanedText,
          enabled: true,
          notes: ''
        });
      }
    });

    if (currentBlock) mockBlocks.push(currentBlock);

    if (mockBlocks.length > 0) {
      updateQuestionnaire({
        ...questionnaire,
        blocks: mockBlocks,
        createdAt: new Date().toISOString()
      });
      setImportText('');
      setErrorMessage('');
    } else {
      setErrorMessage(lang === 'ru' ? 'Не удалось автоматически распознать вопросы. Проверьте формат текста.' : lang === 'by' ? 'Не ўдалося аўтаматычна распазнаць пытанні. Праверце фармат тэксту.' : '未能自动识别问题。请检查大纲文本格式。');
    }
  };

  // AI assistant parser using Google AI Studio API key (server proxy)
  const parseWithAi = async () => {
    if (!importText.trim()) {
      setErrorMessage(lang === 'ru' ? 'Пожалуйста, введите текст опросника для разбора.' : lang === 'by' ? 'Калі ласка, увядзіце тэкст апытальніка для разбору.' : '亲，请输入大纲文本进行格式化解析。');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setDecodedError(null);
    setIsAiInAction(true);

    try {
      const resultText = await generateText({
        action: 'parse_questionnaire',
        text: importText,
        schemaType: 'questionnaire',
        prompt: 'Разбери этот полевой опросник/гайд для исследования на тематические блоки вопросов.'
      });

      const parsedData = JSON.parse(resultText);
      if (parsedData.blocks && Array.isArray(parsedData.blocks)) {
        const mappedBlocks: QuestionBlock[] = parsedData.blocks.map((b: any, bi: number) => {
          const colors: ('violet' | 'teal' | 'amber' | 'terracotta' | 'slate')[] = ['violet', 'teal', 'amber', 'terracotta', 'slate'];
          const colorToken = b.colorToken && colors.includes(b.colorToken) ? b.colorToken : colors[bi % colors.length];
          
          return {
            id: `block-${bi}-${Date.now()}`,
            title: b.title || `Блок ${bi + 1}`,
            description: b.description || 'Проанализированная тематическая группа вопросов.',
            colorToken: colorToken,
            enabled: true,
            questions: (b.questions || []).map((q: string, qi: number) => ({
              id: `q-${bi}-${qi}-${Date.now()}`,
              text: q,
              enabled: true
            }))
          };
        });

        updateQuestionnaire({
          id: `questionnaire-${Date.now()}`,
          title: parsedData.title || questionnaire.title || 'Новый импортированный опросник',
          blocks: mappedBlocks,
          createdAt: new Date().toISOString()
        });

        setImportText('');
        setErrorMessage('');
        setDecodedError(null);
      } else {
        throw new Error('Данные от AI не содержат блоков.');
      }
    } catch (err: any) {
      console.error('Error with AI parsing:', err);
      const decoded = decodeGeminiError(err, lang);
      setDecodedError(decoded);
      setErrorMessage(decoded.reason);
    } finally {
      setIsLoading(false);
      setIsAiInAction(false);
    }
  };

  const toggleBlock = (blockId: string) => {
    const updated = questionnaire.blocks.map(b => b.id === blockId ? { ...b, enabled: !b.enabled } : b);
    updateQuestionnaire({ ...questionnaire, blocks: updated });
  };

  const toggleQuestion = (blockId: string, questionId: string) => {
    const updated = questionnaire.blocks.map(b => {
      if (b.id === blockId) {
        const updatedQuestions = b.questions.map(q => q.id === questionId ? { ...q, enabled: !q.enabled } : q);
        return { ...b, questions: updatedQuestions };
      }
      return b;
    });
    updateQuestionnaire({ ...questionnaire, blocks: updated });
  };

  const deleteQuestion = (blockId: string, questionId: string) => {
    const updated = questionnaire.blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          questions: b.questions.filter(q => q.id !== questionId)
        };
      }
      return b;
    });
    updateQuestionnaire({ ...questionnaire, blocks: updated });
  };

  // INLINE editors - completely replaces previous popups
  const saveInlineQuestionText = (blockId: string, questionId: string) => {
    if (!editingQuestionText.trim()) return;
    const updated = questionnaire.blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          questions: b.questions.map(q => q.id === questionId ? { ...q, text: editingQuestionText.trim() } : q)
        };
      }
      return b;
    });
    updateQuestionnaire({ ...questionnaire, blocks: updated });
    setEditingQuestionId(null);
  };

  const saveInlineNewQuestion = (blockId: string) => {
    if (!newQuestionText.trim()) return;
    const updated = questionnaire.blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          questions: [
            ...b.questions,
            { id: `q-${Date.now()}-${b.questions.length}`, text: newQuestionText.trim(), enabled: true }
          ]
        };
      }
      return b;
    });
    updateQuestionnaire({ ...questionnaire, blocks: updated });
    setAddingQuestionToBlockId(null);
    setNewQuestionText('');
  };

  const saveInlineBlockHeader = (blockId: string) => {
    if (!editingBlockTitle.trim()) return;
    const updated = questionnaire.blocks.map(b => 
      b.id === blockId 
        ? { ...b, title: editingBlockTitle.trim(), description: editingBlockDesc.trim() } 
        : b
    );
    updateQuestionnaire({ ...questionnaire, blocks: updated });
    setEditingBlockId(null);
  };

  const changeBlockColor = (blockId: string, color: 'amber' | 'teal' | 'violet' | 'slate' | 'terracotta') => {
    const updated = questionnaire.blocks.map(b => b.id === blockId ? { ...b, colorToken: color } : b);
    updateQuestionnaire({ ...questionnaire, blocks: updated });
  };

  // Stopwatch instant note injection
  const injectStopwatchTimestamp = (qId: string) => {
    const stamp = `[${formatTime(secondsElapsed)}] `;
    const prevText = questionNotes[qId] || '';
    setQuestionNotes(p => ({
      ...p,
      [qId]: stamp + prevText
    }));
  };

  // Transfer specific question note context into the Field Diaries database
  const sendActiveTextToDiary = async (qText: string, status: string, notes: string) => {
    const entries = (await getKV<any[]>('field_diary')) || [];

    const currentStatusLabel = 
      status === 'asked' ? 'Задан / Есть ответ' : 
      status === 'skipped' ? 'Пропущен' : 
      status === 'later' ? 'Требует уточнения' : 'Не задан';

    const entry = {
      id: `diary-q-snapshot-${Date.now()}`,
      timestamp: `${new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'ru-RU')} ${new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      informantName: sessionInformant,
      location: sessionLocation,
      notes: `[ВЫСКАЗЫВАНИЕ ИЗ ОПРОСНИКА]\nВопрос: «${qText}»\nСтатус: ${currentStatusLabel}\n现场记实: ${notes || 'Без заметок'}`
    };

    const updated = [entry, ...entries];
    await setKV('field_diary', updated);
    showToast(lt.btnPushToDiarySuccess);
  };

  // Start or resume audio recording
  const startAudioRecording = async () => {
    try {
      if (recorderStatus === 'idle' || recorderStatus === 'completed' || recorderStatus === 'error') {
        await startRecording({
          informant: sessionInformant,
          location: sessionLocation,
          date: sessionDate,
          researcher: sessionResearcher,
        });
        setTimerActive(true);
        showToast(lang === 'ru' ? '🎤 Запись звука начата!' : lang === 'by' ? '🎤 Запіс гуку пачаты!' : '🎤 麦克风录音已启动！');
      } else if (recorderStatus === 'paused') {
        await resumeRecording();
        setTimerActive(true);
        showToast(lang === 'ru' ? '🎤 Запись звука возобновлена' : lang === 'by' ? '🎤 Запіс гуку адноўлены' : '🎤 录音已恢复');
      }
    } catch (err: any) {
      console.warn('Microphone access or MediaRecorder error:', err);
      showToast(lang === 'ru' ? '⚠️ Ошибка доступа к микрофону' : lang === 'by' ? '⚠️ Памылка доступу да мікрафона' : '⚠️ 麦克风访问失败');
    }
  };

  const pauseAudioRecording = async () => {
    if (recorderStatus === 'recording') {
      await pauseRecording();
      setTimerActive(false);
    }
  };

  const stopAudioRecording = async () => {
    if (recorderStatus === 'recording' || recorderStatus === 'paused') {
      await stopRecording();
      setTimerActive(false);
    }
  };

  const triggerAudioFileDownload = async (blobToDownload: Blob | null) => {
    const finalBlob = blobToDownload || audioBlob;
    if (!finalBlob) {
      showToast(lang === 'ru' 
        ? '⚠️ Вы еще не включали запись или она пуста' 
        : lang === 'by' 
        ? '⚠️ Вы яшчэ не ўключалі запіс або яна пустая' 
        : '⚠️ 录音文件空或未开启');
      return;
    }

    const cleanForFilename = (text: string) => {
      return text
        .replace(/[^a-zA-Z0-9а-яА-ЯёЁіІўЎ\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    };

    const safeInformant = cleanForFilename(sessionInformant) || 'Информант';
    const safeLocation = cleanForFilename(sessionLocation) || 'Локация';
    const safeResearcher = cleanForFilename(sessionResearcher) || 'Исследователь';
    const safeDate = cleanForFilename(sessionDate) || '2026';

    const filename = `Полевая_аудиозапись_Шифр_${safeInformant}_Локация_${safeLocation}_Исследователь_${safeResearcher}_Дата_${safeDate}.mp3`;

    try {
      await saveFile(finalBlob, filename, finalBlob.type || 'audio/mpeg');
      showToast(lang === 'ru' 
        ? 'Аудиозапись .MP3 успешно сохранена!' 
        : lang === 'by' 
        ? 'Аўдыязапіс .MP3 паспяхова захаваны!' 
        : 'MP3 recording saved successfully!');
    } catch (err: any) {
      console.error('Failed to download audio file', err);
      showToast(lang === 'ru' ? `Ошибка сохранения аудио: ${err.message || err}` : `Памылка захавання аўдыя: ${err.message || err}`);
    }
  };

  const downloadAudioRecording = async () => {
    let blobToDownload = audioBlob;
    if (recorderStatus === 'recording' || recorderStatus === 'paused') {
      blobToDownload = await stopRecording();
      setTimerActive(false);
    }
    if (!blobToDownload && currentSession) {
      blobToDownload = await exportSessionBlob(currentSession.id);
    }
    await triggerAudioFileDownload(blobToDownload);
  };

  // Start the device's camera stream for live photofixation
  const startCamera = async () => {
    try {
      setCapturedImageBase64(null);
      setCameraActive(true);
      // Let React mount the video element, then access getUserMedia
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera stream start failed:", err);
          showToast(lang === 'ru' 
            ? '⚠️ Камера недоступна (заблокировано или не поддерживается). Вы можете загрузить готовый файл.' 
            : '⚠️ Camera unavailable. Please upload a photo instead.');
          setCameraActive(false);
        }
      }, 150);
    } catch (e) {
      console.error(e);
    }
  };

  // Stop current active camera stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture current frame from the camera stream
  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCapturedImageBase64(dataUrl);
          stopCamera();
        } catch (err) {
          console.error("Failed to capture image data URL:", err);
        }
      }
    }
  };

  // Base64 file uploader fallback
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImageBase64(dataUrl);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  // Attach the current photo along with professional ethnological attributes to the state list
  const handleSavePhotoItem = () => {
    if (!capturedImageBase64) {
      showToast(lang === 'ru' 
        ? '⚠️ Сделайте снимок через камеру или загрузите файл изображения!' 
        : '⚠️ Please snapshot or choose an image file first!');
      return;
    }

    const currentTimestampString = formatTime(secondsElapsed);
    const newPhotoItem: CulturalPhoto = {
      id: 'photo_' + Date.now(),
      imgData: capturedImageBase64,
      category: photoCategory,
      title: photoTitle.trim() || (lang === 'ru' ? 'Безымянный артефакт' : 'Unnamed artifact'),
      age: photoAge.trim() || (lang === 'ru' ? 'неизвестно' : 'unknown'),
      description: photoDescription.trim(),
      timestamp: currentTimestampString
    };

    setCulturalPhotos(prev => [...prev, newPhotoItem]);
    
    // Clear and reset form fields
    setCapturedImageBase64(null);
    setPhotoTitle('');
    setPhotoCategory('utensils');
    setPhotoAge('');
    setPhotoDescription('');
    stopCamera();

    showToast(lang === 'ru' 
      ? '✅ Предмет материальной культуры сохранен и привязан к отчету!' 
      : '✅ Object saved and linked to report!');
  };

  // Delete specific cultural photo from list
  const handleDeletePhotoItem = (photoId: string) => {
    setCulturalPhotos(prev => prev.filter(p => p.id !== photoId));
    showToast(lang === 'ru' ? '🗑️ Фотофиксация предмета удалена' : '🗑️ Photograph removed');
  };

  // Mark status & automatically log the precision record stopwatch timecode
  const markQuestionStatus = (qId: string, status: 'unasked' | 'asked' | 'skipped' | 'later') => {
    setQuestionStatuses(prev => ({ ...prev, [qId]: status }));
    const currentCode = formatTime(secondsElapsed);
    setQuestionMarkedTimes(prev => ({ ...prev, [qId]: currentCode }));
    
    let label = '';
    if (lang === 'ru') {
      label = status === 'asked' ? 'Задан' : status === 'skipped' ? 'Пропущен' : 'Уточнить';
    } else if (lang === 'by') {
      label = status === 'asked' ? 'Заданы' : status === 'skipped' ? 'Прапушчаны' : 'Удакладніць';
    } else {
      label = status === 'asked' ? '已问' : status === 'skipped' ? '跳过' : '待追问';
    }
    
    showToast(`${label} • фиксированный таймкод: [${currentCode}]`);
  };

  const base64ToUint8Array = (base64Str: string) => {
    try {
      const parts = base64Str.split(',');
      const encoded = parts.length > 1 ? parts[1] : parts[0];
      const raw = window.atob(encoded);
      const rawLength = raw.length;
      const array = new Uint8Array(new ArrayBuffer(rawLength));
      for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }
      return array;
    } catch (e) {
      console.error("Base64 conversion failed:", e);
      return new Uint8Array();
    }
  };

  // Export interview session directly as a real .docx document (questions, status markings, timeline tags, and ethnographic notes)
  const exportSessionToDocx = () => {
    // 1. Explicitly stop the recording/timer (Остановка записи)
    setTimerActive(false);

    const asked = flatQuestions.filter(q => questionStatuses[q.id] === 'asked').length;
    const skipped = flatQuestions.filter(q => questionStatuses[q.id] === 'skipped').length;
    const later = flatQuestions.filter(q => questionStatuses[q.id] === 'later').length;

    try {
      // Build document children structure
      const children: any[] = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "ПОЛЕВОЙ ПРОТОКОЛ ФОРМАЛИЗОВАННОГО ОПРОСА",
              bold: true,
              size: 32,
              color: "B66029"
            })
          ]
        }),
        new Paragraph({ text: "" }),
        
        // Passport Cards
        new Paragraph({
          children: [
            new TextRun({ text: "ПАСПОРТ ЭТНОГРАФИЧЕСКОЙ СЕССИИ", bold: true, size: 24, color: "7C7948" })
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "Информант (Шифр): ", bold: true }),
            new TextRun({ text: sessionInformant || 'Без шифра' })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Локация выезда: ", bold: true }),
            new TextRun({ text: sessionLocation || 'Локация не указана' })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Исследователь (ФИО): ", bold: true }),
            new TextRun({ text: sessionResearcher || 'Не указан' })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Дата интервью: ", bold: true }),
            new TextRun({ text: sessionDate || 'Без даты' })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Длительность записи аудио: ", bold: true }),
            new TextRun({ text: formatTime(secondsElapsed) })
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Статистика сессии: ", bold: true }),
            new TextRun({ text: `Всего вопросов: ${flatQuestions.length} | Задано: ${asked} | Пропущено: ${skipped} | На уточнение: ${later}` })
          ]
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [
            new TextRun({ text: "РАЗМЕЧЕННЫЙ ОПРОСНЫЙ ЛИСТ С ЗАМЕТКАМИ И ТАЙМКОДАМИ", bold: true, size: 24, color: "7C7948" })
          ]
        }),
        new Paragraph({ text: "" })
      ];

      flatQuestions.forEach((q, idx) => {
        const statusValue = questionStatuses[q.id] || 'unasked';
        const statusStr = 
          statusValue === 'asked' ? '✅ ЗАДАН / ОТВЕТИЛ' : 
          statusValue === 'skipped' ? '❌ ПРОПУЩЕН' : 
          statusValue === 'later' ? '⏳ УТОЧНИТЬ' : '⚪ НЕ ЗАДАН';

        const markedTimecode = questionMarkedTimes[q.id];
        const markedTimecodeSuffix = markedTimecode ? ` (Время отметки на записи: ${markedTimecode})` : ' (Таймкод отсутствует)';

        const notesVal = questionNotes[q.id] || '';

        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Вопрос ${q.blockIndex + 1}.${q.questionIndexInBlock + 1}: ${q.text}`, bold: true, size: 20 })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `  Статус: `, bold: true, size: 18 }),
              new TextRun({ text: `${statusStr}${markedTimecodeSuffix}`, color: statusValue === 'asked' ? "2E7D32" : statusValue === 'skipped' ? "C62828" : statusValue === 'later' ? "EF6C00" : "757575", size: 18 })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `  Полевые заметки: `, bold: true, size: 18, color: "424242" }),
              new TextRun({ text: notesVal.trim() ? notesVal.trim() : "(Заметки пусты)", italics: !notesVal.trim(), size: 18, color: "212121" })
            ]
          }),
          new Paragraph({ text: "" })
        );
      });

      // Append material culture artifacts if any
      if (culturalPhotos && culturalPhotos.length > 0) {
        children.push(
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: "МАТЕРИАЛЬНАЯ КУЛЬТУРА (ФОТОФИКСАЦИЯ И АТРИБУЦИЯ)", bold: true, size: 24, color: "7C7948" })
            ]
          }),
          new Paragraph({ text: "" })
        );

        culturalPhotos.forEach((photo, pIdx) => {
          let catText = "";
          if (photo.category === 'utensils') {
            catText = lang === 'ru' ? "Утварь (предмет домашнего обихода / убранство)" : "Начынне (рэчы хатняга ўжытку / аздоба)";
          } else if (photo.category === 'buildings') {
            catText = lang === 'ru' ? "Постройка (жилище / хозяйственное сооружение)" : "Будынак (жыллё / гаспадарчая пабудова)";
          } else if (photo.category === 'costume') {
            catText = lang === 'ru' ? "Костюм (одежда / головной убор / текстиль)" : "Касцюм (адзенне / галаўны ўбор / тэкстыль)";
          } else if (photo.category === 'inventory') {
            catText = lang === 'ru' ? "Инвентарь (сельскагаспадарчая прылада / рамесны інструмент)" : "Інвентар (сельскагаспадарчая прылада / рамесны інструмент)";
          } else {
            catText = lang === 'ru' ? "Прочее / Иной культурный объект" : "Іншае / Іншы культурны аб'ект";
          }

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Предмет №${pIdx + 1}: ${photo.title}`, bold: true, size: 20, color: "B66029" })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `  Категория: `, bold: true, size: 18 }),
                new TextRun({ text: catText, size: 18 })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `  Примерный период/датировка: `, bold: true, size: 18 }),
                new TextRun({ text: photo.age || 'не указана', size: 18 })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `  Таймкод фиксации: `, bold: true, size: 18 }),
                new TextRun({ text: photo.timestamp || 'нет таймкода', size: 18 })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `  Описание и культурно-бытовой контекст: `, bold: true, size: 18 }),
                new TextRun({ text: photo.description || 'нет описания', size: 18 })
              ]
            }),
            new Paragraph({ text: "" })
          );

          try {
            const imgBytes = base64ToUint8Array(photo.imgData);
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: imgBytes,
                    type: "jpg",
                    transformation: {
                      width: 400,
                      height: 300
                    }
                  })
                ]
              }),
              new Paragraph({ text: "" })
            );
          } catch (imgError) {
            console.error("Failed to add image to word document:", imgError);
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `[Ошибка рендеринга изображения: ${imgError}]`, color: "FF0000", italics: true })
                ]
              }),
              new Paragraph({ text: "" })
            );
          }
        });
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      const cleanForFilename = (text: string) => {
        return text
          .replace(/[^a-zA-Z0-9а-яА-ЯёЁіІўЎ\s_-]/g, '')
          .trim()
          .replace(/\s+/g, '_');
      };

      const safeInformant = cleanForFilename(sessionInformant) || 'Информант';
      const safeLocation = cleanForFilename(sessionLocation) || 'Локация';
      const safeResearcher = cleanForFilename(sessionResearcher) || 'Исследователь';
      const safeDate = cleanForFilename(sessionDate) || '2026';

      const filename = `Полевые_записи_Шифр_${safeInformant}_Локация_${safeLocation}_Исследователь_${safeResearcher}_Дата_${safeDate}.docx`;

      Packer.toBlob(doc).then(async (blob) => {
        try {
          await saveFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          showToast(lang === 'ru' 
            ? 'Протокол в формате DOCX успешно сохранен!' 
            : lang === 'by'
            ? 'Пратакол у фармаце DOCX паспяхова захаваны!'
            : '访谈记录 Word 文档已成功生成并保存！');
        } catch (err: any) {
          console.error("Failed to save DOCX file:", err);
          showToast(lang === 'ru' ? `Ошибка сохранения DOCX: ${err.message || err}` : `Памылка захавання DOCX: ${err.message || err}`);
        }
      });

    } catch (err) {
      console.error("Failed to generate DOCX file: ", err);
      alert(lang === 'ru' ? "Ошибка во время сборки docx: " + err : "Памылка пры зборцы docx: " + err);
    }
  };

  // Save current report to the unified internal Field Diary
  const saveSessionToFieldDiary = async () => {
    // Stop recording when saving to diary
    if (recorderStatus === 'recording') {
      await pauseRecording();
    }
    setTimerActive(false);

    const asked = flatQuestions.filter(q => questionStatuses[q.id] === 'asked').length;
    const skipped = flatQuestions.filter(q => questionStatuses[q.id] === 'skipped').length;
    const later = flatQuestions.filter(q => questionStatuses[q.id] === 'later').length;

    let md = `## ИТОГОВЫЙ ПОЛЕВОЙ ПРОТОКОЛ ФОРМАЛИЗОВАННОГО ОПРОСА\n\n`;
    md += `**Информант (Шифр):** ${sessionInformant || 'Без шифра'}\n`;
    md += `**Локация выезда:** ${sessionLocation || 'Локация не указана'}\n`;
    md += `**Исследователь (ФИО):** ${sessionResearcher || 'Неизвестный исследователь'}\n`;
    md += `**Дата проведения:** ${sessionDate || 'Без даты'}\n`;
    md += `**Продолжительность записи:** ${formatTime(secondsElapsed)}\n`;
    md += `**Статистика сессии:** Задано ${asked}, Пропущено ${skipped}, Требуют уточнения ${later} (Всего активных вопросов: ${flatQuestions.length})\n\n`;
    md += `### РАЗМЕЧАННЫЕ ОТВЕТЫ И ПОЛЕВЫЕ ЗАМЕТКИ С ТАЙМКОДАМИ:\n\n`;

    flatQuestions.forEach((q, idx) => {
      const statusValue = questionStatuses[q.id] || 'unasked';
      const statusStr = 
        statusValue === 'asked' ? '✅ ЗАДАН / ОТВЕТИЛ' : 
        statusValue === 'skipped' ? '❌ ПРОПУЩЕН' : 
        statusValue === 'later' ? '⏳ УТОЧНИТЬ' : '⚪ НЕ ЗАДАН';

      const markedTimecode = questionMarkedTimes[q.id];
      const markedTimecodeSuffix = markedTimecode ? ` (Время отметки: ${markedTimecode})` : '';

      const notesVal = questionNotes[q.id] || '';

      md += `#### Вопрос ${q.blockIndex + 1}.${q.questionIndexInBlock + 1}: ${q.text}\n`;
      md += `*Статус:* ${statusStr}${markedTimecodeSuffix}\n`;
      if (notesVal.trim()) {
        md += `*Полевая заметка:* ${notesVal.trim()}\n`;
      } else {
        md += `*Полевая заметка:* (Записи отсутствуют)\n`;
      }
      md += `\n`;
    });

    const entries = (await getKV<any[]>('field_diary')) || [];

    const newDocument = {
      id: `diary-session-report-${Date.now()}`,
      timestamp: `${new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'ru-RU')} ${new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      informantName: sessionInformant,
      location: sessionLocation,
      notes: md
    };

    const updated = [newDocument, ...entries];
    await setKV('field_diary', updated);

    showToast(lang === 'ru' 
      ? 'Отчет сессии успешно зафиксирован в Хронике Дневника на Дашборде!' 
      : lang === 'by'
      ? 'Справаздача сесіі паспяхова зафіксавана ў Хроніцы Дзённіка на Дашбордзе!'
      : '会话报告已成功保存至田野日记 Chronicle 中！');
  };

  // Backward compatibility alias
  const finalizeSessionReporting = () => {
    exportSessionToDocx();
  };

  // Erase responses state, timer, notes, and timecodes for a clean new interview session
  const handleResetSessionData = async () => {
    if (confirm(lt.confirmReset)) {
      // 1. Reset component state values
      setQuestionStatuses({});
      setQuestionNotes({});
      setQuestionMarkedTimes({});
      setSecondsElapsed(0);
      setTimerActive(false);
      setActiveQuestionIndex(0);
      setCulturalPhotos([]);

      // 2. Discard and clean active/recorded audio streams
      await stopRecording();
      await cleanupAudio();

      showToast(lang === 'ru' 
        ? 'Все примечания, таймкоды, маркировки и аудиозаписи полностью очищены для начала нового интервью!' 
        : lang === 'by' 
        ? 'Усе заўвагі, таймкоды, маркіроўкі і аўдыязапісы цалкам ачышчаны для пачатку новага інтэрв’ю!' 
        : '全部随堂随记、标签、高精度时间锚点及语音记录已安全清空，可开启新访谈！');
    }
  };

  // Copy structured Markdown representation
  const copyToClipboard = () => {
    let markdown = `# ${questionnaire.title}\n\n`;
    questionnaire.blocks.filter(b => b.enabled).forEach((b, bi) => {
      markdown += `## ${t.blockWord} ${bi + 1}: ${b.title}\n`;
      if (b.description) markdown += `_${b.description}_\n\n`;
      
      const activeQs = b.questions.filter(q => q.enabled);
      activeQs.forEach((q, qi) => {
        markdown += `${bi + 1}.${qi + 1}. ${q.text}\n`;
      });
      markdown += '\n';
    });

    navigator.clipboard.writeText(markdown).then(() => {
      showToast(lang === 'ru' ? 'Markdown опросника скопирован!' : lang === 'by' ? 'Markdown апытальніка скапіяваны!' : 'Markdown大纲已复制！');
    });
  };

  const activeQuestion = flatQuestions[activeQuestionIndex];

  return (
    <div ref={containerRef} className="space-y-10 max-w-7xl mx-auto px-1 md:px-0">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#B66029] text-white px-6 py-3 rounded-xl shadow-lg font-sans font-bold text-sm tracking-wide z-50 flex items-center gap-2"
          >
            <CheckSquare className="w-5 h-5 text-white animate-bounce" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segmented Mode Selector Button Group */}
      <div className="flex bg-[#eCebeb] p-1.5 rounded-xl border border-sahara-surface-dim/40 max-w-md mx-auto shadow-2xs">
        <button
          onClick={() => setActiveMode('field')}
          className={`flex-1 py-3 text-center rounded-lg font-sans text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeMode === 'field' 
              ? 'bg-[#B66029] text-white font-black shadow-md scale-[1.01]' 
              : 'text-sahara-secondary hover:text-[#B66029] font-bold'
          }`}
        >
          <Award className="w-4 h-4" />
          {lt.modeField}
        </button>
        <button
          onClick={() => setActiveMode('editor')}
          className={`flex-1 py-3 text-center rounded-lg font-sans text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeMode === 'editor' 
              ? 'bg-[#B66029] text-white font-black shadow-md scale-[1.01]' 
              : 'text-sahara-secondary hover:text-[#B66029] font-bold'
          }`}
        >
          <Edit2 className="w-3.5 h-3.5" />
          {lt.modeEditor}
        </button>
      </div>

      {activeMode === 'field' ? (
        /* ======================== NEW FIELD MODE (MAIN) ======================== */
        <div className="space-y-8 animate-fade-in">
          
          {/* Unfinished Sessions Recovery Card */}
          {unfinishedSessions.length > 0 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-sans uppercase tracking-wider">
                  {lang === 'ru' ? `Обнаружена незавершенная аудиозапись (${unfinishedSessions.length})` : lang === 'by' ? `Знойдзены незакончаны аўдыязапіс (${unfinishedSessions.length})` : `Unfinished Recording Session (${unfinishedSessions.length})`}
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-sans">
                {lang === 'ru' 
                  ? 'Предыдущая сессия записи была прервана или вкладка была закрыта. Вы можете восстановить аудиозапись из локальной базы IndexedDB и выгрузить её.'
                  : lang === 'by'
                  ? 'Папярэдняя сесія запісу была перапынена або ўкладка была закрыта. Вы можаце аднавіць аўдыязапіс з IndexedDB і спампаваць яго.'
                  : 'A previous recording was interrupted or the tab was closed. You can recover the audio from IndexedDB.'}
              </p>
              <div className="space-y-2">
                {unfinishedSessions.map((s) => (
                  <div key={s.id} className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="font-bold text-sahara-primary">{s.informant || 'Без шифра'}</span>
                      <span className="text-sahara-secondary ml-2 font-mono">({new Date(s.createdAt).toLocaleString()})</span>
                      <span className="text-sahara-secondary/70 ml-2">Сегментов: {s.segments.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const b = await recoverSession(s);
                          if (b) {
                            showToast(lang === 'ru' ? 'Аудиозапись успешно восстановлена! Нажмите «Выгрузить MP3» для сохранения.' : 'Аўдыязапіс паспяхова адноўлены!');
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        {lang === 'ru' ? 'Восстановить' : lang === 'by' ? 'Аднавіць' : 'Recover'}
                      </button>
                      <button
                        type="button"
                        onClick={() => discardUnfinishedSession(s.id)}
                        className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                      >
                        {lang === 'ru' ? 'Удалить' : lang === 'by' ? 'Выдаліць' : 'Discard'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Passport Block */}
          <div className="gsap-q-header bg-[#faf8f5] border-2 border-[#e9e3d5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2.5 h-full bg-[#B66029]" />
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-[#e9e3d5] pb-4 gap-4">
              <div>
                <span className="font-sans text-[11px] uppercase tracking-widest font-black text-[#B66029] block mb-1">
                  {lt.sessionPassport}
                </span>
                <h2 className="text-2xl font-serif font-black text-sahara-primary flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${timerActive ? 'bg-red-600 animate-pulse' : 'bg-stone-400'}`} />
                  {timerActive ? lt.sessionActive : lt.sessionInactive}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono tracking-wider bg-sahara-clay/20 text-[#B66029] border border-[#B66029]/20 rounded-md px-3 py-1 font-black">
                  {lt.qProgressCompleted.replace('{done}', String(flatQuestions.filter(q => questionStatuses[q.id] === 'asked').length)).replace('{skipped}', String(flatQuestions.filter(q => questionStatuses[q.id] === 'skipped').length)).replace('{later}', String(flatQuestions.filter(q => questionStatuses[q.id] === 'later').length))}
                </span>
              </div>
            </div>

            {/* Recorder Alert Notice */}
            {recorderAlert && (
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-sans font-semibold ${
                recorderAlert.type === 'error'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{recorderAlert.text}</span>
                </div>
                {requiresUserGesture && (
                  <button
                    type="button"
                    onClick={resumeWithUserGesture}
                    className="px-3 py-1.5 bg-[#B66029] hover:bg-[#86400f] text-white rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 cursor-pointer shadow-xs"
                  >
                    {lang === 'ru' ? 'Возобновить запись' : lang === 'by' ? 'Узнавіць запіс' : 'Resume Recording'}
                  </button>
                )}
              </div>
            )}

            {/* Credential Attributes Mapping Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {lt.labelInformant}
                </label>
                <input
                  type="text"
                  value={sessionInformant}
                  onChange={(e) => setSessionInformant(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-md text-sm font-sans font-semibold text-sahara-onbackground focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {lt.labelLocation}
                </label>
                <input
                  type="text"
                  value={sessionLocation}
                  onChange={(e) => setSessionLocation(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-md text-sm font-sans font-semibold text-sahara-onbackground focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  {lt.labelResearcher}
                </label>
                <input
                  type="text"
                  value={sessionResearcher}
                  onChange={(e) => setSessionResearcher(e.target.value)}
                  className="w-full h-11 px-3 bg-[#eCebeb]/50 border border-[#e9e3d5]/80 text-sahara-secondary/80 rounded-md text-sm font-sans font-semibold focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {lt.labelDate}
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-md text-sm font-sans font-semibold text-sahara-onbackground focus:outline-none"
                />
              </div>
            </div>

            {/* Integrated Parallel dictaphone Timer */}
            <div className="bg-white/80 p-4 border border-[#e9e3d5]/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#B66029] shrink-0" />
                <div className="text-center sm:text-left">
                  <span className="block text-[10px] font-sans font-bold uppercase tracking-wider text-[#B66029]/70">{lt.timeElapsed}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl sm:text-2xl font-black text-sahara-primary">{formatTime(secondsElapsed)}</span>
                    {recorderStatus === 'recording' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sahara-clay/15 rounded-md border border-[#B66029]/20" title="Уровень звука микрофона">
                        <div className="w-14 h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-75 ${audioLevel < 0.01 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                            style={{ width: `${Math.min(100, Math.max(6, audioLevel * 300))}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-[#B66029]">
                          {audioLevel < 0.01 ? 'Тишина' : 'REC'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const nextState = !timerActive;
                    setTimerActive(nextState);
                    if (nextState) {
                      startAudioRecording();
                    } else {
                      pauseAudioRecording();
                    }
                  }}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all ${
                    timerActive 
                      ? 'bg-red-800 hover:bg-red-900 text-white animate-pulse' 
                      : 'bg-sahara-primary hover:bg-[#86400f] text-white'
                  }`}
                >
                  {timerActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {timerActive ? lt.btnPauseTimer : lt.btnStartTimer}
                </button>

                <button
                  type="button"
                  onClick={downloadAudioRecording}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 transition-all"
                  title="Скачать записанный аудиофайл"
                >
                  <FileDown className="w-4 h-4" />
                  {lang === 'ru' ? 'Выгрузить MP3' : lang === 'by' ? 'Выгрузіць MP3' : 'Export MP3'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(lang === 'ru' ? 'Очистить текущие показания секундомера и удалить сделанную аудиозапись?' : 'Ачысціць бягучыя паказанні секундамера і выдаліць зроблены аўдыязапіс?')) {
                      setSecondsElapsed(0);
                      setTimerActive(false);
                      stopAudioRecording();
                      cleanupAudio();
                      showToast(lang === 'ru' ? 'Секундомер и аудиозапись очищены' : 'Секундамер і аўдыязапіс ачышчаны');
                    }
                  }}
                  className="text-sahara-secondary/60 hover:text-sahara-primary p-2.5 hover:bg-sahara-clay/10 rounded-lg transition-colors cursor-pointer"
                  title="Erase stopwatch and recording"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Active Question Carousel and Sidebar */}
          {flatQuestions.length === 0 ? (
            <div className="text-center py-20 bg-white border border-sahara-surface-dim/40 rounded-xl space-y-3">
              <AlertCircle className="w-10 h-10 text-sahara-secondary/35 mx-auto" />
              <p className="font-serif text-sm font-medium italic text-sahara-secondary/80">Похоже, в анкете сейчас нет активных вопросов.</p>
              <button 
                onClick={() => setActiveMode('editor')} 
                className="text-xs uppercase font-extrabold tracking-wider text-[#B66029] border border-[#B66029] rounded px-4 py-2 hover:bg-sahara-clay/10 mt-2"
              >
                Активировать опросник в редакторе
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Focused Large Question Layout */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Active Card Body */}
                <div className="bg-[#faf8f5] border-2 border-[#e9e3d5] rounded-3xl p-6 sm:p-10 shadow-sm relative space-y-8">
                  
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between border-b border-[#e9e3d5]/60 pb-4">
                    <span className="font-semibold text-xs tracking-wider text-sahara-secondary uppercase font-sans flex items-center gap-2">
                      <span className="font-mono text-sm bg-[#B66029]/10 text-[#B66029] rounded px-2.5 py-0.5 font-black">
                        Блок {activeQuestion.blockIndex + 1}
                      </span>
                      {activeQuestion.blockTitle}
                    </span>
                    <span className="text-xs font-bold font-mono text-[#B66029]">
                      {lt.qProgress.replace('{current}', String(activeQuestionIndex + 1)).replace('{total}', String(flatQuestions.length))}
                    </span>
                  </div>

                  {/* Primary Large Display typography */}
                  <div className="space-y-2">
                    <p className="text-2xl sm:text-3xl lg:text-3.5xl font-serif font-black tracking-tight text-sahara-primary leading-tight">
                      {activeQuestion.text}
                    </p>
                  </div>

                  {/* Gigantic Status Buttons for ergonomics */}
                  <div className="space-y-4 pt-2">
                    <span className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                      Маркировка статуса вопроса в текущую сессию:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => markQuestionStatus(activeQuestion.id, 'asked')}
                        className={`py-4 rounded-xl text-xs sm:text-sm font-sans font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                          questionStatuses[activeQuestion.id] === 'asked'
                            ? 'bg-emerald-800 text-white shadow-md border-2 border-emerald-900 scale-[1.01]'
                            : 'bg-white border-2 border-[#e9e3d5] text-sahara-secondary hover:border-emerald-600 hover:text-emerald-800'
                        }`}
                      >
                        <Check className="w-5 h-5 shrink-0" />
                        {lt.statusAsked}
                      </button>

                      <button
                        onClick={() => markQuestionStatus(activeQuestion.id, 'skipped')}
                        className={`py-4 rounded-xl text-xs sm:text-sm font-sans font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                          questionStatuses[activeQuestion.id] === 'skipped'
                            ? 'bg-rose-900 text-white shadow-md border-2 border-rose-950 scale-[1.01]'
                            : 'bg-white border-2 border-[#e9e3d5] text-sahara-secondary hover:border-rose-600 hover:text-rose-900'
                        }`}
                      >
                        <X className="w-5 h-5 shrink-0" />
                        {lt.statusSkipped}
                      </button>

                      <button
                        onClick={() => markQuestionStatus(activeQuestion.id, 'later')}
                        className={`py-4 rounded-xl text-xs sm:text-sm font-sans font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                          questionStatuses[activeQuestion.id] === 'later'
                            ? 'bg-amber-700 text-white shadow-md border-2 border-amber-800 scale-[1.01]'
                            : 'bg-white border-2 border-[#e9e3d5] text-sahara-secondary hover:border-amber-500 hover:text-amber-700'
                        }`}
                      >
                        <HelpCircle className="w-5 h-5 shrink-0" />
                        {lt.statusFollowup}
                      </button>
                    </div>
                  </div>

                  {/* Context note and text area */}
                  <div className="space-y-2.5">
                    <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                      {lt.noteLabel}
                    </label>
                    <textarea
                      rows={4}
                      value={questionNotes[activeQuestion.id] || ''}
                      placeholder={lt.notePlaceholder}
                      onChange={(e) => setQuestionNotes(prev => ({ ...prev, [activeQuestion.id]: e.target.value }))}
                      className="w-full p-4 border border-[#e9e3d5] bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B66029] text-sm sm:text-base font-sans font-medium text-sahara-onbackground leading-relaxed shadow-3xs"
                    />
                    
                    {/* Dictaphone integration tools */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => injectStopwatchTimestamp(activeQuestion.id)}
                        className="px-4 py-2 bg-[#B66029]/10 hover:bg-[#B66029]/20 border border-[#B66029]/20 rounded-md text-xs font-bold text-[#B66029] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Clock className="w-4 h-4 shrink-0" />
                        {lt.btnInsertTimecode.replace('{time}', formatTime(secondsElapsed))}
                      </button>

                      <button
                        type="button"
                        onClick={() => sendActiveTextToDiary(activeQuestion.text, questionStatuses[activeQuestion.id] || 'unasked', questionNotes[activeQuestion.id] || '')}
                        className="px-4 py-2 bg-[#7C7948]/15 hover:bg-[#7C7948]/25 border border-[#7C7948]/30 rounded-md text-xs font-bold text-[#7C7948] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <BookOpen className="w-4 h-4 shrink-0" />
                        {lt.btnPushToDiary}
                      </button>
                    </div>
                  </div>

                </div>

                {/* Left/Right Stepper Action row with keyboard banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#eCebeb]/50 p-4 border border-sahara-surface-dim/35 rounded-2xl">
                  <button
                    onClick={() => setActiveQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={activeQuestionIndex === 0}
                    className="w-full sm:w-auto px-6 py-3.5 border-2 border-[#e9e3d5] bg-white text-sahara-secondary hover:text-[#B66029] hover:bg-sahara-clay/5 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {lt.navPrev}
                  </button>

                  <span className="font-sans text-[11px] font-bold text-center text-sahara-secondary/40 select-none hidden lg:block">
                    {lt.keyboardTip}
                  </span>

                  <button
                    onClick={() => setActiveQuestionIndex(prev => Math.min(prev + 1, flatQuestions.length - 1))}
                    disabled={activeQuestionIndex === flatQuestions.length - 1}
                    className="w-full sm:w-auto px-8 py-3.5 border-2 border-transparent bg-sahara-primary hover:bg-[#86400f] text-white disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs uppercase font-extrabold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    {lt.navNext}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 📸 ЭТНОГРАФИЧЕСКАЯ ФОТОФИКСАЦИЯ И АТРИБУЦИЯ ПРЕДМЕТОВ МАТЕРИАЛЬНОЙ КУЛЬТУРЫ */}
                <div className="bg-[#faf8f5] border-2 border-[#e9e3d5] rounded-3xl p-6 sm:p-10 shadow-sm relative space-y-8">
                  <div className="flex items-start justify-between border-b border-[#e9e3d5]/60 pb-4">
                    <div className="flex items-center gap-3">
                      <Camera className="w-6 h-6 text-[#B66029]" />
                      <div>
                        <h3 className="font-serif text-lg font-black text-sahara-primary uppercase tracking-tight">
                          {lang === 'ru' ? '📸 Материальная культура и фотофиксация' : lang === 'by' ? '📸 Матэрыяльная культура і фотафіксацыя' : '📸 Material Culture & Photo Attribution'}
                        </h3>
                        <p className="text-xs text-sahara-secondary/80 font-serif leading-relaxed mt-0.5">
                          {lang === 'ru' 
                            ? 'Съемка и научная атрибутация предметов материальной культуры (утварь, постройки, костюм, инвентарь) с экспортом фото в протокол DOCX.'
                            : lang === 'by'
                            ? 'Здымка і навуковая атрыбутацыя прадметаў матэрыяльнай культуры (начынне, будынкі, народны касцюм, інвентар) з экспартам фота ў пратакол DOCX.'
                            : 'Real-time photography, cataloging, and attributing of material culture artifacts (utensils, architecture, folk costume, tools) directly attached within your Word document report.'}
                        </p>
                      </div>
                    </div>
                    {culturalPhotos.length > 0 && (
                      <span className="font-mono text-xs font-black bg-[#B66029]/10 text-[#B66029] px-2.5 py-1 rounded-full shrink-0">
                        {lang === 'ru' ? `Экспортируется: ${culturalPhotos.length}` : lang === 'by' ? `Экспартуецца: ${culturalPhotos.length}` : `Attached: ${culturalPhotos.length}`}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Camera Control Panel / Upload Container */}
                    <div className="space-y-4">
                      <div className="relative aspect-video bg-black rounded-lg border border-stone-300 overflow-hidden flex flex-col items-center justify-center text-center p-4">
                        {cameraActive ? (
                          <>
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
                              <button
                                type="button"
                                onClick={takeSnapshot}
                                className="px-4 py-2 bg-[#B66029] hover:bg-[#8d481f] text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                {lang === 'ru' ? 'Сделать снимок' : lang === 'by' ? 'Зрабіць здымак' : 'Take Photo'}
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="px-3 py-2 bg-stone-700 hover:bg-stone-800 text-white rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                {lang === 'ru' ? 'Отмена' : lang === 'by' ? 'Адмена' : 'Cancel'}
                              </button>
                            </div>
                          </>
                        ) : capturedImageBase64 ? (
                          <>
                            <img 
                              src={capturedImageBase64} 
                              alt="Captured Preview" 
                              className="absolute inset-0 w-full h-full object-contain bg-stone-900"
                              referrerPolicy="no-referrer"
                            />
                            <div 
                              className="absolute top-2 right-2 bg-stone-900/80 hover:bg-stone-900 hover:scale-105 rounded-full p-2 text-white cursor-pointer transition-transform flex items-center justify-center" 
                              onClick={() => setCapturedImageBase64(null)}
                            >
                              <X className="w-4 h-4" />
                            </div>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
                              <label className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all flex items-center gap-1">
                                <Image className="w-3 h-3" />
                                {lang === 'ru' ? 'Переснять / заменить' : lang === 'by' ? 'Перазняць / замяніць' : 'Replace Photo'}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment" 
                                  onChange={handleImageFileUpload} 
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-3 p-6 text-stone-400">
                            <Camera className="w-12 h-12 mx-auto stroke-1 text-stone-500" />
                            <div>
                              <p className="text-xs font-bold text-stone-300">
                                {lang === 'ru' ? 'Камера не активна' : lang === 'by' ? 'Камера не актыўная' : 'Camera inactive'}
                              </p>
                              <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                                {lang === 'ru' 
                                  ? 'Сделайте мгновенное фото через камеру устройства или выберите файл изображения с диска' 
                                  : lang === 'by' 
                                  ? 'Зрабіце імгненнае фота праз камеру прылады або выберыце файл выявы з дыска' 
                                  : 'Capture with your device camera or upload an image file'}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="w-full sm:w-auto px-4 py-2.5 bg-[#B66029] hover:bg-[#86400f] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Camera className="w-4 h-4" />
                                {lang === 'ru' ? 'Веб-камера' : lang === 'by' ? 'Вэб-камера' : 'Webcam'}
                              </button>
                              
                              <label className="w-full sm:w-auto px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white border border-stone-700 hover:border-stone-600 rounded-lg text-xs font-bold uppercase tracking-wider text-center cursor-pointer transition-all flex items-center justify-center gap-1.5">
                                <Image className="w-4 h-4" />
                                {lang === 'ru' ? 'Фото с диска' : lang === 'by' ? 'Фота з дыска' : 'Upload File'}
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment" 
                                  onChange={handleImageFileUpload} 
                                  className="hidden" 
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Scientific Attribution Metadata Fields Container */}
                    <div className="space-y-4">
                      {/* Name of the Item */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                          {lang === 'ru' ? 'Название предмета / Объекта' : lang === 'by' ? 'Назва прадмета / Аб\'екта' : 'Artifact Name'}
                        </label>
                        <input
                          type="text"
                          value={photoTitle}
                          onChange={(e) => setPhotoTitle(e.target.value)}
                          placeholder={lang === 'ru' ? 'например: Макитра для замеса теста' : lang === 'by' ? 'напрыклад: Макітра для цеста' : 'e.g. Clay baking pot'}
                          className="w-full h-10 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-lg text-sm text-sahara-onbackground focus:outline-none"
                        />
                      </div>

                      {/* Category Selector */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                          {lang === 'ru' ? 'Категория материальной культуры' : lang === 'by' ? 'Катэгорыя матэрыяльнай культуры' : 'Cultural Category'}
                        </label>
                        <select
                          value={photoCategory}
                          onChange={(e) => setPhotoCategory(e.target.value as any)}
                          className="w-full h-10 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-lg text-sm text-sahara-onbackground focus:outline-none"
                        >
                          <option value="utensils">{lang === 'ru' ? '🏺 Утварь (посуда, обиход, убранство)' : lang === 'by' ? '🏺 Начынне (посуд, ужытак, аздабленне)' : '🏺 Utensils & Living Items'}</option>
                          <option value="buildings">{lang === 'ru' ? '🏠 Постройка (хата, хлев, колодец, забор)' : lang === 'by' ? '🏠 Будынак (хата, хлеў, калодзеж, плот)' : '🏠 Architecture & Shelter'}</option>
                          <option value="costume">{lang === 'ru' ? '👗 Костюм (одежда, вышивка, фартук, обувь)' : lang === 'by' ? '👗 Касцюм (адзенне, вышыўка, фартух, абутак)' : '👗 Folk Costume & Textile'}</option>
                          <option value="inventory">{lang === 'ru' ? '🌾 Инвентарь (сельхозорудие, прялка, станок)' : lang === 'by' ? '🌾 Інвентар (сельгаспрылада, калаўрот, кросны)' : '🌾 Tooling & Craft Guild'}</option>
                          <option value="other">{lang === 'ru' ? '📦 Прочее / Иная материальная форма' : lang === 'by' ? '📦 Іншае / Іншая матэрыяльная форма' : '📦 Miscellaneous Artifact'}</option>
                        </select>
                      </div>

                      {/* Approximate Period */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                          {lang === 'ru' ? 'Примерная датировка / Возраст' : lang === 'by' ? 'Прыкладная датыроўка / Узрост' : 'Estimated Period'}
                        </label>
                        <input
                          type="text"
                          value={photoAge}
                          onChange={(e) => setPhotoAge(e.target.value)}
                          placeholder={lang === 'ru' ? 'например: Конец XIX в., бытовал до 1970-х' : lang === 'by' ? 'напрыклад: Канец ХІХ ст., ужываўся да 1970-х' : 'e.g. End of 19th Century'}
                          className="w-full h-10 px-3 bg-white border border-[#e9e3d5] focus:ring-2 focus:ring-[#B66029] rounded-lg text-sm text-sahara-onbackground focus:outline-none"
                        />
                      </div>

                      {/* Description Annotator */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                          {lang === 'ru' ? 'Описание, конструкция и контекст бытования' : lang === 'by' ? 'Апісанне, канструкцыя і кантэкст ужывання' : 'Scientific Context Note'}
                        </label>
                        <textarea
                          rows={2}
                          value={photoDescription}
                          onChange={(e) => setPhotoDescription(e.target.value)}
                          placeholder={lang === 'ru' ? 'Диалектное название, материал, декор, как изготовили...' : lang === 'by' ? 'Дыялектная назва, матэрыял, дэкор, як вырабілі...' : 'Dialect name, materials used, ornaments, heritage status...'}
                          className="w-full p-2 border border-[#e9e3d5] bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B66029] text-xs text-sahara-onbackground"
                        />
                      </div>

                      {/* Attach Artifact Button */}
                      <button
                        type="button"
                        onClick={handleSavePhotoItem}
                        className="w-full py-3 bg-[#7C7948] hover:bg-[#5f5d37] text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-3xs hover:-translate-y-0.5"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        {lang === 'ru' ? 'Добавить и прикрепить фото к отчету' : lang === 'by' ? 'Дадаць і прымацаваць фота да справаздачы' : 'Attach Artifact & Photo to Report'}
                      </button>
                    </div>
                  </div>

                  {/* Attached Photos Grid Preview List */}
                  {culturalPhotos.length > 0 && (
                    <div className="border-t border-[#e9e3d5]/60 pt-4 space-y-3">
                      <span className="block text-[10px] font-sans font-black uppercase text-[#B66029] tracking-widest">
                        {lang === 'ru' ? 'ПРИКРЕПЛЕННЫЕ ПРЕДМЕТЫ МАТЕРИАЛЬНОЙ КУЛЬТУРЫ:' : lang === 'by' ? 'ПРЫМАЦАВАНЫЯ ПРАДМЕТЫ МАТЭРЫЯЛЬНАЙ КУЛЬТУРЫ:' : 'LOCALLY STORED CULTURAL PHOTOS & ATTRIBUTIONS:'}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {culturalPhotos.map((photo) => {
                          let catBadge = "";
                          if (photo.category === 'utensils') catBadge = lang === 'ru' ? "🏺 Утварь" : "🏺 Начынне";
                          else if (photo.category === 'buildings') catBadge = lang === 'ru' ? "🏠 Постройка" : "🏠 Будынак";
                          else if (photo.category === 'costume') catBadge = lang === 'ru' ? "👗 Костюм" : "👗 Касцюм";
                          else if (photo.category === 'inventory') catBadge = lang === 'ru' ? "🌾 Инвентарь" : "🌾 Інвентар";
                          else catBadge = lang === 'ru' ? "📦 Иное" : "📦 Іншае";

                          return (
                            <div 
                              key={photo.id}
                              className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col space-y-3 relative group overflow-hidden shadow-4xs"
                            >
                              <div className="aspect-video bg-stone-100 rounded-lg overflow-hidden relative">
                                <img 
                                  src={photo.imgData} 
                                  alt={photo.title}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="absolute top-2 left-2 bg-stone-900/85 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                  {catBadge}
                                </span>
                                {photo.timestamp && (
                                  <span className="absolute bottom-2 right-2 bg-[#B66029]/90 text-white text-[9px] font-mono tracking-wider font-extrabold px-1.5 py-0.5 rounded">
                                    ⏱️ {photo.timestamp}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <h4 className="font-serif text-sm font-bold text-sahara-primary truncate">
                                  {photo.title}
                                </h4>
                                <p className="text-[10px] text-stone-500 font-serif">
                                  <span className="font-sans font-bold text-[9px] text-[#7C7948] uppercase tracking-wider mr-1">Датировка:</span>
                                  {photo.age}
                                </p>
                                {photo.description && (
                                  <p className="text-[10px] text-stone-600 font-serif bg-stone-50 p-2 rounded border border-stone-100 italic line-clamp-2 leading-relaxed">
                                    {photo.description}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePhotoItem(photo.id)}
                                className="absolute top-3 right-3 bg-red-800 hover:bg-red-900 text-white p-1.5 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer shadow"
                                title="Удалить прикрепленное фото"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Completion aggregation card */}
                <div className="bg-[#faf8f5]/80 border border-[#e9e3d5] rounded-2xl p-6 sm:p-8 space-y-4">
                  <div className="flex items-start gap-4">
                    <CheckSquare className="w-6 h-6 text-[#B66029] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-serif text-lg font-black text-sahara-primary uppercase tracking-tight">
                        {lt.finishSessionTitle}
                      </h3>
                      <p className="text-xs sm:text-sm text-sahara-secondary/90 leading-relaxed mt-1 font-serif">
                        {lt.finishSessionDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 pt-3 w-full">
                    <button
                      onClick={exportSessionToDocx}
                      className="flex-1 px-5 py-4 bg-[#B66029] hover:bg-[#8d481f] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <FileDown className="w-4 h-4 shrink-0 animate-bounce" />
                      {lt.btnFinishSession}
                    </button>
                    <button
                      onClick={downloadAudioRecording}
                      className="flex-1 px-5 py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <FileDown className="w-4 h-4 shrink-0" />
                      {lang === 'ru' ? 'Выгрузить аудиозапись .MP3' : lang === 'by' ? 'Выгрузіць аўдыязапіс .MP3' : 'Download Audio .MP3'}
                    </button>
                    <button
                      onClick={saveSessionToFieldDiary}
                      className="flex-1 px-5 py-4 bg-[#7C7948] hover:bg-[#5f5d37] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <BookOpen className="w-4 h-4 shrink-0" />
                      {lt.btnSaveToDiaryOnly}
                    </button>
                    <button
                      onClick={handleResetSessionData}
                      className="px-4 py-4 border border-red-300 hover:bg-red-50 text-red-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      {lt.btnResetAnswers}
                    </button>
                  </div>
                </div>

              </div>

              {/* Session Navigator Sidebar (Right panel) */}
              <div className="lg:col-span-4 bg-white border border-[#e9e3d5] rounded-3xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-sahara-surface-dim/30">
                  <span className="font-sans text-[11px] first-letter:uppercase font-black tracking-wider text-sahara-primary">
                    СПИСОК ВОПРОСОВ ({flatQuestions.length})
                  </span>
                  <span className="font-mono text-[10px] text-sahara-secondary tracking-widest font-bold">
                    INDEX
                  </span>
                </div>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {flatQuestions.map((q, idx) => {
                    const stat = questionStatuses[q.id] || 'unasked';
                    const active = idx === activeQuestionIndex;
                    const commentText = questionNotes[q.id] || '';

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setActiveQuestionIndex(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-start gap-2.5 cursor-pointer hover:border-sahara-primary/30 ${
                          active 
                            ? 'bg-sahara-clay/10 border-sahara-primary' 
                            : 'bg-stone-50/40 border-stone-150'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          stat === 'asked' ? 'bg-emerald-700' :
                          stat === 'skipped' ? 'bg-stone-400' :
                          stat === 'later' ? 'bg-amber-600 animate-pulse' :
                          'bg-stone-200'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <span className="block text-[9.5px] uppercase font-mono font-bold text-sahara-secondary tracking-tight">
                            Вопрос {q.blockIndex + 1}.{q.questionIndexInBlock + 1}
                          </span>
                          <span className={`block font-serif text-xs leading-relaxed truncate ${
                            active ? 'font-bold text-sahara-primary' : 'text-sahara-onbackground/80'
                          }`}>
                            {q.text}
                          </span>
                          {commentText.trim() && (
                            <span className="block text-[9px] text-[#B66029] italic truncate mt-0.5">
                              * Note: {commentText}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      ) : (
        /* ======================== REFACTORED TEMPLATE EDITOR (STREAMLINED) ======================== */
        <div className="space-y-12 animate-fade-in">
          
          {/* Main Title Block */}
          <div className="gsap-q-header bg-white p-8 border border-sahara-surface-dim/40 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-xs">
            <div>
              <span className="font-sans text-xs uppercase tracking-widest font-black text-sahara-primary block mb-1.5">
                {t.qTitle}
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-sahara-primary">
                {questionnaire.title}
              </h2>
              <p className="font-serif text-sm text-sahara-secondary mt-2 max-w-2xl leading-relaxed">
                {t.qSubtitle}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <button
                onClick={() => setShowDisabledQuestions(!showDisabledQuestions)}
                className="px-6 py-3 bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary text-sahara-secondary hover:text-sahara-primary rounded-md text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-3xs"
              >
                {showDisabledQuestions ? t.btnHideDisabled : t.btnShowDisabled}
              </button>
              
              <button
                onClick={copyToClipboard}
                className="px-6 py-3 bg-sahara-primary hover:bg-[#86400f] text-white text-xs font-bold uppercase tracking-widest transition-all rounded-md shadow-md cursor-pointer flex items-center gap-2 hover:scale-[1.01]"
              >
                <Clipboard className="w-4 h-4" />
                {t.btnCopyMd}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Box: External Input parsed via Gemini or regex */}
            <div className="lg:col-span-4 space-y-8 col-start-1">
              <div className="gsap-q-sidebar bg-white p-6 sm:p-8 border border-sahara-surface-dim/40 rounded-xl space-y-6 shadow-xs">
                <span className="font-sans text-[11px] uppercase font-extrabold text-sahara-primary tracking-widest block mb-1">
                  {t.importHeader}
                </span>
                <h3 className="font-serif text-xl font-black text-sahara-primary flex items-center gap-2">
                  <FileDown className="w-6 h-6 text-sahara-primary" />
                  {t.importTitle}
                </h3>
                
                <p className="font-sans text-sahara-secondary text-xs sm:text-sm leading-relaxed">
                  {t.importDesc}
                </p>

                <div className="flex border-b border-sahara-surface-dim/20 text-xs font-bold font-sans">
                  <button
                    onClick={() => setActiveImportTab('paste')}
                    className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer uppercase tracking-wider text-[11px] ${
                      activeImportTab === 'paste' ? 'border-sahara-primary text-sahara-primary font-black' : 'border-transparent text-sahara-secondary/50'
                    }`}
                  >
                    {t.tabRawText}
                  </button>
                  <button
                    onClick={() => setActiveImportTab('preset')}
                    className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer uppercase tracking-wider text-[11px] ${
                      activeImportTab === 'preset' ? 'border-sahara-primary text-sahara-primary font-black' : 'border-transparent text-sahara-secondary/50'
                    }`}
                  >
                    {t.tabInstructions}
                  </button>
                </div>

                {activeImportTab === 'paste' ? (
                  <div className="space-y-6">
                    <textarea
                      id="raw-import-area"
                      rows={5}
                      placeholder={t.importPlaceholder}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="w-full p-4 text-xs rounded-md bg-sahara-clay/5 border border-sahara-surface-dim/50 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-mono leading-relaxed text-sahara-onbackground"
                    ></textarea>

                    {decodedError ? (
                      <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-3 font-sans text-xs">
                        <div className="flex items-start gap-2 text-red-900 font-extrabold pb-2 border-b border-red-200">
                          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[8.5px] uppercase font-mono text-red-600 mb-0.5">Ошибка: {decodedError.code}</span>
                            <span className="font-serif font-black">{decodedError.title}</span>
                          </div>
                        </div>
                        <p>{decodedError.reason}</p>
                        <button
                          onClick={() => { parseLocally(importText); setDecodedError(null); }}
                          className="w-full py-2 bg-red-800 hover:bg-red-900 text-white font-bold text-xs uppercase tracking-wider rounded"
                        >
                          Локальный разбор (Офлайн)
                        </button>
                      </div>
                    ) : errorMessage ? (
                      <div className="p-3 bg-red-50 border border-red-250 rounded text-xs text-red-700 font-sans">
                        {errorMessage}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2.5">
                      <button
                        onClick={parseWithAi}
                        disabled={isLoading || !importText.trim()}
                        className="w-full py-3 bg-sahara-primary hover:bg-[#86400f] text-white text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 rounded-md shadow-md disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
                        {isLoading ? '...' : t.btnAiParse}
                      </button>
                      <button
                        onClick={() => parseLocally(importText)}
                        disabled={isLoading || !importText.trim()}
                        className="w-full py-3 bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary text-sahara-secondary hover:text-sahara-primary text-xs font-black uppercase tracking-widest transition-all rounded-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-3xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t.btnLocalParse}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-sahara-secondary space-y-4 font-sans">
                    <p>{t.importGuideText}</p>
                    <div className="bg-sahara-clay/5 p-4 rounded-md border border-sahara-surface-dim/30 font-mono text-[10px] whitespace-pre-wrap leading-relaxed text-sahara-onbackground">
{lang === 'zh' ? `板块 1：语言学问卷
- 童年时说哪种母语？
- 重视双语沟通吗？` : `БЛОК 1: ЯЗЫКОВАЯ БИОГРАФИЯ
- На каком наречии пели колыбельные?
- Какой язык считаете родным?`}
                    </div>
                    <button
                      onClick={() => setImportText(lang === 'zh' ? `板块 1：个人成长背景\n- 童年时期家庭成员使用哪种语言沟通？\n- 您如何看待方言的存续？` : `БЛОК 1: ЯЗЫКОВАЯ БИОГРАФИЯ\n- Какими языками владели ваши предки?\n- Какой язык считаете основным?`)}
                      className="w-full py-2.5 bg-white hover:bg-sahara-background text-sahara-primary border border-sahara-surface-dim/75 rounded text-xs uppercase font-black tracking-wider"
                    >
                      {t.btnLoadExample}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right block layout */}
            <div className="lg:col-span-8 space-y-10">
              <span className="font-sans text-xs uppercase tracking-widest font-extrabold text-sahara-primary block border-b border-sahara-surface-dim/30 pb-3">
                {t.qHierarchy} ({questionnaire.blocks.length})
              </span>

              {questionnaire.blocks.map((block, blockIndex) => {
                const hasActive = block.questions.some(q => q.enabled);
                const countOfEnabled = block.questions.filter(q => showDisabledQuestions || q.enabled).length;

                if (!showDisabledQuestions && !hasActive) {
                  return null;
                }

                const isEditingBlockStr = editingBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    className={`gsap-q-card bg-white border border-sahara-surface-dim/40 rounded-xl overflow-hidden shadow-xs transition-all duration-200 ${
                      !block.enabled ? 'opacity-60 saturate-50 bg-[#fbf9f9]' : ''
                    }`}
                  >
                    {/* Inline Header Editor */}
                    <div className="p-5 sm:p-6 border-b border-sahara-surface-dim/30 bg-sahara-clay/5">
                      {isEditingBlockStr ? (
                        <div className="space-y-3 bg-white p-4 border border-[#e9e3d5] rounded-xl">
                          <div>
                            <label className="block text-[10px] font-sans font-extrabold text-sahara-primary mb-1">Название раздела:</label>
                            <input
                              type="text"
                              value={editingBlockTitle}
                              onChange={(e) => setEditingBlockTitle(e.target.value)}
                              className="w-full px-3 py-2 text-sm border-2 border-sahara-surface-dim rounded focus:outline-none focus:border-sahara-primary font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-sans font-extrabold text-[#B66029] mb-1">Краткое описание / контекст:</label>
                            <textarea
                              value={editingBlockDesc}
                              rows={2}
                              onChange={(e) => setEditingBlockDesc(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-sahara-surface-dim rounded focus:outline-none text-sahara-secondary"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => saveInlineBlockHeader(block.id)}
                              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold"
                            >
                              {lt.editorInlineSave}
                            </button>
                            <button
                              onClick={() => setEditingBlockId(null)}
                              className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-xs font-bold"
                            >
                              {lt.editorInlineCancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="font-sans text-[10px] sm:text-xs uppercase font-black tracking-widest px-2.5 py-0.5 border border-sahara-primary/20 bg-sahara-clay/15 rounded text-sahara-primary">
                                {t.blockWord} {blockIndex + 1}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {(['slate', 'violet', 'teal', 'amber', 'terracotta'] as const).map(c => (
                                  <button
                                    key={c}
                                    onClick={() => changeBlockColor(block.id, c)}
                                    className={`w-3.5 h-3.5 rounded-full border border-stone-250 ${
                                      c === 'violet' ? 'bg-[#974811]' :
                                      c === 'teal' ? 'bg-[#765848]' :
                                      c === 'amber' ? 'bg-[#636032]' :
                                      c === 'terracotta' ? 'bg-orange-850' : 'bg-stone-300'
                                    } ${block.colorToken === c ? 'ring-2 ring-sahara-primary scale-110' : 'opacity-40'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <h3 className="font-serif text-xl font-black text-sahara-primary flex items-center gap-2">
                              {block.title}
                              <button
                                onClick={() => {
                                  setEditingBlockId(block.id);
                                  setEditingBlockTitle(block.title);
                                  setEditingBlockDesc(block.description);
                                }}
                                className="text-sahara-secondary/50 hover:text-sahara-primary p-1 cursor-pointer"
                                title="Edit header attributes inline"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </h3>
                            <p className="font-serif text-xs text-sahara-secondary leading-relaxed">{block.description}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                            <button
                              onClick={() => {
                                setAddingQuestionToBlockId(block.id);
                                setNewQuestionText('');
                              }}
                              className="px-4 py-2 bg-sahara-primary hover:bg-[#86400f] text-white rounded text-xs font-black uppercase tracking-wider cursor-pointer"
                            >
                              + Вопрос
                            </button>
                            <button onClick={() => toggleBlock(block.id)} className="cursor-pointer">
                              {block.enabled ? (
                                <ToggleRight className="w-8 h-8 text-sahara-primary" />
                              ) : (
                                <ToggleLeft className="w-8 h-8 text-sahara-secondary/40" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Adding Question Inline Form */}
                    {addingQuestionToBlockId === block.id && (
                      <div className="p-4 bg-[#faf8f5] border-b border-sahara-surface-dim/30 space-y-2">
                        <span className="block text-[10px] font-sans font-black uppercase text-[#B66029]">{lt.editorInlineAdd}:</span>
                        <input
                          type="text"
                          value={newQuestionText}
                          placeholder="Например: Как в вашей деревне называют радугу?"
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          className="w-full px-3 py-2 text-sm border-2 border-sahara-primary/30 rounded focus:border-sahara-primary focus:outline-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => saveInlineNewQuestion(block.id)}
                            className="px-3 py-1 bg-sahara-primary hover:bg-[#8a4a1a] text-white rounded text-xs font-semibold"
                          >
                            Добавить
                          </button>
                          <button
                            onClick={() => setAddingQuestionToBlockId(null)}
                            className="px-3 py-1 bg-stone-200 text-stone-700 rounded text-xs font-semibold"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Questions Body Group */}
                    {countOfEnabled === 0 ? (
                      <div className="p-8 text-center text-sahara-secondary/40 text-xs italic">
                        {t.emptyBlock}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-sahara-surface-dim/20 border-t border-sahara-surface-dim/30">
                        {block.questions.map((question, qIndex) => {
                          if (!showDisabledQuestions && !question.enabled) return null;

                          const isEditingQ = editingQuestionId === question.id;

                          return (
                            <div
                              key={question.id}
                              className={`bg-white p-4 flex items-start gap-3 transition-all hover:bg-sahara-clay/5 ${
                                !question.enabled ? 'bg-stone-50/70 text-sahara-secondary/45 saturate-50' : ''
                              }`}
                            >
                              <span className="font-mono text-xs text-sahara-primary mt-1 font-bold select-none shrink-0">
                                {blockIndex + 1}.{qIndex + 1}
                              </span>

                              <div className="flex-1 min-w-0">
                                {isEditingQ ? (
                                  <div className="space-y-2">
                                    <textarea
                                      rows={2}
                                      value={editingQuestionText}
                                      onChange={(e) => setEditingQuestionText(e.target.value)}
                                      className="w-full p-2 border border-sahara-primary text-xs font-serif rounded focus:outline-none"
                                    />
                                    <div className="flex gap-2.5">
                                      <button
                                        onClick={() => saveInlineQuestionText(block.id, question.id)}
                                        className="px-2 py-1 bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded"
                                      >
                                        ОК
                                      </button>
                                      <button
                                        onClick={() => setEditingQuestionId(null)}
                                        className="px-2 py-1 bg-stone-200 text-stone-700 font-bold text-[10px] uppercase tracking-wider rounded"
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <p className={`font-serif text-sm text-sahara-onbackground leading-relaxed break-words ${!question.enabled ? 'line-through text-sahara-secondary/40' : 'font-normal'}`}>
                                      {question.text}
                                    </p>
                                    {question.notes && (
                                      <p className="font-sans text-[10px] text-sahara-primary mt-1 italic">
                                        * {question.notes}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {!isEditingQ && (
                                <div className="flex items-center gap-1 shrink-0 self-start">
                                  <button
                                    onClick={() => {
                                      setEditingQuestionId(question.id);
                                      setEditingQuestionText(question.text);
                                    }}
                                    className="text-sahara-secondary/50 hover:text-sahara-primary p-1 hover:bg-sahara-background rounded cursor-pointer"
                                    title="Edit text inline"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => toggleQuestion(block.id, question.id)}
                                    className={`p-1 hover:bg-sahara-background rounded cursor-pointer ${
                                      question.enabled ? 'text-sahara-primary' : 'text-sahara-secondary/35'
                                    }`}
                                  >
                                    {question.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => deleteQuestion(block.id, question.id)}
                                    className="text-sahara-secondary/50 hover:text-red-700 p-1 hover:bg-red-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
