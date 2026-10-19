/**
 * The simulated shell: every answer and audit record it produces is a valid contract exchange, hal.id.read
 * and hal.pay.request return unavailable / not-implemented with a shell (KA-027), barcode reads reach only
 * the focused window, and badge events carry no credential. Also the UUIDv7 generator, and the message
 * keys the client emits, which must all be in the @hms/i18n source catalogue.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAPTURE_DISCARDED_MESSAGE_KEY } from '../src/capture.ts';
import {
  CALL_NAMES,
  ERROR_REASONS,
  isSubscriptionCall,
  MESSAGE_KEY_BY_KIND,
  OUTCOME_UNKNOWN_MESSAGE_KEY,
  reasonMessageKey,
  UUID7_PATTERN,
  type AuditRecord,
  type CallName,
  type HalRequest,
  type RequestCallName,
  type SubscriptionCallName,
} from '../src/contract.ts';
import { refusedRequestError } from '../src/transport.ts';
import { createSimTransport } from '../src/transport-sim.ts';
import { uuid7 } from '../src/uuid7.ts';
import { ajvErrors, okRequest, validateAuditRecord, validateExchange } from './support.ts';

function recordingSim(options: Parameters<typeof createSimTransport>[0] = {}) {
  const records: AuditRecord[] = [];
  const sim = createSimTransport({ ...options, audit: (record) => records.push(record) });
  return { sim, records };
}

/** The exchange of one simulated call, in fixture shape, for the schema of record. */
function exchange(
  call: CallName,
  request: unknown,
  response: { ok: boolean; error?: { kind: string; reason: string } },
  records: AuditRecord[],
) {
  const [audit, ...eventAudits] = records;
  const name = response.ok
    ? `${call}.ok`
    : `${call}.${response.error?.kind ?? ''}.${response.error?.reason ?? ''}`;
  return {
    fixture: name,
    provenance: 'synthetic',
    description: 'A simulated exchange.',
    contractVersion: 1,
    call,
    request,
    response,
    audit,
    // Only a subscription has event records; a call's exchange has none.
    ...(eventAudits.length > 0 ? { eventAudits } : {}),
  };
}

describe('transport-sim', () => {
  it.each(CALL_NAMES.filter((call) => !isSubscriptionCall(call)))(
    '%s: the simulated answer and its audit record form a valid contract exchange',
    async (call) => {
      const { sim, records } = recordingSim();
      const request = okRequest(call);
      const result = await sim.call(call, request as HalRequest<RequestCallName>);
      expect(records).toHaveLength(1);
      expect(records[0]?.auditId).toBe(result.auditId);
      expect(result.auditId).toMatch(UUID7_PATTERN);
      expect(validateExchange(exchange(call, request, result, records)), ajvErrors(validateExchange)).toBe(
        true,
      );
    },
  );

  it.each(['hal.id.read', 'hal.pay.request'] as const)(
    '%s returns unavailable / not-implemented with a shell',
    async (call) => {
      const { sim, records } = recordingSim();
      const result = await sim.call(call, okRequest(call) as HalRequest<typeof call>);
      expect(result).toStrictEqual({
        ok: false,
        error: {
          kind: 'unavailable',
          reason: 'not-implemented',
          retryable: false,
          outcomeUnknown: false,
          messageKey: 'hal.error.unavailable',
        },
        auditId: result.auditId,
      });
      expect(records[0]).toMatchObject({
        writtenBy: 'shell',
        errorKind: 'unavailable',
        errorReason: 'not-implemented',
      });
    },
  );

  it.each(['hal.scan.onBarcode', 'hal.auth.onBadge'] as const)(
    '%s: the subscription, its events and their audit records form a valid contract exchange',
    async (call: SubscriptionCallName) => {
      const { sim, records } = recordingSim();
      const events: unknown[] = [];
      const subscription = await sim.subscribe(call, okRequest(call), (event) => events.push(event));
      if (call === 'hal.scan.onBarcode') {
        sim.emitBarcode({
          symbology: 'gs1-datamatrix',
          aimId: ']d2',
          data: '0109506000134352\u001d10SYN0001',
        });
      } else {
        sim.emitBadge({ outcome: 'step-up-completed' });
        sim.emitBadge({ outcome: 'step-up-refused' });
      }
      const full = { ...exchange(call, okRequest(call), subscription.result, records), events };
      expect(records.length).toBe(1 + events.length);
      expect(validateExchange(full), ajvErrors(validateExchange)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    },
  );

  it('delivers barcode reads only while the window has the focus, and badge taps always', async () => {
    const { sim } = recordingSim();
    const reads: unknown[] = [];
    const taps: unknown[] = [];
    await sim.subscribe('hal.scan.onBarcode', {}, (event) => reads.push(event));
    await sim.subscribe('hal.auth.onBadge', {}, (event) => taps.push(event));
    sim.setFocused(false);
    sim.emitBarcode({ symbology: 'code128', data: 'SYN-MRN-0000001' });
    sim.emitBadge({ outcome: 'step-up-refused' });
    expect(reads).toHaveLength(0);
    expect(taps).toHaveLength(1);
    sim.setFocused(true);
    sim.emitBarcode({ symbology: 'code128', data: 'SYN-MRN-0000001' });
    expect(reads).toHaveLength(1);
  });

  it('keeps payloads, step-up references and barcode data out of the audit records', async () => {
    const { sim, records } = recordingSim();
    await sim.call('hal.print.label', okRequest('hal.print.label') as HalRequest<'hal.print.label'>);
    const events: { stepUpRef?: string }[] = [];
    await sim.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
    await sim.subscribe('hal.scan.onBarcode', {}, () => undefined);
    sim.emitBadge({ outcome: 'step-up-completed' });
    sim.emitBarcode({ symbology: 'code128', data: 'SYN-MRN-0000042' });
    const text = JSON.stringify(records);
    expect(text).not.toContain(String(okRequest('hal.print.label').content));
    expect(text).not.toContain('SYN-MRN-0000042');
    expect(events[0]?.stepUpRef).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(text).not.toContain(events[0]?.stepUpRef ?? 'missing');
  });

  it('refuses a malformed request with invalid-request and answers a scripted error with the contract flags', async () => {
    const { sim } = recordingSim({
      script: { 'hal.print.label': () => ({ ok: false, kind: 'timeout', reason: 'device-timeout' }) },
    });
    const malformed = await sim.call('hal.kiosk.lock', {
      state: 'open',
    } as unknown as HalRequest<'hal.kiosk.lock'>);
    expect(malformed.ok ? null : malformed.error.kind).toBe('invalid-request');
    const timedOut = await sim.call(
      'hal.print.label',
      okRequest('hal.print.label') as HalRequest<'hal.print.label'>,
    );
    expect(timedOut.ok ? null : timedOut.error).toMatchObject({ retryable: false, outcomeUnknown: true });
  });

  /** Malformed versions of a call's well-formed request: an extra field, and a malformed identifier. */
  function malformedRequests(call: CallName): Record<string, unknown>[] {
    const request = okRequest(call);
    const broken: Record<string, unknown>[] = [{ ...request, patientId: 'SYN-MRN-0001' }];
    for (const field of [
      'deviceId',
      'printerId',
      'terminalId',
      'templateId',
      'templateVersion',
      'reprintOf',
    ]) {
      broken.push({ ...request, [field]: 'SYN BAD ID' });
    }
    return broken;
  }

  it.each(CALL_NAMES)(
    '%s: a malformed request gets a refusal, never an exception, and nothing of it reaches the record',
    async (call) => {
      for (const request of malformedRequests(call)) {
        const { sim, records } = recordingSim();
        const result = isSubscriptionCall(call)
          ? (await sim.subscribe(call, request, () => undefined)).result
          : await sim.call(call, request as unknown as HalRequest<RequestCallName>);
        expect(result).toStrictEqual({
          ok: false,
          error: refusedRequestError(call),
          auditId: result.auditId,
        });
        expect(records).toHaveLength(1);
        expect(validateAuditRecord(records[0]), ajvErrors(validateAuditRecord)).toBe(true);
        // Only the fields every error record has: no device, job, template or reprint field.
        expect(Object.keys(records[0] ?? {}).sort()).toStrictEqual(
          [
            'auditId',
            'writtenBy',
            'contractVersion',
            'call',
            'at',
            'outcome',
            'errorKind',
            'errorReason',
            'workstationId',
            'sessionRef',
          ].sort(),
        );
        const text = JSON.stringify(records);
        expect(text).not.toContain('SYN-MRN-0001');
        expect(text).not.toContain('SYN BAD ID');
      }
    },
  );

  it('opens no subscription for a refused request, even one with a well-formed device', async () => {
    const { sim, records } = recordingSim();
    const events: unknown[] = [];
    const subscription = await sim.subscribe(
      'hal.scan.onBarcode',
      { deviceId: 'SIM-SCANNER-01', extra: 1 } as unknown as HalRequest<'hal.scan.onBarcode'>,
      (event) => events.push(event),
    );
    expect(subscription.result.ok).toBe(false);
    expect(records[0]?.deviceId).toBeUndefined();
    sim.emitBarcode({ symbology: 'code128', data: 'SYN-MRN-0000001' });
    expect(events).toHaveLength(0);
  });

  it('records a null session for a malformed or failing session reference, and still answers', async () => {
    for (const sessionRef of [
      () => 'bad session',
      () => {
        throw new Error('no session');
      },
    ]) {
      const { sim, records } = recordingSim({ sessionRef });
      const result = await sim.call('hal.kiosk.lock', { state: 'locked' });
      expect(result.ok).toBe(true);
      expect(records[0]?.sessionRef).toBeNull();
    }
  });

  it('stops delivering events after close', async () => {
    const { sim } = recordingSim();
    const taps: unknown[] = [];
    const subscription = await sim.subscribe('hal.auth.onBadge', {}, (event) => taps.push(event));
    subscription.close();
    sim.emitBadge({ outcome: 'step-up-completed' });
    expect(taps).toHaveLength(0);
  });
});

describe('hal message keys', () => {
  it('are all in the source catalogue of @hms/i18n', () => {
    const catalogue = JSON.parse(
      readFileSync(new URL('../../i18n/src/messages/en.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    const keys = [
      ...Object.values(MESSAGE_KEY_BY_KIND),
      OUTCOME_UNKNOWN_MESSAGE_KEY,
      CAPTURE_DISCARDED_MESSAGE_KEY,
      ...ERROR_REASONS.map(reasonMessageKey),
    ];
    for (const key of keys) {
      expect(catalogue[key], key).toBeTypeOf('string');
    }
  });
});

describe('uuid7', () => {
  it('makes lower-case UUIDv7s that carry the time and sort by it', () => {
    const early = uuid7(0x0190_0000_0000);
    const late = uuid7(0x0190_0000_0001);
    expect(early).toMatch(UUID7_PATTERN);
    expect(late).toMatch(UUID7_PATTERN);
    expect(early.slice(0, 13)).toBe('01900000-0000');
    expect(early < late).toBe(true);
    expect(uuid7(1, () => new Uint8Array(10).fill(0xff))).toBe('00000000-0001-7fff-bfff-ffffffffffff');
    expect(() => uuid7(-1)).toThrow(RangeError);
  });
});
