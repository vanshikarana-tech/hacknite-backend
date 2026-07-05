export interface PlaywrightResult {
  screenshotBase64: string;
  domSnapshot: string;
}

/**
 * Fetches a URL and returns its DOM snapshot.
 * In production (Railway), Playwright/Chromium is not available so we use
 * Node.js native fetch. Screenshot is left empty — visual AI analysis is
 * skipped and only code-based WCAG analysis runs.
 *
 * For local development with Playwright installed, set USE_PLAYWRIGHT=true
 * in your .env to enable screenshot capture.
 */
export async function capturePageData(url: string, timeoutMs = 30000): Promise<PlaywrightResult> {
  if (process.env.USE_PLAYWRIGHT === 'true') {
    return captureWithPlaywright(url, timeoutMs);
  }
  return fetchDom(url, timeoutMs);
}

async function fetchDom(url: string, timeoutMs: number): Promise<PlaywrightResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      const err = new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
      (err as NodeJS.ErrnoException & { status?: number }).status = 422;
      throw err;
    }

    const html = await response.text();
    return { screenshotBase64: '', domSnapshot: html };
  } catch (err: unknown) {
    if ((err as Error).name === 'AbortError') {
      const timeoutErr = new Error('Page load timed out after 30 seconds');
      (timeoutErr as NodeJS.ErrnoException & { status?: number }).status = 422;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function captureWithPlaywright(url: string, timeoutMs: number): Promise<PlaywrightResult> {
  // Dynamically import so production build doesn't fail if playwright is absent
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (compatible; AccessibilityChecker/1.0)',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const screenshotBase64 = screenshotBuffer.toString('base64');
    // Use page.content() instead of page.evaluate(() => document...) to avoid
    // TypeScript DOM lib requirement in the backend tsconfig (TS2584)
    const domSnapshot = await page.content();

    await context.close();
    return { screenshotBase64, domSnapshot };
  } finally {
    await browser.close();
  }
}
