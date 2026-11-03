/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronRight, Save, Trash2 } from 'lucide-react';
import { Questionnaire } from '../types';
import { Language, translations } from '../lib/translations';
import { gsap } from 'gsap';

interface DashboardProps {
  questionnaire: Questionnaire;
  loadPreset: () => void;
  resetToClean: () => void;
  setActiveTab: (tab: string) => void;
  lang: Language;
}

interface FieldDiaryEntry {
  id: string;
  timestamp: string;
  informantName: string;
  location: string;
  notes: string;
}

export default function Dashboard({ questionnaire, loadPreset, resetToClean, setActiveTab, lang }: DashboardProps) {
  const [diaryEntries, setDiaryEntries] = useState<FieldDiaryEntry[]>([]);
  const [newEntry, setNewEntry] = useState({ informantName: '', location: '', notes: '' });
  const [completedTranscriptions, setCompletedTranscriptions] = useState(2);
  const [annotatedTranscriptions, setAnnotatedTranscriptions] = useState(2);
  const containerRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    const saved = localStorage.getItem('field_diary');
    if (saved) {
      try {
        setDiaryEntries(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing field diary', e);
      }
    }

    const savedHistory = localStorage.getItem('linguistic_history_facet');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setCompletedTranscriptions(parsed.length);
          const annotated = parsed.filter((item: any) => {
            const hasSpans = Array.isArray(item.spans) && item.spans.length > 0;
            const hasTurnFacets = item.turnFacets && Object.keys(item.turnFacets).length > 0;
            const hasSegmentTags = Array.isArray(item.segments) && item.segments.some((seg: any) => Array.isArray(seg.tags) && seg.tags.length > 0);
            return hasSpans || hasTurnFacets || hasSegmentTags;
          });
          setAnnotatedTranscriptions(annotated.length);
        }
      } catch (e) {
        console.error('Error parsing linguistic history', e);
      }
    }
  }, []);

  useEffect(() => {
    // GSAP context orchestration
    const ctx = gsap.context(() => {
      gsap.fromTo('.gsap-hero', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' });
      gsap.fromTo('.gsap-stat-card', 
        { opacity: 0, y: 12 }, 
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1 }
      );
      gsap.fromTo('.gsap-slide-up', 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out', delay: 0.25 }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const saveDiaryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.notes.trim()) return;

    const defaultAnon = lang === 'ru' ? 'Анонимный информант' : lang === 'by' ? 'Ананімны інфармант' : '匿名受访者';
    const defaultLoc = lang === 'ru' ? 'Не указана' : lang === 'by' ? 'Не пазначана' : '未指定地点';

    const entry: FieldDiaryEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'ru-RU'),
      informantName: newEntry.informantName.trim() || defaultAnon,
      location: newEntry.location.trim() || defaultLoc,
      notes: newEntry.notes,
    };

    const updated = [entry, ...diaryEntries];
    setDiaryEntries(updated);
    localStorage.setItem('field_diary', JSON.stringify(updated));
    setNewEntry({ informantName: '', location: '', notes: '' });

    // Instantly animate the newly pushed diary card
    setTimeout(() => {
      const firstEntry = containerRef.current?.querySelector('.gsap-diary-card');
      if (firstEntry) {
        gsap.fromTo(firstEntry, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' });
      }
    }, 50);
  };

  const deleteDiaryEntry = (id: string) => {
    const element = document.getElementById(`diary-card-${id}`);
    if (element) {
      gsap.to(element, {
        opacity: 0,
        height: 0,
        marginBottom: 0,
        padding: 0,
        duration: 0.35,
        ease: 'power2.out',
        onComplete: () => {
          const updated = diaryEntries.filter(e => e.id !== id);
          setDiaryEntries(updated);
          localStorage.setItem('field_diary', JSON.stringify(updated));
        }
      });
    } else {
      const updated = diaryEntries.filter(e => e.id !== id);
      setDiaryEntries(updated);
      localStorage.setItem('field_diary', JSON.stringify(updated));
    }
  };

  const totalBlocks = questionnaire.blocks.length;

  return (
    <div ref={containerRef} className="space-y-12 max-w-7xl mx-auto px-1 md:px-0">
      {/* Editorial Hero Unit */}
      <div className="gsap-hero bg-white text-sahara-onbackground border border-sahara-surface-dim/50 rounded-xl p-6 sm:p-8 md:p-10 relative overflow-hidden shadow-xs">
        {/* Subtle dot-grid alignment matching design spec */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(#974811 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}></div>

        <div className="relative z-10 max-w-4xl space-y-4">
          <span className="font-sans text-xs uppercase tracking-[0.15em] font-extrabold text-sahara-primary bg-sahara-clay/35 px-4 py-1.5 rounded-sm border border-sahara-primary/10 inline-block">
            {t.heroBadge}
          </span>
          
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-serif font-black tracking-tight leading-tight text-sahara-primary">
            {t.heroTitle}
          </h1>
          
          <p className="font-serif text-base text-sahara-secondary/95 leading-relaxed pt-1">
            {t.heroDescription}
          </p>

          <div className="pt-6 flex flex-wrap gap-4">
            <button
              onClick={loadPreset}
              className="bg-sahara-primary hover:bg-sahara-primary/90 text-white px-6 py-3.5 rounded-md font-sans text-xs sm:text-sm uppercase tracking-widest font-black transition-all shadow-md cursor-pointer hover:shadow-lg hover:scale-[1.01]"
            >
              {t.btnLoadPreset}
            </button>
            <button
              onClick={resetToClean}
              className="border-2 border-sahara-surface-dim/70 text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-background px-6 py-3.5 rounded-md font-sans text-xs sm:text-sm uppercase tracking-widest font-black transition-all cursor-pointer bg-white shadow-xs"
            >
              {t.btnResetClean}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Editorial Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="gsap-stat-card border border-sahara-surface-dim/40 rounded-xl p-8 flex flex-col justify-between bg-white text-sahara-onbackground shadow-xs hover:border-sahara-primary/20 transition-colors">
          <span className="font-sans text-xs uppercase font-extrabold text-sahara-secondary/80 tracking-widest block mb-4">
            {t.statBlocks}
          </span>
          <div className="flex items-baseline justify-between mt-auto">
            <span className="text-6xl font-serif font-black text-sahara-primary">{totalBlocks}</span>
            <span className="font-sans text-xs uppercase tracking-wider text-sahara-secondary font-extrabold">{t.statBlocksUnit}</span>
          </div>
        </div>

        <div className="gsap-stat-card border border-sahara-surface-dim/40 rounded-xl p-8 flex flex-col justify-between bg-white text-sahara-onbackground shadow-xs hover:border-sahara-primary/20 transition-colors">
          <span className="font-sans text-xs uppercase font-extrabold text-sahara-secondary/80 tracking-widest block mb-4">
            {t.statActive}
          </span>
          <div className="flex items-baseline justify-between mt-auto">
            <span className="text-6xl font-serif font-black text-sahara-tertiary">{completedTranscriptions}</span>
            <span className="font-sans text-xs uppercase tracking-wider text-sahara-tertiary font-extrabold">{t.statActiveUnit}</span>
          </div>
        </div>

        <div className="gsap-stat-card border border-sahara-surface-dim/40 rounded-xl p-8 flex flex-col justify-between bg-white text-sahara-onbackground shadow-xs hover:border-sahara-primary/20 transition-colors">
          <span className="font-sans text-xs uppercase font-extrabold text-sahara-secondary/80 tracking-widest block mb-4">
            {t.statDisabled}
          </span>
          <div className="flex items-baseline justify-between mt-auto">
            <span className="text-6xl font-serif font-black text-sahara-secondary/50">{annotatedTranscriptions}</span>
            <span className="font-sans text-xs uppercase tracking-wider text-sahara-secondary/55 font-extrabold">{t.statDisabledUnit}</span>
          </div>
        </div>

        <div className="gsap-stat-card border border-sahara-primary/10 rounded-xl p-8 flex flex-col justify-between bg-sahara-primary text-white shadow-md hover:bg-[#86400f] transition-colors">
          <span className="font-sans text-xs uppercase font-extrabold text-white/80 tracking-widest block mb-4">
            {t.statDiary}
          </span>
          <div className="flex items-baseline justify-between mt-auto">
            <span className="text-6xl font-serif font-black text-white">{diaryEntries.length}</span>
            <span className="font-sans text-xs uppercase tracking-wider text-white/90 font-extrabold">{t.statDiaryUnit}</span>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left column: Quick Actions & Belarus Specific Notes */}
        <div className="lg:col-span-5 space-y-10 gsap-slide-up">
          {/* Sociolinguistic context info */}
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-8 space-y-8 shadow-xs">
            <h2 className="font-serif text-2xl font-black text-sahara-primary border-b border-sahara-surface-dim/30 pb-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-sahara-primary"></span>
              {t.memoTitle}
            </h2>
            <div className="space-y-8 divide-y divide-sahara-surface-dim/35">
              <div className="pt-1">
                <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-wider block mb-2">
                  {t.memoSeniorTitle}
                </span>
                <p className="font-sans text-sm text-sahara-secondary leading-relaxed">
                  {t.memoSeniorDesc}
                </p>
              </div>
              <div className="pt-6">
                <span className="font-sans text-xs uppercase font-extrabold text-sahara-secondary tracking-wider block mb-2">
                  {t.memoMiddleTitle}
                </span>
                <p className="font-sans text-sm text-sahara-secondary leading-relaxed">
                  {t.memoMiddleDesc}
                </p>
              </div>
              <div className="pt-6">
                <span className="font-sans text-xs uppercase font-extrabold text-[#ba1a1a] tracking-wider block mb-2">
                  {t.memoShameTitle}
                </span>
                <p className="font-sans text-sm text-sahara-secondary leading-relaxed">
                  {t.memoShameDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Shortcut triggers in modern academic list */}
          <div className="bg-[#f5f3f3]/50 border border-sahara-surface-dim/40 rounded-xl p-8 space-y-6 shadow-xs">
            <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-widest block mb-2">
              {t.quickAccess}
            </span>
            <div className="space-y-3">
              <button
                id="dash-go-questions"
                onClick={() => setActiveTab('questionnaire')}
                className="w-full bg-white hover:bg-sahara-background text-sahara-onbackground p-5 rounded-md border border-sahara-surface-dim/35 flex items-center justify-between text-left group transition-all cursor-pointer shadow-xs"
              >
                <span className="font-serif text-base text-sahara-secondary group-hover:text-sahara-primary transition-colors font-semibold">{t.linkQuest}</span>
                <ChevronRight className="w-5 h-5 text-sahara-primary group-hover:transform group-hover:translate-x-1.5 transition-transform" />
              </button>
              <button
                id="dash-go-prompts"
                onClick={() => setActiveTab('prompts')}
                className="w-full bg-white hover:bg-sahara-background text-sahara-onbackground p-5 rounded-md border border-sahara-surface-dim/35 flex items-center justify-between text-left group transition-all cursor-pointer shadow-xs"
              >
                <span className="font-serif text-base text-sahara-secondary group-hover:text-sahara-primary transition-colors font-semibold">{t.linkPrompts}</span>
                <ChevronRight className="w-5 h-5 text-sahara-primary group-hover:transform group-hover:translate-x-1.5 transition-transform" />
              </button>
              <button
                id="dash-go-text"
                onClick={() => setActiveTab('postprocess')}
                className="w-full bg-white hover:bg-sahara-background text-sahara-onbackground p-5 rounded-md border border-sahara-surface-dim/35 flex items-center justify-between text-left group transition-all cursor-pointer shadow-xs"
              >
                <span className="font-serif text-base text-sahara-secondary group-hover:text-sahara-primary transition-colors font-semibold">{t.linkTexts}</span>
                <ChevronRight className="w-5 h-5 text-sahara-primary group-hover:transform group-hover:translate-x-1.5 transition-transform" />
              </button>
              <button
                id="dash-go-security"
                onClick={() => setActiveTab('security')}
                className="w-full bg-white hover:bg-sahara-background text-sahara-onbackground p-5 rounded-md border border-sahara-surface-dim/35 flex items-center justify-between text-left group transition-all cursor-pointer shadow-xs"
              >
                <span className="font-serif text-base text-sahara-secondary group-hover:text-sahara-primary transition-colors font-semibold">{t.linkSecurity}</span>
                <ChevronRight className="w-5 h-5 text-sahara-primary group-hover:transform group-hover:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Field Researcher Diary */}
        <div className="lg:col-span-7 space-y-10 gsap-slide-up">
          <div className="bg-white border border-sahara-surface-dim/40 rounded-xl p-8 md:p-10 space-y-8 shadow-xs">
            <div className="border-b border-sahara-surface-dim/30 pb-6">
              <h2 className="font-serif text-3xl font-black text-sahara-primary flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-sahara-primary" />
                {t.diaryTitle}
              </h2>
              <p className="text-sm text-sahara-secondary mt-3 font-serif leading-relaxed">
                {t.diarySubtitle}
              </p>
            </div>

            <form onSubmit={saveDiaryEntry} className="space-y-6 bg-sahara-clay/10 p-6 sm:p-8 border border-sahara-surface-dim/35 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-wider mb-2.5">
                    {t.labelInformant}
                  </label>
                  <input
                    type="text"
                    id="diary-informant"
                    placeholder={t.placeholderInformant}
                    value={newEntry.informantName}
                    onChange={(e) => setNewEntry({ ...newEntry, informantName: e.target.value })}
                    className="w-full h-12 px-4 py-3 rounded-md text-sm bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium text-sahara-onbackground"
                  />
                </div>
                <div>
                  <label className="block font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-wider mb-2.5">
                    {t.labelLocation}
                  </label>
                  <input
                    type="text"
                    id="diary-location"
                    placeholder={t.placeholderLocation}
                    value={newEntry.location}
                    onChange={(e) => setNewEntry({ ...newEntry, location: e.target.value })}
                    className="w-full h-12 px-4 py-3 rounded-md text-sm bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium text-sahara-onbackground"
                  />
                </div>
              </div>
              
              <div>
                <label className="block font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-wider mb-2.5">
                  {t.labelObservation}
                </label>
                <textarea
                  id="diary-notes"
                  rows={5}
                  placeholder={t.placeholderNotes}
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full p-4 mt-1 rounded-md text-sm bg-white border border-sahara-surface-dim/55 focus:outline-none focus:ring-2 focus:ring-sahara-primary font-sans font-medium leading-relaxed text-sahara-onbackground"
                ></textarea>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  id="btn-save-diary"
                  className="bg-sahara-primary hover:bg-sahara-primary/90 text-white px-6 py-3 rounded-md font-sans text-xs sm:text-sm uppercase tracking-widest font-black transition-all hover:shadow-sm cursor-pointer flex items-center gap-2 hover:scale-[1.01]"
                >
                  <Save className="w-5 h-5" />
                  {t.btnSaveDiary}
                </button>
              </div>
            </form>

            <div className="space-y-8 pt-2">
              <span className="font-sans text-xs uppercase font-extrabold text-sahara-primary tracking-[0.1em] block border-b border-sahara-surface-dim/30 pb-3">
                {t.diaryChronicle}
              </span>
              
              {diaryEntries.length === 0 ? (
                <div className="text-center py-16 bg-[#f5f3f3]/25 rounded-xl border-2 border-dashed border-sahara-surface-dim/40 p-8">
                  <p className="text-sm text-sahara-secondary/60 font-serif italic">{t.diaryEmpty}</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                  {diaryEntries.map((entry) => (
                    <div 
                      key={entry.id} 
                      id={`diary-card-${entry.id}`}
                      className="gsap-diary-card p-6 bg-white border border-sahara-surface-dim/40 rounded-xl hover:border-sahara-primary/30 relative group shadow-xs transition-colors overflow-hidden"
                    >
                      <button
                        onClick={() => deleteDiaryEntry(entry.id)}
                        className="absolute top-5 right-5 text-sahara-secondary/50 hover:text-red-700 p-2 rounded-md hover:bg-sahara-background transition-colors cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
                        <span className="font-sans text-sm font-black text-sahara-onbackground">{entry.informantName}</span>
                        <span className="text-sahara-surface-dim text-xs">•</span>
                        <span className="text-sahara-primary text-xs font-black font-sans uppercase tracking-wider">{entry.location}</span>
                        <span className="text-sahara-surface-dim text-xs">•</span>
                        <span className="text-sahara-secondary/50 text-xs font-mono">{entry.timestamp}</span>
                      </div>
                      
                      {/* Elegant serif blockquote layout */}
                      <p className="font-serif text-base text-sahara-onbackground leading-relaxed italic border-l-2 border-sahara-primary/80 pl-4 py-1.5 bg-sahara-clay/5 rounded-r-md">
                        "{entry.notes}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
