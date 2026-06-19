import { runAllScrapes } from '../scraper/runAllScrapes.js';
import { scrapeAndRecordProduct } from '../scraper/scrapeAndRecordProduct.js';
import scrapeEventManager from '../scraper/scrapeEventManager.js';

// 5. Trigger scraper for all tracked products (protected by CRON_SECRET)
export async function runScrapeCron(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'];
  if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond immediately so cron-job.org doesn't time out waiting
  res.status(202).json({ message: 'Scrape run started' });

  // Run in the background; errors are logged, not sent to the (already-responded) client
  runAllScrapes()
    .then((result) => {
      if (result?.skipped) {
        console.log('Cron scrape run skipped: another batch scrape is already running.');
      }
    })
    .catch((err) => {
      console.error('Scrape run failed unexpectedly:', err.message);
    });
}

// 8. On-demand single product scrape
export async function runSingleScrape(req, res) {
  try {
    const { productId } = req.params;
    const numId = Number(productId);
    if (scrapeEventManager.getActiveScrape(numId)) {
      return res.status(409).json({ error: 'Scrape already in progress' });
    }
    const result = await scrapeAndRecordProduct(numId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to scrape product', detail: err.message });
  }
}

// 8b. Server-Sent Events (SSE) endpoint streaming real-time attempt progress
export function streamScrapeProgress(req, res) {
  const { productId } = req.params;
  const numId = Number(productId);

  // Set standard headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const activeState = scrapeEventManager.getActiveScrape(numId);
  if (activeState) {
    sendEvent('status', {
      inProgress: true,
      productId: numId,
      currentAttempt: activeState.currentAttempt,
      maxAttempts: activeState.maxAttempts,
      attempts: activeState.attempts,
      nextRetryDelayMs: activeState.nextRetryDelayMs || 0,
    });
  } else {
    sendEvent('status', { inProgress: false, productId: numId });
  }

  // If not currently in progress, wait up to 8 seconds in case background scrape starts right now
  let idleTimeout = null;
  if (!activeState) {
    idleTimeout = setTimeout(() => {
      cleanup();
      res.end();
    }, 8000);
  }

  const eventName = `scrape:${numId}`;
  const handleEvent = (event) => {
    if (idleTimeout) {
      clearTimeout(idleTimeout);
      idleTimeout = null;
    }
    sendEvent(event.type, event.data);
    if (event.type === 'scrape_complete') {
      cleanup();
      res.end();
    }
  };

  scrapeEventManager.on(eventName, handleEvent);

  const cleanup = () => {
    if (idleTimeout) clearTimeout(idleTimeout);
    scrapeEventManager.off(eventName, handleEvent);
  };

  req.on('close', cleanup);
}

