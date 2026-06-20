import { EventEmitter } from 'events';

class ScrapeEventManager extends EventEmitter {
  constructor() {
    super();
    // Keyed by numeric productId: { inProgress: boolean, currentAttempt: number, maxAttempts: number, attempts: [], startTime: number }
    this.activeScrapes = new Map();
  }

  startScrape(productId) {
    const numId = Number(productId);
    const state = {
      productId: numId,
      inProgress: true,
      currentAttempt: 1,
      maxAttempts: 3,
      attempts: [],
      startTime: Date.now(),
    };
    this.activeScrapes.set(numId, state);
    this.emit(`scrape:${numId}`, { type: 'scrape_start', data: state });
    return state;
  }

  notifyAttemptStart(productId, attempt, maxAttempts = 3) {
    const numId = Number(productId);
    let state = this.activeScrapes.get(numId);
    if (!state) {
      state = {
        productId: numId,
        inProgress: true,
        currentAttempt: attempt,
        maxAttempts,
        attempts: [],
        startTime: Date.now(),
      };
      this.activeScrapes.set(numId, state);
    } else {
      state.currentAttempt = attempt;
      state.maxAttempts = maxAttempts;
    }

    this.emit(`scrape:${numId}`, {
      type: 'attempt_start',
      data: {
        productId: numId,
        attempt,
        maxAttempts,
      },
    });
  }

  notifyAttemptComplete(productId, attemptData, nextRetryDelayMs = 0) {
    const numId = Number(productId);
    const state = this.activeScrapes.get(numId);
    if (state) {
      state.attempts.push(attemptData);
      state.nextRetryDelayMs = nextRetryDelayMs;
    }

    this.emit(`scrape:${numId}`, {
      type: 'attempt_complete',
      data: {
        productId: numId,
        attempt: attemptData.attempt,
        status: attemptData.status,
        detail: attemptData.detail,
        duration_ms: attemptData.duration_ms,
        nextRetryDelayMs,
        attempts: state ? state.attempts : [attemptData],
      },
    });
  }

  finishScrape(productId, finalResult) {
    const numId = Number(productId);
    const state = this.activeScrapes.get(numId);

    const completionData = {
      productId: numId,
      success: finalResult.success,
      price: finalResult.price || null,
      stock: finalResult.stock || null,
      error: finalResult.error || null,
      attempts: finalResult.attempts || (state ? state.attempts : []),
      duration_ms: state ? Date.now() - state.startTime : null,
    };

    this.emit(`scrape:${numId}`, {
      type: 'scrape_complete',
      data: completionData,
    });

    this.activeScrapes.delete(numId);
    return completionData;
  }

  getActiveScrape(productId) {
    return this.activeScrapes.get(Number(productId)) || null;
  }

  isScrapeInProgress(productId) {
    const state = this.activeScrapes.get(Number(productId));
    return Boolean(state && state.inProgress);
  }
}

export const scrapeEventManager = new ScrapeEventManager();
export default scrapeEventManager;
