/**
 * The localisation lint, run by `pnpm run i18n:lint` (part of `pnpm run fast`).
 *
 *   node packages/i18n/src/lint/cli.ts [--json] [--dir <catalogue directory>]
 *
 * By default it checks packages/i18n/src/messages. Exit codes follow the programme check contract
 * (tools/hmstools/common.py): 0 pass, 1 findings, 2 usage or environment error. With --json the last stdout
 * line is one JSON object {check, ok, counts, errors, warnings}.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintCatalogueDirectory, UI_CATALOGUE_LINT_OPTIONS } from './catalogue-lint.ts';

const CHECK_NAME = 'frontend-i18n-catalogues';
const USAGE = 'usage: node packages/i18n/src/lint/cli.ts [--json] [--dir <catalogue directory>]';
const defaultDirectory = fileURLToPath(new URL('../messages/', import.meta.url));

function main(argv: readonly string[]): number {
  let json = false;
  let directory = defaultDirectory;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') {
      json = true;
    } else if (argument === '--dir' && argv[index + 1] !== undefined) {
      directory = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else {
      console.error(`${CHECK_NAME}: unexpected argument ${argument ?? ''}`);
      console.error(USAGE);
      return 2;
    }
  }
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    console.error(`${CHECK_NAME}: catalogue directory not found: ${directory}`);
    return 2;
  }

  const result = lintCatalogueDirectory(directory, UI_CATALOGUE_LINT_OPTIONS);
  for (const error of result.errors) {
    console.log(`ERROR  ${error}`);
  }
  for (const warning of result.warnings) {
    console.log(`WARN   ${warning}`);
  }
  const ok = result.errors.length === 0;
  const counts = Object.entries(result.counts)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(', ');
  console.log(`${CHECK_NAME}: ${ok ? 'PASS' : 'FAIL'} (${counts})`);
  if (json) {
    console.log(
      JSON.stringify({
        check: CHECK_NAME,
        ok,
        counts: result.counts,
        errors: result.errors,
        warnings: result.warnings,
      }),
    );
  }
  return ok ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
