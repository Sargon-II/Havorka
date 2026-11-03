/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AndroidSaveTarget = 'ask' | 'device' | 'share';

const PREF_KEY = 'havorka_android_save_target';

/**
 * Retrieve user preference for Android file export
 */
export function getAndroidSaveTarget(): AndroidSaveTarget {
  if (typeof window === 'undefined' || !window.localStorage) return 'ask';
  const val = window.localStorage.getItem(PREF_KEY);
  if (val === 'device' || val === 'share') return val;
  return 'ask';
}

/**
 * Persist user preference for Android file export
 */
export function setAndroidSaveTarget(target: AndroidSaveTarget): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (target === 'ask') {
    window.localStorage.removeItem(PREF_KEY);
  } else {
    window.localStorage.setItem(PREF_KEY, target);
  }
}

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

/**
 * Show a modal dialog on Android offering:
 * 1) «Сохранить на устройство» (Storage Access Framework)
 * 2) «Поделиться» (System Share sheet)
 * with a "Remember my choice" checkbox.
 */
export async function promptAndroidSaveTarget(params: {
  filename: string;
  sizeBytes: number;
}): Promise<'device' | 'share' | 'cancel'> {
  const currentPref = getAndroidSaveTarget();
  if (currentPref !== 'ask') {
    return currentPref;
  }

  return new Promise<'device' | 'share' | 'cancel'>((resolve) => {
    if (typeof document === 'undefined') {
      resolve('device');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'android-save-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.backgroundColor = 'rgba(27, 28, 28, 0.65)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.animation = 'fadeIn 0.18s ease-out';

    const safeFilename = params.filename.replace(/^.*[\\/]/, '') || params.filename;
    const formattedSize = formatBytes(params.sizeBytes);

    overlay.innerHTML = `
      <div style="background:#ffffff; color:#1b1c1c; border-radius:18px; max-width:440px; width:100%; padding:22px; box-shadow:0 20px 40px rgba(0,0,0,0.25); font-family:system-ui,-apple-system,BlinkMacSystemFont,'Manrope',sans-serif; border:1px solid #e7ded5;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <h3 style="margin:0; font-size:17px; font-weight:800; color:#974811; display:flex; align-items:center; gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#974811" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Экспорт файла
          </h3>
          <span style="font-size:11px; font-weight:800; background:#f4ebe2; color:#974811; padding:3px 8px; border-radius:6px; font-family:monospace;">${formattedSize}</span>
        </div>
        <p style="margin:0 0 16px 0; font-size:12px; color:#605d5a; word-break:break-word; line-height:1.4;">
          <strong>Файл:</strong> ${safeFilename}
        </p>

        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
          <!-- Option A: Save via SAF -->
          <button id="btn-save-saf" type="button" style="text-align:left; background:#faf7f5; border:1.5px solid #dfcfc2; border-radius:12px; padding:12px 14px; cursor:pointer; display:flex; align-items:flex-start; gap:12px; transition:all 0.15s ease;">
            <div style="background:#974811; color:#fff; border-radius:8px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </div>
            <div>
              <div style="font-size:14px; font-weight:800; color:#1b1c1c;">Сохранить на устройство</div>
              <div style="font-size:11px; color:#765848; margin-top:2px; line-height:1.35;">Выбрать системную папку (Загрузки, Документы, SD-карта) и подтвердить имя файла (Storage Access Framework)</div>
            </div>
          </button>

          <!-- Option B: Share -->
          <button id="btn-save-share" type="button" style="text-align:left; background:#faf7f5; border:1.5px solid #dfcfc2; border-radius:12px; padding:12px 14px; cursor:pointer; display:flex; align-items:flex-start; gap:12px; transition:all 0.15s ease;">
            <div style="background:#765848; color:#fff; border-radius:8px; width:34px; height:34px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </div>
            <div>
              <div style="font-size:14px; font-weight:800; color:#1b1c1c;">Поделиться</div>
              <div style="font-size:11px; color:#765848; margin-top:2px; line-height:1.35;">Открыть меню «Поделиться» Android (отправить через Telegram, WhatsApp, Диск, почту)</div>
            </div>
          </button>
        </div>

        <!-- Remember choice checkbox -->
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#504c48; cursor:pointer; margin-bottom:16px; user-select:none;">
          <input id="chk-remember-save-pref" type="checkbox" style="width:16px; height:16px; accent-color:#974811; cursor:pointer;" />
          <span>Запомнить выбор (можно изменить в настройках)</span>
        </label>

        <!-- Cancel button -->
        <div style="display:flex; justify-content:flex-end;">
          <button id="btn-save-cancel" type="button" style="background:#f1ece7; border:none; color:#504c48; padding:8px 18px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">
            Отмена
          </button>
        </div>
      </div>
    `;

    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    overlay.querySelector('#btn-save-saf')?.addEventListener('click', () => {
      const remember = (overlay.querySelector('#chk-remember-save-pref') as HTMLInputElement)?.checked;
      if (remember) {
        setAndroidSaveTarget('device');
      }
      cleanup();
      resolve('device');
    });

    overlay.querySelector('#btn-save-share')?.addEventListener('click', () => {
      const remember = (overlay.querySelector('#chk-remember-save-pref') as HTMLInputElement)?.checked;
      if (remember) {
        setAndroidSaveTarget('share');
      }
      cleanup();
      resolve('share');
    });

    overlay.querySelector('#btn-save-cancel')?.addEventListener('click', () => {
      cleanup();
      resolve('cancel');
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve('cancel');
      }
    });

    document.body.appendChild(overlay);
  });
}

/**
 * Progress tracker for large file operations (> 20 MB)
 */
export interface SaveProgressTracker {
  update: (loadedBytes: number) => void;
  finish: (message: string) => void;
  error: (errMessage: string) => void;
  close: () => void;
}

export function createSaveProgressTracker(filename: string, totalBytes: number): SaveProgressTracker {
  if (typeof document === 'undefined') {
    return {
      update: () => {},
      finish: () => {},
      error: () => {},
      close: () => {},
    };
  }

  const safeFilename = filename.replace(/^.*[\\/]/, '') || filename;
  const formattedTotal = formatBytes(totalBytes);

  const container = document.createElement('div');
  container.id = 'save-progress-tracker-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '99998';
  container.style.maxWidth = '360px';
  container.style.width = 'calc(100vw - 40px)';
  container.style.background = '#ffffff';
  container.style.border = '1.5px solid #dfcfc2';
  container.style.borderRadius = '14px';
  container.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.2)';
  container.style.padding = '14px 16px';
  container.style.fontFamily = "system-ui,-apple-system,BlinkMacSystemFont,'Manrope',sans-serif";
  container.style.color = '#1b1c1c';
  container.style.transition = 'all 0.25s ease';

  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
      <div id="prog-title" style="font-size:12px; font-weight:800; color:#974811; display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#974811; animation:pulse 1.2s infinite;"></span>
        Сохранение файла...
      </div>
      <div id="prog-pct" style="font-size:12px; font-weight:800; font-family:monospace; color:#1b1c1c;">0%</div>
    </div>
    <div style="font-size:11px; color:#605d5a; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safeFilename}">
      ${safeFilename}
    </div>
    <div style="width:100%; height:7px; background:#f0ebe6; border-radius:4px; overflow:hidden; margin-bottom:6px;">
      <div id="prog-bar" style="height:100%; width:0%; background:linear-gradient(90deg, #974811, #c86c2e); transition:width 0.15s ease; border-radius:4px;"></div>
    </div>
    <div id="prog-details" style="font-size:10px; color:#856d5e; font-family:monospace; text-align:right;">
      0 МБ из ${formattedTotal}
    </div>
  `;

  document.body.appendChild(container);

  return {
    update: (loadedBytes: number) => {
      const pct = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
      const barEl = container.querySelector('#prog-bar') as HTMLElement;
      const pctEl = container.querySelector('#prog-pct');
      const detEl = container.querySelector('#prog-details');
      if (barEl) barEl.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${pct}%`;
      if (detEl) detEl.textContent = `${formatBytes(loadedBytes)} из ${formattedTotal}`;
    },
    finish: (message: string) => {
      const titleEl = container.querySelector('#prog-title') as HTMLElement;
      const barEl = container.querySelector('#prog-bar') as HTMLElement;
      const pctEl = container.querySelector('#prog-pct') as HTMLElement;
      const detEl = container.querySelector('#prog-details') as HTMLElement;

      if (titleEl) {
        titleEl.style.color = '#1b703a';
        titleEl.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1b703a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Готово!
        `;
      }
      if (barEl) {
        barEl.style.width = '100%';
        barEl.style.background = '#1b703a';
      }
      if (pctEl) pctEl.textContent = '100%';
      if (detEl) {
        detEl.textContent = message;
        detEl.style.color = '#1b703a';
      }

      setTimeout(() => {
        if (container.parentNode) {
          container.style.opacity = '0';
          setTimeout(() => container.parentNode?.removeChild(container), 250);
        }
      }, 3500);
    },
    error: (errMessage: string) => {
      const titleEl = container.querySelector('#prog-title') as HTMLElement;
      const barEl = container.querySelector('#prog-bar') as HTMLElement;
      const detEl = container.querySelector('#prog-details') as HTMLElement;

      if (titleEl) {
        titleEl.style.color = '#b3261e';
        titleEl.textContent = 'Ошибка сохранения';
      }
      if (barEl) barEl.style.background = '#b3261e';
      if (detEl) {
        detEl.textContent = errMessage;
        detEl.style.color = '#b3261e';
      }

      setTimeout(() => {
        if (container.parentNode) {
          container.style.opacity = '0';
          setTimeout(() => container.parentNode?.removeChild(container), 350);
        }
      }, 5000);
    },
    close: () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

/**
 * Toast notification for save result
 */
export function showSaveNotification(params: {
  type: 'success' | 'info' | 'error';
  title: string;
  message: string;
}): void {
  if (typeof document === 'undefined') return;

  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '99999';
  toast.style.maxWidth = '420px';
  toast.style.width = 'calc(100vw - 32px)';
  toast.style.padding = '12px 16px';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
  toast.style.fontFamily = "system-ui,-apple-system,BlinkMacSystemFont,'Manrope',sans-serif";
  toast.style.fontSize = '12px';
  toast.style.lineHeight = '1.4';
  toast.style.boxSizing = 'border-box';
  toast.style.animation = 'fadeIn 0.2s ease-out';

  if (params.type === 'success') {
    toast.style.background = '#eaf7ee';
    toast.style.border = '1.5px solid #a3dcaf';
    toast.style.color = '#135c2b';
  } else if (params.type === 'error') {
    toast.style.background = '#fdebee';
    toast.style.border = '1.5px solid #f8b4bc';
    toast.style.color = '#991b1b';
  } else {
    toast.style.background = '#f5f0eb';
    toast.style.border = '1.5px solid #d8c7b8';
    toast.style.color = '#5a463a';
  }

  toast.innerHTML = `
    <div style="font-weight:800; font-size:13px; margin-bottom:2px; display:flex; align-items:center; gap:6px;">
      ${params.type === 'success' ? '✓ ' : params.type === 'error' ? '⚠️ ' : 'ℹ️ '}
      ${params.title}
    </div>
    <div style="word-break:break-word;">${params.message}</div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 4000);
}
