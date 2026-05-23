/** Coalesce rapid UI updates so streaming does not freeze the main thread. */
export function createUiBatcher(flush: () => void, intervalMs = 200) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      if (timer != null) return;
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, intervalMs);
    },
    flushNow() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
  };
}

export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
