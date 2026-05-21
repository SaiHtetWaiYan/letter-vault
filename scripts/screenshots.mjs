import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../docs/screenshots');
const BASE = 'https://letter-vault.saihtet.dev';

const sleep = ms => new Promise(r => setTimeout(r, ms));

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1530, height: 900, deviceScaleFactor: 2 },
});

async function shot(page, filename) {
  await sleep(900);
  await page.screenshot({ path: join(OUT, filename), fullPage: false });
  console.log('✓', filename);
}

const page = await browser.newPage();

// ── 01: Auth page — Recipient tab ─────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle2' });
await shot(page, '01-auth.png');

// ── 02: Auth page — Sign in tab ───────────────────────────────────────────────
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sign in')?.click();
});
await sleep(400);
await shot(page, '02-auth-signin.png');

// ── 03: Dashboard — Sections tab ──────────────────────────────────────────────
await page.waitForSelector('input[type="email"]');
await page.type('input[type="email"]', 'testator@example.com');
await page.type('input[type="password"]', 'writer123');
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign in →'))?.click();
});
await sleep(2500);
await shot(page, '03-dashboard.png');

// ── 04: Dashboard — Recipients tab ────────────────────────────────────────────
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b => /Recipients/i.test(b.textContent))?.click();
});
await sleep(500);
await shot(page, '04-recipients.png');

// ── 05: New section form ───────────────────────────────────────────────────────
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New section'))?.click();
});
await sleep(800);
await shot(page, '05-new-section.png');

// ── 06: Reader portal — sign in as alice ──────────────────────────────────────
await page.evaluate(() => {
  localStorage.clear();
  document.cookie.split(';').forEach(c => {
    document.cookie = c.split('=')[0].trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
  });
});
await page.goto(BASE, { waitUntil: 'networkidle2' });
await sleep(600);
// Fill recipient name and passcode
const inputs = await page.$$('input');
await inputs[0]?.type('alice');
await inputs[1]?.type('alpha');
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent.includes('Confirm') || b.textContent.includes('Open')
  )?.click();
});
await sleep(3000);
await shot(page, '06-reader-portal.png');

await browser.close();
console.log('\n✓ All screenshots saved to docs/screenshots/');
