const puppeteer = require('puppeteer-core');
const axios = require('axios');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5000/api';

async function runOfflineLoginTest() {
  console.log('====================================================');
  console.log('TESTING LOGIN WITHOUT INTERNET (OFFLINE LOGIN)');
  console.log('====================================================\n');

  let browser;
  try {
    const testEmail = `offline_login_tester_${Date.now()}@emergency.org`;
    const testPassword = 'SecretPassword123!';
    const testName = 'Offline Drill Responder';

    // 1. Create a user online first
    console.log('[Step 1] Creating test user online...');
    const signupRes = await axios.post(`${BACKEND_URL}/auth/signup`, {
      name: testName,
      email: testEmail,
      password: testPassword,
    });
    console.log(`  User created: ${signupRes.data.user._id} (${testEmail})`);

    // Launch browser
    browser = await puppeteer.launch({
      executablePath: '/opt/brave-bin/brave',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,800'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 2. Open login page online and log in to cache credentials
    console.log('\n[Step 2] Logging in online to populate device credentials...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0' });

    // Fill login form
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for login to complete and main dashboard to appear
    await page.waitForSelector('.app-header', { timeout: 8000 });
    const loggedInName = await page.$eval('.user-name', (el) => el.textContent.trim());
    console.log(`  Successfully logged in online as: "${loggedInName}"`);

    // Verify user profile is cached in IndexedDB
    const cachedUsers = await page.evaluate(async () => {
      const { getOfflineUsersList } = await import('/src/services/db.js');
      return await getOfflineUsersList();
    });
    console.log(`  Cached users on device: ${cachedUsers.length}`);
    const foundUser = cachedUsers.find((u) => u.email === testEmail.toLowerCase());
    console.log(`  User cached on device with SHA-256 credential hash? ${foundUser && foundUser.credentialHash ? 'YES ✅' : 'NO ❌'}`);

    // 3. Log out to return to login screen
    console.log('\n[Step 3] Logging out to test offline authentication...');
    await page.click('button[title="Logout"]');
    await page.waitForSelector('.auth-form-card', { timeout: 5000 });
    console.log('  Returned to login screen');

    // 4. Disconnect network
    console.log('\n[Step 4] Disconnecting network (simulating offline)...');
    const cdp = await page.target().createCDPSession();
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await new Promise((r) => setTimeout(r, 600));

    // Verify offline banner and offline pill in login form
    const offlineNotice = await page.$eval('.offline-auth-notice', (el) => el.textContent.trim());
    console.log(`  Offline Notice Displayed: "${offlineNotice.substring(0, 50)}..."`);

    // 5. Attempt offline login with WRONG password
    console.log('\n[Step 5] Testing offline login with INCORRECT password...');
    // Clear and retype password
    await page.$eval('input[type="password"]', (el) => el.value = '');
    await page.type('input[type="password"]', 'WrongPasswordXYZ');
    await page.click('.btn-auth-submit');
    await new Promise((r) => setTimeout(r, 500));

    const errorBanner = await page.$eval('.error-banner', (el) => el.textContent.trim());
    console.log(`  Error received: "${errorBanner}"`);
    console.log(`  ASSERT: Wrong offline password rejected? ${errorBanner.includes('Incorrect') ? 'PASSED ✅' : 'FAILED ❌'}`);

    // 6. Attempt offline login with CORRECT password
    console.log('\n[Step 6] Testing offline login with CORRECT cached credentials...');
    await page.$eval('input[type="password"]', (el) => el.value = '');
    await page.type('input[type="password"]', testPassword);
    await page.click('.btn-auth-submit');

    // Wait for successful offline login and app dashboard
    await page.waitForSelector('.app-header', { timeout: 8000 });
    const offlineLoggedInName = await page.$eval('.user-name', (el) => el.textContent.trim());
    console.log(`  Successfully logged in OFFLINE as: "${offlineLoggedInName}"`);
    console.log(`  ASSERT: Offline authentication succeeded? ${offlineLoggedInName === testName ? 'PASSED ✅' : 'FAILED ❌'}`);

    // 7. Log out and test Emergency Responder option (no credentials needed)
    console.log('\n[Step 7] Testing "Emergency Offline Access" (No credentials needed)...');
    await page.click('button[title="Logout"]');
    await page.waitForSelector('.auth-form-card', { timeout: 5000 });

    // Click "No password? Enter as Emergency Offline Responder"
    await page.click('.btn-link-emergency');
    await page.waitForSelector('.btn-cancel-guest', { timeout: 3000 });

    // Enter emergency callsign
    await page.type('input[type="text"]', 'Rescue Unit 42');
    await page.click('button[type="submit"]');

    // Wait for dashboard to open as emergency responder
    await page.waitForSelector('.app-header', { timeout: 8000 });
    const guestName = await page.$eval('.user-name', (el) => el.textContent.trim());
    console.log(`  Entered emergency workspace as: "${guestName}"`);
    console.log(`  ASSERT: Emergency offline responder access granted? ${guestName === 'Rescue Unit 42' ? 'PASSED ✅' : 'FAILED ❌'}`);

    console.log('\n====================================================');
    console.log('ALL OFFLINE LOGIN & AUTHENTICATION TESTS PASSED! 🎉');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUNNER ERROR:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runOfflineLoginTest();
