import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { checkStylesheet, findStylesheets } from '../src/css/check.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures', 'css');
const cli = path.join(here, '..', 'src', 'css', 'cli.ts');

const read = (name: string): string => readFileSync(path.join(fixtures, name), 'utf8');

/** The "expect:" comments of a fixture, by line number. */
function expectations(source: string): Map<number, string> {
  const expected = new Map<number, string>();
  source.split('\n').forEach((line, index) => {
    const match = /\/\* expect: (.*) \*\/\s*$/.exec(line);
    if (match?.[1] !== undefined) {
      expected.set(index + 1, match[1]);
    }
  });
  return expected;
}

describe('checkStylesheet on fixtures', () => {
  it('reports every physical declaration in physical.css, on its line, naming the replacement', () => {
    const source = read('physical.css');
    const lines = source.split('\n');
    const expected = expectations(source);
    const findings = checkStylesheet(source, 'physical.css');

    expect(expected.size).toBe(47);
    expect(findings.map((finding) => finding.line)).toEqual([...expected.keys()]);
    for (const finding of findings) {
      const indentation = /^\s*/.exec(lines[finding.line - 1] ?? '')?.[0].length ?? 0;
      expect(finding.file).toBe('physical.css');
      expect(finding.column).toBe(indentation + 1);
      expect(finding.message).toContain(expected.get(finding.line));
      expect(finding.message).toContain('BUILD-PROMPT.md §6.5');
    }
  });

  it('accepts logical.css, including comments, selectors and custom properties that mention left', () => {
    expect(checkStylesheet(read('logical.css'), 'logical.css')).toEqual([]);
  });

  it('fails closed on a stylesheet it cannot parse', () => {
    const findings = checkStylesheet(read('broken.css'), 'broken.css');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toMatch(/^The stylesheet cannot be parsed, so it cannot be checked: /);
  });
});

describe('findStylesheets', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hms-css-'));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const touch = (relative: string): string => {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, '.a { margin-left: 1px; }\n');
    return file;
  };

  it('finds .css files and skips node_modules, build output and excluded directories', () => {
    const kept = [touch('apps/web/src/a.css'), touch('packages/ui/src/nested/B.CSS')];
    touch('apps/web/node_modules/lib/x.css');
    touch('apps/web/dist/x.css');
    touch('apps/web/build/x.css');
    touch('packages/ui/coverage/x.css');
    touch('packages/ui/test/fixtures/x.css');
    touch('packages/ui/src/not-css.scss');

    const found = findStylesheets(
      [path.join(root, 'apps'), path.join(root, 'packages')],
      [path.join(root, 'packages', 'ui', 'test', 'fixtures')],
    );
    expect(found).toEqual([...kept].sort());
  });

  it('accepts a file as a root', () => {
    const file = touch('single/one.css');
    expect(findStylesheets([file])).toEqual([file]);
  });
});

/** Runs the CLI with Node.js and returns its exit code and the JSON object on its last stdout line. */
function runCli(...args: string[]): { status: number | null; result: unknown; stdout: string } {
  const run = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const lines = run.stdout.trim().split(/\r?\n/);
  const last = lines.at(-1) ?? '';
  return {
    status: run.status,
    result: last.startsWith('{') ? JSON.parse(last) : undefined,
    stdout: run.stdout,
  };
}

// Each case starts Node.js processes; on a loaded build host one start can take seconds, so the cases get
// an explicit time budget instead of Vitest's 5-second default. The assertions are unchanged.
describe('stylesheet check CLI', { timeout: 60_000 }, () => {
  it('exits 1 and reports every finding as JSON for physical.css', () => {
    const { status, result } = runCli('--json', path.join(fixtures, 'physical.css'));
    expect(status).toBe(1);
    expect(result).toMatchObject({
      check: 'frontend-css-logical',
      ok: false,
      counts: { files: 1, findings: 47 },
    });
  });

  it('exits 0 for logical.css', () => {
    const { status, result } = runCli('--json', path.join(fixtures, 'logical.css'));
    expect(status).toBe(0);
    expect(result).toEqual({
      check: 'frontend-css-logical',
      ok: true,
      counts: { files: 1, findings: 0 },
      errors: [],
      warnings: [],
    });
  });

  it('exits 1 for a stylesheet it cannot parse', () => {
    expect(runCli(path.join(fixtures, 'broken.css')).status).toBe(1);
  });

  it('exits 2 for an unknown option or a missing path', () => {
    expect(runCli('--bogus').status).toBe(2);
    expect(runCli(path.join(fixtures, 'no-such-file.css')).status).toBe(2);
  });

  it('skips its own fixtures in the default workspace scan', () => {
    const { result, stdout } = runCli('--json');
    expect(stdout).not.toContain('test/fixtures');
    expect(result).toMatchObject({ check: 'frontend-css-logical' });
  });
});
