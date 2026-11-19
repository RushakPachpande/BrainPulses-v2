/** How long a process may drain before it exits. */
export function shutdownDrainMs(nodeEnv: string, role: 'api' | 'worker'): number {
  if (nodeEnv !== 'production') return 1_000;
  // API stays under PM2 kill_timeout 10s. Worker stays under its 30s kill_timeout
  // so an in-flight import or export can finish on reload.
  return role === 'worker' ? 25_000 : 8_000;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Log stray rejections. An uncaught exception starts shutdown so PM2 restarts
 * a clean process instead of continuing in an unknown state.
 */
export function installProcessGuards(label: string, shutdown: (signal: string) => void): void {
  process.on('unhandledRejection', (reason) => {
    console.error(`[${label}] unhandledRejection ${errorMessage(reason)}`);
  });
  process.on('uncaughtException', (err) => {
    console.error(`[${label}] uncaughtException ${errorMessage(err)}`);
    shutdown('uncaughtException');
  });
}
