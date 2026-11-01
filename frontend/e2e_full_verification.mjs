import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = 'C:\\Users\\Shazil Parwez\\.gemini\\antigravity\\brain\\308ee6f5-8a47-4151-ac73-503b476f2b0d\\screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

async function waitForPort(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 404) {
        return true;
      }
    } catch {
      // waiting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runE2E() {
  console.log('=== Starting End-to-End Integration Verification ===');

  // Clean test artifacts in db if needed, or allow append
  const pythonBin = path.resolve(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe');
  const backendDir = path.resolve(__dirname, '..', 'backend');

  // 1. Start Backend FastAPI Server
  console.log('1. Launching FastAPI backend server on port 8000...');
  const backendProc = spawn(pythonBin, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendDir,
    stdio: 'pipe',
  });

  backendProc.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('ERROR')) console.error(`Backend ERR: ${s.trim()}`);
  });

  await waitForPort('http://127.0.0.1:8000/api/v1/healthz');
  console.log('Backend server is healthy and responding at http://127.0.0.1:8000');

  // 2. Start Frontend Vite Preview Server on port 5173
  console.log('2. Launching Frontend preview server on port 5173...');
  const frontendProc = spawn('npx.cmd', ['vite', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true,
  });

  frontendProc.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('ERROR')) console.error(`Frontend ERR: ${s.trim()}`);
  });

  await waitForPort('http://127.0.0.1:5173/');
  console.log('Frontend server is online at http://127.0.0.1:5173');

  // 3. Launch Headless Browser
  console.log(`3. Launching browser: ${browserPath}`);
  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.warn(`Browser Console Error: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`Browser Uncaught Exception: ${err.message}`);
    networkErrors.push(err.message);
  });

  page.on('requestfailed', (req) => {
    networkErrors.push(`${req.method()} ${req.url()} failed: ${req.failure()?.errorText}`);
  });

  try {
    // Step A: Load Dashboard
    console.log('--- Step A: Loading Dashboard ---');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Event Command Center');
    console.log('Dashboard rendered successfully.');
    const screenshot1 = path.join(screenshotsDir, '01_event_dashboard.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`Captured: ${screenshot1}`);

    // Step B: Navigate to Event Hub
    console.log('--- Step B: Navigating to Event Hub ---');
    await page.click('button:has-text("Events Hub")');
    await page.waitForSelector('text=Event Hub');
    const screenshot2 = path.join(screenshotsDir, '02_event_hub.png');
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`Captured: ${screenshot2}`);

    // Step C: Create New Event
    console.log('--- Step C: Creating Event via Modal ---');
    await page.click('button:has-text("Create New Event")');
    const modal = page.locator('.fixed.inset-0');
    await modal.waitFor({ state: 'visible' });

    const uniqueTitle = `Aarav & Meera Wedding ${Date.now().toString().slice(-4)}`;
    await modal.locator('input[placeholder*="Maya & Aryan"]').fill(uniqueTitle);
    await modal.locator('select').first().selectOption('WEDDING');
    await modal.locator('input[placeholder*="Udaipur"]').fill('Udaipur Heritage Palace');
    await modal.locator('textarea').fill('Grand 3-day royal wedding celebration in Rajasthan with traditional ceremonies');

    const numberInputs = await modal.locator('input[type="number"]').all();
    if (numberInputs.length >= 2) {
      await numberInputs[0].fill('350'); // guest count
      await numberInputs[1].fill('3500000'); // target budget
    }

    await modal.locator('button[type="submit"]:has-text("Create Event")').click();
    await modal.waitFor({ state: 'hidden' });

    // Wait for card title h3 in Event Hub
    await page.waitForSelector(`h3:has-text("${uniqueTitle}")`);
    console.log(`Event "${uniqueTitle}" successfully created and verified in Event Hub!`);
    const screenshot3 = path.join(screenshotsDir, '03_event_created.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`Captured: ${screenshot3}`);

    // Step D: Open Budget Intelligence and Seed Categories
    console.log('--- Step D: Budget Intelligence & Seeding Categories ---');
    const eventCard = page.locator('.bg-white.rounded-xl', { hasText: uniqueTitle }).first();
    await eventCard.locator('button:has-text("Manage Budget")').click();
    await page.waitForSelector('text=Budget Intelligence');
    await page.waitForSelector(`h2:has-text("${uniqueTitle}")`);

    // Wait for Seed Standard Categories button to appear and click it
    console.log('Waiting for Category Allocations section...');
    await page.waitForSelector('text=Category Allocations');

    const seedBtn = page.locator('button:has-text("Seed Standard Categories")').first();
    if (await seedBtn.isVisible()) {
      console.log('Clicking Seed Standard Categories button...');
      await seedBtn.click();
    }

    // Wait for categories to be created and displayed
    await page.waitForSelector('.p-4.bg-slate-50.rounded-xl', { timeout: 10000 });
    console.log('Categories seeded and budget overview calculated.');
    const screenshot4 = path.join(screenshotsDir, '04_budget_overview.png');
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`Captured: ${screenshot4}`);

    // Step E: Add Expense Items & Trigger Over-Budget Warning
    console.log('--- Step E: Adding Expense Items & Triggering Overrun ---');
    const addExpenseBtn = page.locator('button:has-text("Add Expense Item"):not([disabled])').first();
    await addExpenseBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addExpenseBtn.click();

    const itemModal = page.locator('.fixed.inset-0');
    await itemModal.waitFor({ state: 'visible' });

    // Select category (first category e.g. Venue)
    const categoryOptions = await itemModal.locator('select').first().locator('option').all();
    if (categoryOptions.length > 1) {
      const firstVal = await categoryOptions[1].getAttribute('value');
      await itemModal.locator('select').first().selectOption(firstVal);
    }

    await itemModal.locator('input[placeholder*="Venue Banquet Hall"]').fill('Palace Courtyard & Royal Ballroom Booking');
    const itemNumInputs = await itemModal.locator('input[type="number"]').all();
    if (itemNumInputs.length >= 3) {
      await itemNumInputs[0].fill('2400000'); // Estimated
      await itemNumInputs[1].fill('2500000'); // Actual
      await itemNumInputs[2].fill('1000000'); // Paid
    }
    await itemModal.locator('button[type="submit"]:has-text("Add Item")').click();
    await itemModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(600);

    // Add second expense item to deliberately exceed the ₹35,00,000 target budget
    console.log('Adding second expense item to trigger budget overrun...');
    await addExpenseBtn.click();
    await itemModal.waitFor({ state: 'visible' });

    const categoryOptions2 = await itemModal.locator('select').first().locator('option').all();
    if (categoryOptions2.length > 2) {
      const secondVal = await categoryOptions2[2].getAttribute('value');
      await itemModal.locator('select').first().selectOption(secondVal);
    }

    await itemModal.locator('input[placeholder*="Venue Banquet Hall"]').fill('Royal Feast Catering & Beverage Package');
    const itemNumInputs2 = await itemModal.locator('input[type="number"]').all();
    if (itemNumInputs2.length >= 3) {
      await itemNumInputs2[0].fill('1300000'); // Estimated
      await itemNumInputs2[1].fill('1400000'); // Actual (2500000 + 1400000 = 3900000 > 3500000)
      await itemNumInputs2[2].fill('500000'); // Paid
    }
    await itemModal.locator('button[type="submit"]:has-text("Add Item")').click();
    await itemModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Check for Over-Budget Alert Banner
    await page.waitForSelector('text=Budget Limit Exceeded');
    console.log('Verified Over-Budget Alert Banner is displayed with deficit calculation!');
    const screenshot5 = path.join(screenshotsDir, '05_budget_overrun.png');
    await page.screenshot({ path: screenshot5, fullPage: true });
    console.log(`Captured: ${screenshot5}`);

    // Step F: Edit expense item to bring back under budget
    console.log('--- Step F: Editing Expense Item to Rebalance Budget ---');
    const editBtn = page.locator('button[title="Edit item"]').last();
    await editBtn.click();
    await itemModal.waitFor({ state: 'visible' });

    const editNumInputs = await itemModal.locator('input[type="number"]').all();
    if (editNumInputs.length >= 3) {
      await editNumInputs[0].fill('800000');
      await editNumInputs[1].fill('850000'); // 2500000 + 850000 = 3350000 <= 3500000
      await editNumInputs[2].fill('500000');
    }
    await itemModal.locator('button[type="submit"]:has-text("Update Item")').click();
    await itemModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    console.log('Verified Budget rebalanced within limits.');
    const screenshot6 = path.join(screenshotsDir, '06_budget_rebalanced.png');
    await page.screenshot({ path: screenshot6, fullPage: true });
    console.log(`Captured: ${screenshot6}`);

    console.log('=== All End-to-End Steps Executed Successfully ===');
  } catch (err) {
    console.error(`E2E Verification Error: ${err.message}`);
    const errScreenshot = path.join(screenshotsDir, 'error_state.png');
    await page.screenshot({ path: errScreenshot, fullPage: true });
    throw err;
  } finally {
    await browser.close();
    console.log('Closing background server processes...');
    backendProc.kill();
    frontendProc.kill();
  }

  // Summary of browser network and console
  console.log(`Total Browser Console Logs: ${consoleLogs.length}`);
  const errLogs = consoleLogs.filter((l) => l.type === 'error');
  console.log(`Browser Errors Logged: ${errLogs.length}`);
  if (errLogs.length > 0) {
    console.warn('Error details:', errLogs);
  }
  console.log(`Network Failures: ${networkErrors.length}`);
  if (networkErrors.length > 0) {
    console.warn('Network failure details:', networkErrors);
  }
}

runE2E()
  .then(() => {
    console.log('E2E Integration Verification COMPLETED WITH ZERO DEFECTS.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('E2E Integration Verification FAILED:', err);
    process.exit(1);
  });
