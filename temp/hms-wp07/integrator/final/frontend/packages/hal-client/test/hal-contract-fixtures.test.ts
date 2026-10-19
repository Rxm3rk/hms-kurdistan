/**
 * UnitTest:hal-contract-fixtures (docs/specs/modules/design-system.md §9; slice S8). Every fixture in
 * docs/specs/hal/fixtures/ validates against hal-v1.schema.json and round-trips through the client's types
 * (contract.ts), with the cross-checks of docs/specs/hal/README.md, "Fixtures and checks". The client's
 * Zod schemas and the JSON Schema must agree: on every fixture, on every error the contract allows and on
 * the changes that make an exchange invalid.
 */
import { describe, expect, it } from 'vitest';
import {
  auditRecordSchema,
  CALL_NAMES,
  ERROR_KINDS,
  ERROR_KINDS_BY_CALL,
  ERROR_REASONS,
  errorFlags,
  halError,
  isKindOfCall,
  isSubscriptionCall,
  MESSAGE_KEY_BY_KIND,
  OUTCOME_UNKNOWN_CALLS,
  parseEvent,
  parseRequest,
  parseResult,
  REASONS_BY_KIND,
  reasonMessageKey,
  type CallName,
  type ErrorKind,
  type ErrorReason,
} from '../src/contract.ts';
import {
  ajvErrors,
  copy,
  fixtureFiles,
  okRequest,
  schema,
  validateExchange,
  type Fixture,
} from './support.ts';

/** The README's count: one fixture per call and outcome, plus the two no-shell fixtures. */
const README_FIXTURE_COUNT = 69;

/** Every part of a fixture parsed by the client's schemas; null for a part that does not parse. */
function parseFixture(fixture: Fixture) {
  const { call } = fixture;
  return {
    request: parseRequest(call, fixture.request),
    response: parseResult(call, fixture.response),
    audit: auditRecordSchema.safeParse(fixture.audit).data ?? null,
    events: isSubscriptionCall(call) ? (fixture.events ?? []).map((event) => parseEvent(call, event)) : [],
    eventAudits: (fixture.eventAudits ?? []).map(
      (record) => auditRecordSchema.safeParse(record).data ?? null,
    ),
  };
}

/** Whether the client's schemas accept every part of the exchange. */
function clientAccepts(fixture: Fixture): boolean {
  const parsed = parseFixture(fixture);
  return (
    parsed.request !== null &&
    parsed.response !== null &&
    parsed.audit !== null &&
    parsed.events.every((event) => event !== null) &&
    parsed.eventAudits.every((record) => record !== null)
  );
}

describe('hal-contract-fixtures', () => {
  it('finds every fixture the README counts, named after its file, for all twelve calls', () => {
    expect(fixtureFiles).toHaveLength(README_FIXTURE_COUNT);
    for (const { file, fixture } of fixtureFiles) {
      expect(`${fixture.fixture}.json`).toBe(file);
      expect(fixture.provenance).toBe('synthetic');
    }
    for (const call of CALL_NAMES) {
      expect(
        fixtureFiles.some(({ fixture }) => fixture.fixture === `${call}.ok`),
        call,
      ).toBe(true);
    }
  });

  it.each(fixtureFiles.map(({ file, fixture }) => [file, fixture] as const))(
    '%s validates against hal-v1.schema.json',
    (_file, fixture) => {
      expect(validateExchange(fixture), ajvErrors(validateExchange)).toBe(true);
    },
  );

  it.each(fixtureFiles.map(({ file, fixture }) => [file, fixture] as const))(
    '%s round-trips through the client types unchanged',
    (_file, fixture) => {
      const parsed = parseFixture(fixture);
      // Through JSON, as across the bridge: nothing added, nothing dropped, nothing changed.
      const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
      expect(roundTrip(parsed.request)).toStrictEqual(fixture.request);
      expect(roundTrip(parsed.response)).toStrictEqual(fixture.response);
      expect(roundTrip(parsed.audit)).toStrictEqual(fixture.audit);
      expect(roundTrip(parsed.events)).toStrictEqual(
        isSubscriptionCall(fixture.call) ? (fixture.events ?? []) : [],
      );
      expect(roundTrip(parsed.eventAudits)).toStrictEqual(fixture.eventAudits ?? []);
    },
  );

  it.each(fixtureFiles.map(({ file, fixture }) => [file, fixture] as const))(
    '%s passes the README cross-checks 1 to 4',
    (_file, fixture) => {
      // 1. The response names the audit record.
      expect(fixture.response.auditId).toBe(fixture.audit.auditId);
      const events = fixture.events ?? [];
      const eventAudits = fixture.eventAudits ?? [];
      // 3. One audit record per event, in order, each naming its event.
      expect(eventAudits).toHaveLength(events.length);
      events.forEach((event, index) => {
        const record = eventAudits[index];
        expect(event.auditId).toBe(record?.auditId);
        // 2. Every event belongs to the subscription the response opened.
        expect(event.subscriptionId).toBe(fixture.response.value?.subscriptionId);
        // 4. A badge event's outcome agrees with its audit record.
        if (fixture.call === 'hal.auth.onBadge') {
          const refused = event.outcome === 'step-up-refused';
          expect(record?.outcome).toBe(refused ? 'error' : 'ok');
          if (refused) {
            expect(record?.errorKind).toBe('not-permitted');
            expect(record?.errorReason).toBe('step-up-refused');
          }
        }
      });
    },
  );

  it('repeats no audit ID within a fixture or across the fixtures (cross-check 5)', () => {
    const seen = new Map<string, string>();
    for (const { file, fixture } of fixtureFiles) {
      const ids = [fixture.audit.auditId, ...(fixture.eventAudits ?? []).map((record) => record.auditId)];
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(seen.get(id as string), `${String(id)} in ${file}`).toBeUndefined();
        seen.set(id as string, file);
      }
    }
  });

  it('agrees with the schema on the error kinds of each call', () => {
    const branches = schema.allOf as readonly {
      if?: { properties?: { call?: { const?: string } } };
      then?: {
        properties?: {
          response?: { else?: { properties?: { error?: { properties?: { kind?: { enum?: string[] } } } } } };
        };
      };
    }[];
    for (const call of CALL_NAMES) {
      const branch = branches.find((candidate) => candidate.if?.properties?.call?.const === call);
      const kinds = branch?.then?.properties?.response?.else?.properties?.error?.properties?.kind?.enum;
      expect(kinds, call).toStrictEqual([...ERROR_KINDS_BY_CALL[call]]);
    }
  });

  it('agrees with the schema on the reasons of each kind and the error vocabulary', () => {
    const defs = schema.$defs as Record<string, { enum?: string[] }>;
    expect(defs.errorKind?.enum).toStrictEqual([...ERROR_KINDS]);
    expect(defs.errorReason?.enum).toStrictEqual([...ERROR_REASONS]);
    expect(defs.callName?.enum).toStrictEqual([...CALL_NAMES]);
    expect(Object.values(REASONS_BY_KIND).flat().sort()).toStrictEqual([...ERROR_REASONS].sort());
    expect(reasonMessageKey('no-shell')).toBe('hal.reason.noShell');
    expect(reasonMessageKey('capability-not-granted')).toBe('hal.reason.capabilityNotGranted');
  });

  /** An exchange for a call that ends in the given error, with a matching audit record. */
  function errorExchange(
    call: CallName,
    error: Record<string, unknown>,
    reason: ErrorReason,
    kind: ErrorKind,
  ) {
    const auditId = '019a3c00-0000-7000-8000-0000000000f0';
    return {
      fixture: `${call}.${kind}.${reason}`,
      provenance: 'synthetic',
      description: 'A generated error exchange (test only).',
      contractVersion: 1,
      call,
      request: okRequest(call),
      response: { ok: false, error, auditId },
      audit: {
        auditId,
        writtenBy: reason === 'no-shell' ? 'hal-client' : 'shell',
        contractVersion: 1,
        call,
        at: '2026-10-19T09:00:00.000Z',
        outcome: 'error',
        errorKind: kind,
        errorReason: reason,
        workstationId: reason === 'no-shell' ? null : 'SYN-WS-0001',
        sessionRef: 'SYN-SESSION-0001',
      },
    } as unknown as Fixture;
  }

  it('builds, for every call, exactly the errors the schema allows (halError)', () => {
    for (const call of CALL_NAMES) {
      for (const kind of ERROR_KINDS) {
        for (const reason of REASONS_BY_KIND[kind]) {
          if (isKindOfCall(call, kind)) {
            const exchange = errorExchange(call, { ...halError(call, kind, reason) }, reason, kind);
            expect(
              validateExchange(exchange),
              `${call} ${kind}/${reason}: ${ajvErrors(validateExchange)}`,
            ).toBe(true);
            expect(clientAccepts(exchange), `${call} ${kind}/${reason}`).toBe(true);
            expect(halError(call, kind, reason).outcomeUnknown).toBe(
              OUTCOME_UNKNOWN_CALLS.has(call) && (kind === 'device-error' || kind === 'timeout'),
            );
          } else {
            expect(() => halError(call, kind, reason)).toThrow();
            const error = { kind, reason, ...errorFlags(call, kind), messageKey: MESSAGE_KEY_BY_KIND[kind] };
            const exchange = errorExchange(call, error, reason, kind);
            expect(validateExchange(exchange), `${call} ${kind}`).toBe(false);
            expect(clientAccepts(exchange), `${call} ${kind}`).toBe(false);
          }
        }
      }
    }
  });

  it('rejects, with both schemas, an error whose flags or message key do not match its call and kind', () => {
    for (const call of CALL_NAMES) {
      for (const kind of ERROR_KINDS_BY_CALL[call]) {
        const reason = REASONS_BY_KIND[kind][0];
        const good = halError(call, kind, reason);
        const changes = [
          { ...good, retryable: !good.retryable },
          { ...good, outcomeUnknown: !good.outcomeUnknown },
          { ...good, messageKey: kind === 'timeout' ? 'hal.error.cancelled' : 'hal.error.timeout' },
          { ...good, reason: kind === 'cancelled' ? 'device-fault' : 'user-cancelled' },
        ];
        for (const changed of changes) {
          const exchange = errorExchange(call, changed, reason, kind);
          expect(validateExchange(exchange), `${call} ${JSON.stringify(changed)}`).toBe(false);
          expect(clientAccepts(exchange), `${call} ${JSON.stringify(changed)}`).toBe(false);
        }
      }
    }
  });

  /** Sets a field outside the contract on an object of the fixture. */
  function addField(target: object | undefined, name: string): boolean {
    if (target === undefined) {
      return false;
    }
    (target as Record<string, unknown>)[name] = 'SYN-EXTRA';
    return true;
  }

  /** Changes that make any fixture invalid; each returns false when it does not apply to the fixture. */
  const invalidatingChanges: readonly [string, (fixture: Fixture) => boolean][] = [
    ['an extra field in the request', (fixture) => addField(fixture.request, 'patientId')],
    ['an extra field in the response', (fixture) => addField(fixture.response, 'message')],
    [
      'an extra field in the value or the error',
      (fixture) => addField(fixture.response.value ?? fixture.response.error, 'text'),
    ],
    ['an extra field in the audit record', (fixture) => addField(fixture.audit, 'patientName')],
    ['an extra field in an event', (fixture) => addField(fixture.events?.[0], 'badgeCredential')],
    [
      'an audit ID that is not a UUIDv7',
      (fixture) => {
        const response = fixture.response as { auditId: string };
        response.auditId = `${response.auditId.slice(0, 14)}4${response.auditId.slice(15)}`;
        return true;
      },
    ],
  ];

  it.each(invalidatingChanges)('rejects, with both schemas, %s in every fixture', (_name, change) => {
    for (const { file, fixture } of fixtureFiles) {
      const changed = copy(fixture);
      if (!change(changed)) {
        continue;
      }
      expect(validateExchange(changed), file).toBe(false);
      expect(clientAccepts(changed), file).toBe(false);
    }
  });
});
