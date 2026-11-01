import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = 'C:/Users/Shazil Parwez/.gemini/antigravity/brain/308ee6f5-8a47-4151-ac73-503b476f2b0d/screenshots';
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
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runE2EPhase4() {
  console.log('=== Starting Phase 4 E2E Integration Verification ===');

  const pythonBin = path.resolve(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe');
  const backendDir = path.resolve(__dirname, '..', 'backend');

  // 1. Launch FastAPI Backend
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

  // 2. Launch Frontend Preview Server
  console.log('2. Launching Frontend preview server on port 5173...');
  const frontendProc = spawn('npx.cmd', ['vite', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true,
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
    viewport: { width: 1366, height: 960 },
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
    // Step A: Load App & Select Active Event from Events Hub
    console.log('--- Step A: Loading App & Selecting Active Event ---');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Event Command Center');

    await page.click('button:has-text("Events Hub")');
    await page.waitForSelector('text=Event Hub');
    await page.waitForTimeout(1500);

    // Ensure an event is active
    const setActiveBtn = page.locator('button:has-text("Set as Active")').first();
    if (await setActiveBtn.isVisible()) {
      console.log('Clicking "Set as Active" on first event...');
      await setActiveBtn.click();
      await page.waitForTimeout(1000);
    } else {
      const activeBtn = page.locator('button:has-text("Active Event")').first();
      if (await activeBtn.isVisible()) {
        console.log('First event is already active.');
      } else {
        console.log('Creating initial test event...');
        await page.click('button:has-text("Create New Event")');
        const modal = page.locator('.fixed.inset-0');
        await modal.waitFor({ state: 'visible' });
        await modal.locator('input[placeholder*="Maya & Aryan"]').fill('Pooja & Rohan Royal Wedding');
        await modal.locator('select').first().selectOption('WEDDING');
        await modal.locator('input[placeholder*="Udaipur"]').fill('Udaipur Lake Palace');
        const numberInputs = await modal.locator('input[type="number"]').all();
        if (numberInputs.length >= 2) {
          await numberInputs[0].fill('400');
          await numberInputs[1].fill('5000000');
        }
        await modal.locator('button[type="submit"]:has-text("Create Event")').click();
        await modal.waitFor({ state: 'hidden' });
        await page.waitForTimeout(1000);
      }
    }

    // Step B: Navigate to Guest Management
    console.log('--- Step B: Navigating to Guest Roster ---');
    await page.click('button:has-text("Guest Roster")');
    await page.waitForTimeout(500);

    // If active event prompt appears, click Go to Events Hub and re-activate
    const noActivePrompt = page.locator('text=No Active Event Selected');
    if (await noActivePrompt.isVisible()) {
      console.log('Active event was not selected, activating from prompt...');
      await page.click('button:has-text("Go to Events Hub")');
      await page.waitForTimeout(1000);
      const setBtn = page.locator('button:has-text("Set as Active")').first();
      if (await setBtn.isVisible()) {
        await setBtn.click();
        await page.waitForTimeout(800);
      }
      await page.click('button:has-text("Guest Roster")');
    }

    await page.waitForSelector('text=Guest Roster & RSVP Matrix', { timeout: 10000 });

    // Step C: Add Guests via Modal
    console.log('Adding Guest 1: Maharaja Gaj Singh (VIP)...');
    await page.click('button:has-text("Add Guest")');
    let guestModal = page.locator('.fixed.inset-0');
    await guestModal.waitFor({ state: 'visible' });

    await guestModal.locator('#guest-name-input').fill('Maharaja Gaj Singh');
    await guestModal.locator('#guest-category-select').selectOption('VIP');
    await guestModal.locator('#guest-email-input').fill('maharaja@jodhpurpalace.in');
    await guestModal.locator('#guest-phone-input').fill('+91 98290 99999');
    await guestModal.locator('#guest-rsvp-select').selectOption('CONFIRMED');
    await guestModal.locator('#guest-invitation-select').selectOption('SENT');
    await guestModal.locator('#guest-plus-ones-input').fill('2');
    await guestModal.locator('#guest-dietary-input').fill('Vegetarian, Jain');
    await guestModal.locator('#guest-accessibility-input').fill('Step-free access & golf cart transfer');
    await guestModal.locator('#guest-table-input').fill('Table Royal 1');
    await guestModal.locator('#guest-notes-input').fill('Royal family VIP protocol');

    await guestModal.locator('button[type="submit"]:has-text("Add Guest")').click();
    await guestModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Add Guest 2
    console.log('Adding Guest 2: Priya Sharma (Family)...');
    await page.click('button:has-text("Add Guest")');
    guestModal = page.locator('.fixed.inset-0');
    await guestModal.waitFor({ state: 'visible' });

    await guestModal.locator('#guest-name-input').fill('Priya Sharma');
    await guestModal.locator('#guest-category-select').selectOption('Family');
    await guestModal.locator('#guest-email-input').fill('priya.sharma@example.com');
    await guestModal.locator('#guest-rsvp-select').selectOption('CONFIRMED');
    await guestModal.locator('#guest-invitation-select').selectOption('SENT');
    await guestModal.locator('#guest-plus-ones-input').fill('1');
    await guestModal.locator('#guest-dietary-input').fill('Vegan');
    await guestModal.locator('#guest-table-input').fill('Table 3');

    await guestModal.locator('button[type="submit"]:has-text("Add Guest")').click();
    await guestModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Add Guest 3
    console.log('Adding Guest 3: Dr. Kabir Roy (Colleagues)...');
    await page.click('button:has-text("Add Guest")');
    guestModal = page.locator('.fixed.inset-0');
    await guestModal.waitFor({ state: 'visible' });

    await guestModal.locator('#guest-name-input').fill('Dr. Kabir Roy');
    await guestModal.locator('#guest-category-select').selectOption('Colleagues');
    await guestModal.locator('#guest-rsvp-select').selectOption('INVITED');
    await guestModal.locator('#guest-invitation-select').selectOption('SENT');
    await guestModal.locator('#guest-plus-ones-input').fill('0');
    await guestModal.locator('#guest-dietary-input').fill('Gluten-Free');

    await guestModal.locator('button[type="submit"]:has-text("Add Guest")').click();
    await guestModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(1000);

    console.log('Capturing: 11_guest_management.png');
    const screenshot11 = path.join(screenshotsDir, '11_guest_management.png');
    await page.screenshot({ path: screenshot11, fullPage: true });

    // Step D: Filter by VIP & Capture Filtered Roster
    console.log('Filtering roster by category: VIP...');
    await page.click('button:has-text("VIP")');
    await page.waitForTimeout(600);

    console.log('Capturing: 12_guest_roster_filtered.png');
    const screenshot12 = path.join(screenshotsDir, '12_guest_roster_filtered.png');
    await page.screenshot({ path: screenshot12, fullPage: true });

    // Reset filter
    await page.click('button:has-text("All")');
    await page.waitForTimeout(500);

    // Step E: Navigate to Inspiration Studio
    console.log('--- Step E: Navigating to Inspiration Studio ---');
    await page.click('button:has-text("Inspiration Studio")');
    await page.waitForSelector('text=Inspiration Studio & Moodboard');

    // Step F: Open AI Generate Ideas Modal
    console.log('Opening AI Inspiration Studio Generator Modal...');
    await page.click('button:has-text("Generate Ideas (AI)")');
    const genModal = page.locator('.fixed.inset-0');
    await genModal.waitFor({ state: 'visible' });

    await genModal.locator('#gen-category-select').selectOption('Decorations');
    await genModal.locator('#gen-prompt-input').fill('Royal Rajasthani Mandap with Marigold Canopies and Brass Lanterns');
    console.log('Triggering AI generation with structured validation...');
    await genModal.locator('button[type="submit"]:has-text("Generate Ideas")').click();

    // Wait for candidate ideas to be returned
    await page.waitForSelector('text=Review Generated Ideas', { timeout: 15000 });
    console.log('AI creative ideas generated successfully. Reviewing candidate ideas...');

    // Save one idea to moodboard
    const saveToMoodboardBtn = genModal.locator('button:has-text("Save to Moodboard")').first();
    await saveToMoodboardBtn.click();
    await page.waitForTimeout(800);

    // Close modal
    await genModal.locator('button:has-text("Close")').click();
    await genModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(1000);

    console.log('Capturing: 13_inspiration_studio.png');
    const screenshot13 = path.join(screenshotsDir, '13_inspiration_studio.png');
    await page.screenshot({ path: screenshot13, fullPage: true });

    // Step G: Add Custom Moodboard Card
    console.log('Adding custom moodboard idea...');
    await page.click('button:has-text("Add Custom Idea")');
    const cardModal = page.locator('.fixed.inset-0');
    await cardModal.waitFor({ state: 'visible' });

    await cardModal.locator('#card-title-input').fill('Imperial Sangeet Folk Fusion & Velvet Drapes');
    await cardModal.locator('#card-category-select').selectOption('Event Themes');
    await cardModal.locator('#card-desc-input').fill('Deep wine velvet drapes with gold foil stamping, acoustic sitar & folk dhol welcome for the royal sangeet celebration.');
    await cardModal.locator('#card-palette-input').fill('#800020, #D4AF37, #FFD700, #1B4D3E');
    await cardModal.locator('#card-tags-input').fill('sangeet, velvet, royal, lighting, traditional');
    await cardModal.locator('#card-budget-input').fill('₹90,000 - ₹1,80,000 (Indicative)');
    await cardModal.locator('#card-notes-input').fill('Coordinate sound check 2 hours before guest arrivals.');

    await cardModal.locator('button[type="submit"]:has-text("Save to Moodboard")').click();
    await cardModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(1000);

    console.log('Capturing: 14_inspiration_detail.png');
    const screenshot14 = path.join(screenshotsDir, '14_inspiration_detail.png');
    await page.screenshot({ path: screenshot14, fullPage: true });

    console.log('=== All Phase 4 E2E Actions Executed Successfully ===');
  } catch (error) {
    console.error(`E2E Verification Failure: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
    console.log('Shutting down server processes...');
    frontendProc.kill();
    backendProc.kill();
  }

  // Audit Logs
  console.log(`\n=== Verification Audit ===`);
  console.log(`Total Console Messages: ${consoleLogs.length}`);
  console.log(`Console Errors: ${consoleLogs.filter((l) => l.type === 'error').length}`);
  console.log(`Network Failures: ${networkErrors.length}`);

  if (networkErrors.length > 0) {
    console.error('Network failures detected:', networkErrors);
  }
}

runE2EPhase4().catch((err) => {
  console.error('Fatal E2E Error:', err);
  process.exit(1);
});
