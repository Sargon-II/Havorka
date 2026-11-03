/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Type, ChevronDown } from 'lucide-react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import QuestionnaireBuilder from './components/QuestionnaireBuilder';
import PromptLibrary from './components/PromptLibrary';
import LinguisticPostprocessor from './components/LinguisticPostprocessor';
import SecurityAndApi from './components/SecurityAndApi';
import { Questionnaire } from './types';
import { DEFAULT_QUESTIONNAIRE } from './data/defaultData';
import { Language, translations } from './lib/translations';
import { gsap } from 'gsap';
import { ApiKeyGate } from './components/ApiKeyGate';

import { usePersistentState } from './lib/storage/usePersistentState';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [lang, setLang] = usePersistentState<Language>('app_lang', 'ru');
  const [questionnaire, setQuestionnaire] = usePersistentState<Questionnaire>('sociologist_questionnaire', DEFAULT_QUESTIONNAIRE);
  const [researcherName, setResearcherName] = usePersistentState<string>('researcher_name', 'Введите ФИО');
  const [fontSize, setFontSize] = usePersistentState<string>('app_font_size', 'base');
  const [fontWeight, setFontWeight] = usePersistentState<string>('app_font_weight', 'normal');
  const [showFontMenu, setShowFontMenu] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  // Sync font size to document root html element for perfect responsive rem scaling
  useEffect(() => {
    const sizeMap: Record<string, string> = {
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
    };
    document.documentElement.style.fontSize = sizeMap[fontSize] || '16px';
  }, [fontSize]);

  // Close font settings menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setShowFontMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // GSAP transition on tab switch
  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [activeTab]);

  const t = translations[lang];

  const loadPreset = () => {
    let confirmMsg = 'Вы действительно хотите загрузить стандартный комплексный опросник по Беларуси? Текущие изменения в опросниках будут перезаписаны.';
    if (lang === 'by') {
      confirmMsg = 'Вы сапраўды хочаце загрузіць стандартны комплексны апытальнік па Беларусі? Бягучыя змены ў апытальніках будуць перазапісаныя.';
    } else if (lang === 'zh') {
      confirmMsg = '您确定要加载白俄罗斯基准调研问卷吗？您当前所做的任何修改都将被覆盖。';
    }

    if (window.confirm(confirmMsg)) {
      setQuestionnaire(DEFAULT_QUESTIONNAIRE);
    }
  };

  const resetToClean = () => {
    let confirmMsg = 'Вы уверены, что хотите сбросить опросник и стереть все блоки? Вы сможете начать конструировать анкету с чистого листа.';
    if (lang === 'by') {
      confirmMsg = 'Вы ўпэўненыя, што хочаце скінуць апытальнік і сцерці ўсе блокі? Вы зможаце пачаць канструяваць анкету з чыстага ліста.';
    } else if (lang === 'zh') {
      confirmMsg = '您确定要清空并重置当前所有内容吗？您可以从零开始构建新的问卷。';
    }

    let defaultTitle = 'Индивидуальный полевой опросник исследователя';
    if (lang === 'by') {
      defaultTitle = 'Індывідуальны палявы апытальнік даследчыка';
    } else if (lang === 'zh') {
      defaultTitle = '个人实地访谈问卷提纲';
    }

    if (window.confirm(confirmMsg)) {
      const cleanQ: Questionnaire = {
        id: `q-clean-${Date.now()}`,
        title: defaultTitle,
        createdAt: new Date().toISOString(),
        blocks: []
      };
      setQuestionnaire(cleanQ);
    }
  };

  const activeColor = activeTab === 'dashboard' || activeTab === 'prompts' || activeTab === 'postprocess' ? '#7C7948' : '#B66029';

  const weightClass = fontWeight === 'light' ? 'app-wt-light' : fontWeight === 'bold' ? 'app-wt-bold' : 'app-wt-normal';

  return (
    <div id="app-container" className={`min-h-screen flex bg-sahara-background text-sahara-onbackground font-sans pb-16 md:pb-0 ${weightClass}`}>
      <ApiKeyGate lang={lang}>
        {/* Sidebar navigation on PC, bottom nav bar on mobile */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          researcherName={researcherName}
          setResearcherName={setResearcherName}
          lang={lang}
          activeColor={activeColor}
        />

        {/* Main Content Pane */}
        <main
          style={{ '--color-sahara-primary': activeColor } as React.CSSProperties}
          className="flex-1 overflow-y-auto h-screen relative bg-sahara-background flex flex-col"
        >
          {/* Global mini-header bar */}
          <header className="bg-white border-b border-sahara-surface-dim/40 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-40 gap-4 sm:gap-2">
            <div className="flex items-center gap-3">
              <span id="header-brand-title" className="font-serif text-xl tracking-tight text-sahara-primary font-bold">
                {t.headerTitle}
              </span>
              <span className="hidden lg:inline text-sm text-sahara-secondary/70 border-l border-sahara-surface-dim/70 pl-3">
                {t.headerRegion}
              </span>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-auto">
              {/* 3-Language switcher (RU/БЕЛ/КИТ) */}
              <div className="flex bg-sahara-background p-1 rounded-md border border-sahara-surface-dim/70 gap-1.5 shadow-2xs">
                <button
                  id="btn-lang-ru"
                  onClick={() => setLang('ru')}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all uppercase cursor-pointer ${
                    lang === 'ru'
                      ? 'bg-sahara-primary text-white shadow-xs scale-102 font-black'
                      : 'text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-clay/20'
                  }`}
                >
                  РУ
                </button>
                <button
                  id="btn-lang-by"
                  onClick={() => setLang('by')}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all uppercase cursor-pointer ${
                    lang === 'by'
                      ? 'bg-sahara-primary text-white shadow-xs scale-102 font-black'
                      : 'text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-clay/20'
                  }`}
                >
                  БЕЛ
                </button>
                <button
                  id="btn-lang-zh"
                  onClick={() => setLang('zh')}
                  className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all uppercase cursor-pointer ${
                    lang === 'zh'
                      ? 'bg-sahara-primary text-white shadow-xs scale-102 font-black'
                      : 'text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-clay/20'
                  }`}
                >
                  КИТ
                </button>
              </div>

              {/* Elegant Font Size & Weight Adjustment Popover */}
              <div className="relative" ref={fontMenuRef}>
                <button
                  id="btn-font-settings"
                  onClick={() => setShowFontMenu(!showFontMenu)}
                  className="flex items-center gap-1.5 bg-sahara-clay/25 hover:bg-sahara-clay/40 text-sahara-primary px-3 py-1.5 rounded-md border border-sahara-primary/10 transition-all font-sans text-xs uppercase tracking-wider font-extrabold cursor-pointer shadow-2xs"
                >
                  <Type className="w-4 h-4" />
                  <span className="hidden sm:inline font-bold">{t.fontSettings}</span>
                  <span className="sm:hidden font-bold">{t.fontSizeLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFontMenu ? 'rotate-180' : ''}`} />
                </button>

                {showFontMenu && (
                  <div className="absolute right-0 mt-2.5 w-60 bg-white border border-sahara-surface-dim shadow-md rounded-xl p-3.5 z-50 text-sahara-onbackground text-left">
                    <div className="space-y-4">
                      {/* Font Size Row */}
                      <div>
                        <span className="font-sans text-[10px] uppercase tracking-widest font-extrabold text-sahara-secondary/80 block mb-1.5">
                          {t.fontSizeLabel}
                        </span>
                        <div className="grid grid-cols-4 gap-1 bg-sahara-background p-1 rounded-lg border border-sahara-surface-dim/40">
                          {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => {
                            const labels: Record<string, string> = {
                              sm: t.fontSizeSm,
                              base: t.fontSizeBase,
                              lg: t.fontSizeLg,
                              xl: t.fontSizeXl,
                            };
                            return (
                              <button
                                key={sz}
                                onClick={() => setFontSize(sz)}
                                className={`py-1 text-center rounded-md text-xs font-black transition-all cursor-pointer ${
                                  fontSize === sz
                                    ? 'bg-sahara-primary text-white shadow-xs'
                                    : 'text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-clay/15'
                                }`}
                              >
                                {labels[sz]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Font Weight Row */}
                      <div>
                        <span className="font-sans text-[10px] uppercase tracking-widest font-extrabold text-sahara-secondary/80 block mb-1.5">
                          {t.fontDensityLabel}
                        </span>
                        <div className="grid grid-cols-3 gap-1 bg-sahara-background p-1 rounded-lg border border-sahara-surface-dim/40">
                          {(['light', 'normal', 'bold'] as const).map((wt) => {
                            const labels: Record<string, string> = {
                              light: t.fontDensityLight,
                              normal: t.fontDensityNormal,
                              bold: t.fontDensityBold,
                            };
                            return (
                              <button
                                key={wt}
                                onClick={() => setFontWeight(wt)}
                                className={`py-1 text-center rounded-md text-[10px] font-black tracking-tighter transition-all uppercase cursor-pointer ${
                                  fontWeight === wt
                                    ? 'bg-sahara-primary text-white shadow-xs'
                                    : 'text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-clay/15'
                                }`}
                              >
                                {labels[wt]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Dynamic sub-panels routing with GSAP Ref */}
          <div ref={contentRef} className="p-4 md:p-8 flex-1">
            {activeTab === 'dashboard' && (
              <Dashboard
                questionnaire={questionnaire}
                loadPreset={loadPreset}
                resetToClean={resetToClean}
                setActiveTab={setActiveTab}
                lang={lang}
              />
            )}

            {activeTab === 'questionnaire' && (
              <QuestionnaireBuilder
                questionnaire={questionnaire}
                onChange={setQuestionnaire}
                lang={lang}
                researcherName={researcherName}
              />
            )}

            {activeTab === 'prompts' && (
              <PromptLibrary lang={lang} />
            )}

            {activeTab === 'postprocess' && (
              <LinguisticPostprocessor 
                researcherName={researcherName} 
                onResearcherNameChange={setResearcherName} 
                lang={lang} 
              />
            )}

            {activeTab === 'security' && (
              <SecurityAndApi lang={lang} />
            )}
          </div>
        </main>
      </ApiKeyGate>
    </div>
  );
}
