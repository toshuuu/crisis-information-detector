const puppeteer = require('puppeteer-core');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

async function testMobileS24() {
  console.log('====================================================');
  console.log('TESTING MOBILE UI (SAMSUNG GALAXY S24 VIEWPORT)');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    executablePath: '/opt/brave-bin/brave',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Samsung Galaxy S24 exact viewport: 390 x 844 px, DPR: 3.0
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    // Login user
    const email = `s24_test_${Date.now()}@emergency.org`;
    const password = 'Password@123';
    const regRes = await axios.post(`${BACKEND_URL}/api/auth/signup`, {
      name: 'S24 Field Responder',
      email,
      password,
      role: 'citizen'
    });
    const token = regRes.data.token;

    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
    }, token);

    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.app-layout', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('\n--- 1. Viewport & Dimensions Verification ---');
    const headerBox = await page.$eval('.app-header', el => {
      const rect = el.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
    console.log(`  Header height: ${headerBox.height.toFixed(1)}px (Compact: ${headerBox.height <= 52})`);

    const mapBox = await page.$eval('.map-container', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, height: rect.height, width: rect.width, bottom: rect.bottom };
    });
    console.log(`  Map dimensions: ${mapBox.width.toFixed(1)}x${mapBox.height.toFixed(1)}px (Top: ${mapBox.top.toFixed(1)}px)`);

    console.log('\n--- 2. Floating Action Rail & Button Collisions Check ---');
    const locateBox = await page.$eval('.map-rail-btn.btn-rail-locate', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    });
    console.log(`  Locate Me button: [top: ${locateBox.top.toFixed(1)}, bottom: ${locateBox.bottom.toFixed(1)}, left: ${locateBox.left.toFixed(1)}, right: ${locateBox.right.toFixed(1)}] (${locateBox.width.toFixed(1)}x${locateBox.height.toFixed(1)}px)`);

    const offlineMapBox = await page.$eval('.map-rail-btn.btn-rail-offline', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    });
    console.log(`  Offline Map button: [top: ${offlineMapBox.top.toFixed(1)}, bottom: ${offlineMapBox.bottom.toFixed(1)}, left: ${offlineMapBox.left.toFixed(1)}, right: ${offlineMapBox.right.toFixed(1)}] (${offlineMapBox.width.toFixed(1)}x${offlineMapBox.height.toFixed(1)}px)`);

    // Check collision between locate and offline map
    const verticalGap = offlineMapBox.top - locateBox.bottom;
    console.log(`  Vertical gap between Locate & Offline Map: ${verticalGap.toFixed(1)}px`);
    if (verticalGap < 0) {
      throw new Error(`COLLISION DETECTED: Offline Map button overlaps Locate Me button by ${Math.abs(verticalGap)}px!`);
    } else {
      console.log('  ASSERT: Locate Me & Offline Map buttons do NOT collide? PASSED ✅');
    }

    const reportBtnBox = await page.$eval('.btn-floating-report', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    });
    console.log(`  Report Crisis FAB: [top: ${reportBtnBox.top.toFixed(1)}, bottom: ${reportBtnBox.bottom.toFixed(1)}] (${reportBtnBox.width.toFixed(1)}x${reportBtnBox.height.toFixed(1)}px)`);

    console.log('\n--- 3. Collapsible Bottom Sheet Drawer Check ---');
    const sidebarCollapsedBox = await page.$eval('.sidebar', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    console.log(`  Sidebar collapsed height: ${sidebarCollapsedBox.height.toFixed(1)}px`);

    const fabGapAboveSidebar = sidebarCollapsedBox.top - reportBtnBox.bottom;
    console.log(`  Gap between Report FAB and Bottom Drawer: ${fabGapAboveSidebar.toFixed(1)}px`);
    if (fabGapAboveSidebar < 0) {
      throw new Error(`COLLISION: Report FAB overlaps the bottom drawer peek bar by ${Math.abs(fabGapAboveSidebar)}px!`);
    } else {
      console.log('  ASSERT: Report FAB sits cleanly above the bottom drawer peek bar? PASSED ✅');
    }

    // Save screenshot of collapsed state
    await page.screenshot({ path: 'screenshot_s24_collapsed.png' });
    console.log('  Saved screenshot_s24_collapsed.png');

    console.log('\n--- 4. Expanding the Bottom Sheet Drawer ---');
    await page.click('.mobile-drawer-peek-bar');
    await new Promise((r) => setTimeout(r, 400)); // wait for transition

    const sidebarExpandedBox = await page.$eval('.sidebar', el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height, isOpen: el.classList.contains('mobile-drawer-open') };
    });
    console.log(`  Sidebar expanded height: ${sidebarExpandedBox.height.toFixed(1)}px (isOpen: ${sidebarExpandedBox.isOpen})`);
    if (sidebarExpandedBox.height < 400) {
      throw new Error(`Drawer did not expand properly, height is only ${sidebarExpandedBox.height}px`);
    } else {
      console.log('  ASSERT: Drawer expands smoothly to reveal incident list? PASSED ✅');
    }

    // Save screenshot of expanded state
    await page.screenshot({ path: 'screenshot_s24_expanded.png' });
    console.log('  Saved screenshot_s24_expanded.png');

    console.log('\n--- 5. Collapsing the Drawer via Backdrop Tap ---');
    await page.click('.mobile-drawer-backdrop');
    await new Promise((r) => setTimeout(r, 400));

    const isCollapsedAgain = await page.$eval('.sidebar', el => el.classList.contains('mobile-drawer-collapsed'));
    console.log(`  Sidebar collapsed again after backdrop tap: ${isCollapsedAgain}`);
    if (!isCollapsedAgain) {
      throw new Error('Backdrop tap did not collapse the drawer');
    } else {
      console.log('  ASSERT: Tapping backdrop collapses drawer back to map? PASSED ✅');
    }

    console.log('\n====================================================');
    console.log('SAMSUNG GALAXY S24 MOBILE UI VERIFICATION PASSED! 📱🎉');
    console.log('====================================================');

  } finally {
    await browser.close();
  }
}

testMobileS24().catch(err => {
  console.error('\n❌ S24 Test Failed:', err);
  process.exit(1);
});
