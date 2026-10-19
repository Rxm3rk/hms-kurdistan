/**
 * Workspace wiring for @hms/hal-client (slice S1): the package loads, the Tauri API resolves and reports
 * no shell outside Tauri, and Ajv compiles the HAL contract schema that the fixture tests use.
 */
import { readFileSync } from 'node:fs';
import { isTauri } from '@tauri-apps/api/core';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const schemaUrl = new URL('../../../../docs/specs/hal/hal-v1.schema.json', import.meta.url);

describe('hal-client workspace wiring', () => {
  // A dynamic import inside the test, so that an entry point that throws while loading fails this test.
  it('imports the package entry point without error', async () => {
    await expect(import('../src/index.ts')).resolves.toBeTypeOf('object');
  });

  it('resolves @tauri-apps/api and reports no shell outside Tauri', () => {
    expect(isTauri()).toBe(false);
  });

  // strictTypes is off because the schema's if/then branches constrain values without repeating their type,
  // as JSON Schema allows; Ajv's other strict checks (unknown keywords among them) stay on.
  it('compiles the HAL contract v1 schema with Ajv (JSON Schema 2020-12)', () => {
    const schema: unknown = JSON.parse(readFileSync(schemaUrl, 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
    expect(typeof ajv.compile(schema as object)).toBe('function');
  });
});
