import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import WebSocket from 'ws';

const CHROME_PATH = process.env.CHROME_PATH || (process.platform === 'win32'
  ? path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')
  : 'google-chrome');
const WAV_PATH = path.resolve(process.cwd(), 'temp_test', 'test_audio_440hz.wav');
const PROFILE_DIR = path.resolve(os.tmpdir(), 'chrome_audio_stage1_verify');

if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

console.log('--- STAGE 1 VERIFICATION START ---');

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9224',
  '--no-first-run',
  '--no-default-browser-check',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${WAV_PATH}`,
  `--user-data-dir=${PROFILE_DIR}`,
  'http://localhost:3000'
], { stdio: 'ignore' });

async function waitForCdp() {
  for (let i = 0; i < 30; i++) {
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9224/json/list', (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(body));
        }).on('error', reject);
      });
      const pages = JSON.parse(data);
      const page = pages.find(p => p.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for Chrome CDP');
}

async function run() {
  try {
    const page = await waitForCdp();
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

    await send('Runtime.enable');
    await send('Page.enable');

    console.log('1. Waiting for page load (4s)...');
    await new Promise(r => setTimeout(r, 4000));

    // Navigate to questionnaire tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const qNav = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Опросники') || b.innerText.includes('02'));
        if (qNav) qNav.click();
      })()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1500));

    // Test 1: Start recording as-is in the current application and check audioContext.state
    console.log('2. Starting recording in application...');
    const startResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('ЗАПУСК ЗАПИСИ') || b.innerText.includes('Запуск записи'));
        if (startBtn) {
          startBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Start button clicked:', startResult.result.value);

    // Wait 2 seconds for stream and AudioContext to initialize
    await new Promise(r => setTimeout(r, 2000));

    // Test 2: Check the state of AudioContext and audio level indicator in DOM
    const checkBeforeResume = await send('Runtime.evaluate', {
      expression: `(() => {
        const indicator = document.querySelector('.bg-emerald-600, .bg-amber-500');
        const badge = Array.from(document.querySelectorAll('span, div')).find(el => el.innerText === 'REC' || el.innerText === 'Тишина');
        return {
          meterWidth: indicator ? indicator.style.width : null,
          badgeText: badge ? badge.innerText : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Indicator BEFORE AudioContext.resume():', checkBeforeResume.result.value);

    // Test 3: Now let's test what happens if AudioContext.resume() is called!
    console.log('3. Finding and resuming all AudioContext instances in the page...');
    const resumeResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        // Inspect window AudioContext states
        // In the browser, any created AudioContext can be checked via monkeypatch or AudioContext instances
        // Let's create an analyser directly on the active stream or call resume on all AudioContexts
        const results = [];
        // Check window AudioContext prototype or active contexts
        return { success: true };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    // Let recording run for 20 seconds total
    console.log('4. Recording for 20 seconds...');
    const samples = [];
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const s = await send('Runtime.evaluate', {
        expression: `(() => {
          const ind = document.querySelector('.bg-emerald-600, .bg-amber-500');
          const badge = Array.from(document.querySelectorAll('span, div')).find(el => el.innerText === 'REC' || el.innerText === 'Тишина');
          return { sec: ${i + 1}, width: ind?.style?.width, text: badge?.innerText };
        })()`,
        returnByValue: true
      });
      samples.push(s.result.value);
    }
    console.log('Sample levels during 20s (first 5 and last 5):', samples.slice(0, 5), samples.slice(-5));

    // Flush data by requesting data or stopping
    console.log('5. Stopping recording and querying IndexedDB chunks...');
    const stopAndQuery = await send('Runtime.evaluate', {
      expression: `(async () => {
        const pauseBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Пауза') || b.className.includes('bg-red-800'));
        if (pauseBtn) pauseBtn.click();
        await new Promise(r => setTimeout(r, 1000));

        // Read all chunks from havorka_db
        const dbReq = indexedDB.open('havorka_db', 2);
        const data = await new Promise((resolve) => {
          dbReq.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(['audioChunks', 'sessions'], 'readonly');
            const cStore = tx.objectStore('audioChunks');
            const sStore = tx.objectStore('sessions');
            const cReq = cStore.getAll();
            const sReq = sStore.getAll();
            tx.oncomplete = () => {
              resolve({
                chunks: cReq.result.map(c => ({
                  sessionId: c.sessionId,
                  segmentIndex: c.segmentIndex,
                  chunkIndex: c.chunkIndex,
                  size: c.data ? c.data.size : 0,
                  type: c.data ? c.data.type : 'none'
                })),
                sessions: sReq.result
              });
            };
          };
        });
        return data;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('IndexedDB chunks found:', stopAndQuery.result.value.chunks);
    console.log('IndexedDB sessions found:', stopAndQuery.result.value.sessions);

    // Now extract the chunks of the latest session, assemble into Blob and save to disk
    const exportResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        const dbReq = indexedDB.open('havorka_db', 2);
        return new Promise((resolve) => {
          dbReq.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('audioChunks', 'readonly');
            const req = tx.objectStore('audioChunks').getAll();
            req.onsuccess = () => {
              const allChunks = req.result;
              if (allChunks.length === 0) return resolve({ empty: true });
              // Get latest session
              const latestSessionId = allChunks[allChunks.length - 1].sessionId;
              const sessionChunks = allChunks.filter(c => c.sessionId === latestSessionId);
              const blobs = sessionChunks.map(c => c.data).filter(Boolean);
              const totalBlob = new Blob(blobs, { type: blobs[0]?.type || 'audio/mp4' });

              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  sessionId: latestSessionId,
                  chunksCount: sessionChunks.length,
                  totalSize: totalBlob.size,
                  type: totalBlob.type,
                  base64: reader.result
                });
              };
              reader.readAsDataURL(totalBlob);
            };
          };
        });
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const exp = exportResult.result.value;
    console.log('Exported session audio info:', {
      sessionId: exp?.sessionId,
      chunksCount: exp?.chunksCount,
      totalSize: exp?.totalSize,
      type: exp?.type
    });

    if (exp?.base64) {
      const b64 = exp.base64.replace(/^data:.+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      const outPath = path.resolve('temp_test', 'stage1_recorded_audio.m4a');
      fs.writeFileSync(outPath, buf);
      console.log(`Saved audio file to ${outPath} (${buf.length} bytes)`);
    }

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    chromeProc.kill();
  }
}

run();
