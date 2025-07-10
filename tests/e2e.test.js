const puppeteer = require('puppeteer');
const path = require('path');

const extensionPath = path.resolve(__dirname, '../');

// Increase the timeout for all tests in this file
jest.setTimeout(30000);

describe('CaptureX E2E Tests', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    try {
      browser = await puppeteer.launch({
        headless: false,
        executablePath: '/Users/zhangboxian/.cache/puppeteer/chrome/mac-138.0.7204.92/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      });

      const extensionTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker',
        { timeout: 10000 } // Wait for 10 seconds
      );
      const partialExtensionUrl = extensionTarget.url() || '';
      [, , extensionId] = partialExtensionUrl.split('/');

    } catch (error) {
      console.error('Failed to launch browser:', error);
    }
  });

  beforeEach(async () => {
    // Create a new page for each test
    page = await browser.newPage();
  });

  afterEach(async () => {
    // Close the page after each test
    await page.close();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('TC-E2E-001: Extension popup should open and display correct title', async () => {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.waitForSelector('h1.title');
    const title = await page.$eval('h1.title', el => el.textContent);
    expect(title).toBe('CaptureX');
  });

  test('TC-E2E-002: Should start capture mode when clicking the button', async () => {
    // First, go to the target page
    await page.goto('https://example.com', { waitUntil: 'load' });

    // Open the popup in a new page or tab to simulate user clicking the extension icon
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await popupPage.waitForSelector('.ratio-btn');

    // Click the 1.75:1 ratio button in the popup
    await popupPage.click('button[data-ratio="1.75"]');

    // Click the start capture button in the popup
    await popupPage.click('#start-capture');

    // Close the popup page as it would be in a real scenario
    await popupPage.close();

    // Switch back to the target page and check for the overlay
    await page.bringToFront();
    const overlay = await page.waitForSelector('.screencut-overlay', { timeout: 5000 });
    expect(overlay).toBeDefined();
  });
});
