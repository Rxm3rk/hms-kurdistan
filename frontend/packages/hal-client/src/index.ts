/**
 * @hms/hal-client: the typed client for the workstation shell's hardware abstraction layer, HAL contract
 * v1 (docs/specs/hal/; OQ-140, OQ-150, OQ-157). Every call returns {ok, value | error, auditId}; with no
 * shell every call returns unavailable / no-shell.
 */
export * from './contract.ts';
export * from './transport.ts';
export * from './transport-none.ts';
export * from './transport-tauri.ts';
export * from './transport-sim.ts';
export * from './capture.ts';
export * from './client.ts';
export { uuid7 } from './uuid7.ts';
