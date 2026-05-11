import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5500/admin.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(2000);
const url = page.url();
const html = await page.content();
const hasModal = html.includes('modal-livraison');
const hasRedirect = html.includes('login.html') || url.includes('login');
console.log('URL:', url);
console.log('Has modal-livraison:', hasModal);
console.log('Has login redirect:', hasRedirect);
console.log('Body classes:', await page.evaluate(() => document.body.className));
await browser.close();
