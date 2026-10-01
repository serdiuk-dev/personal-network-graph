export const RETURN_IDLE_MS = 3000;
type Clock = {
  now: () => number;
  set: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clear: (handle: ReturnType<typeof setTimeout>) => void;
};

// The deadline is measured from the last drag movement. Holding/hovering the
// inspected node blocks return, but does not restart an already elapsed deadline.
export function createGraphReturn(onReturn: () => void, clock: Clock = {
  now: () => performance.now(),
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle),
}) {
  let deadline: number | null = null;
  let held = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  function clearTimer() {
    if (timer !== undefined) clock.clear(timer);
    timer = undefined;
  }
  function schedule() {
    clearTimer();
    if (disposed || held || deadline === null) return;
    timer = clock.set(() => {
      timer = undefined;
      if (disposed || held || deadline === null) return;
      deadline = null;
      onReturn();
    }, Math.max(0, deadline - clock.now()));
  }
  return {
    moved() { if (!disposed) { deadline = clock.now() + RETURN_IDLE_MS; schedule(); } },
    hold(value: boolean) { if (held !== value) { held = value; schedule(); } },
    cancel() { clearTimer(); deadline = null; },
    dispose() { disposed = true; clearTimer(); deadline = null; },
  };
}
