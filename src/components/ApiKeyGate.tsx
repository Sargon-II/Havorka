/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { getApiKey, setApiKey, clearApiKey } from '../lib/apiKey';
import { Key, Lock, ExternalLink, ShieldCheck, HelpCircle } from 'lucide-react';
import { Language } from '../lib/translations';

interface ApiKeyGateProps {
  children: ReactNode;
  lang: Language;
}

export function ApiKeyGate({ children, lang }: ApiKeyGateProps) {
  const [key, setKeyState] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const currentKey = getApiKey();
    setKeyState(currentKey);
    if (currentKey) {
      setInputVal(currentKey);
    }

    const handleOpenRequest = () => {
      setIsModalOpen(true);
    };

    window.addEventListener('open-api-key-gate', handleOpenRequest);
    return () => {
      window.removeEventListener('open-api-key-gate', handleOpenRequest);
    };
  }, []);

  const handleSave = () => {
    const trimmed = inputVal.trim();
    if (trimmed.length >= 5) {
      setApiKey(trimmed);
      setKeyState(trimmed);
      setIsError(false);
      setIsModalOpen(false);
      // Reload is helpful to re-trigger current modules cleanly
      window.location.reload();
    } else {
      setIsError(true);
    }
  };

  const texts = {
    ru: {
      title: 'Ввод ключа Gemini API (BYOK)',
      desc: 'Для активации интеллектуальных функций (разметки транскрипта, разбора структуры анкет и работы песочницы) подключите ваш собственный API-ключ. Данные остаются на вашем устройстве.',
      securityNotice: 'Ключ сохраняется исключительно в локальном хранилище вашего браузера (localStorage). Запросы отправляются напрямую на серверы Google Gemini API без третьих лиц.',
      getLabel: 'Получить ключ Gemini API:',
      placeholder: 'Вставьте ваш ключ API...',
      btnSave: 'Активировать доступ',
      btnReset: 'Сбросить текущий ключ',
      invalidKey: 'Пожалуйста, введите корректный API-ключ (не менее 5 символов).',
      localStatus: 'Автономная работа',
      btnFloatSet: 'Ввести API-ключ',
      btnFloatReset: 'Сбросить API-ключ',
      warnConfirm: 'Вы уверены, что хотите выйти и сбросить API Ключ?'
    },
    by: {
      title: 'Увод ключа Gemini API (BYOK)',
      desc: 'Для актывацыі інтэлектуальных функцый (разметкі транскрыпту, аналізу структуры анкет і працы пясочніцы) падключыце ваш уласны API-ключ. Дадзеныя застаюцца на вашай прыладзе.',
      securityNotice: 'Ключ захоўваецца выключна ў лакальным сховішчы вашага браўзера (localStorage). Запыты адпраўляюцца наўпрост на серверы Google Gemini API без трэціх асоб.',
      getLabel: 'Атрымаць ключ Gemini API:',
      placeholder: 'Устаўце ваш ключ API...',
      btnSave: 'Актываваць доступ',
      btnReset: 'Скінуць бягучы ключ',
      invalidKey: 'Калі ласка, увядзіце карэктны API-ключ (не менш за 5 сімвалаў).',
      localStatus: 'Аўтаномная праца',
      btnFloatSet: 'Увесці API-ключ',
      btnFloatReset: 'Скінуць API-ключ',
      warnConfirm: 'Вы ўпэўненыя, што хочаце выйсці і скінуць API Ключ?'
    },
    zh: {
      title: '填写您的 Gemini API 密钥 (BYOK)',
      desc: '请绑定您个人的 API 密钥以激活智能 analysis 模块（包括实地转写细粒度标注、问卷提纲一键重构与沙盒对话调试）。数据由您本机完全控制。',
      securityNotice: '此密钥仅被保存在您当前使用的设备浏览器本地（localStorage）。所有的推理请求将直接加密发送至 Google API 官方服务器，绝对不存在任何数据越边泄露。',
      getLabel: '获取 Gemini 官方密钥：',
      placeholder: '请输入您的 API Key...',
      btnSave: '绑定并激活终端',
      btnReset: '移除并重新设置 API 密钥',
      invalidKey: '请输入有效的 API 密钥（长度不能小于 5 个字符）。',
      localStatus: '本地主导工作模式',
      btnFloatSet: '配置 API 密钥',
      btnFloatReset: '清除 API 密钥',
      warnConfirm: '您确定要清除 API 密钥吗？'
    }
  };

  const t = texts[lang] || texts.ru;

  return (
    <>
      {children}

      {/* Modern Floating Action Button to configure or reset API key - HIdden per user preference to keep it only in Section 5 */}
      <button
        type="button"
        id="btn-gate-reset-float"
        onClick={() => {
          if (key) {
            if (confirm(t.warnConfirm)) {
              clearApiKey();
              setKeyState(null);
              setInputVal('');
              window.location.reload();
            }
          } else {
            setIsModalOpen(true);
          }
        }}
        className="hidden"
        title={key ? t.btnFloatReset : t.btnFloatSet}
      >
        <Key className={`w-3.5 h-3.5 ${key ? 'text-sahara-primary' : 'text-white'}`} />
        <span>{key ? t.btnFloatReset : t.btnFloatSet}</span>
      </button>

      {/* Non-intrusive setup modal popup */}
      {isModalOpen && (
        <div 
          id="api-key-gate-overlay"
          className="fixed inset-0 bg-sahara-onbackground/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 transition-all animate-fade-in"
        >
          <div 
            id="api-key-gate-container"
            className="w-full max-w-lg bg-white border border-sahara-surface-dim rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
          >
            {/* Accent decoration */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-sahara-primary" />

            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-sahara-secondary hover:text-sahara-onbackground cursor-pointer text-lg font-black bg-transparent border-none p-1"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Icon and Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-sahara-clay/25 text-sahara-primary rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 shrink-0" />
              </div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-sahara-onbackground">
                {t.title}
              </h1>
              <p className="text-xs sm:text-sm text-sahara-secondary leading-relaxed font-sans max-w-sm mx-auto">
                {t.desc}
              </p>
            </div>

            {/* Body Section */}
            <div className="space-y-4 font-sans">
              <div className="bg-sahara-background/60 border border-sahara-surface-dim/40 rounded-xl p-4 space-y-3">
                <div className="flex gap-2.5 items-start">
                  <ShieldCheck className="w-4 h-4 text-sahara-primary shrink-0 mt-0.5" />
                  <span className="text-xs text-sahara-secondary font-medium leading-relaxed">
                    {t.securityNotice}
                  </span>
                </div>
                <div className="border-t border-sahara-surface-dim/20 pt-2.5 flex items-center justify-between text-xs font-semibold">
                  <span className="text-sahara-secondary/80 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {t.getLabel}
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sahara-primary hover:underline font-extrabold flex items-center gap-1"
                  >
                    <span>aistudio.google.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Input key */}
              <div className="space-y-1.5">
                <label htmlFor="gate-api-key-input" className="block text-[10px] uppercase font-black tracking-widest text-sahara-secondary">
                  GEMINI KEY (BYOK)
                </label>
                <div className="relative flex items-center">
                  <Key className="absolute left-3 w-4 h-4 text-sahara-secondary/70" />
                  <input
                    id="gate-api-key-input"
                    type="password"
                    value={inputVal}
                    onChange={(e) => {
                      setInputVal(e.target.value);
                      if (isError) setIsError(false);
                    }}
                    placeholder={t.placeholder}
                    className={`w-full pl-10 pr-4 py-3 bg-sahara-background border ${
                      isError ? 'border-red-400 focus:ring-red-400' : 'border-sahara-surface-dim focus:ring-sahara-primary'
                    } rounded-lg text-xs sm:text-sm text-sahara-onbackground focus:outline-none focus:ring-1 font-mono`}
                  />
                </div>
                {isError && (
                  <p id="gate-api-key-error" className="text-xs text-red-500 font-medium animate-pulse">
                    {t.invalidKey}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-sahara-surface-dim text-sahara-secondary hover:text-sahara-onbackground hover:bg-sahara-background rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  {lang === 'ru' ? 'Отмена' : lang === 'by' ? 'Адмена' : '取消'}
                </button>
                <button
                  type="button"
                  id="btn-gate-save-key"
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-sahara-primary hover:bg-sahara-hover text-white text-xs sm:text-sm font-black uppercase tracking-wider rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t.btnSave}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
