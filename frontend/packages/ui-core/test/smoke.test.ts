/** Workspace wiring for @hms/ui-core (slice S1): the package loads, runs without a DOM and resolves Zod. */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('ui-core workspace wiring', () => {
  // A dynamic import inside the test, so that an entry point that throws while loading fails this test.
  it('imports the package entry point without error', async () => {
    await expect(import('../src/index.ts')).resolves.toBeTypeOf('object');
  });

  it('runs in the node environment, with no DOM', () => {
    expect('document' in globalThis).toBe(false);
  });

  it('resolves zod', () => {
    expect(z.literal('nka').safeParse('nka').success).toBe(true);
    expect(z.literal('nka').safeParse('not-assessed').success).toBe(false);
  });
});
