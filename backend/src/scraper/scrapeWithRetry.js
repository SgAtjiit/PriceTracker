import scrapeProductPrice from './scrapeSingle.js';
import scrapeEventManager from './scrapeEventManager.js';
import { recordSingleAttempt, recordPriceHistory } from './recordScrapeResult.js';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 3000; // first retry waits 3s, then grows exponentially

function getBackoffDelay(attempt) {
    // attempt 1 fails -> wait before attempt 2, etc. Exponential: 3s, 9s, 27s...
    return BASE_DELAY_MS * Math.pow(3, attempt - 1);
}

export async function scrapeProductWithRetry(productId, headless = true) {
    const attempts = [];
    const numId = Number(productId);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        // Emit attempt start event so connected clients see current running attempt immediately
        scrapeEventManager.notifyAttemptStart(numId, attempt, MAX_ATTEMPTS);

        const attemptStart = Date.now();
        const result = await scrapeProductPrice(numId, headless);
        const duration_ms = Date.now() - attemptStart;

        if (result.success) {
            const attemptData = {
                attempt,
                status: attempt === 1 ? 'success' : 'retried',
                detail: `Success on attempt ${attempt}`,
                duration_ms,
            };
            attempts.push(attemptData);

            // Immediately persist attempt into scrape_log and price into price_history
            await recordSingleAttempt(numId, attemptData);
            await recordPriceHistory(numId, result.price, result.stock);

            // Notify event manager of successful attempt completion
            scrapeEventManager.notifyAttemptComplete(numId, attemptData, 0);

            return {
                success: true,
                productId: numId,
                price: result.price,
                stock: result.stock,
                attempts,
            };
        }

        // failed this attempt
        const attemptData = {
            attempt,
            status: 'failed',
            detail: result.error || 'Unknown scrape error',
            duration_ms,
        };
        attempts.push(attemptData);

        // Immediately persist failed attempt into scrape_log
        await recordSingleAttempt(numId, attemptData);

        if (attempt < MAX_ATTEMPTS) {
            const delay = getBackoffDelay(attempt);
            console.log(`Product ${numId}: attempt ${attempt} failed (${result.error}), retrying in ${delay}ms...`);
            scrapeEventManager.notifyAttemptComplete(numId, attemptData, delay);
            await new Promise((r) => setTimeout(r, delay));
        } else {
            scrapeEventManager.notifyAttemptComplete(numId, attemptData, 0);
        }
    }

    return {
        success: false,
        productId: numId,
        error: attempts[attempts.length - 1].detail,
        attempts,
    };
}