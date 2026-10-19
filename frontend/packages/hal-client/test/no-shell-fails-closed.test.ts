/**
 * UnitTest:no-shell-fails-closed (docs/specs/modules/design-system.md §9; slice S8; §3.5 fail closed).
 * With no shell, every call, hal.capabilities, hal.id.read and hal.pay.request included, returns
 * `unavailable` / `no-shell` with an audit ID, and hal-client writes its own audit record for it, which
 * holds nothing from the request.
 */
import { describe, expect, it } from 'vitest';
import {
  CALL_NAMES,
  isSubscriptionCall,
  parseResult,
  UUID7_PATTERN,
  type AuditRecord,
  type CallName,
  type HalRequest,
  type RequestCallName,
} from '../src/contract.ts';
import { createHalClient } from '../src/client.ts';
import type { HalTransport } from '../src/transport.ts';
import { createNoShellTransport } from '../src/transport-none.ts';
import { ajvErrors, fixtureFiles, okRequest, validateAuditRecord, validateExchange } from './support.ts';

const NO_SHELL_ERROR = {
  kind: 'unavailable',
  reason: 'no-shell',
  retryable: false,
  outcomeUnknown: false,
  messageKey: 'hal.error.unavailable',
} as const;

/** Calls one HAL call through a transport with a well-formed request; events are counted. */
async function callAny(transport: HalTransport, call: CallName, events: unknown[]) {
  const request = okRequest(call);
  if (isSubscriptionCall(call)) {
    const subscription = await transport.subscribe(call, request, (event) => events.push(event));
    return subscription.result;
  }
  return transport.call(call, request as HalRequest<RequestCallName>);
}

function recordingTransport() {
  const records: AuditRecord[] = [];
  const transport = createNoShellTransport({
    sessionRef: () => 'SYN-SESSION-0001',
    audit: (record) => records.push(record),
  });
  return { transport, records };
}

describe('no-shell-fails-closed', () => {
  it.each(CALL_NAMES)(
    '%s returns unavailable / no-shell with an audit ID and its own audit record',
    async (call) => {
      const { transport, records } = recordingTransport();
      const events: unknown[] = [];
      const result = await callAny(transport, call, events);

      expect(result).toStrictEqual({
        ok: false,
        error: NO_SHELL_ERROR,
        auditId: result.auditId,
      });
      expect(result.auditId).toMatch(UUID7_PATTERN);
      expect(parseResult(call, result)).not.toBeNull();
      expect(events).toHaveLength(0);

      expect(records).toHaveLength(1);
      const [record] = records;
      expect(record?.auditId).toBe(result.auditId);
      expect(validateAuditRecord(record), ajvErrors(validateAuditRecord)).toBe(true);
      expect(record).toMatchObject({ writtenBy: 'hal-client', call, outcome: 'error', workstationId: null });

      // The exchange is a valid contract exchange, as the no-shell fixtures are.
      const exchange = {
        fixture: `${call}.unavailable.no-shell`,
        provenance: 'synthetic',
        description: 'A no-shell refusal recorded by the test.',
        contractVersion: 1,
        call,
        request: okRequest(call),
        response: result,
        audit: record,
      };
      expect(validateExchange(exchange), ajvErrors(validateExchange)).toBe(true);

      // Nothing from the request reaches the record (H13): no device, content, amount or reference.
      const recordText = JSON.stringify(record);
      for (const value of Object.values(okRequest(call))) {
        if (typeof value === 'string' && value.length > 1) {
          expect(recordText).not.toContain(value);
        }
      }
    },
  );

  it.each(['hal.id.read', 'hal.pay.request'] as const)(
    '%s answers as its no-shell fixture, apart from the audit ID and the time',
    async (call) => {
      const found = fixtureFiles.find(({ fixture }) => fixture.fixture === `${call}.unavailable.no-shell`);
      expect(found).toBeDefined();
      const fixture = found?.fixture;
      if (fixture === undefined) {
        return;
      }
      const { transport, records } = recordingTransport();
      const result = await transport.call(call, fixture.request as HalRequest<typeof call>);
      expect(result).toStrictEqual({ ...fixture.response, auditId: result.auditId });
      expect(records[0]).toStrictEqual({ ...fixture.audit, auditId: result.auditId, at: records[0]?.at });
    },
  );

  it('gives every refusal its own audit ID', async () => {
    const { transport } = recordingTransport();
    const ids = new Set<string>();
    for (let round = 0; round < 5; round += 1) {
      for (const call of CALL_NAMES) {
        ids.add((await callAny(transport, call, [])).auditId);
      }
    }
    expect(ids.size).toBe(5 * CALL_NAMES.length);
  });

  it('is what createHalClient chooses outside the shell, and when shell detection fails', async () => {
    const detected = createHalClient();
    expect(detected.kind).toBe('none');
    const throwing = createHalClient({
      shellPresent: () => {
        throw new Error('no shell probe');
      },
    });
    expect(throwing.kind).toBe('none');
    for (const transport of [detected, throwing]) {
      for (const call of CALL_NAMES) {
        const result = await callAny(transport, call, []);
        expect(result.ok ? null : result.error).toStrictEqual(NO_SHELL_ERROR);
      }
    }
  });

  it('still refuses when the audit sink or the session reference fails, and never records a malformed session', async () => {
    const records: AuditRecord[] = [];
    const failing = createNoShellTransport({
      audit: () => {
        throw new Error('audit sink down');
      },
      sessionRef: () => {
        throw new Error('no session');
      },
    });
    const result = await failing.call(
      'hal.print.label',
      okRequest('hal.print.label') as HalRequest<'hal.print.label'>,
    );
    expect(result.ok ? null : result.error).toStrictEqual(NO_SHELL_ERROR);

    const malformed = createNoShellTransport({
      sessionRef: () => 'not an opaque id',
      audit: (r) => records.push(r),
    });
    await malformed.call('hal.capabilities', {});
    expect(records[0]?.sessionRef).toBeNull();
    expect(validateAuditRecord(records[0]), ajvErrors(validateAuditRecord)).toBe(true);
  });

  it('still refuses, with a valid record, when the clock or the ID source fails', async () => {
    const sources = [
      { now: () => new Date(Number.NaN) },
      {
        now: () => {
          throw new Error('no clock');
        },
      },
      {
        newId: () => {
          throw new Error('no ID source');
        },
      },
      { newId: () => 'not-a-uuid' },
    ];
    for (const source of sources) {
      const records: AuditRecord[] = [];
      const transport = createNoShellTransport({ ...source, audit: (record) => records.push(record) });
      // Not even a synchronous exception escapes call() or subscribe().
      let pending: Promise<unknown> | undefined;
      expect(() => {
        pending = transport.call('hal.kiosk.lock', { state: 'locked' });
      }).not.toThrow();
      await pending;
      expect(() => {
        pending = transport.subscribe('hal.auth.onBadge', {}, () => undefined);
      }).not.toThrow();
      await pending;
      records.length = 0;
      for (const call of CALL_NAMES) {
        const result = await callAny(transport, call, []);
        expect(result.ok ? null : result.error).toStrictEqual(NO_SHELL_ERROR);
        expect(result.auditId).toMatch(UUID7_PATTERN);
      }
      expect(records).toHaveLength(CALL_NAMES.length);
      for (const record of records) {
        expect(validateAuditRecord(record), ajvErrors(validateAuditRecord)).toBe(true);
      }
    }
  });

  it('releases no blob and opens no subscription', async () => {
    const { transport } = recordingTransport();
    await expect(
      transport.releaseBlob('hal-blob:019a3c00-0000-7000-8000-000000000099'),
    ).resolves.toBeUndefined();
    const events: unknown[] = [];
    const subscription = await transport.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
    subscription.close();
    expect(subscription.result.ok).toBe(false);
    expect(events).toHaveLength(0);
  });
});
