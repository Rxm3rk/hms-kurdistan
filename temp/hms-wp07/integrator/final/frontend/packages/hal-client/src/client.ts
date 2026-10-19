/**
 * Chooses the transport: the Tauri shell when the page runs inside it, otherwise no shell, where every call
 * fails closed with `unavailable` / `no-shell` (README, "Fail closed"). The simulator is never chosen on its
 * own; tests and the demo pass it explicitly.
 */
import { isTauri } from '@tauri-apps/api/core';
import type { HalTransport } from './transport.ts';
import { createNoShellTransport, type NoShellTransportOptions } from './transport-none.ts';
import { createTauriTransport, type TauriTransportOptions } from './transport-tauri.ts';

export interface HalClientOptions {
  /** Use this transport (for example the simulator) instead of detecting the shell. */
  readonly transport?: HalTransport;
  /** Whether the shell is present; Tauri's isTauri() by default. */
  readonly shellPresent?: () => boolean;
  readonly tauri?: TauriTransportOptions;
  readonly noShell?: NoShellTransportOptions;
}

export function createHalClient(options: HalClientOptions = {}): HalTransport {
  if (options.transport !== undefined) {
    return options.transport;
  }
  let present: boolean;
  try {
    present = (options.shellPresent ?? isTauri)();
  } catch {
    present = false;
  }
  return present ? createTauriTransport(options.tauri) : createNoShellTransport(options.noShell);
}
