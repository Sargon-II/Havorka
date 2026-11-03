/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Check, Sparkles, AlertCircle, Terminal, Copy } from 'lucide-react';
import { PromptPack, ModelGuide } from '../types';
import { DEFAULT_PROMPT_PACKS, DEFAULT_MODEL_GUIDES } from '../data/defaultData';
import { Language, translations } from '../lib/translations';
import { gsap } from 'gsap';
import { saveFile } from '../platform/files';

interface PromptLibraryProps {
  lang: Language;
}

export default function PromptLibrary({ lang }: PromptLibraryProps) {
  const [prompts, setPrompts] = useState<PromptPack[]>(DEFAULT_PROMPT_PACKS);
  const [guides] = useState<ModelGuide[]>(DEFAULT_MODEL_GUIDES);
  
  // Initialize to the first default prompt/guide
  const [selectedPromptId, setSelectedPromptId] = useState<string>(DEFAULT_PROMPT_PACKS[0].id);
  const [selectedGuideId, setSelectedGuideId] = useState<string>(DEFAULT_MODEL_GUIDES[0].id);
  
  // State for copying and toggles
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Import states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMarkdown, setImportMarkdown] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // Manual creation states
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualPromptText, setManualPromptText] = useState('');
  const [manualModelTarget, setManualModelTarget] = useState<'google-ai-studio' | 'qwen' | 'deepseek' | 'universal'>('universal');

  const containerRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];

  // Helper to translate Prompt pack titles and descriptions
  const getPromptInfo = (id: string) => {
    const pack = prompts.find(p => p.id === id);
    if (pack) {
      if (id === 'prompt-decryption-bel') {
        return {
          title: lang === 'ru' ? 'Дешифровка аудио и выявление речевого смешения' 
               : lang === 'by' ? 'Дэшыфроўка аўдыё і выяўленне маўленчага змешвання'
               : '白俄罗斯多语混合转写与解析',
          description: lang === 'ru' ? 'Промпт для точного перевода аудио-расшифровок в text со словариком и разметкой.'
                     : lang === 'by' ? 'Промпт для дакладнага перакладу аўдыё-расшыфровак у тэкст са слоўнікам і разметкай.'
                     : '用于白俄罗斯及周边多语环境下，精准进行语音、转写、社会语码标记及特征分析。'
        };
      }
      if (id === 'prompt-chinese-diarization') {
        return {
          title: lang === 'ru' ? 'Билингвальная русско-китайская расшифровка'
               : lang === 'by' ? 'Білінгвальная руска-кітайская расшыфроўка'
               : '俄汉双语智能切分与对齐',
          description: lang === 'ru' ? 'Разбор русско-китайского диалога, разделение спикеров и перевод с таймкодами.'
                     : lang === 'by' ? 'Разбор руска-кітайскага дыялогу, падзел спікераў і пераклад з таймкодамі.'
                     : '基于中俄学术访谈或谈判场景，自动分割发言人，区分双语切换，并在括号中附加双语译文。'
        };
      }
      if (id === 'prompt-linguistic-profile') {
        return {
          title: lang === 'ru' ? 'Анализ социолингвистического профиля'
               : lang === 'by' ? 'Аналіз сацыялінгвістычнага профілю'
               : '社会语言学信息档案分析',
          description: lang === 'ru' ? 'Детальный разбор семейных кодов, факторов языкового перехода и переключения кодов.'
                     : lang === 'by' ? 'Дэталёвы разбор сямейных кодаў, фактараў моўнага пераходу і пераключэння кодаў.'
                     : '深入判定受访者的母语背景、家庭使用规范、代际传承特点、以及混合语的控制度。'
        };
      }
      if (id === 'prompt-problem-informant') {
        return {
          title: lang === 'ru' ? 'Преодоление отчужденности информанта'
               : lang === 'by' ? 'Пераадоленне адчужанасці інфарманта'
               : '田野访谈心理破冰与叙事引导',
          description: lang === 'ru' ? 'Фразы-мосты и наводящие вопросы для бережного раскрепощения зажатых респондентов.'
                     : lang === 'by' ? 'Фразы-масты і навадныя пытанні для беражлівага раскрыцця заціснутых рэспандэнтаў.'
                     : '包含 10 个温和的引导式过渡问题，用于消除对录音设备的抗拒，消除自卑感，引导乡野叙事。'
        };
      }
      if (id === 'prompt-postprocess-summary') {
        return {
          title: lang === 'ru' ? 'Агрегация отчетов и полевых заметок'
               : lang === 'by' ? 'Агрэгацыя справаздач і палявых нататак'
               : '实地调研笔记与学术报告集成',
          description: lang === 'ru' ? 'Преобразование заметок и стенограмм в структурированный научно-методический отчет.'
                     : lang === 'by' ? 'Пераўтварэнне нататак і стэнаграм у структураваную навукова-метадычную справаздачу.'
                     : '将松散的调研随底、研究日志与访谈对白一键梳理成符合学术发表资质的规范考察研究报告。'
        };
      }
      if (id === 'prompt-ru-bel-bilingual-environment') {
        return {
          title: lang === 'ru' ? 'Анализ русско-белорусской билингвальной среды'
               : lang === 'by' ? 'Аналіз руска-беларускага білінгвальнага асяроддзя'
               : '俄白双语混合接触环境综合分析',
          description: lang === 'ru' ? 'Специализированный промпт для выявления речевой интерференции, переключения кодов и функционального распределения русского и белорусского языков.'
                     : lang === 'by' ? 'Спецыялізаваны промпт для выяўлення маўленчай інтэрферэнцыі, пераключэння кодаў і функцыянальнага размеркавання рускай і беларускай моў.'
                     : '专门针对具有高频词法或句法变异的俄白接触，综合判定其语言干涉程度及语码转换机制。'
        };
      }
      return {
        title: pack.title,
        description: pack.description
      };
    }
    return {
      title: 'Неизвестный промпт',
      description: 'Описание отсутствует'
    };
  };

  // Helper to translate Guide Steps
  const getGuideSteps = (modelName: string) => {
    if (modelName === 'google-ai-studio') {
      return {
        title: lang === 'ru' ? 'Интеграция с Google AI Studio' : lang === 'by' ? 'Інтэграцыя з Google AI Studio' : 'Google AI Studio 调用手册',
        recommended: 'Gemini 2.5 Flash / Pro',
        steps: lang === 'ru' ? [
          'Откройте личный кабинет Google AI Studio',
          'Скопируйте системный промпт из нашей карточки',
          'Вставьте промпт в поле System Instruction',
          'В правое окно вставьте транскрипт беседы и запустите разбор'
        ] : lang === 'by' ? [
          'Адкрыйце асабісты кабінет Google AI Studio',
          'Скапіруйте сістэмны промпт з нашай карткі',
          'Устаўце промпт у поле System Instruction',
          'У правае акно ўстаўце транскрыпт гутаркі і запусціце разбор'
        ] : [
          '登录您的 Google AI Studio 开发者主页',
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
          'Скопируйте системные инструкции и предупреждения',
          'В чате укажите модели: "Действуй строго по правилам...", затем вставьте промпт',
          'Отправьте стенограмму для глубокой фонологической русификации'
        ] : lang === 'by' ? [
          'Скапіруйце сістэмныя інструкцыі і папярэджанні',
          'У чаце пазначце мадэлі: "Дзейнічай строга па правілах...", затым уставіць промпт',
          'Адпраўце стенограму для глыбокай фаналагічнай русіфікацыі'
        ] : [
          '完整复制带有 [警告说明] 的系统提示词模板',
          '在会话窗口先发送：“请严格扮演社会语言学家，按下方规则评测：”并贴入提示词',
          '随后贴入完整的白俄罗斯多语转写对话进行高精度语言变种诊断'
        ],
        tips: lang === 'ru' ? 'Превосходно справляется со славянскими этнолектами.' : lang === 'by' ? 'Цудоўна спраўляецца са славянскімі этналектамі.' : '对于东欧/斯拉夫语系混合体（特拉相卡、乌克兰夹杂等）具备极强的常识理解力。'
      };
    } else {
      return {
        title: lang === 'ru' ? 'Интеграция с DeepSeek' : lang === 'by' ? 'Інтэграцыя з DeepSeek' : 'DeepSeek 满血版部署流程',
        recommended: 'DeepSeek-Chat (V3 API)',
        steps: lang === 'ru' ? [
          'Зарегистрируйте токен на платформе разработчика',
          'Передайте промпт в параметр "system", а реплики — в "user"',
          'Проанализируйте синтаксическую кодировку польских заимствований'
        ] : lang === 'by' ? [
          'Зарэгіструйце токен на платформе распрацоўшчыка',
          'Перадайце промпт у параметр "system", а рэплікі — у "user"',
          'Прааналізуйце сінтаксічную кадзіроўку польскіх запазычанняў'
        ] : [
          '在开发者控制台申请 API Key 认证密钥',
          '在消息数组的 System 元素中传载此提示词，User 元素承载访谈文稿',
          '分析传回的 JSON 以高保真度标注波兰语系和西斯拉夫融合特征'
        ],
        tips: lang === 'ru' ? 'Самое экономичное решение для пакетной разметки больших архивов.' : lang === 'by' ? 'Самае эканамічнае рашэнне для пакетнай разметкі вялікіх архіваў.' : '非常节省成本，是批量处理数百万字超长口述史料的性价比之首。'
      };
    }
  };

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId) || prompts[0];
  const selectedGuide = guides.find(g => g.id === selectedGuideId) || guides[0];

  useEffect(() => {
    // GSAP context introduction
    const ctx = gsap.context(() => {
      gsap.fromTo('.gsap-prompts-header', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
      gsap.fromTo('.gsap-guide-card', 
        { opacity: 0, scale: 0.98 }, 
        { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out', delay: 0.1 }
      );
      gsap.fromTo('.gsap-playground-panel', 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out', delay: 0.25 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const generateMarkdownExport = () => {
    let md = `# Систематизированные социолингвистические промпты / Сацыялінгвістычныя промпты\n\n`;
    prompts.forEach((p) => {
      const info = getPromptInfo(p.id);
      md += `### ${info.title}\n\n`;
      md += `* **Описание / Апісанне**: ${info.description}\n`;
      md += `* **Целевая архитектура / Мэтавая мадэль**: ${p.modelTarget === 'google-ai-studio' ? 'Google AI Studio' : p.modelTarget === 'qwen' ? 'Qwen / Alibaba' : p.modelTarget === 'deepseek' ? 'DeepSeek' : 'Универсальная (Universal)'}\n`;
      if (p.caution) {
        md += `* **Важное предупреждение / Папярэджанне**: ${p.caution}\n`;
      }
      md += `\n\`\`\`text\n${p.promptText}\n\`\`\`\n\n---\n\n`;
    });
    return md;
  };

  const handleDownloadMarkdown = async () => {
    try {
      const markdownContent = generateMarkdownExport();
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
      await saveFile(blob, `sociolinguistic_prompts_${lang}.md`, 'text/markdown');
    } catch (err: any) {
      console.error('Failed to save prompts markdown:', err);
    }
  };

  const handleAddManualPrompt = () => {
    if (!manualTitle.trim() || !manualPromptText.trim()) return;
    const newPack: PromptPack = {
      id: `prompt-custom-${Date.now()}`,
      title: manualTitle,
      stage: 'decryption',
      modelTarget: manualModelTarget,
      description: manualDescription || 'Пользовательский промпт',
      promptText: manualPromptText,
      tags: ['Custom']
    };
    setPrompts([...prompts, newPack]);
    setSelectedPromptId(newPack.id);
    setManualTitle('');
    setManualDescription('');
    setManualPromptText('');
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const handleImportMarkdown = () => {
    setImportError('');
    setImportSuccess(false);
    
    if (!importMarkdown.trim()) return;

    try {
      const parts = importMarkdown.split(/###\s+/);
      const importedPacks: PromptPack[] = [];

      parts.forEach(part => {
        if (!part.trim()) return;
        
        const lines = part.split('\n');
        const title = lines[0].trim();
        if (!title) return;

        let description = 'Импортированный промпт';
        const descMatch = part.match(/\*\*(?:Описание|Апісанне|功能描述)\*\*:\s*([^\n]+)/i);
        if (descMatch && descMatch[1]) {
          description = descMatch[1].trim();
        }

        let modelTarget: 'google-ai-studio' | 'qwen' | 'deepseek' | 'universal' = 'universal';
        const modelMatch = part.match(/\*\*(?:Целевая архитектура|Мэтавая мадэль|适配目标模型)\*\*:\s*([^\n]+)/i);
        if (modelMatch && modelMatch[1]) {
          const m = modelMatch[1].toLowerCase();
          if (m.includes('google') || m.includes('gemini')) {
            modelTarget = 'google-ai-studio';
          } else if (m.includes('qwen')) {
            modelTarget = 'qwen';
          } else if (m.includes('deepseek')) {
            modelTarget = 'deepseek';
          }
        }

        let caution: string | undefined = undefined;
        const cautionMatch = part.match(/\*\*(?:Важное предупреждение|Папярэджанне|Важное предупреждение)\*\*:\s*([^\n]+)/i);
        if (cautionMatch && cautionMatch[1]) {
          caution = cautionMatch[1].trim();
        }

        const codeBlockMatch = part.match(/```(?:text)?\s*([\s\S]*?)```/);
        let promptText = '';
        if (codeBlockMatch && codeBlockMatch[1]) {
          promptText = codeBlockMatch[1].trim();
        } else {
          const remainingLines = lines.slice(1).filter(l => !l.trim().startsWith('*'));
          promptText = remainingLines.join('\n').trim();
        }

        if (title && promptText) {
          importedPacks.push({
            id: `prompt-custom-${Math.random().toString(36).substr(2, 9)}`,
            title,
            stage: 'decryption',
            modelTarget,
            description,
            promptText,
            caution,
            tags: ['Imported']
          });
        }
      });

      if (importedPacks.length > 0) {
        setPrompts([...prompts, ...importedPacks]);
        setSelectedPromptId(importedPacks[0].id);
        setImportMarkdown('');
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError(exLocal.importErrorToast || 'Не удалось распознать промпты в тексте.');
      }
    } catch (e) {
      setImportError(exLocal.importErrorToast || 'Не удалось распознать промпты в тексте.');
    }
  };

  const exLocal = {
    ru: {
      btnExport: 'Экспортировать все промпты (.MD)',
      hideExport: 'Скрыть разметку экспорта',
      copyExport: 'Скопировать Markdown',
      downloadFile: 'Скачать .md файл',
      exportTitle: 'Сформированная разметка экспорта (Markdown)',
      copiedToast: 'Скопировано!',
      btnImport: 'Импортировать промпт(ы)',
      hideImport: 'Скрыть импорт промптов',
      importTitle: 'Импорт из Markdown или ручной ввод',
      importPlaceholder: 'Вставьте сюда Markdown из экспорта или введите текст...',
      btnDoImport: 'Распознать и импортировать',
      importSuccessToast: 'Промпты успешно импортированы!',
      importErrorToast: 'Не удалось распознать промпты в тексте. Попробуйте ручную форму.',
      manualTitle: 'Или создайте вручную:',
      manualName: 'Название промпта',
      manualDesc: 'Описание промпта',
      manualText: 'Системный промпт (текст)',
      btnManualAdd: 'Добавить промпт',
      manualTarget: 'Целевая модель'
    },
    by: {
      btnExport: 'Экспартаваць усе промпты (.MD)',
      hideExport: 'Схаваць разметку экспарту',
      copyExport: 'Скапіяваць Markdown',
      downloadFile: 'Спампаваць .md файл',
      exportTitle: 'Сфарміраваная разметка экспарту (Markdown)',
      copiedToast: 'Скапіявана!',
      btnImport: 'Імпартаваць промпт(ы)',
      hideImport: 'Схаваць імпарт промптаў',
      importTitle: 'Імпарт з Markdown або ручны ўвод',
      importPlaceholder: 'Устаўце сюды Markdown з экспарту або ўвядзіце тэкст...',
      btnDoImport: 'Распазнаць і імпартаваць',
      importSuccessToast: 'Промпты паспяхова імпартаваны!',
      importErrorToast: 'Не ўдалося распазнаць промпты ў тэксце. Паспрабуйце ручную форму.',
      manualTitle: 'Або стварыце ўручную:',
      manualName: 'Назва промпта',
      manualDesc: 'Апісанне промпта',
      manualText: 'Сістэмны промпт (тэкст)',
      btnManualAdd: 'Дадаць промпт',
      manualTarget: 'Мэтавая мадэль'
    },
    zh: {
      btnExport: '一键导出所有提示词 (.MD)',
      hideExport: '隐藏导出文本框',
      copyExport: '复制 Markdown 源码',
      downloadFile: '下载 .md 文件',
      exportTitle: '已生成的 Markdown 数据块',
      copiedToast: '已复制!',
      btnImport: '导入新提示词 (.MD / 手动)',
      hideImport: '隐藏导入选项',
      importTitle: '自 Markdown 导入或手动输入',
      importPlaceholder: '可在此处粘帖导出的 Markdown 格式内容，或手动在下方添加...',
      btnDoImport: '解析并导入',
      importSuccessToast: '提示词成功导入！',
      importErrorToast: '未在文本中识别出标准提示词段落，请使用手动创建。',
      manualTitle: '或者手动创建：',
      manualName: '提示词名称',
      manualDesc: '功能描述',
      manualText: '系统级提示词内容',
      btnManualAdd: '点此新增提示词',
      manualTarget: '适配目标模型'
    }
  }[lang];

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-10" id="prompt-library-container">
      {/* Header section with branding and tagline */}
      <div className="gsap-prompts-header text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 bg-sahara-clay/20 border border-sahara-primary/10 rounded-full px-4 py-1.5 text-sahara-primary text-xs font-black uppercase tracking-widest">
          <Bot className="w-4 h-4" />
          <span>{t.pSub || t.navPrompts}</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-serif font-black tracking-tight text-sahara-primary">
          {t.pTitle}
        </h2>
        <p className="font-sans text-sm md:text-base text-sahara-secondary leading-relaxed">
          {t.pDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left column: Prompts packs and Model guides navigation */}
        <div className="lg:col-span-4 space-y-8">
          {/* Prompts list */}
          <div className="gsap-guide-card bg-white border border-sahara-surface-dim/40 rounded-xl p-8 space-y-6 shadow-xs">
            <span className="font-sans text-xs uppercase font-black text-sahara-primary tracking-widest block mb-1">
              {t.pLibrary}
            </span>
            <div className="space-y-4">
              {prompts.map((pack) => {
                const info = getPromptInfo(pack.id);
                return (
                  <button
                    key={pack.id}
                    onClick={() => {
                      setSelectedPromptId(pack.id);
                    }}
                    className={`w-full text-left p-5 border rounded-xl transition-all cursor-pointer block ${
                      selectedPromptId === pack.id
                        ? 'bg-sahara-clay/20 border-sahara-primary/40 text-sahara-primary font-black shadow-xs'
                        : 'border-sahara-surface-dim/30 text-sahara-secondary hover:bg-sahara-background'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="font-sans text-sm font-black uppercase tracking-wider block">{info.title}</span>
                    </div>
                    <p className="text-xs text-sahara-secondary font-serif italic mt-1 leading-relaxed">{info.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Export & Import Section at the bottom of the card */}
            <div className="border-t border-sahara-surface-dim/30 pt-6 mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsExportOpen(!isExportOpen);
                    setIsImportOpen(false);
                  }}
                  className={`w-full py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border hover:scale-[1.01] ${
                    isExportOpen 
                      ? 'bg-sahara-primary text-white border-sahara-primary' 
                      : 'bg-sahara-clay/10 hover:bg-sahara-primary/10 text-sahara-primary border-sahara-primary/20'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  {isExportOpen ? exLocal.hideExport : exLocal.btnExport}
                </button>

                <button
                  onClick={() => {
                    setIsImportOpen(!isImportOpen);
                    setIsExportOpen(false);
                  }}
                  className={`w-full py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border hover:scale-[1.01] ${
                    isImportOpen 
                      ? 'bg-sahara-primary text-white border-sahara-primary' 
                      : 'bg-sahara-clay/10 hover:bg-sahara-primary/10 text-sahara-primary border-sahara-primary/20'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isImportOpen ? exLocal.hideImport : exLocal.btnImport}
                </button>
              </div>

              {isExportOpen && (
                <div className="bg-sahara-clay/5 p-4 border border-sahara-surface-dim/40 rounded-xl space-y-3.5">
                  <span className="text-[10px] sm:text-xs font-sans font-black text-sahara-primary uppercase tracking-wider block">
                    {exLocal.exportTitle}
                  </span>
                  
                  <textarea
                    readOnly
                    rows={8}
                    value={generateMarkdownExport()}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full p-2.5 text-[11px] font-mono rounded bg-white border border-sahara-surface-dim/50 focus:outline-none leading-relaxed text-sahara-onbackground focus:ring-1 focus:ring-sahara-primary"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => copyText(generateMarkdownExport(), 'export-markdown')}
                      className="py-2.5 text-[10px] sm:text-xs font-sans font-black uppercase tracking-tight text-center rounded-lg border border-sahara-primary/30 text-sahara-primary bg-white hover:bg-sahara-clay/15 transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                    >
                      <Check className="w-3.5 h-3.5" style={{ display: copiedId === 'export-markdown' ? 'inline' : 'none' }} />
                      {copiedId === 'export-markdown' ? exLocal.copiedToast : exLocal.copyExport}
                    </button>
                    
                    <button
                      onClick={handleDownloadMarkdown}
                      className="py-2.5 text-[10px] sm:text-xs font-sans font-black uppercase tracking-tight text-center rounded-lg bg-sahara-primary text-white hover:bg-sahara-primary/95 transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      {exLocal.downloadFile}
                    </button>
                  </div>
                </div>
              )}

              {isImportOpen && (
                <div className="bg-sahara-clay/5 p-4 border border-sahara-surface-dim/40 rounded-xl space-y-4">
                  <span className="text-[10px] sm:text-xs font-sans font-black text-sahara-primary uppercase tracking-wider block">
                    {exLocal.importTitle}
                  </span>
                  
                  <textarea
                    rows={4}
                    placeholder={exLocal.importPlaceholder}
                    value={importMarkdown}
                    onChange={(e) => setImportMarkdown(e.target.value)}
                    className="w-full p-2.5 text-[11px] font-mono rounded bg-white border border-sahara-surface-dim/50 focus:outline-none leading-relaxed text-sahara-onbackground focus:ring-1 focus:ring-sahara-primary"
                  />

                  <button
                    onClick={handleImportMarkdown}
                    disabled={!importMarkdown.trim()}
                    className="w-full py-2.5 text-[11px] font-sans font-black uppercase tracking-tight text-center rounded-lg bg-sahara-primary text-white hover:bg-sahara-primary/95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {exLocal.btnDoImport}
                  </button>

                  <div className="border-t border-sahara-surface-dim/20 pt-4 space-y-3">
                    <span className="text-[10px] sm:text-xs font-sans font-black text-sahara-secondary uppercase tracking-wider block">
                      {exLocal.manualTitle}
                    </span>

                    <input
                      type="text"
                      placeholder={exLocal.manualName}
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="w-full p-2 text-[11px] rounded bg-white border border-sahara-surface-dim/50 focus:outline-none focus:ring-1 focus:ring-sahara-primary font-sans text-sahara-onbackground"
                    />

                    <input
                      type="text"
                      placeholder={exLocal.manualDesc}
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      className="w-full p-2 text-[11px] rounded bg-white border border-sahara-surface-dim/50 focus:outline-none focus:ring-1 focus:ring-sahara-primary font-sans text-sahara-onbackground"
                    />

                    <div className="space-y-1">
                      <span className="text-[9px] font-sans font-black text-sahara-secondary uppercase tracking-wider">
                        {exLocal.manualTarget}
                      </span>
                      <select
                        value={manualModelTarget}
                        onChange={(e) => setManualModelTarget(e.target.value as any)}
                        className="w-full p-2 text-[11px] rounded bg-white border border-sahara-surface-dim/50 focus:outline-none focus:ring-1 focus:ring-sahara-primary font-sans text-sahara-secondary"
                      >
                        <option value="universal">Universal</option>
                        <option value="google-ai-studio">Google AI Studio</option>
                        <option value="qwen">Qwen</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>
                    </div>

                    <textarea
                      rows={3}
                      placeholder={exLocal.manualText}
                      value={manualPromptText}
                      onChange={(e) => setManualPromptText(e.target.value)}
                      className="w-full p-2 text-[11px] font-mono rounded bg-white border border-sahara-surface-dim/50 focus:outline-none leading-relaxed text-sahara-onbackground focus:ring-1 focus:ring-sahara-primary"
                    />

                    <button
                      onClick={handleAddManualPrompt}
                      disabled={!manualTitle.trim() || !manualPromptText.trim()}
                      className="w-full py-2.5 text-[11px] font-sans font-black uppercase tracking-tight text-center rounded-lg border border-sahara-primary/30 text-sahara-primary bg-white hover:bg-sahara-clay/15 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {exLocal.btnManualAdd}
                    </button>
                  </div>

                  {importSuccess && (
                    <div className="text-center text-xs font-black text-green-700 animate-bounce">
                      {exLocal.importSuccessToast}
                    </div>
                  )}

                  {importError && (
                    <div className="text-center text-xs font-serif text-red-700">
                      {importError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Selected Prompt Display & Active Interactive Sandbox console */}
        <div className="lg:col-span-8 space-y-10">
          <div className="gsap-playground-panel bg-white border border-sahara-surface-dim/40 rounded-xl p-8 md:p-10 space-y-8 shadow-xs">
            {/* Header prompt details */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-sahara-surface-dim/30 pb-6 gap-6">
              <div>
                <span className="font-sans text-[10px] uppercase font-black tracking-widest text-sahara-primary">
                  {t.pSystemTask}
                </span>
                <h3 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-sahara-primary mt-1">
                  {getPromptInfo(selectedPrompt.id).title}
                </h3>
              </div>
              <button
                onClick={() => copyText(selectedPrompt.promptText, selectedPrompt.id)}
                className="bg-white border-2 border-sahara-surface-dim/70 hover:border-sahara-primary hover:text-sahara-primary rounded-md text-sahara-secondary text-xs font-black uppercase tracking-widest px-8 py-3.5 transition-all cursor-pointer self-start shadow-2xs hover:scale-[1.01]"
              >
                {copiedId === selectedPrompt.id ? t.btnCopied : t.btnCopyPrompt}
              </button>
            </div>

            {/* Prompt Text details box with high contrast paper feel */}
            <div className="bg-sahara-clay/10 border border-sahara-primary/10 rounded-xl p-6">
              <span className="font-sans text-xs uppercase tracking-widest text-sahara-primary block mb-3 font-extrabold pb-1 border-b border-sahara-primary/10">
                {t.pSystemInstructionLabel}
              </span>
              <p className="text-sahara-onbackground text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto pr-2">
                {selectedPrompt.promptText}
              </p>
            </div>

            {selectedPrompt.caution && (
              <div className="bg-red-55/40 border border-red-200 rounded-xl p-5 flex items-start gap-3.5">
                <AlertCircle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
                <p className="text-xs sm:text-sm text-red-950 leading-relaxed font-serif">
                  <strong>{t.pWarningLabel}</strong> {selectedPrompt.caution}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
