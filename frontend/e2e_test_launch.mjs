import { chromium } from 'playwright';
import fs from 'fs';

async function testLaunch() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const execPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log(`Using browser executable: ${execPath}`);
  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent('<h1>Integration Test Launch Successful</h1>');
  console.log('Page content rendered successfully');
  await browser.close();
  console.log('Browser closed cleanly');
}

testLaunch().catch(console.error);

