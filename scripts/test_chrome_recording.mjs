import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';

const CHROME_PATH = process.env.CHROME_PATH || 'google-chrome';
const WAV_PATH = path.resolve(process.cwd(), 'temp_test', 'test_audio_440hz.wav');
const PROFILE_DIR = path.resolve('/tmp', 'chrome_audio_test_profile');

if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

console.log('1. Launching Chrome with fake audio capture...');
console.log('WAV path:', WAV_PATH);

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-default-browser-check',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${WAV_PATH}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--autoplay-policy=no-user-gesture-required',
  'http://localhost:3000'
], {
  detached: false,
  stdio: 'ignore'
});

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/list', (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const pages = JSON.parse(data);
      const page = pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page;
      }
    } catch (e) {
      // wait
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for Chrome CDP');
}

async function run() {
  try {
    const page = await waitForCdp();
    console.log('2. Connected to Chrome page:', page.title, page.url);
    console.log('WebSocket Debugger URL:', page.webSocketDebuggerUrl);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));

    let msgId = 1;
    const pending = new Map();
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value ?? a.description).join(' ');
        console.log('[Browser Console]', text);
      }
    });

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('3. Waiting for page load and React hydration (5s)...');
    await new Promise(r => setTimeout(r, 5000));

    // Check if page loaded and what is in DOM
    const docEval = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        buttonCount: document.querySelectorAll('button').length,
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
      })`,
      returnByValue: true
    });
    console.log('Page state:', docEval.result.value);

    // Test getUserMedia directly inside the browser first to see what the fake audio capture stream delivers!
    console.log('4. Testing navigator.mediaDevices.getUserMedia directly in page context...');
    const gumTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });
          const track = stream.getAudioTracks()[0];
          const settings = track.getSettings();
          
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const src = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);

          const data = new Uint8Array(analyser.frequencyBinCount);
          // sample over 1.5 seconds
          const levels = [];
          for (let i = 0; i < 15; i++) {
            analyser.getByteFrequencyData(data);
            let sum = 0;
            for (let j = 0; j < data.length; j++) sum += data[j];
            levels.push(sum / (data.length * 255));
            await new Promise(r => setTimeout(r, 100));
          }
          
          // stop tracks
          track.stop();
          audioCtx.close();

          return {
            success: true,
            settings,
            audioCtxState: audioCtx.state,
            sampleLevels: levels,
            avgLevel: levels.reduce((a, b) => a + b, 0) / levels.length,
            maxLevel: Math.max(...levels)
          };
        } catch (e) {
          return { success: false, error: e.name + ': ' + e.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Direct getUserMedia test result:', gumTest.result.value);

    // Switch to Questionnaire tab first
    console.log('4.5. Switching to Questionnaire tab...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const navBtns = Array.from(document.querySelectorAll('button'));
        const qNav = navBtns.find(b => 
          b.innerText.includes('Опросник') || 
          b.innerText.includes('Апытальнік') || 
          b.innerText.includes('Questionnaire') ||
          b.innerText.includes('02')
        );
        if (qNav) {
          console.log('[Test] Clicking questionnaire nav button:', qNav.innerText);
          qNav.click();
        } else {
          console.warn('[Test] Could not find questionnaire nav button among:', navBtns.map(b => b.innerText));
        }
      })()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1500));

    // Now test the REAL recording path in the application!
    console.log('5. Testing application RobustAudioRecorder path...');
    const appRecordTest = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          // Ensure we are in field mode
          let btns = Array.from(document.querySelectorAll('button'));
          console.log('[Test] Buttons on page: ' + btns.map((b, i) => i + ':[' + b.innerText.replace(/\s+/g, ' ').trim() + ']').join(', '));
          
          const fieldModeBtn = btns.find(b => b.innerText.includes('Полевой режим') || b.innerText.includes('Палявы рэжым'));
          if (fieldModeBtn) {
            console.log('[Test] Clicking Field Mode button...');
            fieldModeBtn.click();
            await new Promise(r => setTimeout(r, 800));
            btns = Array.from(document.querySelectorAll('button'));
          }

          let startBtn = btns.find(b => 
            b.innerText.includes('Запуск записи') || 
            b.innerText.includes('Запуск запісу') || 
            b.innerText.includes('Запуск') ||
            b.innerText.includes('Старт') ||
            (b.className && b.className.includes('bg-sahara-primary') && b.querySelector('svg'))
          );

          console.log('[Test] Found start button:', startBtn ? startBtn.innerText.trim() : 'NOT FOUND');
          if (!startBtn) {
            return { error: 'Start button not found in DOM', allButtons: btns.map(b => b.innerText.trim()) };
          }

          // Click start
          startBtn.click();
          console.log('[Test] Clicked start recording');

          // Monitor for 20 seconds
          const levelSamples = [];
          const statusSamples = [];
          const indicatorTexts = [];

          for (let s = 0; s < 20; s++) {
            await new Promise(r => setTimeout(r, 1000));
            // Read indicator from DOM
            const recIndicator = document.querySelector('.bg-emerald-600, .bg-amber-500');
            const statusBadge = Array.from(document.querySelectorAll('span, div')).find(el => 
              el.innerText === 'REC' || el.innerText === 'Тишина' || el.innerText === 'Цішыня'
            );
            
            // Read width style of level meter
            const levelMeter = recIndicator ? recIndicator.style.width : null;
            levelSamples.push(levelMeter);
            indicatorTexts.push(statusBadge ? statusBadge.innerText : null);
          }

          // Click pause/stop
          const stopBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.innerText.includes('Пауза') || 
            b.innerText.includes('Прыпыніць') || 
            b.innerText.includes('Pause') ||
            b.className.includes('bg-red-800')
          );
          if (stopBtn) {
            stopBtn.click();
            console.log('[Test] Paused/Stopped recording');
          }

          // Query IndexedDB audioChunks to inspect what was saved!
          const dbRequest = indexedDB.open('havorka_db', 2);
          const chunksData = await new Promise((resolve, reject) => {
            dbRequest.onsuccess = (e) => {
              const db = e.target.result;
              const tx = db.transaction(['audioChunks', 'sessions'], 'readonly');
              const chunksStore = tx.objectStore('audioChunks');
              const req = chunksStore.getAll();
              req.onsuccess = () => {
                const sessionsStore = tx.objectStore('sessions');
                const sessReq = sessionsStore.getAll();
                sessReq.onsuccess = () => {
                  resolve({
                    chunks: req.result.map(c => ({
                      chunkIndex: c.chunkIndex,
                      size: c.data ? c.data.size : 0,
                      type: c.data ? c.data.type : 'unknown'
                    })),
                    sessions: sessReq.result
                  });
                };
              };
              req.onerror = () => reject(req.error);
            };
            dbRequest.onerror = () => reject(dbRequest.error);
          });

          // Also combine chunks into a Blob and convert to Base64 to save to disk for Python analysis!
          const dbReq2 = indexedDB.open('havorka_db', 2);
          const fullBlobBase64 = await new Promise((resolve) => {
            dbReq2.onsuccess = (e) => {
              const db = e.target.result;
              const tx = db.transaction('audioChunks', 'readonly');
              const store = tx.objectStore('audioChunks');
              const req = store.getAll();
              req.onsuccess = () => {
                const blobs = req.result.map(c => c.data).filter(Boolean);
                const combined = new Blob(blobs, { type: blobs[0]?.type || 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve({
                    base64: reader.result,
                    mimeType: combined.type,
                    totalSize: combined.size
                  });
                };
                reader.readAsDataURL(combined);
              };
            };
          });

          return {
            success: true,
            levelSamples: levelSamples.slice(0, 10),
            indicatorTexts: indicatorTexts.slice(0, 10),
            chunksData,
            fullBlob: {
              mimeType: fullBlobBase64.mimeType,
              totalSize: fullBlobBase64.totalSize,
              base64Snippet: fullBlobBase64.base64 ? fullBlobBase64.base64.substring(0, 100) : null,
              base64: fullBlobBase64.base64
            }
          };
        } catch (err) {
          return { success: false, error: err.stack || err.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('6. Application recording test result:');
    if (appRecordTest.result.value) {
      const res = appRecordTest.result.value;
      console.log('- levelSamples:', res.levelSamples);
      console.log('- indicatorTexts:', res.indicatorTexts);
      console.log('- chunksCount:', res.chunksData?.chunks?.length);
      console.log('- chunks:', res.chunksData?.chunks);
      console.log('- fullBlob mime & size:', res.fullBlob?.mimeType, res.fullBlob?.totalSize);

      if (res.fullBlob?.base64) {
        const matches = res.fullBlob.base64.match(/^data:.+;base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[1], 'base64');
          const ext = res.fullBlob.mimeType.includes('mp4') ? 'm4a' : 'webm';
          const outPath = path.resolve('temp_test', `chrome_recorded_audio.${ext}`);
          fs.writeFileSync(outPath, buffer);
          console.log(`Saved recorded audio to ${outPath} (${buffer.length} bytes)`);
        }
      }
    } else {
      console.log(appRecordTest.result);
    }

    ws.close();
  } catch (e) {
    console.error('Test execution error:', e);
  } finally {
    console.log('Terminating Chrome test process...');
    chromeProc.kill('SIGTERM');
  }
}

run();
