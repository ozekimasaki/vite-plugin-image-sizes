/**
 * 同時実行数を上限で待つセマフォ。
 * 解放時は待ち行列へスロットを直接渡し、上限を超えない。
 */
export function createSemaphore(maxConcurrency: number) {
  const max = Math.max(1, maxConcurrency);
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (activeCount < max) {
      activeCount += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }

  function release(): void {
    const next = waitQueue.shift();
    if (next) {
      next();
      return;
    }
    activeCount = Math.max(0, activeCount - 1);
  }

  async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  return { withLimit };
}
