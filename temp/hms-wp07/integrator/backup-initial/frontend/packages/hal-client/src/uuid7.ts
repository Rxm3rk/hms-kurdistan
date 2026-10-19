/**
 * UUIDv7 identifiers (RFC 9562; BUILD-PROMPT.md §7) for the audit records and handles hal-client creates
 * itself: its own no-shell refusals and the simulator's results.
 */
import type { Uuid7 } from './contract.ts';

/** Random bytes; crypto.getRandomValues in the browser and in Node.js. */
export type RandomBytes = (length: number) => Uint8Array;

const defaultRandomBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/**
 * A UUIDv7 for the given Unix time in milliseconds: 48 bits of time, the version, 74 random bits and the
 * variant, in lower-case canonical form.
 */
export function uuid7(unixMs: number = Date.now(), randomBytes: RandomBytes = defaultRandomBytes): Uuid7 {
  if (!Number.isSafeInteger(unixMs) || unixMs < 0 || unixMs > 0xffff_ffff_ffff) {
    throw new RangeError('uuid7: the time is not a 48-bit count of milliseconds');
  }
  const bytes = new Uint8Array(16);
  bytes.set(randomBytes(10), 6);
  let time = unixMs;
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
