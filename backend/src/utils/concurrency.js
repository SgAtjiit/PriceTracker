/**
 * Runs an async worker function across an array of items with a fixed concurrency limit.
 *
 * @template T, R
 * @param {T[]} items - Items to process
 * @param {number} limit - Maximum number of concurrent workers
 * @param {(item: T) => Promise<R>} worker - Async worker function applied to each item
 * @returns {Promise<R[]>} - Preserves index order matching the input items array
 */
export async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, next));
  return results;
}

/**
 * Shared in-memory Semaphore to enforce a global browser concurrency cap (e.g. max 2 browsers).
 */
export class Semaphore {
  constructor(max = 2) {
    this.max = max;
    this.count = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.count < this.max) {
      this.count++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
  }

  release() {
    this.count--;
    if (this.queue.length > 0) {
      this.count++;
      const next = this.queue.shift();
      next();
    }
  }

  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const globalScrapeSemaphore = new Semaphore(2);

export default runWithConcurrency;
