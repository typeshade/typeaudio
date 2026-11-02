// What the clock of a run can resolve: the smallest step between two readings of
// `performance.now()`, which a browser coarsens unless the page is cross-origin isolated.

/** The smallest positive step `performance.now()` takes, in milliseconds, over many readings. */
export function clockStep(): number {
  let step = Infinity;
  let last = performance.now();
  for (let i = 0; i < 200_000; i++) {
    const now = performance.now();
    if (now > last) {
      step = Math.min(step, now - last);
      last = now;
    }
  }
  return step;
}
