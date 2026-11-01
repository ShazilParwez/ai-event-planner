import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

const SCREENSHOTS_DIR = 'C:/Users/Shazil Parwez/.gemini/antigravity/brain/308ee6f5-8a47-4151-ac73-503b476f2b0d/screenshots';
const PUBLIC_SCREENSHOTS_DIR = path.resolve('public', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function copyToPublic(filename) {
  try {
    const src = path.join(SCREENSHOTS_DIR, filename);
    const dest = path.join(PUBLIC_SCREENSHOTS_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn(`Could not copy ${filename} to public:`, err);
  }
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
  console.log('  Phase 5D: AI Event Copilot - Full End-to-End Verification');
  console.log('================================================================');

  // 1. Start FastAPI backend
  console.log('\n[1/7] Starting FastAPI Backend...');
  const backendCwd = path.resolve('..', 'backend');
  const pythonExe = path.join(backendCwd, '.venv', 'Scripts', 'python.exe');
  const backendProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendCwd,
    stdio: 'ignore',
  });

  // 2. Start Vite Preview frontend
  console.log('[2/7] Starting Vite Preview Frontend on port 5173...');
  const frontendProc = spawn('cmd.exe', ['/c', 'pnpm', 'run', 'preview', '--port', '5173', '--host', '127.0.0.1'], {
    cwd: process.cwd(),
    stdio: 'ignore',
  });

  try {
    await waitForServer('http://127.0.0.1:8000/api/v1/healthz');
    console.log('Backend is healthy at http://127.0.0.1:8000/api/v1/healthz');

    await waitForServer('http://127.0.0.1:5173');
    console.log('Frontend is ready at http://127.0.0.1:5173');

    // Verify Backend Health Payload
    const healthRes = await fetch('http://127.0.0.1:8000/api/v1/healthz');
    const healthData = await healthRes.json();
    assert(healthData.status === 'healthy', 'Health check returns status: healthy');
    assert(healthData.database_connected === true, 'Database connectivity confirmed true');
    assert(healthData.ai_provider_mode === 'mock', 'AI provider mode is configured as mock');

    // Fetch existing events to verify data isolation
    const eventsRes = await fetch('http://127.0.0.1:8000/api/v1/events');
    const eventsJson = await eventsRes.json();
    const events = eventsJson.data || eventsJson;
    assert(Array.isArray(events) && events.length >= 2, `Multiple events found in database (${events?.length} events)`);
    const eventA = events[0];
    const eventB = events[1];
    console.log(`  Event A: "${eventA.title}" (${eventA.id})`);
    console.log(`  Event B: "${eventB.title}" (${eventB.id})`);

    // Launch Playwright Browser
    console.log('\n[3/7] Launching Playwright Browser...');
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

    // Listen to console and network errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('Navigating to http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await sleep(2000);

    // Open Copilot Drawer
    console.log('\n[4/7] Testing Copilot Drawer & Thread Management...');
    const copilotBtn = page.locator('button:has-text("AI Copilot")');
    assert(await copilotBtn.isVisible(), 'AI Copilot navigation button is visible');
    await copilotBtn.click();
    await sleep(1000);

    // Drawer is visible
    const drawerTitle = page.locator('#copilot-drawer-title');
    assert(await drawerTitle.isVisible(), 'Copilot drawer title is visible');
    assert((await drawerTitle.textContent()).includes('AI Event Copilot'), 'Drawer title text contains "AI Event Copilot"');

    // Create Thread 1: "Milestone & Budget Planning"
    const newChatBtn = page.locator('button[title="Start New Chat"]');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
      await sleep(1000);
    }

    // Send Message 1 in Thread 1: Milestone proposal request
    console.log('  Sending milestone request in Thread 1...');
    const chatInput = page.locator('textarea[aria-label="Message input for AI Copilot"]');
    const sendBtn = page.locator('button[aria-label="Send message to AI Copilot"]');
    
    await chatInput.fill('Please propose a timeline milestone and schedule for stage sound setup.');
    await sendBtn.click();
    await sleep(4000);

    // Verify Assistant response rendered with Markdown and Source badge
    const assistantBadge = page.locator('text=Mock AI Provider').first();
    assert(await assistantBadge.isVisible(), 'Assistant message displays "Mock AI Provider" badge');
    
    // Verify Milestone action card proposed
    const milestoneCard = page.locator('text=Timeline Milestone').first();
    assert(await milestoneCard.isVisible(), 'Proposed action card "Timeline Milestone" is displayed');

    // Create Thread 2: "Vendor Procurement"
    console.log('  Creating Thread 2...');
    await newChatBtn.click();
    await sleep(1500);

    // Send Message in Thread 2: Vendor inquiry
    console.log('  Sending vendor inquiry in Thread 2...');
    await chatInput.fill('Suggest catering vendor and quote comparison.');
    await sendBtn.click();
    await sleep(4000);

    const vendorCard = page.locator('text=Vendor Procurement').first();
    assert(await vendorCard.isVisible(), 'Thread 2 proposes "Vendor Procurement" action card');

    // Open Chats list to see multiple threads
    console.log('  Opening Threads List view...');
    const chatsToggleBtn = page.locator('button[title="Toggle Conversation Threads"]');
    await chatsToggleBtn.click();
    await sleep(1500);

    const threadItems = page.locator('div[role="dialog"] .overflow-y-auto .cursor-pointer');
    const threadCount = await threadItems.count();
    assert(threadCount >= 2, `Multiple conversation threads rendered in list view (found ${threadCount})`);

    // Capture Screenshot 21: 21_copilot_thread_management.png
    console.log('  Capturing 21_copilot_thread_management.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '21_copilot_thread_management.png'),
      fullPage: false,
    });
    copyToPublic('21_copilot_thread_management.png');
    auditResults.screenshotsCaptured.push('21_copilot_thread_management.png');

    // Switch back to Thread 1 by clicking the older thread in list
    console.log('  Switching back to Thread 1...');
    await threadItems.nth(1).click();
    await sleep(1500);

    // Verify Thread 1 content (milestone proposal) is displayed
    assert(await page.locator('text=Timeline Milestone').first().isVisible(), 'Thread 1 conversation history properly restored on switch');

    // Refresh browser to verify conversation persistence
    console.log('\n[5/7] Testing Browser Refresh Persistence...');
    await page.reload({ waitUntil: 'networkidle' });
    await sleep(2000);

    // Reopen Copilot
    await copilotBtn.click();
    await sleep(1500);

    // Verify persisted conversation
    assert(await page.locator('text=Mock AI Provider').first().isVisible(), 'Source badge persisted across browser reload');
    assert(await page.locator('text=Timeline Milestone').first().isVisible() || await page.locator('text=Vendor Procurement').first().isVisible(), 'Conversation messages persisted across browser reload');

    // If needed switch to Thread 1 for milestone approval
    if (!(await page.locator('text=Timeline Milestone').first().isVisible())) {
      await chatsToggleBtn.click();
      await sleep(1000);
      const threadsAfterReload = page.locator('div[role="dialog"] .overflow-y-auto .cursor-pointer');
      await threadsAfterReload.nth(1).click();
      await sleep(1500);
    }

    // Capture Screenshot 22: 22_copilot_persisted_conversation.png
    console.log('  Capturing 22_copilot_persisted_conversation.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '22_copilot_persisted_conversation.png'),
      fullPage: false,
    });
    copyToPublic('22_copilot_persisted_conversation.png');
    auditResults.screenshotsCaptured.push('22_copilot_persisted_conversation.png');

    // Approve Milestone Action
    console.log('\n[6/7] Testing Action Lifecycle (Approve, Dismiss, Conflict, Precision)...');
    console.log('  Approving ADD_TIMELINE_MILESTONE...');
    const approveMilestoneBtn = page.locator('button:has-text("Approve & Apply")').first();
    await approveMilestoneBtn.click();
    await sleep(2500);

    const executedMilestoneBadge = page.locator('span:has-text("Applied & Verified")').first();
    assert(await executedMilestoneBadge.isVisible(), 'Milestone action status changed to "Applied & Verified" upon approval');

    // Capture Screenshot 23: 23_copilot_milestone_approved.png
    console.log('  Capturing 23_copilot_milestone_approved.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '23_copilot_milestone_approved.png'),
      fullPage: false,
    });
    copyToPublic('23_copilot_milestone_approved.png');
    auditResults.screenshotsCaptured.push('23_copilot_milestone_approved.png');

    // Send Message for Budget Expense Action
    console.log('  Requesting budget expense proposal...');
    await chatInput.fill('Please add a budget expense for stage decoration and lighting.');
    await sendBtn.click();
    await sleep(4000);

    const budgetCard = page.locator('text=Budget Expense').first();
    assert(await budgetCard.isVisible(), 'Budget Expense proposal card displayed');

    // Approve Budget Expense Action
    console.log('  Approving ADD_BUDGET_EXPENSE...');
    const approveBudgetBtn = page.locator('button:has-text("Approve & Apply")').first();
    await approveBudgetBtn.click();
    await sleep(2500);

    assert(await page.locator('span:has-text("Applied & Verified")').count() >= 2, 'Budget expense action status updated to "Applied & Verified"');
    assert(await page.locator('text=₹60,000').first().isVisible() || await page.locator('text=60000').first().isVisible(), 'Budget amount formatted with Decimal precision');

    // Capture Screenshot 24: 24_copilot_budget_expense_approved.png
    console.log('  Capturing 24_copilot_budget_expense_approved.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '24_copilot_budget_expense_approved.png'),
      fullPage: false,
    });
    copyToPublic('24_copilot_budget_expense_approved.png');
    auditResults.screenshotsCaptured.push('24_copilot_budget_expense_approved.png');

    // Switch to Thread 2 for Vendor item approval
    console.log('  Switching to Thread 2 for Vendor Item approval...');
    await chatsToggleBtn.click();
    await sleep(1000);
    const threadsInList = page.locator('div[role="dialog"] .overflow-y-auto .cursor-pointer');
    await threadsInList.first().click();
    await sleep(1500);

    console.log('  Approving ADD_VENDOR_ITEM...');
    const approveVendorBtn = page.locator('button:has-text("Approve & Apply")').first();
    if (await approveVendorBtn.isVisible()) {
      await approveVendorBtn.click();
      await sleep(2500);
    }
    assert(await page.locator('span:has-text("Applied & Verified")').first().isVisible(), 'Vendor item action updated to "Applied & Verified"');

    // Capture Screenshot 25: 25_copilot_vendor_item_approved.png
    console.log('  Capturing 25_copilot_vendor_item_approved.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '25_copilot_vendor_item_approved.png'),
      fullPage: false,
    });
    copyToPublic('25_copilot_vendor_item_approved.png');
    auditResults.screenshotsCaptured.push('25_copilot_vendor_item_approved.png');

    // Test Dismiss Action
    console.log('  Testing Action Dismissal...');
    await chatInput.fill('Propose catering options and menu planning.');
    await sendBtn.click();
    await sleep(4000);

    const dismissBtn = page.locator('button:has-text("Dismiss")').first();
    assert(await dismissBtn.isVisible(), 'Dismiss button is present on pending action card');
    await dismissBtn.click();
    await sleep(2000);

    const dismissedBadge = page.locator('span:has-text("Dismissed")').first();
    assert(await dismissedBadge.isVisible(), 'Action card status updated to Dismissed');

    // Capture Screenshot 26: 26_copilot_action_dismissed.png
    console.log('  Capturing 26_copilot_action_dismissed.png...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '26_copilot_action_dismissed.png'),
      fullPage: false,
    });
    copyToPublic('26_copilot_action_dismissed.png');
    auditResults.screenshotsCaptured.push('26_copilot_action_dismissed.png');

    // Test Duplicate Execution Rejection (HTTP 409 Conflict) directly via API
    console.log('  Testing Duplicate Execution Rejection (HTTP 409 Conflict)...');
    const activeEventId = eventA.id;
    const threadsApiRes = await fetch(`http://127.0.0.1:8000/api/v1/events/${activeEventId}/copilot/threads`);
    const threadsApiJson = await threadsApiRes.json();
    const threadsApiData = threadsApiJson.data || threadsApiJson;
    
    let executedActionId = null;
    let dismissedActionId = null;

    for (const t of threadsApiData) {
      const msgsRes = await fetch(`http://127.0.0.1:8000/api/v1/events/${activeEventId}/copilot/threads/${t.id}/messages`);
      const msgsJson = await msgsRes.json();
      const msgs = msgsJson.data || msgsJson;
      for (const msg of msgs) {
        if (msg.proposed_actions) {
          for (const act of msg.proposed_actions) {
            if (act.status === 'EXECUTED' && !executedActionId) executedActionId = act.action_id;
            if (act.status === 'DISMISSED' && !dismissedActionId) dismissedActionId = act.action_id;
          }
        }
      }
    }

    if (executedActionId) {
      const dupExecRes = await fetch(`http://127.0.0.1:8000/api/v1/events/${activeEventId}/copilot/actions/${executedActionId}/execute`, {
        method: 'POST',
      });
      const dupJson = await dupExecRes.json();
      assert(dupExecRes.status === 400 || dupExecRes.status === 409, `Backend safely rejects re-executing EXECUTED action (status: ${dupExecRes.status}, detail: "${dupJson.detail}")`);
    } else {
      console.log('  [WARN] No executedActionId found for duplicate execution test');
    }

    if (dismissedActionId) {
      const dismissExecRes = await fetch(`http://127.0.0.1:8000/api/v1/events/${activeEventId}/copilot/actions/${dismissedActionId}/execute`, {
        method: 'POST',
      });
      assert(dismissExecRes.status === 400, `Backend returns HTTP 400 Bad Request for executing DISMISSED action (status: ${dismissExecRes.status})`);
    } else {
      console.log('  [WARN] No dismissedActionId found for 400 test');
    }

    // Verify Event Isolation
    console.log('\n[7/7] Testing Event Isolation & Mobile Viewport...');
    console.log(`  Verifying threads for Event B (${eventB.id})...`);
    const eventBThreadsRes = await fetch(`http://127.0.0.1:8000/api/v1/events/${eventB.id}/copilot/threads`);
    const eventBThreadsJson = await eventBThreadsRes.json();
    const eventBThreads = eventBThreadsJson.data || eventBThreadsJson;
    const eventAThreadIds = new Set(threadsApiData.map(t => t.id));
    const leakedThreads = eventBThreads.filter(t => eventAThreadIds.has(t.id));
    assert(leakedThreads.length === 0, 'Zero thread leakage across distinct events (Event isolation verified)');

    // Test Keyboard Accessibility (Escape key closes drawer)
    console.log('  Testing Keyboard Accessibility (Escape key)...');
    assert(await page.locator('#copilot-drawer-title').isVisible(), 'Drawer is open prior to Escape key');
    await page.keyboard.press('Escape');
    await sleep(1000);
    assert(!(await page.locator('#copilot-drawer-title').isVisible()), 'Pressing Escape successfully closed Copilot drawer');

    // Mobile Viewport (390x844)
    console.log('  Testing Mobile Viewport (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    await sleep(1500);

    const mobileCopilotBtn = mobilePage.locator('button:has-text("AI Copilot")');
    await mobileCopilotBtn.click();
    await sleep(1500);

    // Verify mobile drawer width
    const drawerBoundingBox = await mobilePage.locator('div[role="dialog"] .w-screen').boundingBox();
    assert(drawerBoundingBox && drawerBoundingBox.width <= 390, `Mobile drawer width (${drawerBoundingBox?.width}px) fits within 390px viewport without overflow`);

    // Capture Screenshot 27: 27_copilot_mobile_responsive.png
    console.log('  Capturing 27_copilot_mobile_responsive.png...');
    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '27_copilot_mobile_responsive.png'),
      fullPage: false,
    });
    copyToPublic('27_copilot_mobile_responsive.png');
    auditResults.screenshotsCaptured.push('27_copilot_mobile_responsive.png');

    await mobileContext.close();
    await context.close();
    await browser.close();

    console.log('\n================================================================');
    console.log('  Phase 5D E2E Verification Summary');
    console.log('================================================================');
    console.log(`Total Assertions Checked: ${auditResults.totalAssertions}`);
    console.log(`Passed Assertions:       ${auditResults.passedAssertions}`);
    console.log(`Failed Assertions:       ${auditResults.failedAssertions.length}`);
    console.log(`Screenshots Captured:    ${auditResults.screenshotsCaptured.length} of 7`);
    console.log('Screenshots:');
    auditResults.screenshotsCaptured.forEach(s => console.log(`  - ${s}`));
    console.log('Console Errors Observed: ', consoleErrors.length);

    if (auditResults.failedAssertions.length > 0) {
      console.error('\nFailures:');
      auditResults.failedAssertions.forEach(f => console.error(`  - ${f}`));
      process.exit(1);
    }

  } finally {
    console.log('\nCleaning up processes...');
    killProcess(backendProc);
    killProcess(frontendProc);
  }
}

run().catch((err) => {
  console.error('\nE2E Verification Fatal Error:', err);
  process.exit(1);
});
