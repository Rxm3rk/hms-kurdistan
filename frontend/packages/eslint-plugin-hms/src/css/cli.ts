/**
 * Stylesheet check for physical CSS directions, run by `pnpm run lint:css` (part of `pnpm run fast`).
 *
 *   node packages/eslint-plugin-hms/src/css/cli.ts [--json] [path ...]
 *
 * With no paths it checks every .css file under frontend/apps and frontend/packages, skipping node_modules,
 * git-ignored build output (dist, build, coverage) and this package's own test fixtures, which hold
 * deliberate violations. Exit codes follow the programme check contract (tools/hmstools/common.py): 0 pass,
 * 1 findings, 2 usage or environment error. With --json the last stdout line is one JSON object
 * {check, ok, counts, errors, warnings}.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkStylesheetFiles, findStylesheets } from './check.ts';

const CHECK_NAME = 'frontend-css-logical';
const frontendRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const fixtureDirectory = path.join(frontendRoot, 'packages', 'eslint-plugin-hms', 'test', 'fixtures');

function main(argv: readonly string[]): number {
  const json = argv.includes('--json');
  const unknownOption = argv.find((argument) => argument.startsWith('-') && argument !== '--json');
  if (unknownOption !== undefined) {
    console.error(`${CHECK_NAME}: unknown option ${unknownOption}`);
    console.error('usage: node packages/eslint-plugin-hms/src/css/cli.ts [--json] [path ...]');
    return 2;
  }
  const given = argv
    .filter((argument) => !argument.startsWith('-'))
    .map((argument) => path.resolve(argument));
  const missing = given.filter((root) => !existsSync(root));
  if (missing.length > 0) {
    console.error(`${CHECK_NAME}: path not found: ${missing.join(', ')}`);
    return 2;
  }
  const roots =
    given.length > 0 ? given : [path.join(frontendRoot, 'apps'), path.join(frontendRoot, 'packages')];
  const files = findStylesheets(
    roots.filter((root) => existsSync(root)),
    given.length > 0 ? [] : [fixtureDirectory],
  );
  const findings = checkStylesheetFiles(files, frontendRoot);
  const errors = findings.map(
    (finding) => `${finding.file}:${String(finding.line)}:${String(finding.column)}  ${finding.message}`,
  );

  for (const error of errors) {
    console.log(`ERROR  ${error}`);
  }
  const ok = errors.length === 0;
  console.log(
    `${CHECK_NAME}: ${ok ? 'PASS' : 'FAIL'} (files=${String(files.length)}, findings=${String(findings.length)})`,
  );
  if (json) {
    console.log(
      JSON.stringify({
        check: CHECK_NAME,
        ok,
        counts: { files: files.length, findings: findings.length },
        errors,
        warnings: [],
      }),
    );
  }
  return ok ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
