import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

const SCREENSHOTS_DIR = 'C:/Users/Shazil Parwez/.gemini/antigravity/brain/308ee6f5-8a47-4151-ac73-503b476f2b0d/screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', proc.pid.toString()]);
    } else {
      proc.kill('SIGKILL');
    }
  } catch {}
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) {
        return true;
      }
    } catch {
      // wait and retry
    }
    await sleep(500);
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function run() {
  console.log('--- Phase 5C: Live E2E Screenshot Generation ---');

  // 1. Start FastAPI backend
  console.log('Starting FastAPI backend...');
  const backendCwd = path.resolve('..', 'backend');
  const pythonExe = path.join(backendCwd, '.venv', 'Scripts', 'python.exe');
  const backendProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendCwd,
    stdio: 'ignore',
  });

  // 2. Start Vite Preview frontend
  console.log('Starting Vite preview frontend on port 5173...');
  const frontendProc = spawn('cmd.exe', ['/c', 'pnpm', 'run', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  try {
    console.log('Waiting for backend on http://127.0.0.1:8000/api/v1/healthz ...');
    await waitForServer('http://127.0.0.1:8000/api/v1/healthz');
    console.log('Backend is healthy at http://127.0.0.1:8000');

    console.log('Waiting for frontend on http://127.0.0.1:5173 ...');
    await waitForServer('http://127.0.0.1:5173');
    console.log('Frontend is running at http://127.0.0.1:5173');

    // Launch Playwright using installed Chrome or Edge
    console.log('Launching browser via Playwright...');
    let browser;
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // Navigate to App
    console.log('Navigating to http://127.0.0.1:5173 ...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await sleep(2000);

    // 15_copilot_empty_state.png
    console.log('Capturing 15_copilot_empty_state.png...');
    // Open Copilot drawer via navbar button
    const copilotBtn = page.locator('button:has-text("AI Copilot")');
    await copilotBtn.click();
    await sleep(1500);

    // Start a fresh new chat
    const newChatBtn = page.locator('button[title="Start New Chat"]');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await sleep(1000);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '15_copilot_empty_state.png'),
      fullPage: false,
    });
    console.log('Saved: 15_copilot_empty_state.png');

    // 16_copilot_conversation.png
    console.log('Sending message to Copilot...');
    const chatInput = page.locator('textarea[aria-label="Message input for AI Copilot"]');
    await chatInput.fill('Review my current event budget and provide recommendations');
    const sendBtn = page.locator('button[aria-label="Send message to AI Copilot"]');
    await sendBtn.click();

    // Wait for assistant response to appear
    console.log('Waiting for AI response...');
    await sleep(4000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '16_copilot_conversation.png'),
      fullPage: false,
    });
    console.log('Saved: 16_copilot_conversation.png');

    // 17_copilot_suggested_prompts.png
    console.log('Capturing 17_copilot_suggested_prompts.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '17_copilot_suggested_prompts.png'),
      fullPage: false,
    });
    console.log('Saved: 17_copilot_suggested_prompts.png');

    // 18_copilot_action_proposal.png
    console.log('Capturing 18_copilot_action_proposal.png...');
    await chatInput.fill('Please propose a catering milestone and floral decor budget expense.');
    await sendBtn.click();
    await sleep(4000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '18_copilot_action_proposal.png'),
      fullPage: false,
    });
    console.log('Saved: 18_copilot_action_proposal.png');

    // 19_copilot_action_executed.png
    console.log('Approving action proposal...');
    const approveBtn = page.locator('button:has-text("Approve & Apply")').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await sleep(2500);
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '19_copilot_action_executed.png'),
      fullPage: false,
    });
    console.log('Saved: 19_copilot_action_executed.png');

    // 20_copilot_mobile.png
    console.log('Capturing 20_copilot_mobile.png (Mobile Viewport)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await sleep(1500);

    // Open Copilot on mobile
    const mobileCopilotBtn = mobilePage.locator('button:has-text("AI Copilot")');
    await mobileCopilotBtn.click();
    await sleep(1500);

    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '20_copilot_mobile.png'),
      fullPage: false,
    });
    console.log('Saved: 20_copilot_mobile.png');

    await mobileContext.close();
    await context.close();
    await browser.close();
    console.log('All 6 screenshots captured successfully!');
  } finally {
    console.log('Cleaning up processes...');
    killProcess(backendProc);
    killProcess(frontendProc);
  }
}

run().catch((err) => {
  console.error('E2E Screenshot generation error:', err);
  process.exit(1);
});
