import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.resolve('tmp-chrome-profile');
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuthToken() {
  const email = `dashboard-verifier-${Date.now()}@example.com`;
  const password = 'RealPassword123!';
  const name = 'Vinayak Gund';

  console.log('1. Registering test user on live API for dashboard screenshot...');
  const res = await fetch('http://localhost:3001/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error('Failed to register user: ' + JSON.stringify(data));
  }

  const token = data.data.accessToken;
  console.log('   ✓ User registered! Token acquired.');
  return token;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 0;
    this.callbacks = new Map();

    this.ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) {
          reject(new Error(parsed.error.message));
        } else {
          resolve(parsed.result);
        }
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const token = await getAuthToken();

  console.log('2. Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
    ],
    { stdio: 'ignore' },
  );

  await wait(2500);

  try {
    const versionRes = await fetch('http://127.0.0.1:9222/json/version');
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

    console.log('3. Connected to Chrome CDP:', wsUrl);
    const client = new CdpClient(wsUrl);
    await client.ready();

    // Create a new target page
    const target = await client.send('Target.createTarget', { url: 'about:blank' });
    const pageClient = new CdpClient(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
    await pageClient.ready();

    await pageClient.send('Network.enable');
    await pageClient.send('Page.enable');

    // Set HttpOnly cookie for both localhost:3000 and localhost:3001
    await pageClient.send('Network.setCookie', {
      name: 'bhuvi_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    });

    console.log('4. Capturing Desktop Overview (1440x900)...');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pageClient.send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await wait(3500); // Allow data fetch and UI animation

    const desktopOverviewScreenshot = await pageClient.send('Page.captureScreenshot', {
      format: 'png',
    });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'dashboard-desktop.png'),
      Buffer.from(desktopOverviewScreenshot.data, 'base64'),
    );
    console.log('   ✓ Saved docs/screenshots/dashboard-desktop.png');

    console.log('5. Capturing Desktop Settings (1440x900)...');
    await pageClient.send('Page.navigate', { url: 'http://localhost:3000/dashboard/settings' });
    await wait(2500);

    const desktopSettingsScreenshot = await pageClient.send('Page.captureScreenshot', {
      format: 'png',
    });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'settings-desktop.png'),
      Buffer.from(desktopSettingsScreenshot.data, 'base64'),
    );
    console.log('   ✓ Saved docs/screenshots/settings-desktop.png');

    console.log('6. Capturing Mobile Overview (390x844)...');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await pageClient.send('Page.navigate', { url: 'http://localhost:3000/dashboard' });
    await wait(2500);

    const mobileOverviewScreenshot = await pageClient.send('Page.captureScreenshot', {
      format: 'png',
    });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'dashboard-mobile.png'),
      Buffer.from(mobileOverviewScreenshot.data, 'base64'),
    );
    console.log('   ✓ Saved docs/screenshots/dashboard-mobile.png');

    console.log('7. Capturing Mobile Settings (390x844)...');
    await pageClient.send('Page.navigate', { url: 'http://localhost:3000/dashboard/settings' });
    await wait(2000);

    const mobileSettingsScreenshot = await pageClient.send('Page.captureScreenshot', {
      format: 'png',
    });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'settings-mobile.png'),
      Buffer.from(mobileSettingsScreenshot.data, 'base64'),
    );
    console.log('   ✓ Saved docs/screenshots/settings-mobile.png');

    pageClient.close();
    client.close();
    console.log('8. All screenshots captured successfully!');
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
}

run().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});

