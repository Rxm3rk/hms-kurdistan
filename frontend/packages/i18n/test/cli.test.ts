import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'src', 'lint', 'cli.ts');
const fixtures = path.join(here, 'fixtures');

interface CheckResult {
  check: string;
  ok: boolean;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

/** Runs the lint CLI with Node.js; returns the exit code and the JSON object on the last stdout line. */
function runCli(...args: string[]): { status: number | null; result: CheckResult | undefined } {
  const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const last = run.stdout.trim().split(/\r?\n/).at(-1) ?? '';
  return { status: run.status, result: last.startsWith('{') ? (JSON.parse(last) as CheckResult) : undefined };
}

// Each case starts Node.js processes; on a loaded build host one start can take seconds, so the cases get
// an explicit time budget instead of Vitest's 5-second default. The assertions are unchanged.
describe('localisation lint CLI', { timeout: 60_000 }, () => {
  it('passes on the shipped catalogues by default', () => {
    const { status, result } = runCli('--json');
    expect(status).toBe(0);
    expect(result).toEqual({
      check: 'frontend-i18n-catalogues',
      ok: true,
      counts: { catalogues: 3, keys: 125, messages: 375, unreviewed: 250 },
      errors: [],
      warnings: [],
    });
  });

  it('passes on the valid fixtures, whose plural branches differ by locale', () => {
    const { status, result } = runCli('--json', '--dir', path.join(fixtures, 'valid'));
    expect(status).toBe(0);
    expect(result?.ok).toBe(true);
  });

  it('fails on the invalid fixtures with one error per planted problem', () => {
    const { status, result } = runCli('--json', '--dir', path.join(fixtures, 'invalid'));
    expect(status).toBe(1);
    expect(result?.ok).toBe(false);
    expect(result?.errors).toEqual([
      'ar.json: key "fixture.empty": the message is empty',
      'ckb.json: key "fixture.broken": ICU MessageFormat syntax error EXPECT_ARGUMENT_CLOSING_BRACE at line 1, column 9',
      'en.json:7: key "fixture.ok" appears more than once; JSON keeps only the last value',
      'ku-Arab.json: unexpected catalogue: the UI locales are en, ckb, ar; ku-Arab is used only for patient-facing templates',
      'ckb.json: key "fixture.missingInCkb" is missing (present in ar.json, en.json)',
      'ar.json: key "fixture.placeholders": placeholders ({count}, {nam}) differ from en.json ({count, number}, {name})',
      'ar.json: key "banner.fixture": the message is the same as in en.json; a clinical message (banner.*, clinical.*) must be translated',
      'ar.json: key "clinical.fixtureCount": plural "count" has no # in "one"; a clinical count, so every branch must show the number',
      'review/ar.json: key "fixture.gone" is not in ar.json',
      'review/ar.json: key "fixture.ok" of ar.json has no review status: mark it "unreviewed" (DN-021)',
      'review/ckb.json: key "fixture.ok": unknown review status "reviewed"; the only status is "unreviewed" until the clinician review records its own (DN-021, OQ-151)',
      'review/en.json: unexpected review file: the review-marked locales are ckb, ar',
    ]);
  });

  it('exits 2 for an unknown argument or a missing directory', () => {
    expect(runCli('--bogus').status).toBe(2);
    expect(runCli('--dir').status).toBe(2);
    expect(runCli('--dir', path.join(fixtures, 'no-such-directory')).status).toBe(2);
  });
});
