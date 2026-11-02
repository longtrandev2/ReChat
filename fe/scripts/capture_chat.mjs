import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

async function capture() {
  const tokenRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alex_demo', password: 'password123' }),
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.data?.accessToken;
  console.log('Got token for alex_demo:', Boolean(token));

  const convsRes = await fetch('http://localhost:3000/api/v1/conversations', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const convsData = await convsRes.json();
  const convs = convsData.data || [];
  const targetConvId = convs[0]?.id || '54f722f3-f24f-45b2-8037-70da269b4304';
  console.log('Target Conv ID:', targetConvId);

  const port = 9223;
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--window-size=1440,900',
    '--user-data-dir=/tmp/chrome-test-profile-' + Date.now(),
    'http://localhost:5173/login'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const listData = await listRes.json();
  const page = listData.find(p => p.type === 'page');
  console.log('Found page target:', page.webSocketDebuggerUrl);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  console.log('WebSocket open to page');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('rechat_access_token', ${JSON.stringify(token)})`
  });

  const chatUrl = `http://localhost:5173/chat/${targetConvId}`;
  console.log('Navigating to:', chatUrl);
  await send('Page.navigate', { url: chatUrl });

  // Wait for React to render active chat canvas & messages
  await new Promise(r => setTimeout(r, 3500));

  // Move mouse over conversation item to demonstrate hover effect and 3-dots
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: 200,
    y: 160
  });

  await new Promise(r => setTimeout(r, 500));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  const outPath = '/home/longtk/.gemini/antigravity-ide/brain/9ae68444-e1bc-45ec-b22a-c7ca33d26711/chat_full_view.png';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buffer);
  console.log('Screenshot saved to:', outPath);

  // Switch to dark mode
  await send('Runtime.evaluate', {
    expression: `
      document.documentElement.classList.add('dark');
      localStorage.setItem('rechat_theme', 'dark');
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const darkScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const darkBuffer = Buffer.from(darkScreenshot.data, 'base64');
  const darkOutPath = '/home/longtk/.gemini/antigravity-ide/brain/9ae68444-e1bc-45ec-b22a-c7ca33d26711/chat_dark_view.png';
  writeFileSync(darkOutPath, darkBuffer);
  console.log('Dark screenshot saved to:', darkOutPath);

  ws.close();
  chrome.kill();
  process.exit(0);
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
