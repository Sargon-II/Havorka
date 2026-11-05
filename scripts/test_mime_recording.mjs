import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import os from 'os';
import WebSocket from 'ws';

const CHROME_PATH = process.env.CHROME_PATH || (process.platform === 'win32'
  ? path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')
  : 'google-chrome');
const WAV_PATH = path.resolve(process.cwd(), 'temp_test', 'test_audio_440hz.wav');
const PROFILE_DIR = path.resolve(os.tmpdir(), 'chrome_audio_mime_test');

const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--no-first-run',
  '--no-default-browser-check',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${WAV_PATH}`,
  `--user-data-dir=${PROFILE_DIR}`,
  'about:blank'
], { stdio: 'ignore' });

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  const data = await new Promise((resolve) => {
    http.get('http://127.0.0.1:9223/json/list', (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
  });
  const page = JSON.parse(data)[0];
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
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Runtime.enable');

  // Test recording with different MIME types for 3 seconds each!
  const evalResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      const mimes = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];
      const results = {};

      for (const mime of mimes) {
        const supported = MediaRecorder.isTypeSupported(mime);
        if (!supported) {
          results[mime] = { supported: false };
          continue;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        rec.start(1000);
        await new Promise(r => setTimeout(r, 3000));
        rec.stop();
        await new Promise(r => setTimeout(r, 500));
        stream.getTracks().forEach(t => t.stop());

        const totalBlob = new Blob(chunks, { type: mime });
        results[mime] = {
          supported: true,
          chunksCount: chunks.length,
          chunksSizes: chunks.map(c => c.size),
          totalSize: totalBlob.size
        };
      }
      return results;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('MIME recording test results in Chrome:', evalResult.result.value);

  ws.close();
  chromeProc.kill();
}

run().catch(console.error);
