/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Copy, Check, AlertTriangle, Lightbulb, ListTodo, ClipboardCopy } from 'lucide-react';
import { InformantScenario } from '../types';
import { DEFAULT_INFORMANT_SCENARIOS } from '../data/defaultData';
import { gsap } from 'gsap';

export default function FieldTactics() {
  const [scenarios] = useState<InformantScenario[]>(DEFAULT_INFORMANT_SCENARIOS);
  const [selectedScenario, setSelectedScenario] = useState<InformantScenario>(DEFAULT_INFORMANT_SCENARIOS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  // Field checklist state saved locally
  const [checklistItems, setChecklistItems] = useState([
    { id: 'c-1', text: 'Проверить заряд диктофона и внешнего аккумулятора (PowerBank)', checked: true, stage: 'before' },
    { id: 'c-2', text: 'Подготовить печатные копии анкет и информированных согласий (для подписи или ознакомления)', checked: true, stage: 'before' },
    { id: 'c-3', text: 'Взять сувениры или угощения (чай, печенье, конфеты)— традиционный жест вежливости в деревне', checked: false, stage: 'before' },
    { id: 'c-4', text: 'Записать телефоны экстренных служб и контакты координатора экспедиции', checked: false, stage: 'before' },
    { id: 'c-5', text: 'В поле: четко представиться и получить УСТНОЕ согласие на ведение записи перед включением диктофона', checked: false, stage: 'during' },
    { id: 'c-6', text: 'В поле: следить за речевым кодом собеседника — не поправлять фонетические особенности!', checked: false, stage: 'during' },
    { id: 'c-7', text: 'После визита: прослушать запись на наличие шумов, пометить имя шифром (В-78), чтобы скрыть личные данные', checked: false, stage: 'after' },
    { id: 'c-8', text: 'После визита: записать в дневник нетипичные слова, контекст дома, отношение информанта', checked: false, stage: 'after' },
  ]);

  useEffect(() => {
    // GSAP staggered entrance on key sections
    const ctx = gsap.context(() => {
      gsap.fromTo('.gsap-tactics-header', { opacity: 0, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out' });
      gsap.fromTo('.gsap-stagger-btn', 
        { opacity: 0, x: -12 }, 
        { opacity: 1, x: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', delay: 0.1 }
      );
      gsap.fromTo('.gsap-main-card', 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.25 }
      );
    }, elementRef);
    return () => ctx.revert();
  }, []);

  const toggleChecklistItem = (id: string) => {
    setChecklistItems(
      checklistItems.map(item => item.id === id ? { ...item, checked: !item.checked } : item)
    );
  };

  const copyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div ref={elementRef} className="space-y-10 max-w-7xl mx-auto px-1 md:px-0">
      {/* Intro Header */}
      <div className="gsap-tactics-header bg-white p-6 md:p-8 border border-sahara-surface-dim/40 rounded-lg flex items-center gap-4 shadow-xs">
        <div className="p-3 bg-sahara-primary text-white rounded-md shrink-0">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-sahara-primary block mb-1">
            RESEARCH ETHICS & FIELDWORK MANUAL
          </span>
          <h2 className="text-3xl font-serif font-semibold tracking-tight text-sahara-onbackground">
            Этика полевого опроса & Поведение
          </h2>
          <p className="font-sans text-sahara-secondary text-xs mt-1 leading-relaxed">
            Практическое пособие по поведению в сложных этнолингвистических ситуациях, преодолению закрытости информантов и интерактивный протокол готовности.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Scenarios selection and checklist */}
        <div className="lg:col-span-4 space-y-8">
          {/* Scenario Selection */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-lg p-6 space-y-4 shadow-xs">
            <span className="font-sans text-[10px] uppercase font-bold text-sahara-primary tracking-widest block mb-1">
              КЕЙСЫ СЛОЖНЫХ ИНТЕРВЬЮ
            </span>
            <div className="space-y-2">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc)}
                  className={`gsap-stagger-btn w-full text-left p-4 rounded-md border transition-all cursor-pointer block text-xs leading-relaxed ${
                    selectedScenario.id === sc.id
                      ? 'bg-sahara-clay/20 border-sahara-primary/40 font-semibold text-sahara-primary'
                      : 'border-sahara-surface-dim/30 text-sahara-secondary hover:bg-sahara-background'
                  }`}
                >
                  <span className="font-sans uppercase tracking-tight text-[9px] block text-sahara-secondary mb-1">Сценарий</span>
                  <span className="font-serif italic text-sahara-onbackground">{sc.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Checklist */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-lg p-6 space-y-4 shadow-xs">
            <span className="font-sans text-[10px] uppercase font-bold text-sahara-primary tracking-widest block">
              ПРОТОКОЛ ГОТОВНОСТИ (ЧЕК-ЛИСТ)
            </span>
            
            <div className="space-y-6 divide-y divide-sahara-surface-dim/30">
              <div className="space-y-3">
                <span className="font-sans text-[9px] font-bold text-sahara-secondary/60 uppercase block tracking-wider">1. До выхода на локус</span>
                <div className="space-y-3">
                  {checklistItems.filter(i => i.stage === 'before').map(item => (
                    <label key={item.id} className="flex items-start gap-3 text-xs text-sahara-secondary cursor-pointer select-none font-sans leading-relaxed">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-0.5 rounded border-sahara-surface-dim text-sahara-primary focus:ring-sahara-primary w-4 h-4 cursor-pointer"
                      />
                      <span className={item.checked ? 'line-through text-sahara-secondary/40 italic' : ''}>{item.text}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <span className="font-sans text-[9px] font-bold text-sahara-secondary/60 uppercase block tracking-wider">2. Непосредственно в поле</span>
                <div className="space-y-3">
                  {checklistItems.filter(i => i.stage === 'during').map(item => (
                    <label key={item.id} className="flex items-start gap-3 text-xs text-sahara-secondary cursor-pointer select-none font-sans leading-relaxed">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-0.5 rounded border-sahara-surface-dim text-sahara-primary focus:ring-sahara-primary w-4 h-4 cursor-pointer"
                      />
                      <span className={item.checked ? 'line-through text-sahara-secondary/40 italic' : ''}>{item.text}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <span className="font-sans text-[9px] font-bold text-sahara-secondary/60 uppercase block tracking-wider">3. Постобработка и дебрифинг</span>
                <div className="space-y-3">
                  {checklistItems.filter(i => i.stage === 'after').map(item => (
                    <label key={item.id} className="flex items-start gap-3 text-xs text-sahara-secondary cursor-pointer select-none font-sans leading-relaxed">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-0.5 rounded border-sahara-surface-dim text-sahara-primary focus:ring-sahara-primary w-4 h-4 cursor-pointer"
                      />
                      <span className={item.checked ? 'line-through text-sahara-secondary/40 italic' : ''}>{item.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Scenario detailed tactics information */}
        <div className="lg:col-span-8 space-y-8">
          <div className="gsap-main-card bg-white border border-sahara-surface-dim/40 rounded-lg p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <span className="font-sans text-[9px] uppercase font-bold text-sahara-primary px-2.5 py-1 rounded-sm border border-sahara-primary/20 bg-sahara-clay/15">
                ЛОКАЛЬНЫЙ СЦЕНАРИЙ
              </span>
              <h3 className="text-2xl font-serif font-semibold text-sahara-primary mt-4 tracking-tight">{selectedScenario.title}</h3>
              
              <div className="mt-4 bg-sahara-clay/10 border border-sahara-primary/10 rounded-lg p-5">
                <span className="font-sans text-[10px] uppercase font-bold text-sahara-primary block mb-1">СУТЬ ПРОБЛЕМЫ И СТРАХИ ИНФОРМАНТА</span>
                <p className="font-serif text-sm text-sahara-secondary leading-relaxed italic">
                  "{selectedScenario.situation}"
                </p>
              </div>
            </div>

            {/* Split panel: WRONG vs RIGHT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-white border border-red-200 rounded-lg p-5 space-y-2">
                <div className="flex items-center gap-1.5 text-red-800 font-bold font-sans text-[10px] uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
                  <span>ОШИБОЧНОЕ ПОВЕДЕНИЕ</span>
                </div>
                <p className="text-sahara-secondary text-xs font-sans leading-relaxed italic">{selectedScenario.wrongReaction}</p>
              </div>

              <div className="bg-white border border-sahara-primary/10 rounded-lg p-5 space-y-2 shadow-xs">
                <div className="flex items-center gap-1.5 text-sahara-primary font-bold font-sans text-[10px] uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4 shrink-0 text-sahara-primary" />
                  <span>РЕКОМЕНДОВАННАЯ ТАКТИКА</span>
                </div>
                <p className="text-sahara-onbackground text-xs font-sans leading-relaxed italic">{selectedScenario.rightReaction}</p>
              </div>
            </div>

            {/* Practical prompts to bypass stress */}
            <div className="space-y-4 pt-4 border-t border-sahara-surface-dim/30">
              <span className="font-sans text-[10px] uppercase font-bold text-sahara-primary tracking-widest block">
                РЕЧЕВЫЕ КЛИШЕ РАЗРЯДКИ (КОПИРОВАТЬ ДЛЯ ПАМЯТКИ)
              </span>
              <div className="space-y-3">
                {selectedScenario.recommendedPrompts.map((p, pidx) => (
                  <div key={pidx} className="bg-sahara-clay/5 border border-sahara-surface-dim/30 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <p className="text-xs text-sahara-onbackground font-serif leading-relaxed italic">“{p}”</p>
                    <button
                      onClick={() => copyPrompt(p, `prompt-${pidx}`)}
                      className="bg-white border border-sahara-surface-dim/70 hover:border-sahara-primary hover:text-sahara-primary rounded-sm font-bold px-4 py-2 font-sans text-[9px] uppercase tracking-widest transition-all shrink-0 cursor-pointer shadow-2xs hover:scale-[1.02]"
                    >
                      {copiedId === `prompt-${pidx}` ? 'Скопировано!' : 'Копировать'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Ethical Notes */}
            {selectedScenario.ethicsNotes && (
              <div className="border-t border-sahara-surface-dim/30 pt-6">
                <div className="flex items-center gap-1.5 text-sahara-primary font-bold font-sans text-[10px] uppercase tracking-wider mb-2">
                  <Shield className="w-4.5 h-4.5" />
                  <span>МЕЖДУНАРОДНЫЙ ЭТИЧЕСКИЙ СТАНДАРТ</span>
                </div>
                <p className="text-sahara-secondary/80 text-[11px] font-sans leading-relaxed italic">{selectedScenario.ethicsNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
