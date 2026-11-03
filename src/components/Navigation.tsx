/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, Edit2, Check } from 'lucide-react';
import { Language, translations } from '../lib/translations';
import { gsap } from 'gsap';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: void | string) => void;
  researcherName: string;
  setResearcherName: (name: string) => void;
  lang: Language;
  activeColor?: string;
}

export default function Navigation({ activeTab, setActiveTab, researcherName, setResearcherName, lang, activeColor = '#B66029' }: NavigationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(researcherName);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP staggered entrance on navigation items
    const elements = sidebarRef.current?.querySelectorAll('.gsap-stagger-item');
    if (elements && elements.length > 0) {
      gsap.fromTo(
        elements,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.65, stagger: 0.08, ease: 'power2.out' }
      );
    }
  }, []);

  const handleSave = () => {
    if (tempName.trim()) {
      setResearcherName(tempName.trim());
    }
    setIsEditing(false);
  };

  const t = translations[lang];

  const navItems = [
    { id: 'dashboard', label: t.navDashboard, idxStr: '01' },
    { id: 'questionnaire', label: t.navQuestionnaire, idxStr: '02' },
    { id: 'prompts', label: t.navPrompts, idxStr: '03' },
    { id: 'security', label: t.navSecurity, idxStr: '04' },
    { id: 'postprocess', label: t.navPostprocess, idxStr: '05' },
  ];

  return (
    <>
      {/* Sidebar for Desktop */}
      <aside
        ref={sidebarRef}
        style={{ '--color-sahara-primary': activeColor } as React.CSSProperties}
        className="hidden md:flex flex-col w-64 lg:w-72 bg-[#f5f3f3] text-sahara-onbackground border-r border-sahara-surface-dim/40 p-6 lg:p-8 justify-between h-screen"
      >
        <div>
          <div className="pb-6 border-b border-sahara-surface-dim/50 gsap-stagger-item">
            <span className="font-sans text-[10px] uppercase tracking-widest font-extrabold text-sahara-primary mb-2 block">
              <span className="bg-sahara-clay/20 text-sahara-primary/95 px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider block text-center border border-sahara-primary/10 select-none">
                {lang === 'ru' ? 'Версия: бета 0.018' : lang === 'by' ? 'Версія: бэта 0.018' : '版本: 测试版 0.018'}
              </span>
            </span>
            <h1 className="text-2xl lg:text-3xl font-serif tracking-tight leading-none italic font-black text-[#B66029]">
              {t.navTitle}
            </h1>
            <p className="font-serif text-xs italic text-sahara-secondary mt-2 pr-1 leading-relaxed">
              {t.navSubtitle}
            </p>
          </div>
          
          <nav className="py-6 space-y-5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className="w-full text-left group block cursor-pointer outline-none focus:outline-none gsap-stagger-item"
                >
                  <div className="flex flex-col">
                    {/* Index and selection indicator */}
                    <span className={`font-sans text-[10px] uppercase font-extrabold tracking-widest transition-colors ${
                      isActive ? 'text-sahara-primary' : 'text-sahara-secondary/50 group-hover:text-sahara-primary'
                    }`}>
                      {item.idxStr}
                    </span>
                    <h3 className={`text-lg lg:text-xl font-serif tracking-tight mt-0.5 transition-all truncate ${
                      isActive ? 'font-black pl-1 text-sahara-primary' : 'text-sahara-secondary/80 group-hover:text-sahara-onbackground'
                    }`}>
                      {item.label}
                    </h3>
                    {/* Beautiful warm line indicator */}
                    <div className={`h-[2px] bg-sahara-primary transition-all duration-300 mt-1.5 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}></div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-8 border-t border-sahara-surface-dim/50 flex gap-4 items-center gsap-stagger-item">
          <div className="w-12 h-12 rounded-full border-2 border-sahara-primary/20 flex items-center justify-center bg-white text-sahara-primary shrink-0 transition-all hover:scale-105" title={t.roleLabel}>
            <User className="w-6 h-6" />
          </div>
          <div className="overflow-hidden flex-1 select-none">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tempName}
                  placeholder={lang === 'ru' ? 'Введите ФИО' : lang === 'by' ? 'Увядзіце ПІБ' : '请输入姓名'}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                      setTempName(researcherName);
                      setIsEditing(false);
                    }
                  }}
                  className="w-full h-9 px-2 text-sm bg-white border border-sahara-primary/30 rounded-sm focus:outline-none focus:ring-1 focus:ring-sahara-primary font-sans font-medium"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  className="p-1.5 border border-sahara-primary/20 bg-white hover:bg-sahara-clay/20 text-sahara-primary rounded-sm cursor-pointer shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-1 group/edit">
                <span className="font-sans text-sm font-black leading-tight truncate text-sahara-onbackground hover:text-sahara-primary transition-colors cursor-pointer"
                  onClick={() => {
                    const isPlaceHolder = researcherName === 'Введите ФИО' || researcherName === 'Увядзіце ПІБ' || researcherName === '请输入姓名';
                    setTempName(isPlaceHolder ? '' : researcherName);
                    setIsEditing(true);
                  }}>
                  {researcherName}
                </span>
                <button
                  onClick={() => {
                    const isPlaceHolder = researcherName === 'Введите ФИО' || researcherName === 'Увядзіце ПІБ' || researcherName === '请输入姓名';
                    setTempName(isPlaceHolder ? '' : researcherName);
                    setIsEditing(true);
                  }}
                  className="opacity-50 hover:opacity-100 text-sahara-secondary transition-opacity cursor-pointer p-0.5"
                  title={t.changeName}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="font-sans text-[10px] uppercase tracking-wider text-sahara-secondary/75 font-bold mt-0.5">{t.roleLabel}</p>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for Mobile */}
      <nav
        style={{ '--color-sahara-primary': activeColor } as React.CSSProperties}
        className="md:hidden fixed bottom-0 left-0 right-0 bg-[#f5f3f3] border-t border-sahara-surface-dim/40 text-sahara-secondary z-50 flex justify-around items-center px-1 py-3 pb-safe shadow-md"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`m-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-md transition-colors ${
                isActive ? 'text-sahara-primary font-boldScale' : 'text-sahara-secondary/60 hover:text-sahara-onbackground'
              }`}
            >
              <span className="text-[10px] uppercase font-mono tracking-widest">{item.idxStr}</span>
              <span className="text-[12px] font-sans font-bold tracking-tight mt-0.5">{item.label}</span>
              {isActive && <div className="w-6 h-[2px] bg-sahara-primary mt-1" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
