import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { globalScrapeSemaphore } from '../utils/concurrency.js';

dotenv.config();

const STORE_BASE = 'https://demo.inelabteamdev.com';

async function scrapeProductPrice(productId, headless = true) {
    return globalScrapeSemaphore.run(async () => {
        let browser = null;
        try {
            browser = await chromium.launch({
                headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                ],
            });
            const page = await browser.newPage();

            await page.goto(`${STORE_BASE}/product/${productId}`, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
            });

            try {
                const acceptBtn = page.getByRole('button', { name: /accept/i });
                await acceptBtn.waitFor({ state: 'visible', timeout: 5000 });
                await acceptBtn.click();
                console.log('Cookie consent accepted');
                await page.waitForTimeout(500);
            } catch {
                console.log('No cookie consent modal appeared');
            }

            const earlyText = await page.innerText('body');
            if (/couldn't load this product/i.test(earlyText)) {
                throw new Error(`Product page error: ${earlyText.match(/error:.*/i)?.[0] || 'unknown'}`);
            }

            const revealBtn = page.getByRole('button', { name: /reveal price/i });
            try {
                await revealBtn.waitFor({ state: 'visible', timeout: 15000 });
            } catch {
                throw new Error('STRUCTURE_CHANGE: Reveal button never appeared within 15s');
            }

            const box = await revealBtn.boundingBox();
            if (!box) throw new Error('STRUCTURE_CHANGE: Could not get reveal button position');

            // Approach in a natural arc from outside the button first
            await page.mouse.move(box.x - 80, box.y - 80);
            await page.waitForTimeout(80);

            // 8-10 distinct micro-movements WITHIN the button's bounding box,
            // simulating natural human jitter rather than a single teleport
            const movesInsideButton = 9;
            for (let i = 0; i < movesInsideButton; i++) {
                const randX = box.x + Math.random() * box.width;
                const randY = box.y + Math.random() * box.height;
                await page.mouse.move(randX, randY, { steps: 3 });
                await page.waitForTimeout(60 + Math.random() * 60);
            }

            // Settle at the visual center
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });

            console.log('Completed micro-movement hover sequence, dwelling before click...');
            await page.waitForTimeout(650);

            // Confirm the hover triggered backend chain
            try {
                await page.waitForResponse(
                    (res) => res.url().includes('/api/layout') || res.url().includes('/api/challenge'),
                    { timeout: 8000 }
                );
                console.log('Backend chain triggered (layout/challenge request seen)');
            } catch {
                console.log('Warning: no layout/challenge request detected — proceeding anyway');
            }

            const start = Date.now();
            let enabled = false;
            while (Date.now() - start < 60000) {
                enabled = await revealBtn.evaluate((node) => !node.disabled);
                if (enabled) break;
                await page.waitForTimeout(500);
            }

            if (!enabled) {
                if (process.env.DEBUG_SCREENSHOTS === 'true') {
                    await page.screenshot({ path: `debug-not-enabled-${productId}.png` }).catch(() => { });
                }
                throw new Error('Reveal button never became enabled within 60s');
            }
            console.log(`Button enabled after ~${Date.now() - start}ms`);

            await revealBtn.click();

            // Wait for price text to render post-click
            try {
                await page.waitForFunction(() => {
                    const text = document.body.innerText;
                    return /₹[\d,]+/.test(text) && !/updating/i.test(text);
                }, { timeout: 30000 });
            } catch {
                throw new Error('STRUCTURE_CHANGE: Price element did not render after reveal click within 30s');
            }

            // Scope extraction to product detail container near reveal button; fallback to body
            const scopedCandidate = page.locator('main, [class*="product"], [data-testid*="product"], article').first();
            const hasScoped = (await scopedCandidate.count().catch(() => 0)) > 0;
            const scopedEl = hasScoped ? scopedCandidate : page.locator('body');

            // Read price twice ~500ms apart; accept only if both reads match (retry up to 3 times)
            let confirmedPrice = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                const text1 = await scopedEl.innerText().catch(() => page.innerText('body'));
                const m1 = text1.match(/₹\s*([\d,]+)/);
                const p1 = m1 ? parseInt(m1[1].replace(/,/g, ''), 10) : null;

                await page.waitForTimeout(500);

                const text2 = await scopedEl.innerText().catch(() => page.innerText('body'));
                const m2 = text2.match(/₹\s*([\d,]+)/);
                const p2 = m2 ? parseInt(m2[1].replace(/,/g, ''), 10) : null;

                if (p1 && p2 && p1 === p2 && p1 > 0) {
                    confirmedPrice = p1;
                    break;
                }
            }

            if (!confirmedPrice || confirmedPrice <= 0) {
                throw new Error('STRUCTURE_CHANGE: Price element could not be located or read stably');
            }

            // Extract stock status: exclude phrases like "notify me when back in stock", scope to product text
            const containerText = await scopedEl.innerText().catch(() => page.innerText('body'));
            const cleanedStockText = containerText.replace(/notify\s+me\s+when\s+back\s+in\s+stock/gi, '');
            const stockMatch = cleanedStockText.match(/\b(only\s+\d+\s+left|in\s+stock|out\s+of\s+stock|\d+\s+left)\b/i);
            const stock = stockMatch ? stockMatch[0].trim() : 'unknown';

            return { success: true, productId, price: confirmedPrice, stock };
        } catch (err) {
            if (process.env.DEBUG_SCREENSHOTS === 'true' && browser) {
                try {
                    const pages = browser.contexts?.()[0]?.pages?.() || [];
                    if (pages.length > 0) {
                        await pages[0].screenshot({ path: `debug-error-${productId}.png` }).catch(() => { });
                    }
                } catch { }
            }
            return { success: false, productId, error: err.message };
        } finally {
            if (browser) {
                await browser.close().catch(() => { });
            }
        }
    });
}

export default scrapeProductPrice;