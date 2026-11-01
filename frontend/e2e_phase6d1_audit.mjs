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
    } catch {}
    await sleep(500);
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

const auditResults = {
  totalAssertions: 0,
  passedAssertions: 0,
  failedAssertions: [],
  consoleErrors: [],
  pageErrors: [],
  failedNetworkRequests: [],
  screenshotsCaptured: [],
};

function assert(condition, description) {
  auditResults.totalAssertions++;
  if (condition) {
    auditResults.passedAssertions++;
    console.log(`  [PASS] ${description}`);
  } else {
    auditResults.failedAssertions.push(description);
    console.error(`  [FAIL] ${description}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('  Phase 6D.1: Playwright Browser Authentication & Security Audit');
  console.log('================================================================');

  const timestamp = Date.now();
  const user1Email = `tenant1_${timestamp}@auditflow.org`;
  const user2Email = `tenant2_${timestamp}@auditflow.org`;
  const password = 'SuperSecurePassword123!';

  // 1. Start FastAPI backend
  console.log('\n[1/6] Launching FastAPI Backend on port 8000...');
  const backendCwd = path.resolve('..', 'backend');
  const pythonExe = path.join(backendCwd, '.venv', 'Scripts', 'python.exe');
  const backendProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendCwd,
    stdio: 'ignore',
  });

  // 2. Start Vite Preview Frontend
  console.log('[2/6] Launching Vite Preview Frontend on port 5173...');
  const frontendProc = spawn('cmd.exe', ['/c', 'pnpm', 'run', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  let browser;
  try {
    await waitForServer('http://127.0.0.1:8000/api/v1/healthz');
    console.log('  Backend is healthy.');

    await waitForServer('http://127.0.0.1:5173');
    console.log('  Frontend preview server is online.');

    // 3. Launch browser
    console.log('\n[3/6] Launching Playwright browser...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const execPath = fs.existsSync(edgePath) ? edgePath : chromePath;

    browser = await chromium.launch({
      executablePath: execPath,
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // Listen to console errors and network failures
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Redact any auth tokens if accidentally printed
        const sanitized = text.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]');
        auditResults.consoleErrors.push(sanitized);
      }
    });

    page.on('pageerror', (err) => {
      auditResults.pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      auditResults.failedNetworkRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    // Workflow A: Initial Load - Verify Auth Page
    console.log('\n[4/6] Executing Authentication & Lifecycle Workflows...');
    await page.goto('http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');

    const signInTab = page.getByRole('tab', { name: 'Sign In' });
    const createAccountTab = page.getByRole('tab', { name: 'Create Account' });
    assert(await signInTab.isVisible(), 'Initial unauthenticated visit presents Sign In view');
    assert(await createAccountTab.isVisible(), 'Create Account tab is visible on AuthPage');

    const screenshot1 = path.join(SCREENSHOTS_DIR, '28_auth_landing_page.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    auditResults.screenshotsCaptured.push(screenshot1);

    // Workflow B: User 1 Registration
    console.log('  Testing User 1 Registration...');
    await createAccountTab.click();
    await page.fill('#register-name', 'Alice Montgomery');
    await page.fill('#register-email', user1Email);
    await page.fill('#register-password', password);
    await page.fill('#register-confirm-password', password);
    await page.click('form button[type="submit"]');

    // Wait for authenticated app shell
    await page.waitForSelector('text=Event Command Center', { timeout: 10000 });
    assert(await page.locator('text=Event Command Center').isVisible(), 'User 1 authenticated and navigated to Command Center');
    assert(await page.locator('text=Alice Montgomery').isVisible(), 'User initials/name displayed in Header Profile');

    const screenshot2 = path.join(SCREENSHOTS_DIR, '29_user1_authenticated_dashboard.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    auditResults.screenshotsCaptured.push(screenshot2);

    // Workflow C: User 1 creates an event
    console.log('  Testing Event Creation for User 1...');
    await page.click('button:has-text("New Event")');
    await page.waitForSelector('text=Create New Event');
    await page.fill('input[placeholder*="Maya & Aryan"]', 'Alice & Bob Royal Wedding');
    await page.click('button:has-text("Create Event")');
    await sleep(2000);

    // Verify event in Events tab
    await page.locator('aside nav button:has-text("Events Hub")').click();
    await sleep(1000);
    assert(await page.getByRole('heading', { name: 'Alice & Bob Royal Wedding' }).isVisible(), 'User 1 event is visible in Events Hub');

    // Workflow D: User 1 Copilot interaction
    console.log('  Testing AI Copilot message for User 1...');
    await page.click('button:has-text("AI Copilot")');
    await page.waitForSelector('text=AI Event Copilot');

    const startSessionBtn = page.locator('button:has-text("Start Planning Session")');
    if (await startSessionBtn.isVisible()) {
      await startSessionBtn.click();
      await sleep(1000);
    }

    const chatInput = page.locator('textarea[placeholder*="Ask Copilot"], input[placeholder*="Ask Copilot"]');
    if (await chatInput.isVisible()) {
      await chatInput.fill('Plan catering budget for 250 guests');
      await page.keyboard.press('Enter');
      await sleep(2500);
    }

    const screenshot3 = path.join(SCREENSHOTS_DIR, '30_user1_copilot_interaction.png');
    await page.screenshot({ path: screenshot3 });
    auditResults.screenshotsCaptured.push(screenshot3);

    // Close Copilot drawer
    await page.click('button[aria-label="Close AI Copilot"]');
    await sleep(500);

    // Workflow E: Browser Refresh & Silent Session Restoration
    console.log('  Testing Browser Refresh (Silent Session Restoration via HttpOnly Cookie)...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await sleep(1000);

    assert(await page.locator('text=Event Command Center').isVisible(), 'Session restored automatically on page refresh without re-login');
    assert(await page.locator('text=Alice Montgomery').isVisible(), 'User profile preserved across refresh');

    // Workflow F: User 1 Logout
    console.log('  Testing User 1 Logout with Confirmation...');
    await page.click('button[aria-label="User profile menu"]');
    await page.click('text=Sign Out...');
    await page.waitForSelector('text=Confirm Sign Out');
    await page.click('div[role="dialog"] button:has-text("Sign Out")');
    await page.waitForSelector('button[role="tab"]:has-text("Sign In")', { timeout: 10000 });

    assert(await page.getByRole('tab', { name: 'Sign In' }).isVisible(), 'User 1 successfully logged out and redirected to AuthPage');

    const screenshot4 = path.join(SCREENSHOTS_DIR, '31_logout_redirect.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    auditResults.screenshotsCaptured.push(screenshot4);

    // Workflow G: Protected route enforcement
    console.log('  Verifying Protected Route Enforcement...');
    await page.goto('http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');
    assert(await page.getByRole('tab', { name: 'Sign In' }).isVisible(), 'Protected workspace inaccessible after logout; rendered AuthPage');
    assert(!(await page.getByRole('heading', { name: 'Alice & Bob Royal Wedding' }).isVisible()), 'Protected tenant data is completely hidden');

    // Workflow H: User 2 Registration
    console.log('\n[5/6] Testing Multi-Tenant Frontend Isolation (User 2)...');
    await page.getByRole('tab', { name: 'Create Account' }).click();
    await page.fill('#register-name', 'Carlos Rodriguez');
    await page.fill('#register-email', user2Email);
    await page.fill('#register-password', password);
    await page.fill('#register-confirm-password', password);
    await page.click('form button[type="submit"]');
    await page.waitForSelector('text=Event Command Center', { timeout: 10000 });

    assert(await page.locator('text=Carlos Rodriguez').isVisible(), 'User 2 logged in and authenticated');

    // Workflow I: Multi-Tenant Isolation Checks
    console.log('  Verifying User 2 CANNOT see User 1 data (Event & Copilot isolation)...');
    await page.locator('aside nav button:has-text("Events Hub")').click();
    await sleep(1000);

    const isUser1EventVisibleToUser2 = await page.getByRole('heading', { name: 'Alice & Bob Royal Wedding' }).isVisible();
    assert(!isUser1EventVisibleToUser2, 'CRITICAL ISOLATION: User 1 event is NOT visible to User 2');

    // Open Copilot for User 2
    await page.click('button:has-text("AI Copilot")');
    await page.waitForSelector('text=AI Event Copilot');
    await sleep(1000);

    const isUser1MessageVisibleToUser2 = await page.locator('text=Plan catering budget for 250 guests').isVisible();
    assert(!isUser1MessageVisibleToUser2, 'CRITICAL ISOLATION: User 1 Copilot messages are NOT leaked to User 2');

    const screenshot5 = path.join(SCREENSHOTS_DIR, '32_user2_tenant_isolation.png');
    await page.screenshot({ path: screenshot5 });
    auditResults.screenshotsCaptured.push(screenshot5);

    await page.click('button[aria-label="Close AI Copilot"]');
    await sleep(500);

    // Workflow J: User 2 logs out cleanly
    console.log('  Cleaning up User 2 session...');
    await page.click('button[aria-label="User profile menu"]');
    await page.click('text=Sign Out...');
    await page.waitForSelector('text=Confirm Sign Out');
    await page.click('div[role="dialog"] button:has-text("Sign Out")');
    await page.waitForSelector('button[role="tab"]:has-text("Sign In")');
    assert(await page.getByRole('tab', { name: 'Sign In' }).isVisible(), 'User 2 logged out cleanly');

  } catch (err) {
    console.error('Test execution failed with error:', err);
    auditResults.failedAssertions.push(`Exception: ${err.message}`);
  } finally {
    if (browser) await browser.close();
    killProcess(backendProc);
    killProcess(frontendProc);
  }

  console.log('\n================================================================');
  console.log('  Phase 6D.1 Playwright Integration Summary');
  console.log('================================================================');
  console.log(`Total Assertions:  ${auditResults.totalAssertions}`);
  console.log(`Passed Assertions: ${auditResults.passedAssertions}`);
  console.log(`Failed Assertions: ${auditResults.failedAssertions.length}`);
  console.log(`Console Errors:    ${auditResults.consoleErrors.length}`);
  console.log(`Failed Requests:   ${auditResults.failedNetworkRequests.length}`);
  console.log(`Screenshots:       ${auditResults.screenshotsCaptured.length}`);

  if (auditResults.failedAssertions.length > 0) {
    console.error('\nFailures:');
    auditResults.failedAssertions.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n>> ALL PLAYWRIGHT BROWSER AUDIT ASSERTIONS PASSED SUCCESSFULLY! <<');
  }
}

run();
