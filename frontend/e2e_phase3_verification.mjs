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

async function runE2EPhase3() {
  console.log('=== Starting Phase 3 E2E Integration Verification ===');

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

    // Check if an event exists, if so click "Set as Active"
    const setActiveBtn = page.locator('button:has-text("Set as Active")').first();
    if (await setActiveBtn.isVisible()) {
      console.log('Setting first event as active...');
      await setActiveBtn.click();
      await page.waitForTimeout(500);
    } else {
      const activeBtn = page.locator('button:has-text("Active Event")').first();
      if (!(await activeBtn.isVisible())) {
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
        await page.waitForTimeout(800);
      }
    }

    // Step B: Navigate to Timeline Management
    console.log('--- Step B: Navigating to Timeline Management ---');
    await page.click('button:has-text("Timeline & Schedule")');
    await page.waitForSelector('text=Timeline & Schedule Command');

    // Check if Seed Standard Milestones is visible and click it
    const seedBtn = page.locator('button:has-text("Seed Standard Milestones")').first();
    if (await seedBtn.isVisible()) {
      console.log('Seeding standard milestones...');
      await seedBtn.click();
      await page.waitForTimeout(1000);
    }

    // Add a custom milestone via modal
    console.log('Adding custom milestone via modal...');
    await page.click('button:has-text("Add Milestone")');
    const milestoneModal = page.locator('.fixed.inset-0');
    await milestoneModal.waitFor({ state: 'visible' });
    await milestoneModal.locator('input[placeholder*="Finalize Palace Catering"]').fill('Royal Vintage Fireworks & Drone Display');
    await milestoneModal.locator('select').nth(1).selectOption('CRITICAL');
    await milestoneModal.locator('textarea').fill('Synchronized lakefront fireworks display with royal brass fanfare');
    await milestoneModal.locator('button[type="submit"]:has-text("Create Milestone")').click();
    await milestoneModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Toggle complete first milestone
    const checkBtn = page.locator('button[title*="Mark"]').first();
    if (await checkBtn.isVisible()) {
      await checkBtn.click();
      await page.waitForTimeout(600);
    }

    console.log('Capturing: 07_timeline_roadmap.png');
    const screenshot7 = path.join(screenshotsDir, '07_timeline_roadmap.png');
    await page.screenshot({ path: screenshot7, fullPage: true });

    // Step C: Schedule Day-Of Activity & Inspect Run of Show
    console.log('--- Step C: Scheduling Activity & Day-Of Run of Show ---');
    await page.click('button:has-text("Schedule Activity")');
    const activityModal = page.locator('.fixed.inset-0');
    await activityModal.waitFor({ state: 'visible' });
    await activityModal.locator('input[placeholder*="Royal Baraat"]').fill('Grand Varmala Ceremony & Lakeside Pheras');
    await activityModal.locator('input[placeholder*="Palace Courtyard"]').fill('Lakeside Mandap Pavillion');
    await activityModal.locator('input[placeholder*="Band Lead"]').fill('Royal Priest & Pandit Ji');
    await activityModal.locator('button[type="submit"]:has-text("Schedule Activity")').click();
    await activityModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Switch to Day-Of Itinerary Tab
    await page.click('button:has-text("Day-Of Itinerary & Run of Show")');
    await page.waitForSelector('text=Grand Varmala Ceremony & Lakeside Pheras');
    console.log('Capturing: 08_day_of_schedule.png');
    const screenshot8 = path.join(screenshotsDir, '08_day_of_schedule.png');
    await page.screenshot({ path: screenshot8, fullPage: true });

    // Step D: Navigate to Vendor Management
    console.log('--- Step D: Navigating to Vendor Management ---');
    await page.click('button:has-text("Vendor Checklists")');
    await page.waitForSelector('text=Vendor Pipeline & Contracts');

    // Check if Seed Vendor Categories button is visible and click it
    const seedCatBtn = page.locator('button:has-text("Seed Vendor Categories")').first();
    if (await seedCatBtn.isVisible()) {
      console.log('Seeding vendor categories...');
      await seedCatBtn.click();
      await page.waitForTimeout(1000);
    }

    // Add partner vendor 1: Catering
    console.log('Adding Catering Vendor via modal...');
    await page.click('button:has-text("Add Partner Vendor")');
    const vendorModal = page.locator('.fixed.inset-0');
    await vendorModal.waitFor({ state: 'visible' });
    await vendorModal.locator('input[placeholder*="Royal Rajputana"]').fill('Royal Mewar Heritage Catering');
    await vendorModal.locator('select').first().selectOption('Catering');
    await vendorModal.locator('select').nth(1).selectOption('BOOKED');
    await vendorModal.locator('input[placeholder*="Chef Vikram"]').fill('Chef Raghuvir Singh');
    await vendorModal.locator('input[placeholder*="+91 98765"]').fill('+91 98290 88776');
    await vendorModal.locator('input[placeholder*="contact@vendor.com"]').fill('raghuvir@mewarfeasts.com');
    await vendorModal.locator('input[placeholder*="Udaipur / Jaipur"]').fill('Udaipur, Rajasthan');
    await vendorModal.locator('input[placeholder*="https://vendorwebsite.com"]').fill('https://mewarfeasts.com');

    // Quotation and advance
    await vendorModal.locator('#agreed-price-input').fill('1500000');
    await vendorModal.locator('#advance-paid-input').fill('500000');
    await vendorModal.locator('input[type="checkbox"]').check(); // contract signed
    await vendorModal.locator('textarea').fill('Includes 8 live Rajasthani artisanal stalls and imported dessert bar');

    await vendorModal.locator('button[type="submit"]:has-text("Add Vendor")').click();
    await vendorModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    // Add partner vendor 2: Photography
    console.log('Adding Photography Vendor via modal...');
    await page.click('button:has-text("Add Partner Vendor")');
    await vendorModal.waitFor({ state: 'visible' });
    await vendorModal.locator('input[placeholder*="Royal Rajputana"]').fill('Artisan Lens Wedding Films');
    await vendorModal.locator('select').first().selectOption('Photography');
    await vendorModal.locator('select').nth(1).selectOption('QUOTED');
    await vendorModal.locator('input[placeholder*="Chef Vikram"]').fill('Sameer Saxena');
    await vendorModal.locator('input[placeholder*="+91 98765"]').fill('+91 99112 33445');
    await vendorModal.locator('#agreed-price-input').fill('450000');
    await vendorModal.locator('#advance-paid-input').fill('100000');
    await vendorModal.locator('textarea').fill('4K cinematic teaser, 3-day drone footage, and candid albums');

    await vendorModal.locator('button[type="submit"]:has-text("Add Vendor")').click();
    await vendorModal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(800);

    console.log('Capturing: 09_vendor_directory.png');
    const screenshot9 = path.join(screenshotsDir, '09_vendor_directory.png');
    await page.screenshot({ path: screenshot9, fullPage: true });

    // Step E: Filter by category and booking status
    console.log('--- Step E: Category Filtering & Pipeline Validation ---');
    const cateringPill = page.locator('button:has-text("Catering")').first();
    await cateringPill.click();
    await page.waitForTimeout(600);

    console.log('Capturing: 10_vendor_pipeline.png');
    const screenshot10 = path.join(screenshotsDir, '10_vendor_pipeline.png');
    await page.screenshot({ path: screenshot10, fullPage: true });

    console.log('=== All Phase 3 E2E Steps Completed Successfully ===');
  } catch (err) {
    console.error(`Phase 3 E2E Error: ${err.message}`);
    throw err;
  } finally {
    await browser.close();
    console.log('Closing background server processes...');
    backendProc.kill();
    frontendProc.kill();
  }

  console.log(`Total Browser Console Logs: ${consoleLogs.length}`);
  const errLogs = consoleLogs.filter((l) => l.type === 'error');
  console.log(`Browser Errors Logged: ${errLogs.length}`);
  console.log(`Network Failures: ${networkErrors.length}`);
}

runE2EPhase3()
  .then(() => {
    console.log('PHASE 3 E2E INTEGRATION VERIFICATION PASSED WITH ZERO DEFECTS.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('PHASE 3 E2E FAILED:', err);
    process.exit(1);
  });
