/**
 * Shared test support: the HAL contract v1 schema compiled with Ajv (JSON Schema 2020-12) and the
 * synthetic fixtures of docs/specs/hal/fixtures/ (NOT FOR CLINICAL USE).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { CALL_NAMES, type CallName } from '../src/contract.ts';

const halDirectory = new URL('../../../../docs/specs/hal/', import.meta.url);
const fixturesDirectory = new URL('fixtures/', halDirectory);

export const SCHEMA_ID = 'urn:hms-kurdistan:spec:hal:v1';

/** The JSON Schema of record, parsed. */
export const schema = JSON.parse(readFileSync(new URL('hal-v1.schema.json', halDirectory), 'utf8')) as {
  readonly $defs: Readonly<Record<string, unknown>>;
  readonly allOf: readonly unknown[];
};

// strictTypes is off because the schema's if/then branches constrain values without repeating their type,
// as JSON Schema allows; Ajv's other strict checks stay on (as in smoke.test.ts).
const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
ajv.addSchema(schema);

function compiled(ref: string): ValidateFunction {
  const validate = ajv.getSchema(ref);
  if (validate === undefined) {
    throw new Error(`no schema ${ref}`);
  }
  return validate;
}

/** Validates one call exchange (the shape of a fixture) against the schema's root. */
export const validateExchange = compiled(SCHEMA_ID);
/** Validates one audit record against $defs/auditRecord. */
export const validateAuditRecord = compiled(`${SCHEMA_ID}#/$defs/auditRecord`);

/** The errors Ajv reported, for test failure messages. */
export function ajvErrors(validate: ValidateFunction): string {
  return JSON.stringify(validate.errors ?? [], null, 1);
}

export interface Fixture {
  readonly $schema?: string;
  readonly fixture: string;
  readonly provenance: 'synthetic';
  readonly description: string;
  readonly contractVersion: 1;
  readonly call: CallName;
  readonly request: Record<string, unknown>;
  readonly response: {
    readonly ok: boolean;
    readonly value?: Record<string, unknown>;
    readonly error?: Record<string, unknown>;
    readonly auditId: string;
  };
  readonly audit: Record<string, unknown>;
  readonly events?: readonly Record<string, unknown>[];
  readonly eventAudits?: readonly Record<string, unknown>[];
}

export interface FixtureFile {
  readonly file: string;
  readonly fixture: Fixture;
}

/** Every fixture file, sorted by name. */
export const fixtureFiles: readonly FixtureFile[] = readdirSync(fixturesDirectory)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) => ({
    file,
    fixture: JSON.parse(readFileSync(new URL(file, fixturesDirectory), 'utf8')) as Fixture,
  }));

/** The request of a call's success fixture: a well-formed request for every call. */
export function okRequest(call: CallName): Record<string, unknown> {
  const found = fixtureFiles.find(({ fixture }) => fixture.fixture === `${call}.ok`);
  if (found === undefined) {
    throw new Error(`no success fixture for ${call}`);
  }
  return found.fixture.request;
}

export { CALL_NAMES };

/** A deep copy, so a test can change a fixture without touching the shared one. */
export function copy<T>(value: T): T {
  return structuredClone(value);
}
