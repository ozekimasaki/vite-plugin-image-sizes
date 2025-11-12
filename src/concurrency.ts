export function createSemaphore(maxConcurrency: number) {
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  async function acquire(): Promise<void> {
    if (activeCount < Math.max(1, maxConcurrency)) {
      activeCount += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
    activeCount += 1;
  }

  function release(): void {
    activeCount = Math.max(0, activeCount - 1);
    const next = waitQueue.shift();
    if (next) next();
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


