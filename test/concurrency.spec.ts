import { describe, it, expect } from 'vitest';
import { createSemaphore } from '../src/concurrency.js';

describe('createSemaphore', () => {
  it('does not exceed the concurrency limit', async () => {
    const limit = 2;
    const semaphore = createSemaphore(limit);
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 12 }, async () => {
        await semaphore.withLimit(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        });
      }),
    );

    expect(peak).toBeLessThanOrEqual(limit);
    expect(peak).toBe(limit);
  });
});
