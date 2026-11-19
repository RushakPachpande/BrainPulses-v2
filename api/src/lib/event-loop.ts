import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

/** Mean event-loop delay in milliseconds. */
export function eventLoopLagMs(): number {
  const mean = histogram.mean;
  if (!Number.isFinite(mean)) return 0;
  return Math.round(mean / 1e6);
}
