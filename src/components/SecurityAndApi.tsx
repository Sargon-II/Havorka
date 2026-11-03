/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Key, ShieldAlert, ShieldCheck, ExternalLink, Copy, Check, Terminal, PlayCircle, Loader2, AlertCircle, Bot, Cpu, Sparkles, FileAudio, Trash2, UploadCloud, Volume2, RefreshCw, Database, HardDrive, Activity, Download } from 'lucide-react';
import { PromptPack, ModelGuide } from '../types';
import { DEFAULT_PROMPT_PACKS, DEFAULT_MODEL_GUIDES } from '../data/defaultData';
import { Language } from '../lib/translations';
import { decodeGeminiError, DecodedError } from '../lib/errorDecoder';
import { getApiKey, setApiKey, clearApiKey } from '../lib/apiKey';
import { generateText } from '../lib/gemini';
import { usePersistentState } from '../lib/storage/usePersistentState';
import { getStoragePersistenceStatus, requestStoragePersistence, StoragePersistenceStatus } from '../lib/storage/persistence';
import {
  getDiagnosticLog,
  getDiagnosticLogStats,
  clearDiagnosticLog,
  buildDiagnosticExportContent,
} from '../lib/diagnostics/log';
import { saveFile } from '../platform/files';
import {
  getAndroidSaveTarget,
  setAndroidSaveTarget,
  AndroidSaveTarget,
} from '../platform/fileSaveDialog';

interface SecurityAndApiProps {
  lang: Language;
}

export default function SecurityAndApi({ lang }: SecurityAndApiProps) {
  const [userApiKey, setUserApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [decodedError, setDecodedError] = useState<DecodedError | null>(null);
  const [androidSavePref, setAndroidSavePref] = useState<AndroidSaveTarget>(getAndroidSaveTarget());

  // API Key Status Machine
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'offline'>('idle');
  const [keyStatusError, setKeyStatusError] = useState<DecodedError | null>(null);
  
  // Prompt selection and sandbox
  const [selectedPromptId, setSelectedPromptId] = useState(DEFAULT_PROMPT_PACKS[0].id);
  const [customPrompts, setCustomPrompts] = usePersistentState<PromptPack[]>('custom_prompt_packs', []);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [sandboxText, setSandboxText] = useState('');
  const [sandboxMode, setSandboxMode] = useState<'text' | 'audio'>('text');
  const [sandboxResult, setSandboxResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [audioFile, setAudioFile] = useState<{ data: string; name: string; size: number; mimeType: string } | null>(null);
  const [audioError, setAudioError] = useState<string>('');

  // Storage persistence status
  const [persistenceStatus, setPersistenceStatus] = useState<StoragePersistenceStatus>({ supported: false, persisted: false });
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  // Diagnostics log status
  const [diagStats, setDiagStats] = useState<{ count: number; bytes: number; maxLines: number; maxBytes: number }>({
    count: 0,
    bytes: 0,
    maxLines: 800,
    maxBytes: 60 * 1024,
  });
  const [isExportingDiag, setIsExportingDiag] = useState(false);
  const [isClearingDiag, setIsClearingDiag] = useState(false);
  const [diagActionMessage, setDiagActionMessage] = useState<string | null>(null);

  // Guide selection states (relocated to 4th tab)
  const [selectedGuideId, setSelectedGuideId] = useState<string>(DEFAULT_MODEL_GUIDES[0].id);
  const [guides] = useState<ModelGuide[]>(DEFAULT_MODEL_GUIDES);

  // Local translations for dynamic guides
  const tLocal = {
    ru: {
      pAiGuides: 'ИНСТРУКЦИИ ПО ЗАПУСКУ ИИ (LLM)',
      pModel: 'Модель:',
      pStepsHeader: 'Пошаговый алгоритм запуска:',
      pTipsHeader: '* Полезно:',
    },
    by: {
      pAiGuides: 'ІНСТРУКЦЫІ ПА ЗАПУСКУ ІІ (LLM)',
      pModel: 'Мадэль:',
      pStepsHeader: 'Пакрокавы алгарытм запуску:',
      pTipsHeader: '* Карысна:',
    },
    zh: {
      pAiGuides: 'AI 大模型启动与部署指南',
      pModel: '大模型:',
      pStepsHeader: '配置步骤:',
      pTipsHeader: '* 建议和技巧:',
    }
  }[lang];

  const getGuideSteps = (modelName: string) => {
    if (modelName === 'google-ai-studio') {
      return {
        title: lang === 'ru' ? 'Интеграция с Google AI Studio' : lang === 'by' ? 'Інтэграцыя з Google AI Studio' : 'Google AI Studio 调用手册',
        recommended: 'Gemini 2.5 Flash / Pro',
        steps: lang === 'ru' ? [
          'Откройте личный кабинет Google AI Studio (aistudio.google.com)',
          'Скопируйте системный промпт из нашей карточки выше',
          'Вставьте промпт в поле System Instruction',
          'В правое окно вставьте транскрипт беседы и запустите разбор'
        ] : lang === 'by' ? [
          'Адкрыйце асабісты кабінет Google AI Studio (aistudio.google.com)',
          'Скапіруйте сістэмны промпт з нашай карткі вышэй',
          'Устаўце промпт у поле System Instruction',
          'У правае акно ўстаўце транскрыпт гутаркі і запусціце разбор'
        ] : [
          '登录您的 Google AI Studio 开发者主页 (aistudio.google.com)',
          '拷贝本系统窗格里渲染的 System Instruction 提示词',
          '贴入 AI Studio 的左侧配置栏 of System Instructions 中',
          '在右侧用户框内输入采访录音转写文稿，点击 Run 获得结构化输出'
        ],
        tips: lang === 'ru' ? 'Снимает лимиты, гарантирует конфиденциальность и нулевое логирование.' : lang === 'by' ? 'Здымае ліміты, гарантуе канфідэнцыяльнасць і нулявое лагаванне.' : '不仅免费无配额限制，而且数据隐私完全受保障，不会被用于后续预训练。'
      };
    } else if (modelName === 'qwen') {
      return {
        title: lang === 'ru' ? 'Интеграция с Qwen Chat' : lang === 'by' ? 'Інтэграцыя з Qwen Chat' : '阿里巴巴通义千问 Qwen 指引',
        recommended: 'Qwen 2.5-72B-Instruct',
        steps: lang === 'ru' ? [
          'Скопируйте выбранный системный промпт',
          'В чате укажите модели: "Действуй строго по правилам...", затем вставьте промпт',
          'Отправьте стенограмму для глубокой фонологической русификации'
        ] : lang === 'by' ? [
          'Скапіруйце абраны сістэмны промпт',
          'У чаце пазначце мадэлі: "Дзейнічай строга па правілах...", затым уставіць промпт',
          'Адпраўце стенограму для глыбокай фаналагічнай русіфікацыі'
        ] : [
          '完整复制带有 [警告说明] 的系统提示词模板',
          '在会话窗口先发送：“请严格扮演社会语言学家，按下方规则评测：”并贴入提示词',
          '随后贴入完整的白俄罗斯多语转写对话进行高精度语言变种诊断'
        ],
        tips: lang === 'ru' ? 'Превосходно справляется со славянскими этнолектами.' : lang === 'by' ? 'Цудоўна спраўляецца са славянскімі этналектамі.' : '对于东欧/斯拉夫语系混合体（特拉相ка、乌克兰夹杂等）具备极强的常识理解力。'
      };
    } else {
      return {
        title: lang === 'ru' ? 'Интеграция с DeepSeek' : lang === 'by' ? 'Інтэграцыя з DeepSeek' : 'DeepSeek 满血版部署流程',
        recommended: 'DeepSeek-Chat (V3 API)',
        steps: lang === 'ru' ? [
          'Зарегистрируйте токен на платформе разработчика (deepseek.com)',
          'Передайте промпт в параметр "system", а реплики — в "user"',
          'Проанализируйте синтаксическую кодировку польских заимствований'
        ] : lang === 'by' ? [
          'Зарэгіструйце токен на платформе распрацоўшчыка (deepseek.com)',
          'Передайте промпт у параметр "system", а рэплікі — у "user"',
          'Прааналізуйце сінтаксічную кадзіроўку польскіх запазычанняў'
        ] : [
          '在开发者控制台申请 API Key 认证密钥 (deepseek.com)',
          '在消息数组的 System 元素中传载此提示词，User 元素承载访谈文稿',
          '分析传回的 JSON 以高保真度标注波兰语系和西斯拉夫融合特征'
        ],
        tips: lang === 'ru' ? 'Самое экономичное решение для пакетной разметки больших archives.' : lang === 'by' ? 'Самае эканамічнае рэшэнне для пакетнай разметкі вялікіх архіваў.' : '非常节省成本，是批量处理数百万字超长口述史料的性价比之首。'
      };
    }
  };

  const verifyApiKeyCheck = async (forceKey?: string) => {
    const keyToTest = forceKey !== undefined ? forceKey : userApiKey.trim();
    if (!keyToTest) {
      setKeyStatus('idle');
      setKeyStatusError(null);
      return;
    }

    setKeyStatus('validating');
    setKeyStatusError(null);

    try {
      // Use clean proxy call with extremely short test instructions to verify key health
      const testResult = await generateText({
        action: 'test_health',
        text: 'Ping check',
        prompt: 'Say exactly "OK" without punctuation.'
      });

      if (testResult && (testResult.toLowerCase().includes('ok') || testResult.length > 0)) {
        setKeyStatus('valid');
      } else {
        setKeyStatus('invalid');
        setKeyStatusError({
          code: 'MODEL_RESPONSE_UNEXPECTED',
          title: lang === 'ru' ? 'Ошибка ответа модели' : lang === 'by' ? 'Памылка адказу мадэлі' : '接口应答异常',
          reason: lang === 'ru' ? 'Модель не смогла передать корректный контрольный токен.' : lang === 'by' ? 'Мадэль не змагла перадаць правільны кантрольны токен.' : '云端模型未能正确返回用以校验活跃状态的测试包。',
          solution: lang === 'ru' ? 'Проверьте доступность API серверов и активность лимитов.' : lang === 'by' ? 'Праверце даступнасць API і квоты.' : '请稍后刷新页面或检查大模型账户设置。'
        });
      }
    } catch (err: any) {
      console.error('API validation test failed:', err);
      const decoded = decodeGeminiError(err, lang);
      
      const errStr = String(err.message || err).toLowerCase();
      if (errStr.includes('fetch') || errStr.includes('network') || errStr.includes('http_error') || errStr.includes('failed to fetch')) {
        setKeyStatus('offline');
      } else {
        setKeyStatus('invalid');
      }
      setKeyStatusError(decoded);
    }
  };

  // Load API Key and Storage Persistence status on mount
  useEffect(() => {
    const savedKey = getApiKey();
    if (savedKey) {
      setUserApiKey(savedKey);
      verifyApiKeyCheck(savedKey);
    }

    getStoragePersistenceStatus().then(setPersistenceStatus);
    refreshDiagStats();
  }, []);

  const refreshDiagStats = async () => {
    try {
      const stats = await getDiagnosticLogStats();
      setDiagStats(stats);
    } catch (err) {
      console.warn('Failed to load diag log stats:', err);
    }
  };

  const handleExportDiag = async () => {
    setIsExportingDiag(true);
    try {
      const lines = await getDiagnosticLog();
      const text = buildDiagnosticExportContent(lines);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const filename = `havorka-diag-${datePart}-${timePart}.txt`;
      await saveFile(blob, filename, 'text/plain');
      setDiagActionMessage(
        lang === 'ru'
          ? 'Журнал успешно экспортирован'
          : lang === 'by'
          ? 'Журнал паспяхова экспартаваны'
          : '诊断日志已成功导出'
      );
      setTimeout(() => setDiagActionMessage(null), 3500);
    } catch (err: any) {
      console.error('Diagnostic log export failed:', err);
    } finally {
      setIsExportingDiag(false);
    }
  };

  const handleClearDiag = async () => {
    const confirmText =
      lang === 'ru'
        ? 'Очистить журнал диагностики записи?'
        : lang === 'by'
        ? 'Ачысціць журнал дыягностыкі запісу?'
        : '确定要清空录音诊断日志吗？';
    if (!window.confirm(confirmText)) return;

    setIsClearingDiag(true);
    try {
      await clearDiagnosticLog();
      await refreshDiagStats();
      setDiagActionMessage(
        lang === 'ru' ? 'Журнал очищен' : lang === 'by' ? 'Журнал ачышчаны' : '日志已清空'
      );
      setTimeout(() => setDiagActionMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to clear diagnostic log:', err);
    } finally {
      setIsClearingDiag(false);
    }
  };

  const handleRequestPersist = async () => {
    setIsRequestingPersist(true);
    await requestStoragePersistence();
    const updated = await getStoragePersistenceStatus();
    setPersistenceStatus(updated);
    setIsRequestingPersist(false);
  };

  const handleSaveKey = async () => {
    const trimmed = userApiKey.trim();
    if (!trimmed) return;

    setApiKey(trimmed);
    setIsSaved(true);
    await verifyApiKeyCheck(trimmed);
    
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  const handleClearKey = () => {
    clearApiKey();
    setUserApiKey('');
    setKeyStatus('idle');
    setKeyStatusError(null);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      window.location.reload();
    }, 1500);
  };

  const allPrompts = [...DEFAULT_PROMPT_PACKS, ...customPrompts];
  const selectedPrompt = allPrompts.find(p => p.id === selectedPromptId) || allPrompts[0];

  const handleSaveCustomPrompt = () => {
    if (!newPromptTitle.trim() || !newPromptText.trim()) {
      alert(lang === 'ru' ? 'Заполните название и текст промпта!' : 'Запоўніце назву і тэкст промпту!');
      return;
    }
    const newId = `custom-${Date.now()}`;
    const newPack: PromptPack = {
      id: newId,
      title: newPromptTitle.trim(),
      stage: 'fieldwork',
      modelTarget: 'universal',
      description: lang === 'ru' ? 'Пользовательский системный шаблон' : 'Карыстальніцкі сістэмны шаблон',
      promptText: newPromptText.trim(),
      tags: ['custom']
    };
    const updated = [...customPrompts, newPack];
    setCustomPrompts(updated);
    setSelectedPromptId(newId);
    setNewPromptTitle('');
    setNewPromptText('');
    setIsCustomPromptOpen(false);
  };

  const handleDeleteCustomPrompt = (idToDelete: string) => {
    const updated = customPrompts.filter(p => p.id !== idToDelete);
    setCustomPrompts(updated);
    if (selectedPromptId === idToDelete) {
      setSelectedPromptId(DEFAULT_PROMPT_PACKS[0].id);
    }
  };

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 20) {
      setAudioError(
        lang === 'ru' 
          ? 'Размер файла превышает 20 МБ (лимит для инлайновой передачи base64)' 
          : lang === 'by' 
          ? 'Памер файла перавышае 20 МБ (ліміт для перадачы base64)' 
          : '文件大小超过 20MB（base64 传输限制）'
      );
      return;
    }

    setAudioError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(',')[1];
      setAudioFile({
        data: base64Data,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'audio/mp3'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAudio = () => {
    setAudioFile(null);
    setAudioError('');
  };

  const handleRunSandbox = async () => {
    if (!sandboxText.trim() && !audioFile) {
      setErrorMessage(
        lang === 'ru' 
          ? 'Введите текст или загрузите аудиофайл для анализа' 
          : lang === 'by' 
          ? 'Увядзіце тэкст ці загрузіце аўдыяфайл для аналізу' 
          : '请输入文本或上传音频文件进行分析'
      );
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    setDecodedError(null);
    setSandboxResult('');
    
    try {
      const result = await generateText({
        action: 'sandbox',
        text: audioFile ? undefined : sandboxText,
        audio: audioFile ? {
          data: audioFile.data,
          mimeType: audioFile.mimeType
        } : undefined,
        prompt: selectedPrompt.promptText
      });

      setSandboxResult(result);
      setDecodedError(null);
    } catch (err: any) {
      console.error('Sandbox run error:', err);
      const decoded = decodeGeminiError(err, lang);
      setDecodedError(decoded);
      setErrorMessage(decoded.reason);
    } finally {
      setIsLoading(false);
    }
  };

  // Content texts localized based on active language
  const content = {
    ru: {
      title: 'Расшифровка & Интеграция API',
      subtitle: 'Управление личными ключами доступа, меню выбора системных промптов и офлайн-рекомендации по защите информантов.',
      keySectionTitle: 'Использование личного Gemini API ключа в программе',
      keyDesc: 'Приложение работает полностью на стороне клиента. Ключ API хранится исключительно в локальном хранилище (localStorage) вашего браузера и никогда не передается на сторонние серверы, а запросы отправляются напрямую в Google Gemini API.',
      keyPlaceholder: 'Введите ваш ключ API (AIzaSy...)',
      btnSave: 'Сохранить ключ в браузере',
      btnClear: 'Очистить ключ',
      keySavedStatus: 'Ключ успешно обновлен на вашем устройстве!',
      keyActive: 'Ваш собственный API ключ активен',
      keyNotActive: 'Не передавайте третьим лицам и не храните  открытом виде API-ключи - это приведет к не правомерному доступу и расходам ваших лимитов/средств.',
      
      promptMenuTitle: 'Онлайн дешифровка',
      promptMenuDesc: 'Выберите нужный академический промпт, чтобы проверить его на репликах или быстро скопировать для сторонних LLM чатов.',
      btnCopyPrompt: 'Копировать промпт',
      btnCopied: 'Скопировано в буфер!',
      
      sandboxTitle: 'Экспресс-проверка промпта (Интерактивная консоль)',
      sandboxDesc: 'Вставьте реплики из полевой аудиозаписи. Терминал передаст их с вашим ключом и выбранной инструкцией непосредственно в Gemini для тестирования.',
      sandboxPlaceholder: 'Вставьте фрагмент интервью для диагностики (например: «Ну мы тут роварам паехалі па калейцы...»)',
      btnRun: 'Запустить пробный разбор',
      btnRunning: 'Идет обработка запроса...',
      sandboxOutput: 'Вывод модели (Gemini API response):',
      
      guideTitle: 'Как получить бесплатный API ключ в Google AI Studio',
      guideStep1: 'Откройте официальную платформу разработчиков Google AI Studio по адресу:',
      guideLinkText: 'aistudio.google.com',
      guideStep2: 'Войдите в систему, используя вашу стандартную учетную запись Google (Gmail).',
      guideStep3: 'На панели управления нажмите синюю кнопку «Get API key» (Получить API-ключ).',
      guideStep4: 'Нажмите «Create API key», скопируйте текстовую строку (начинается на AIzaSy...) и вставьте ее в поле ввода вверху этой страницы.',
      
      alternativeTitle: 'Альтернатива: Прямой ручной запуск в чатах',
      alternativeDesc: 'Если вы не хотите регистрировать API-ключ, вы можете использовать полностью ручной метод: скопируйте выбранный системный промпт из меню выше, откройте стандартный чат-клиент Gemini (gemini.google.com), ChatGPT, Claude, Qwen или DeepSeek, вставьте скопированную инструкцию в качестве первого сообщения (или как System Prompt), а затем прикрепите файлы интервью или текст стенограммы.',
      
      complianceTitle: 'Предостережение: Политика персональных данных',
      complianceWarning: 'Обратите внимание: Законодательство в сфере персональных данных требует особой осмотрительности при обработке интервьюируемых граждан. Передача сырых полевых записей, аудиозаписей или детальных реликбий с ФИО, адресами и личными контактами на серверы третьих лиц (включая внешние облачные API-интерфейсы) может нарушать требования локальных регуляторов.',
      complianceLocalSuccess: 'При обработке полностью локально на вашем компьютере условия обработки персональных данных не нарушаются (данные не покидают устройство).',
      complianceOllamaTitle: 'Как настроить локальную конфиденциальную обработку:',
      complianceOllamaDesc: 'Если для вас критически важно соблюсти требования приватности и исключить утечку данных, вы можете развернуть локальные языковые модели:',
      complianceStep1: 'Установите LM Studio (lmstudio.ai) на вашем персональном компьютере.',
      complianceStep2: 'Или установите приложение Edge Gallery на мобильное устройство под управлением Android.',
      complianceStep3: 'Скачайте небольшую, но эффективную языковую модель размером до 4 млрд параметров (например, Qwen-2.5-3B-Instruct, gemma-4-E4B или Llama-3-3B).',
      complianceStep4: 'Скопируйте системные промпты из Раздела 3 (AI Промпты) или из меню выше, вставьте их в локальный чат и подавайте полевые тексты. Анализ выполнится на 100% автономно на вашем оборудовании, гарантируя полную тайну полевого материала.'
    },
    by: {
      title: 'Бяспека даных & Інтэграцыя API',
      subtitle: 'Кіраванне асабістымі ключамі доступу, меню выбару сістэмных промптаў і афлайн-рэкамендацыі па абароне інфармантаў.',
      keySectionTitle: 'Выкарыстанне асабістага Gemini API ключа ў праграме',
      keyDesc: 'Дадатак працуе цалкам на баку кліента. Ключ API захоўваецца выключна ў лакальным сховішчы (localStorage) вашага браўзера і ніколі не перадаецца на староннія серверы, а запыты накіроўваюцца наўпрост у Google Gemini API.',
      keyPlaceholder: 'Увядзіце ваш ключ API (AIzaSy...)',
      btnSave: 'Захаваць ключ у браўзеры',
      btnClear: 'Ачысціць ключ',
      keySavedStatus: 'Ключ паспяхова абноўлены на вашай прыладзе!',
      keyActive: 'Ваш уласны API ключ актыўны',
      keyNotActive: 'Не перадавайце трэцім асобам і не захоўвайце ў адкрытым выглядзе API-ключы - гэта прывядзе да неправамернага доступу і выдаткаў вашых лімітаў/сродкаў.',
      
      promptMenuTitle: 'Хуткая прывязка сістэмных промптаў',
      promptMenuDesc: 'Выберыце патрэбны акадэмічны промпт, каб праверыць яго на рэпліках або хутка скапіяваць для старонніх LLM чатаў.',
      btnCopyPrompt: 'Капіяваць промпт',
      btnCopied: 'Скапіявана ў буфер!',
      
      sandboxTitle: 'Экспрэс-праверка промпту (Інтэрактыўная кансоль)',
      sandboxDesc: 'Устаўце рэплікі з палявога аўдыёзапісу. Тэрмінал перадасць іх з вашым ключом і абранай інструкцыяй непасрэдна ў Gemini для тэставання.',
      sandboxPlaceholder: 'Устаўце фрагмент інтэрв\'ю для дыягностыкі (напрыклад: «Ну мы тут роварам паехалі па калейцы...»)',
      btnRun: 'Запусціць спробны разбор',
      btnRunning: 'Ідзе апрацоўка запыту...',
      sandboxOutput: 'Вывад мадэлі (Gemini API response):',
      
      guideTitle: 'Як атрымаць бясплатны API ключ у Google AI Studio',
      guideStep1: 'Адкрыйце афіцыйную платформу распрацоўшчыкаў Google AI Studio па адрасе:',
      guideLinkText: 'aistudio.google.com',
      guideStep2: 'Увайдзіце ў сістэму, выкарыстоўваючы ваш стандартны ўліковы запіс Google (Gmail).',
      guideStep3: 'На панэлі кіравання націсніце сінюю кнопку «Get API key» (Атрымаць API-ключ).',
      guideStep4: 'Націсніце «Create API key», скапіруйце тэкставы радок (пачынаецца на AIzaSy...) і ўстаўце яго ў поле ўводу уверсе гэтай старонкі.',
      
      alternativeTitle: 'Альтэрнатыва: Практычны ручны запуск у чатах',
      alternativeDesc: 'Калі вы не хочаце рэгістраваць API-ключ, вы можаце выкарыстоўваць цалкам ручны метад: скапіруйце абраны сістэмны промпт з меню вышэй, адкрыйце стандартны чат-кліент Gemini (gemini.google.com), ChatGPT, Claude, Qwen або DeepSeek, устаўце скапіяваную інструкцыю ў якасці першага паведамлення (альбо як System Prompt), а затым далучыце файлы інтэрв\'ю альбо тэкст стэнаграмы.',
      
      complianceTitle: 'Перасцярога: Палітыка персанальных даных',
      complianceWarning: 'Звярніце ўвагу: Заканадаўства ў сферы персанальных даных патрабуе асаблівай абачлівасці пры апрацоўцы інтэрв\'юіруемых грамадзян. Перадача сырых палявых запісаў, аўдыёзапісаў ці дэталёвых рэліктаў з ПІБ, адрасамі і асабістымі кантактамі на серверы трэціх асоб (уключаючы знешнія воблачныя API-інтэрфейсы) можа парушаць патрабаванні мясцовых рэгулятараў.',
      complianceLocalSuccess: 'Пры апрацоўцы цалкам лакальна на вашым кампутары ўмовы апрацоўкі персанальных даных не парушаюцца (даныя не пакідаюць прыладу).',
      complianceOllamaTitle: 'Як наладзіць лакальную канфідэнцыйную апрацоўку:',
      complianceOllamaDesc: 'Калі для вас крытычна важна выканаць патрабаванні прыватнасці і выключыць выцек даных, вы можаце разгарнуць лакальныя моўныя мадэлі:',
      complianceStep1: 'Усталюйце LM Studio (lmstudio.ai) на вашым асабістым кампутары.',
      complianceStep2: 'Альбо ўсталюйце прыкладанне Edge Gallery на мабільную прыладу пад кіраваннем Android.',
      complianceStep3: 'Спусціце невялікую, але эфектыўную моўную мадэль памерам да 4 млрд параметраў (напрыклад, Qwen-2.5-3B-Instruct, gemma-4-E4B ці Llama-3-3B).',
      complianceStep4: 'Скапіруйце сістэмныя промпты з Раздзела 3 (AI Промпты) ці з меню вышэй, устаўце іх у лакальны чат і падавайце палявыя тэксты. Аналіз выканаецца на 100% аўтаномна на вашым абсталяванні, гарантуючы поўную таямніцу палявога матэрыялу.'
    },
    zh: {
      title: '数据安全与 API 集成',
      subtitle: '管理您的个人 API 访问密钥，调用系统提示词，并参阅本地离线部署建议以保障受访者的数据隐私。',
      keySectionTitle: '在程序中配置个人 Gemini API 密钥',
      keyDesc: '本应用完全在客户端运行。您的 API 密钥仅存储在当前设备的本地浏览器缓存（localStorage）中，绝不上传至任何第三方服务器，所有请求均直接加密发送至 Google Gemini API 官方端点。',
      keyPlaceholder: '请输入您的 API 密钥 (开头为 AIzaSy...)',
      btnSave: '保存在本地浏览器中',
      btnClear: '清除密钥',
      keySavedStatus: '密钥已成功更新并保存在您的本地设备上！',
      keyActive: '您的个人 API 密钥已激活并应用',
      keyNotActive: '请勿向第三方泄露，也不向任何公开渠道流传您的 API-密钥 - 这会导致未经授权的访问并消耗您的信用额度/资金。',
      
      promptMenuTitle: '系统学术提示词绑定菜单',
      promptMenuDesc: '从下方选择特定的社会语言学预设提示词，阅读详情，或一键拷贝至外部大模型客户端中使用。',
      btnCopyPrompt: '拷贝系统提示词',
      btnCopied: '成功拷贝至剪贴板！',
      
      sandboxTitle: '指令效果评测沙盒（交互式控制台）',
      sandboxDesc: '在此处输入访谈口语的转写句子，系统将配合您上方配置的密钥，直接发送至 Gemini API 评测语法和特征提取的标注准确率。',
      sandboxPlaceholder: '在此粘贴受访者的录音对话片段进行诊断评测...',
      btnRun: '运行规则沙盒测试',
      btnRunning: '正在向 API 发送分析指令并加载结果...',
      sandboxOutput: '大模型输出结果 (Gemini API response):',
      
      guideTitle: '如何在 Google AI Studio 申请免费的 API 密钥',
      guideStep1: '使用电脑浏览器打开 Google AI Studio 官方开发者平台主页：',
      guideLinkText: 'aistudio.google.com',
      guideStep2: '首选用您常用的 Google 账号 (Gmail) 完成登录授权。',
      guideStep3: '在控制面板左上角或右侧显眼位置，点击蓝色的「Get API key」按钮。',
      guideStep4: '点击生成密钥，将该随机代码字符串（通常为 AIzaSy... 格式）拷贝，并贴入本页顶部的“配置个人 Gemini API 密钥”输入框中，并点击保存。',
      
      alternativeTitle: '绕过 API：直接在官方网页端中使用提示词（最速替代案）',
      alternativeDesc: '如果您不希望配置复杂的 API 密钥，可以使用完全无侵入的手动替代方案：在下方的提示词模板菜单中一键选中并拷贝科研提示词，接着在常用的 AI 网页窗口（如 gemini.google.com、ChatGPT、Claude、通义千问、DeepSeek 网页端等）中将其作为首条系统指令/规则发送，然后将您的采访文档直接贴入对话框开始对话。',
      
      complianceTitle: '特别声明与学术前瞻：个人敏感数据合规警示',
      complianceWarning: '请注意：根据白俄罗斯和周边特定地区的个人信息与敏感数据安全管理规定，处理实地采集成果必须慎重。凡含有受访村民的真实姓名、详细家庭住址、政治/宗教意识形态等高度敏感隐私信息的口头语或原始音视频，在通过任何外部第三方云端 API（包括国外的商用闭源 LLM 端口）时，均会带来数据跨境及海外留存的安全隐患。',
      complianceLocalSuccess: '通过纯粹的本地或局域网离线电脑算力进行标注，所有数据绝不离港，符合严苛的敏感地理和人文学术规范，不构成任何数据泄露违规。',
      complianceOllamaTitle: '如何在本地建立 100% 离线隐私计算终端：',
      complianceOllamaDesc: '为了在完全物理隔离的环境安全展开地缘与社会语言学研究，学者可以自主建立本地 AI 服务：',
      complianceStep1: '在个人学术笔记本上安装 LM Studio 专业客户端 (lmstudio.ai)。',
      complianceStep2: '或者在安卓（Android）手机上，直接下载安装 Edge Gallery 离线大模型客户端。',
      complianceStep3: '通过客户端下载一款性能平衡良好的轻量级离线开源模型，规模推荐在 40 亿（4B）参数之内（例如：Qwen-2.5-3B-Instruct、gemma-4-E4B、Llama-3-3B 等）。',
      complianceStep4: '将本系统第 3 栏（AI Промпты）或本页下方挑选的专属系统提示词完整复制，贴入您的本地离线模型中，然后直接加载田野文本进行深度对齐。这种本土计算方式将保证数据终身离线安全。'
    }
  }[lang];

  // System packs info translating helper
  const getPromptLabel = (id: string) => {
    switch (id) {
      case 'prompt-decryption-bel':
        return lang === 'ru' ? 'Дешифровка аудио и выявление речевого смешения' 
             : lang === 'by' ? 'Дэшыфроўка аўдыё і выяўленне маўленчага змешвання'
             : '白俄罗斯多语混合转写与解析';
      case 'prompt-chinese-diarization':
        return lang === 'ru' ? 'Билингвальная русско-китайская расшифровка'
             : lang === 'by' ? 'Білінгвальная руска-кітайская расшыфроўка'
             : '俄汉双语智能切分与对齐';
      case 'prompt-linguistic-profile':
        return lang === 'ru' ? 'Анализ социолингвистического профиля'
             : lang === 'by' ? 'Аналіз сацыялінгвістычнага профілю'
             : '社会语言学信息档案分析';
      case 'prompt-problem-informant':
        return lang === 'ru' ? 'Преодоление отчужденности информанта'
             : lang === 'by' ? 'Пераадоленне адчужанасці інфарманта'
             : '田野访谈心理破冰与叙事引导';
      case 'prompt-postprocess-summary':
        return lang === 'ru' ? 'Агрегация отчетов и полевых заметок'
             : lang === 'by' ? 'Агрэгацыя справаздач і палявых нататак'
             : '实地调研笔记与学术报告集成';
      case 'prompt-ru-bel-bilingual-environment':
        return lang === 'ru' ? 'Анализ русско-белорусской билингвальной среды'
             : lang === 'by' ? 'Аналіз руска-беларускага білінгвальнага асяроддзя'
             : '俄白双语混合接触环境综合分析';
      default:
        return id;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-10" id="security-api-container">
      {/* Visual branding header section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 bg-green-100/30 border border-sahara-primary/20 rounded-full px-4 py-1.5 text-sahara-primary text-xs font-black uppercase tracking-widest">
          <Cpu className="w-4 h-4" />
          <span>BETA OPERATIONAL CONSOLE</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight text-sahara-primary">
          {content.title}
        </h2>
        <p className="font-sans text-sm md:text-base text-sahara-secondary leading-relaxed">
          {content.subtitle}
        </p>
      </div>

      {/* SECTION 5 MOST IMPORTANT BLOCK: Prompts selection and sandbox terminal (Онлайн дешифровка) */}
      <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-sahara-surface-dim/30 pb-4">
          <div className="p-2 rounded-lg bg-green-100/30 text-sahara-primary">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-serif font-black text-sahara-primary animate-pulse">
            {content.promptMenuTitle}
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-sahara-secondary leading-relaxed">
          {content.promptMenuDesc}
        </p>

        {/* Prompt Selector Dropdown */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="security-prompt-select" className="block text-[10px] uppercase font-black tracking-widest text-sahara-secondary">
                {lang === 'ru' ? 'ВЫБЕРИТЕ ШАБЛОН' : lang === 'by' ? 'ВЫБЕРЫЦЕ ШАБЛОН' : '选择提示词模板'}
              </label>
              
              <button
                type="button"
                onClick={() => setIsCustomPromptOpen(true)}
                className="text-[10px] uppercase font-black text-sahara-primary hover:underline cursor-pointer flex items-center gap-1 bg-transparent border-none p-0"
              >
                <Sparkles className="w-3 h-3 text-sahara-primary shrink-0" />
                <span>{lang === 'ru' ? '+ Добавить свой' : lang === 'by' ? '+ Дадаць свой' : '+ 添加自定义'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                id="security-prompt-select"
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="flex-1 px-3 py-2 bg-sahara-background border border-sahara-surface-dim rounded-md text-xs sm:text-sm text-sahara-onbackground focus:outline-none focus:ring-1 focus:ring-sahara-primary font-medium transition-all"
              >
                {allPrompts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id.startsWith('custom-') ? p.title : getPromptLabel(p.id)}
                  </option>
                ))}
              </select>

              {selectedPromptId.startsWith('custom-') && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomPrompt(selectedPromptId)}
                  className="p-2 hover:bg-red-50 text-sahara-secondary hover:text-red-600 border border-sahara-surface-dim rounded-md transition-colors cursor-pointer"
                  title={lang === 'ru' ? 'Удалить этот промпт' : 'Выдаліць гэты промпт'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Prompt Text Visualizer with Copy button */}
          <div className="bg-green-100/15 border border-sahara-primary/15 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-sahara-primary/10 pb-2">
              <span className="font-mono text-[9px] text-sahara-primary font-black uppercase tracking-wider">SYSTEM PRESET</span>
              <button
                onClick={() => handleCopyPrompt(selectedPrompt.promptText, selectedPrompt.id)}
                className="flex items-center gap-1.5 text-[9px] uppercase font-black text-sahara-secondary hover:text-sahara-primary transition-colors cursor-pointer"
              >
                {copiedId === selectedPrompt.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-700">{content.btnCopied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{content.btnCopyPrompt}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-sahara-onbackground text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed scrollbar-thin">
              {selectedPrompt.promptText}
            </p>
          </div>

          {/* Console Sandbox Sandbox */}
          <div className="border-t border-sahara-surface-dim/30 pt-4 space-y-4">
            <div className="flex items-center gap-2 text-sahara-onbackground">
              <PlayCircle className="w-5 h-5 text-sahara-primary" />
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest">{content.sandboxTitle}</h4>
            </div>
            <p className="text-xs text-sahara-secondary font-medium">
              {content.sandboxDesc}
            </p>
            <div className={`text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1.5 ${
              userApiKey.trim() 
                ? 'bg-green-50 text-green-800 border border-green-100' 
                : 'bg-amber-50 text-amber-800 border border-amber-100'
            }`}>
              {userApiKey.trim() ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span>{lang === 'ru' ? 'Консоль использует ваш персональный API-ключ' : lang === 'by' ? 'Кансоль выкарыстоўвае ваш асабісты API-ключ' : '控制台正在使用您的个人 API 密钥'}</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{lang === 'ru' ? 'API-ключ не задан (требуется для онлайн-запросов)' : lang === 'by' ? 'API-ключ не зададзены (патрэбны для анлайн-запытаў)' : '未配置 API 密钥（在线请求需要配置密钥）'}</span>
                </>
              )}
            </div>
            {/* Custom Mode Toggle for Option 1 and Option 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-sahara-surface-dim/40 rounded-lg">
              <button
                type="button"
                onClick={() => setSandboxMode('text')}
                className={`min-h-[2.5rem] py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center break-words ${
                  sandboxMode === 'text'
                    ? 'bg-white text-sahara-onbackground shadow-xs'
                    : 'text-sahara-secondary hover:text-sahara-onbackground'
                }`}
              >
                <span>{lang === 'ru' ? 'Вариант 1: Промпт + Текст' : lang === 'by' ? 'Варыянт 1: Промпт + Тэкст' : '选项 1：提示词 + 文本'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSandboxMode('audio')}
                className={`min-h-[2.5rem] py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center break-words ${
                  sandboxMode === 'audio'
                    ? 'bg-white text-sahara-onbackground shadow-xs'
                    : 'text-sahara-secondary hover:text-sahara-onbackground'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'ru' ? 'Вариант 2: Промпт + Аудио' : lang === 'by' ? 'Варыянт 2: Промпт + Аўдыё' : '选项 2：提示词 + 音频'}</span>
              </button>
            </div>

            {sandboxMode === 'text' ? (
              <textarea
                id="security-sandbox-textarea"
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                placeholder={content.sandboxPlaceholder}
                rows={3}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-sahara-background border border-sahara-surface-dim rounded-md focus:outline-none focus:ring-1 focus:ring-sahara-primary/55 font-sans"
              />
            ) : (
              <div className="space-y-3 font-sans">
                {/* Audio Upload File Area */}
                {!audioFile ? (
                  <div className="border border-dashed border-sahara-surface-dim rounded-lg p-5 flex flex-col items-center justify-center bg-sahara-background hover:bg-sahara-surface-dim/10 transition-colors relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-sahara-primary/70 mb-2" />
                    <span className="text-xs font-semibold text-sahara-onbackground mb-1">
                      {lang === 'ru' ? 'Выберите WAV, MP3, FLAC, M4A, OGG файлы' : lang === 'by' ? 'Выберыце WAV, MP3, FLAC, M4A, OGG файлы' : '选择 WAV, MP3, FLAC, M4A, OGG 音频文件'}
                    </span>
                    <span className="text-[10px] text-sahara-secondary">
                      {lang === 'ru' ? 'Максимум 20 МБ для прямой веб-обработки' : lang === 'by' ? 'Максімум 20 МБ для вэб-перадачы' : '最大限制 20MB 通信体积'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-sahara-surface-dim/20 rounded-lg border border-sahara-surface-dim/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-[#eceae1] flex items-center justify-center text-sahara-primary">
                        <FileAudio className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black truncate text-sahara-onbackground max-w-[180px] sm:max-w-[300px]" title={audioFile.name}>
                          {audioFile.name}
                        </span>
                        <span className="text-[10px] text-sahara-secondary font-mono">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {audioFile.mimeType}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAudio}
                      className="p-1.5 hover:bg-red-50 text-sahara-secondary hover:text-red-600 rounded transition-colors cursor-pointer"
                      title={lang === 'ru' ? 'Удалить файл' : 'Выдаліць файл'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {audioError && (
                  <div className="p-2.5 bg-red-50 text-red-800 border border-red-100 rounded-lg text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{audioError}</span>
                  </div>
                )}

                {/* Technical constraints display */}
                <div className="bg-[#eceae1]/30 border border-[#b8b394]/30 rounded-lg p-3.5 space-y-2.5">
                  <span className="block text-[9.5px] uppercase font-mono font-black text-[#5c593c] tracking-wider leading-none">
                    {lang === 'ru' ? 'ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ (GEMINI MULTIMODAL)' : lang === 'by' ? 'ТЭХНІЧНЫЯ АБМЕЖАВАННІ (GEMINI MULTIMODAL)' : '音频处理技术限制 (GEMINI MULTIMODAL)'}
                  </span>
                  
                  <div className="grid grid-cols-1 gap-2 text-[11px] text-sahara-secondary leading-relaxed">
                    <div className="flex items-start gap-1.5">
                      <span className="text-sahara-primary shrink-0 mt-0.5">•</span>
                      <span>
                        {lang === 'ru' ? (
                          <>
                            <strong>Ограничение по объёму:</strong> До <strong>20 МБ</strong> для прямой передачи (Base64) через веб-запросы во избежание перегрузки памяти.
                          </>
                        ) : lang === 'by' ? (
                          <>
                            <strong>Абмежаванне па аб’ёме:</strong> Да <strong>20 МБ</strong> для прамой перадачы (Base64) праз вэб-запыты дзеля стабільнасці.
                          </>
                        ) : (
                          <>
                            <strong>体积极限：</strong> 支持最大 <strong>20 MB</strong> 的 Base64 内联请求，避免传输溢出。
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <span className="text-sahara-primary shrink-0 mt-0.5">•</span>
                      <span>
                        {lang === 'ru' ? (
                          <>
                            <strong>Окно контекста & Длина аудио:</strong> Расход составляет ~<strong>258 токенов/сек</strong>.
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                              <li><strong className="text-sahara-onbackground">Gemini 3.5 Flash</strong> (и 1.5 Flash - 1M токенов): Поддержка до <strong>~64 минут</strong> аудио.</li>
                              <li><strong className="text-sahara-onbackground">Gemini 1.5 Pro</strong> (и 3.1 Pro - 2M токенов): Поддержка до <strong>~128 минут (более 2 часов)</strong> аудио.</li>
                              <li><strong className="text-sahara-onbackground">Gemini 3.1 / 1.5 Flash-lite</strong> (резервная модель): Ограничение до <strong>~64 минут</strong>.</li>
                            </ul>
                          </>
                        ) : lang === 'by' ? (
                          <>
                            <strong>Акно кантэксту & Даўжыня аўдыё:</strong> Выдатак каля ~<strong>258 токенаў/сек</strong>.
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                              <li><strong className="text-[#5c593c]">Gemini 3.5 Flash</strong> (і 1.5 Flash - 1M токенаў): Падтрымка да <strong>~64 хвілін</strong>.</li>
                              <li><strong className="text-[#5c593c]">Gemini 1.5 Pro</strong> (і 3.1 Pro - 2M токенаў): Падтрымка да <strong>~128 хвілін (больш за 2 гадзіны)</strong>.</li>
                              <li><strong className="text-[#5c593c]">Gemini 3.1 / 1.5 Flash-lite</strong> (рэзервовая): Абмежаванне да <strong>~64 хвілін</strong>.</li>
                            </ul>
                          </>
                        ) : (
                          <>
                            <strong>上下文窗口与音频时长：</strong> 音频消耗约为 ~<strong>258 Token/秒</strong>。
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10.5px]">
                              <li><strong className="text-sahara-onbackground">Gemini 3.5 Flash</strong> (与 1.5 Flash - 100万 Token): 支持多达 <strong>~64 分钟</strong> 声音分析。</li>
                              <li><strong className="text-sahara-onbackground">Gemini 1.5 Pro</strong> (与 3.1 Pro - 200万 Token): 支持多达 <strong>~128 分钟 (超过 2 小时)</strong> 音频。</li>
                              <li><strong className="text-sahara-onbackground">Gemini 3.1 / 1.5 Flash-lite</strong> (备用模型): 支持上限为 <strong>~64 分钟</strong>。</li>
                            </ul>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {decodedError ? (
              <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-3 font-sans text-xs">
                <div className="flex items-start gap-2.5 text-red-900 font-extrabold border-b border-red-200 pb-2">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[8.5px] tracking-wider uppercase font-mono text-red-600/[0.8] mb-0.5">Ошибка: {decodedError.code}</span>
                    <span className="font-serif font-black">{decodedError.title}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-red-950/90 leading-relaxed font-sans">
                  <p>
                    <strong className="text-red-900 font-bold">{lang === 'ru' ? 'Почему это произошло: ' : lang === 'by' ? 'Чаму гэта адбылося: ' : '产生原因: '}</strong>
                    {decodedError.reason}
                  </p>
                  <p className="bg-white/80 p-2.5 rounded-lg border border-red-200 text-red-900">
                    <strong className="block text-[10px] uppercase font-mono font-black tracking-wider text-red-600 mb-0.5">{lang === 'ru' ? 'ЧТО ДЕЛАТЬ:' : lang === 'by' ? 'ШТО РАБІЦЬ:' : '如何解决:'}</strong>
                    {decodedError.solution}
                  </p>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium">
                {errorMessage}
              </div>
            ) : null}

            <button
              onClick={handleRunSandbox}
              disabled={isLoading}
              className={`w-full py-3 rounded-md text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2 ${
                isLoading
                  ? 'bg-sahara-surface-dim text-sahara-secondary/60 cursor-wait'
                  : 'bg-sahara-primary text-white hover:bg-[#686539]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-sahara-secondary" />
                  <span>{content.btnRunning}</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  <span>{content.btnRun}</span>
                </>
              )}
            </button>

            {sandboxResult && (
              <div className="bg-[#2D2A2A] text-gray-100 rounded-lg p-4 font-mono text-xs space-y-2.5 border border-sahara-primary/30 max-h-60 overflow-y-auto">
                <div className="text-[10px] text-sahara-primary/80 font-black tracking-wider uppercase border-b border-gray-700 pb-1 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  {content.sandboxOutput}
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {sandboxResult}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Key Manager & Obtain Instructions */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* Section: Personal Key Setup */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex items-center gap-3 border-b border-sahara-surface-dim/30 pb-4">
              <div className="p-2 rounded-lg bg-green-100/30 text-sahara-primary">
                <Key className="w-5 h-5 font-black" />
              </div>
              <h3 className="text-xl font-serif font-black text-sahara-primary">
                {content.keySectionTitle}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-sahara-secondary leading-relaxed font-sans">
              {content.keyDesc}
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  id="user-api-key-input"
                  value={userApiKey}
                  onChange={(e) => {
                    setUserApiKey(e.target.value);
                    if (isSaved) setIsSaved(false);
                  }}
                  placeholder={content.keyPlaceholder}
                  className="w-full px-4 py-3 text-sm bg-sahara-background border border-sahara-primary/20 rounded-md focus:outline-none focus:ring-2 focus:ring-sahara-primary/40 focus:border-sahara-primary font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3.5 top-3.5 text-xs text-sahara-secondary/70 hover:text-sahara-primary font-bold uppercase tracking-tight cursor-pointer"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveKey}
                  disabled={!userApiKey.trim()}
                  className={`flex-1 px-5 py-3 rounded-md text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-2xs ${
                    userApiKey.trim() 
                      ? 'bg-sahara-primary text-white hover:bg-[#686539]' 
                      : 'bg-sahara-surface-dim/50 text-sahara-secondary/40 cursor-not-allowed'
                  }`}
                >
                  {content.btnSave}
                </button>
                {userApiKey && (
                  <button
                    onClick={handleClearKey}
                    className="px-5 py-3 border border-red-200 hover:border-red-400 text-red-700 bg-red-50/20 hover:bg-red-50 rounded-md text-xs font-black uppercase tracking-widest cursor-pointer transition-colors"
                  >
                    {content.btnClear}
                  </button>
                )}
              </div>

              {/* Status Indicator */}
              {isSaved ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 font-medium">
                  {content.keySavedStatus}
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {/* Key Status Message */}
                  {keyStatus === 'validating' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-xs text-blue-800 font-sans leading-relaxed">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-blue-900">
                          {lang === 'ru' ? 'Проверка ключа...' : lang === 'by' ? 'Праверка ключа...' : '正在校验密钥...'}
                        </p>
                        <p className="text-blue-700/80">
                          {lang === 'ru' ? 'Выполняется тестовый фоновый запрос к серверам Google Gemini API.' : lang === 'by' ? 'Выконваецца тэставы фоновы запыт да сервераў Google Gemini API.' : '正在对 Google Gemini API 服务器执行连通性与健康状态状态检测。'}
                        </p>
                      </div>
                    </div>
                  )}

                  {keyStatus === 'valid' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 text-xs text-green-800 font-sans leading-relaxed">
                      <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-green-900">
                          {lang === 'ru' ? 'Ключ проверен и активен' : lang === 'by' ? 'Ключ правераны і актыўны' : 'API 密钥验证通过 (Active)'}
                        </p>
                        <p className="text-green-700/80">
                          {lang === 'ru' ? 'Соединение успешно установлено. Доступ ко всем интеллектуальным функциям открыт.' : lang === 'by' ? 'Злучэнне паспяхова ўстаноўлена. Доступ да ўсіх інтэлектуальных функцый адкрыты.' : '链接通道建立成功。高保真、多模态转写及智能方言分析模型已经就绪，可无限制调用。'}
                        </p>
                      </div>
                    </div>
                  )}

                  {keyStatus === 'invalid' && keyStatusError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3 text-xs text-red-800 font-sans leading-relaxed">
                      <div className="flex gap-3">
                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <p className="font-extrabold text-red-900">
                            {keyStatusError.title}
                          </p>
                          <p className="text-red-700/90 font-medium">
                            <span className="font-extrabold">{lang === 'ru' ? 'Причина: ' : lang === 'by' ? 'Прычына: ' : '故障明细: '}</span>
                            {keyStatusError.reason}
                          </p>
                          <div className="text-red-700/90 bg-white/60 p-2.5 rounded-lg border border-red-100 mt-2 font-mono text-[11px] leading-relaxed">
                            <span className="font-extrabold block mb-1 text-red-900 font-sans text-xs">{lang === 'ru' ? 'Решение: ' : lang === 'by' ? 'Рашэнне: ' : '排障方案: '}</span>
                            {keyStatusError.solution}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => verifyApiKeyCheck()}
                        className="self-end flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors mt-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {lang === 'ru' ? 'Повторить тест ключа' : lang === 'by' ? 'Паўтарыць тэст ключа' : '重新校验密钥'}
                      </button>
                    </div>
                  )}

                  {keyStatus === 'offline' && keyStatusError && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3 text-xs text-amber-800 font-sans leading-relaxed">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                          <p className="font-extrabold text-amber-900">
                            {keyStatusError.title}
                          </p>
                          <p className="text-amber-700/95 font-medium">
                            <span className="font-semibold">{lang === 'ru' ? 'Проблема: ' : lang === 'by' ? 'Праблема: ' : '网络故障: '}</span>
                            {keyStatusError.reason}
                          </p>
                          <div className="text-amber-700/95 bg-white/60 p-2.5 rounded-lg border border-amber-100 mt-2 font-mono text-[11px] leading-relaxed">
                            <span className="font-extrabold block mb-1 text-amber-950 font-sans text-xs">{lang === 'ru' ? 'Рекомендация: ' : lang === 'by' ? 'Рэкамендацыя: ' : '处理措施: '}</span>
                            {keyStatusError.solution}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => verifyApiKeyCheck()}
                        className="self-end flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors mt-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {lang === 'ru' ? ' Повторить проверку сети' : lang === 'by' ? 'Паўтарыць праверку сеткі' : '重新诊断网络'}
                      </button>
                    </div>
                  )}

                  {keyStatus === 'idle' && (
                    <div className="bg-sahara-background/60 border border-sahara-surface-dim/40 rounded-xl p-4 flex flex-col gap-3 text-xs text-sahara-secondary font-sans leading-relaxed">
                      <div className="flex gap-3">
                        <Bot className="w-5 h-5 text-sahara-primary shrink-0" />
                        <div className="space-y-1 flex-1">
                          {userApiKey ? (
                            <>
                              <p className="font-extrabold text-sahara-primary">
                                {lang === 'ru' ? 'Ключ сохранен, тест не запущен' : lang === 'by' ? 'Ключ захаваны, тэст не запушчаны' : '密钥已就绪，等待联机测试'}
                              </p>
                              <p className="text-sahara-secondary/80 text-[11px]">
                                {lang === 'ru' ? 'Вы можете запустить принудительную диагностическую проверку вашего ключа.' : lang === 'by' ? 'Вы можаце запусціць прымусовую дыягнастычную праверку вашага ключа.' : '您可随时点击下方验证按钮，主动发起至 Google 云端的多模态可用性验证。'}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-extrabold text-sahara-primary">
                                {lang === 'ru' ? 'Персональный API-ключ не настроен' : lang === 'by' ? 'Асабісты API-ключ не наладжаны' : '尚未配置个人 API 密钥'}
                              </p>
                              <p className="text-sahara-secondary/80 text-[11px]">
                                {lang === 'ru' ? 'Ключ хранится только на вашем устройстве, а запросы отправляются напрямую в Google Gemini API. Введите ваш ключ выше для работы онлайн-модулей.' : lang === 'by' ? 'Ключ захоўваецца толькі на вашай прыладзе, а запыты накіроўваюцца наўпрост у Google Gemini API. Увядзіце ваш ключ уверсе для працы анлайн-модуляў.' : '密钥仅保存在当前设备本地，请求直接加密发送至 Google Gemini API。请在上方输入您的密钥以激活在线功能。'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      {userApiKey && (
                        <button
                          onClick={() => verifyApiKeyCheck()}
                          className="self-end flex items-center gap-1.5 px-3 py-1.5 bg-sahara-primary/95 text-white hover:bg-sahara-primary rounded-md text-[10px] font-black uppercase tracking-wider transition-colors mt-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {lang === 'ru' ? 'Проверить работоспособность' : lang === 'by' ? 'Праверыць працаздольнасць' : '一键验证密钥'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: Storage Persistence & Offline Resilience */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-sahara-surface-dim/30 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-green-100/20 text-sahara-primary">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-sahara-primary">
                    {lang === 'ru' ? 'Постоянное хранилище IndexedDB' : lang === 'by' ? 'Пастаяннае сховішча IndexedDB' : 'IndexedDB 本地持久化存储'}
                  </h3>
                  <p className="text-xs text-sahara-secondary">
                    {lang === 'ru' ? 'Автономное хранение интервью, полевого дневника и потоковых аудиочанков' : lang === 'by' ? 'Аўтаномнае захаванне інтэрв\'ю, палявога дзённіка і струменевых аўдыячанкаў' : '完全离线化存储采访记录、田野日记及流式音频片段'}
                  </p>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                persistenceStatus.persisted
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {persistenceStatus.persisted ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                    <span>{lang === 'ru' ? 'Защищено от очистки' : lang === 'by' ? 'Абаронена ад ачысткі' : '持久化保护已开启'}</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'ru' ? 'Стандартное хранилище' : lang === 'by' ? 'Стандартнае сховішча' : '标准存储模式'}</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-sahara-background/60 border border-sahara-surface-dim/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-sans">
              <div className="space-y-1">
                <p className="text-sahara-onbackground font-medium">
                  {persistenceStatus.persisted
                    ? (lang === 'ru'
                        ? 'Браузер гарантирует постоянное хранение данных даже при нехватке свободного места на диске.'
                        : lang === 'by'
                        ? 'Браўзер гарантуе пастаяннае захаванне даных нават пры недахопе вольнага месца на дыску.'
                        : '浏览器已为本应用授予持久化配额，即便在系统低磁盘空间状态下亦不会被自动清除。')
                    : (lang === 'ru'
                        ? 'Хранилище работает в стандартном режиме. Для защиты записей от очистки браузером нажмите кнопку справа.'
                        : lang === 'by'
                        ? 'Сховішча працуе ў стандартным рэжыме. Каб абараніць запісы ад ачысткі браўзерам, націсніце кнопку справа.'
                        : '当前运行于默认存储池中。为防止浏览器在存储紧张时清理缓存，建议申请永久保护。')}
                </p>
                {persistenceStatus.quota && (
                  <p className="text-sahara-secondary text-[11px]">
                    {lang === 'ru' ? 'Использовано диска: ' : lang === 'by' ? 'Выкарыстана дыска: ' : '已占用存储: '}
                    <span className="font-semibold text-sahara-onbackground font-mono">
                      {((persistenceStatus.usage || 0) / (1024 * 1024)).toFixed(1)} МБ
                    </span>
                    {' / '}
                    <span className="text-sahara-secondary font-mono">
                      {((persistenceStatus.quota || 0) / (1024 * 1024)).toFixed(0)} МБ
                    </span>
                  </p>
                )}
              </div>

              {!persistenceStatus.persisted && (
                <button
                  type="button"
                  onClick={handleRequestPersist}
                  disabled={isRequestingPersist}
                  className="px-4 py-2 bg-sahara-primary hover:bg-sahara-primary/90 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isRequestingPersist ? '...' : (lang === 'ru' ? 'Запросить защиту (persist)' : lang === 'by' ? 'Запытаць абарону (persist)' : '申请持久化 (persist)')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Section: Android File Export Settings */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sahara-surface-dim/30 pb-4 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-green-100/20 text-sahara-primary">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-sahara-primary">
                    {lang === 'ru' ? 'Экспорт файлов на Android' : lang === 'by' ? 'Экспарт файлаў на Android' : 'Android 文件导出设置'}
                  </h3>
                  <p className="text-xs text-sahara-secondary">
                    {lang === 'ru'
                      ? 'Действие по умолчанию при экспорте аудиозаписей и отчётов (Storage Access Framework или меню «Поделиться»)'
                      : lang === 'by'
                      ? 'Дзеянне па змаўчанні пры экспарце аўдыязапісаў і справаздач (Storage Access Framework альбо меню «Падзяліцца»)'
                      : '配置导出录音和文档时的默认动作（SAF 存储框架或系统分享面板）'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAndroidSaveTarget('ask');
                  setAndroidSavePref('ask');
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                  androidSavePref === 'ask'
                    ? 'bg-sahara-primary/10 border-sahara-primary text-sahara-primary font-bold shadow-xs'
                    : 'bg-sahara-background/60 border-sahara-surface-dim/60 text-sahara-secondary hover:text-sahara-onbackground hover:border-sahara-primary/30'
                }`}
              >
                <div className="text-xs font-bold font-sans">
                  {lang === 'ru' ? '❓ Спрашивать каждый раз' : lang === 'by' ? '❓ Запытваць кожны раз' : '❓ 每次询问'}
                </div>
                <div className="text-[11px] font-normal leading-relaxed opacity-85">
                  {lang === 'ru' ? 'Показывать выбор между сохранением на устройство и «Поделиться» при каждом экспорте (по умолчанию)' : lang === 'by' ? 'Паказваць выбар пры кожным экспарце (па змаўчанні)' : '每次导出时弹窗询问存储至设备还是分享（默认）'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAndroidSaveTarget('device');
                  setAndroidSavePref('device');
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                  androidSavePref === 'device'
                    ? 'bg-sahara-primary/10 border-sahara-primary text-sahara-primary font-bold shadow-xs'
                    : 'bg-sahara-background/60 border-sahara-surface-dim/60 text-sahara-secondary hover:text-sahara-onbackground hover:border-sahara-primary/30'
                }`}
              >
                <div className="text-xs font-bold font-sans">
                  {lang === 'ru' ? '💾 На устройство (SAF)' : lang === 'by' ? '💾 На прыладу (SAF)' : '💾 存至设备 (SAF)'}
                </div>
                <div className="text-[11px] font-normal leading-relaxed opacity-85">
                  {lang === 'ru' ? 'Сразу открывать системный проводник Android для выбора папки' : lang === 'by' ? 'Адразу адкрываць сістэмны праваднік Android для выбару папкі' : '直接呼出 Android 系统文件管理器保存至选择的文件夹'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAndroidSaveTarget('share');
                  setAndroidSavePref('share');
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                  androidSavePref === 'share'
                    ? 'bg-sahara-primary/10 border-sahara-primary text-sahara-primary font-bold shadow-xs'
                    : 'bg-sahara-background/60 border-sahara-surface-dim/60 text-sahara-secondary hover:text-sahara-onbackground hover:border-sahara-primary/30'
                }`}
              >
                <div className="text-xs font-bold font-sans">
                  {lang === 'ru' ? '↗️ Меню «Поделиться»' : lang === 'by' ? '↗️ Меню «Падзяліцца»' : '↗️ 系统分享'}
                </div>
                <div className="text-[11px] font-normal leading-relaxed opacity-85">
                  {lang === 'ru' ? 'Сразу открывать меню отправки файла в мессенджеры, Диск или почту' : lang === 'by' ? 'Адразу адкрываць меню адпраўкі файла ў месенджары альбо пошту' : '直接打开系统分享菜单，快速发送至应用'}
                </div>
              </button>
            </div>
          </div>

          {/* Section: Diagnostics Log */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sahara-surface-dim/30 pb-4 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-green-100/20 text-sahara-primary">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-sahara-primary">
                    {lang === 'ru' ? 'Диагностика записи' : lang === 'by' ? 'Дыягностыка запісу' : '录音诊断'}
                  </h3>
                  <p className="text-xs text-sahara-secondary">
                    {lang === 'ru'
                      ? 'Компактный журнал аудиозахвата и фоновой службы (для проверки на телефоне без ADB)'
                      : lang === 'by'
                      ? 'Кампактны журнал аўдыязахопу і фонавай службы (для праверкі на тэлефоне без ADB)'
                      : '用于在无ADB连接的真机上排查音频与后台服务运行状态'}
                  </p>
                </div>
              </div>
              <div className="self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold bg-sahara-background text-sahara-secondary border border-sahara-surface-dim flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>{lang === 'ru' ? 'Журнал вне записи не растёт' : lang === 'by' ? 'Журнал па-за запісам не расце' : '非录音期间零增长'}</span>
              </div>
            </div>

            <div className="bg-sahara-background/60 border border-sahara-surface-dim/40 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-sans">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sahara-onbackground font-medium">
                    {lang === 'ru' ? 'Размер журнала:' : lang === 'by' ? 'Памер журнала:' : '日志体积:'}
                  </span>
                  <span className="font-mono font-bold text-sahara-primary bg-white px-2 py-0.5 rounded border border-sahara-surface-dim/50">
                    {diagStats.count} / {diagStats.maxLines} {lang === 'ru' ? 'строк' : lang === 'by' ? 'радкоў' : '行'}
                  </span>
                  <span className="text-sahara-secondary">|</span>
                  <span className="font-mono font-bold text-sahara-primary bg-white px-2 py-0.5 rounded border border-sahara-surface-dim/50">
                    {(diagStats.bytes / 1024).toFixed(1)} КБ / {(diagStats.maxBytes / 1024).toFixed(0)} КБ
                  </span>
                </div>
                <p className="text-sahara-secondary text-[11px] leading-relaxed">
                  {lang === 'ru'
                    ? 'Кольцевой буфер (до 800 строк и 60 КБ) сохраняет события старта/стопа, переходов в фон, аудиофокуса, сбоев и поминутный пульс.'
                    : lang === 'by'
                    ? 'Кальцавы буфер (да 800 радкоў і 60 КБ) захоўвае падзеі старту/стопу, пераходаў у фон, аўдыяфокусу, збояў і штохвілінны пульс.'
                    : '环形缓冲区（上限800行 / 60KB）记录启停、后台可见性、音频焦点、故障及每分钟心跳指标。'}
                </p>
                {diagActionMessage && (
                  <p className="text-green-700 font-bold text-[11px] animate-fade-in flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>{diagActionMessage}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportDiag}
                  disabled={isExportingDiag}
                  className="px-3.5 py-2 bg-sahara-primary hover:bg-sahara-primary/90 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  title={lang === 'ru' ? 'Экспортировать журнал в текстовый файл' : 'Экспартаваць журнал у тэкставы файл'}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExportingDiag
                      ? '...'
                      : lang === 'ru'
                      ? 'Экспортировать'
                      : lang === 'by'
                      ? 'Экспартаваць'
                      : '导出'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleClearDiag}
                  disabled={isClearingDiag || diagStats.count === 0}
                  className="px-3 py-2 bg-white hover:bg-red-50 text-sahara-secondary hover:text-red-600 border border-sahara-surface-dim rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={lang === 'ru' ? 'Очистить журнал диагностики' : 'Ачысціць журнал дыягностыкі'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ru' ? 'Очистить' : lang === 'by' ? 'Ачысціць' : '清空'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section: Interactive Model Guides */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-6 md:p-8 space-y-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-sahara-surface-dim/30 pb-4">
              <div className="p-1.5 rounded-md bg-green-100/20 text-sahara-primary">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-black text-sahara-primary uppercase tracking-tight">
                {tLocal.pAiGuides}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 pb-1">
              {guides.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGuideId(g.id)}
                  className={`py-2 px-1 rounded-md text-center border text-[10px] sm:text-xs font-black transition-all cursor-pointer uppercase tracking-tight ${
                    selectedGuideId === g.id
                      ? 'bg-sahara-primary text-white border-sahara-primary shadow-xs font-bold'
                      : 'bg-white text-sahara-secondary border-sahara-surface-dim/55 hover:bg-sahara-background'
                  }`}
                >
                  {g.modelName === 'google-ai-studio' ? 'AI Studio' : g.modelName === 'qwen' ? 'Qwen' : 'DeepSeek'}
                </button>
              ))}
            </div>

            {/* Render selected guide info */}
            {(() => {
              const selectedGuide = guides.find(g => g.id === selectedGuideId) || guides[0];
              const guideInfo = getGuideSteps(selectedGuide.modelName);
              return (
                <div className="bg-green-100/5 border border-sahara-primary/15 rounded-lg p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-sahara-surface-dim/20 pb-2.5">
                    <Terminal className="w-4.5 h-4.5 text-sahara-primary" />
                    <span className="text-xs sm:text-sm font-black text-sahara-onbackground font-sans uppercase tracking-wider">{guideInfo.title}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs uppercase font-bold text-sahara-secondary">{tLocal.pModel}</span>
                    <span className="text-[11px] bg-white border border-sahara-surface-dim/50 text-sahara-onbackground px-2 py-0.5 rounded-md font-mono font-extrabold">{guideInfo.recommended}</span>
                  </div>

                  <div className="space-y-2.5">
                    <span className="font-sans text-xs uppercase font-bold text-sahara-secondary block">{tLocal.pStepsHeader}</span>
                    <ol className="list-decimal list-inside text-xs sm:text-sm text-sahara-onbackground space-y-2 leading-relaxed pl-1PN">
                      {guideInfo.steps.map((st, idx) => (
                        <li key={idx} className="pl-1">
                          {idx === 0 && selectedGuide.modelName === 'google-ai-studio' ? (
                            <span className="ml-1 font-sans font-medium">
                              {lang === 'ru' ? 'Откройте личный кабинет ' : lang === 'by' ? 'Адкрыйце асабісты кабінет ' : '进入 '}
                              <a 
                                href="https://aistudio.google.com/" 
                                target="_blank" 
                                rel="noreferrer"
                                className="font-bold text-sahara-primary hover:underline inline-flex items-center gap-1"
                              >
                                Google AI Studio
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {lang === 'ru' ? ' для получения токена' : lang === 'by' ? ' для атрымання токена' : ' 开发者平台'}
                            </span>
                          ) : (
                            <span className="ml-1 font-sans font-medium">{st}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {guideInfo.tips && (
                    <div className="border-t border-sahara-surface-dim/25 pt-2.5 text-xs text-sahara-primary italic leading-relaxed font-serif">
                      {tLocal.pTipsHeader} {guideInfo.tips}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Alternative block */}
          <div className="bg-green-100/5 border border-sahara-surface-dim/40 rounded-xl p-6 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-sahara-secondary">
              {content.alternativeTitle}
            </h4>
            <p className="text-xs sm:text-sm text-sahara-secondary leading-relaxed font-serif italic">
              {content.alternativeDesc}
            </p>
          </div>
        </div>

        {/* Right Column: Compliance Warning */}
        <div className="lg:col-span-6 space-y-8">
          
          {/* HIGH PRIORITY WARNING: Data Compliance */}
          <div className="bg-red-50/30 border-2 border-red-200/80 rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3.5 border-b border-red-200/50 pb-4">
              <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0">
                <ShieldAlert className="w-5 h-5 font-black" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-black text-red-950">
                  {content.complianceTitle}
                </h3>
                <span className="text-[9px] uppercase tracking-widest text-red-700 font-black font-mono">REGIONAL COMPLIANCE PROTOCOL</span>
              </div>
            </div>

            <div className="space-y-4 font-serif text-xs sm:text-sm text-red-950 leading-relaxed">
              <p className="font-extrabold">
                {content.complianceWarning}
              </p>
              
              <div className="bg-white/80 border border-green-200 rounded-lg p-3 flex items-start gap-3 text-xs text-green-950 font-sans">
                <ShieldCheck className="w-4.5 h-4.5 text-green-700 shrink-0 mt-0.5" />
                <p>
                  <strong>{lang === 'ru' ? 'Преимущество:' : lang === 'by' ? 'Перавага:' : '优势建议：'}</strong> {content.complianceLocalSuccess}
                </p>
              </div>

              <div className="space-y-3 font-sans text-xs mt-2 text-red-950 bg-red-100/10 p-4 rounded-lg border border-red-200/50">
                <h4 className="font-extrabold uppercase tracking-wide text-red-900 flex items-center gap-1">
                  <Cpu className="w-4 h-4" />
                  {content.complianceOllamaTitle}
                </h4>
                <p className="text-red-950/80">{content.complianceOllamaDesc}</p>
                <ol className="list-decimal list-inside space-y-2.5 leading-relaxed pl-1 text-red-950">
                  <li className="pl-1"><strong>{content.complianceStep1}</strong></li>
                  <li className="pl-1"><strong>{content.complianceStep2}</strong></li>
                  <li className="pl-1"><strong>{content.complianceStep3}</strong></li>
                  <li className="pl-1"><strong>{content.complianceStep4}</strong></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Prompt Modal Popover */}
      {isCustomPromptOpen && (
        <div 
          id="custom-prompt-modal-overlay"
          className="fixed inset-0 bg-sahara-onbackground/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-opacity"
        >
          <div 
            id="custom-prompt-modal-container"
            className="bg-white border border-sahara-surface-dim rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 relative animate-fade-in"
          >
            <button
              type="button"
              onClick={() => setIsCustomPromptOpen(false)}
              className="absolute top-4 right-4 text-sahara-secondary hover:text-sahara-onbackground cursor-pointer text-lg font-black bg-transparent border-none p-1"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h4 className="text-sm font-black uppercase tracking-wider text-sahara-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sahara-primary" />
                <span>{lang === 'ru' ? 'Добавление сис-промпта' : lang === 'by' ? 'Дадаванне сіс-промпту' : '新增自定义提示词'}</span>
              </h4>
              <p className="text-xs text-sahara-secondary leading-relaxed font-sans font-medium">
                {lang === 'ru' ? 'Задайте название и системную инструкцию. Новый промпт добавится в верхний выпадающий список.' : lang === 'by' ? 'Задайце назву і сістэмную інструкцыю. Новы промпт з’явіцца ў верхнім спісе.' : '设置标题和系统级 AI 规则描述。完成后即可直接在上方菜单快速选用。'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="custom-prompt-title-input" className="block text-[10px] uppercase font-black text-sahara-secondary mb-1">
                  {lang === 'ru' ? 'Название шаблона' : lang === 'by' ? 'Назва шаблону' : '标题名称'}
                </label>
                <input
                  id="custom-prompt-title-input"
                  type="text"
                  value={newPromptTitle}
                  onChange={(e) => setNewPromptTitle(e.target.value)}
                  placeholder={lang === 'ru' ? 'Например: Экспертный фонетический разбор' : lang === 'by' ? 'Напрыклад: Экспертны фанетычны разбор' : '例如：高保真同音异义校验'}
                  className="w-full px-3 py-2 bg-sahara-background border border-sahara-surface-dim rounded-md text-xs sm:text-sm text-sahara-onbackground focus:outline-none focus:ring-1 focus:ring-sahara-primary font-medium font-sans"
                />
              </div>

              <div>
                <label htmlFor="custom-prompt-text-input" className="block text-[10px] uppercase font-black text-sahara-secondary mb-1">
                  {lang === 'ru' ? 'Текст системного промпта' : lang === 'by' ? 'Тэкст сістэмнага промпту' : '提示词正文'}
                </label>
                <textarea
                  id="custom-prompt-text-input"
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  placeholder={lang === 'ru' ? 'Ты — лингвист-исследователь. Проанализируй...' : lang === 'by' ? 'Ты — лінгвіст-даследчык. Прааналізуй...' : '在此处输入您的系统 Instruction 说明书...'}
                  rows={5}
                  className="w-full px-3 py-2 bg-sahara-background border border-sahara-surface-dim rounded-md text-xs sm:text-sm text-sahara-onbackground focus:outline-none focus:ring-1 focus:ring-sahara-primary font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-sahara-surface-dim/40 font-sans">
              <button
                type="button"
                onClick={() => setIsCustomPromptOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-sahara-secondary hover:text-sahara-onbackground rounded-md bg-sahara-surface-dim/20 hover:bg-sahara-surface-dim/45 transition-colors cursor-pointer"
              >
                {lang === 'ru' ? 'Отмена' : lang === 'by' ? 'Адмена' : '取消'}
              </button>
              <button
                type="button"
                onClick={handleSaveCustomPrompt}
                className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white bg-sahara-primary hover:bg-sahara-hover rounded-md transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-white" />
                <span>{lang === 'ru' ? 'Сохранить' : lang === 'by' ? 'Захаваць' : '应用保存'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
