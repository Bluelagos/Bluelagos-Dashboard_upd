/**
 * Development-only server timing.
 *
 * Wrap an expensive server operation in `timed()` and its duration is printed
 * during `next dev`, or whenever BLUE_LAGOS_PERF=1 is set for a production
 * build. In an ordinary production run it compiles down to calling the function
 * — no logging, no measurement, nothing shown to users.
 *
 *   const rows = await timed("getCommunities", () => getCommunities());
 */
const ENABLED =
  process.env.NODE_ENV === "development" || process.env.BLUE_LAGOS_PERF === "1";

export async function timed<T>(label: string, run: () => Promise<T> | T): Promise<T> {
  if (!ENABLED) return run();
  const started = performance.now();
  try {
    return await run();
  } finally {
    const elapsed = performance.now() - started;
    // The point of this module is to print timings during development.
    console.log(`[perf] ${label} ${elapsed.toFixed(1)}ms`);
  }
}

/** Synchronous variant for CPU-bound work. */
export function timedSync<T>(label: string, run: () => T): T {
  if (!ENABLED) return run();
  const started = performance.now();
  try {
    return run();
  } finally {
    const elapsed = performance.now() - started;
    // The point of this module is to print timings during development.
    console.log(`[perf] ${label} ${elapsed.toFixed(1)}ms`);
  }
}
