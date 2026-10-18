/**
 * The stylesheet half of hms/no-physical-css: flags the same physical properties, keywords and shorthands
 * in .css files (BUILD-PROMPT.md §6.5, §6.8 item 6). It uses the tables in ../physical-css.ts, so the two
 * checks cannot drift apart.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import postcss, { CssSyntaxError } from 'postcss';
import { checkDeclaration, formatFinding, normaliseCssPropertyName } from '../physical-css.ts';

/** One problem in a stylesheet. Lines and columns start at 1. */
export interface StylesheetFinding {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

/** Checks one stylesheet. A stylesheet that cannot be parsed is itself a finding, so the check fails closed. */
export function checkStylesheet(source: string, file: string): StylesheetFinding[] {
  let root: postcss.Root;
  try {
    root = postcss.parse(source, { from: file });
  } catch (error) {
    if (error instanceof CssSyntaxError) {
      return [
        {
          file,
          line: error.line ?? 1,
          column: error.column ?? 1,
          message: `The stylesheet cannot be parsed, so it cannot be checked: ${error.reason}.`,
        },
      ];
    }
    throw error;
  }
  const findings: StylesheetFinding[] = [];
  root.walkDecls((declaration) => {
    // Custom properties are named freely, and their values are only known where var() uses them.
    if (declaration.prop.startsWith('--')) {
      return;
    }
    const start = declaration.source?.start;
    const property = normaliseCssPropertyName(declaration.prop);
    for (const finding of checkDeclaration(property, declaration.value)) {
      findings.push({
        file,
        line: start?.line ?? 1,
        column: start?.column ?? 1,
        message: formatFinding(finding, 'css', declaration.prop),
      });
    }
  });
  return findings;
}

/** Directory names never searched: installed packages and git-ignored build and test output. */
export const SKIPPED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const isStylesheetName = (name: string): boolean => name.toLowerCase().endsWith('.css');

/**
 * Lists the .css files under the given roots (directories or files), sorted. Directory walks skip
 * SKIPPED_DIRECTORY_NAMES, the directories in `excludedDirectories` and symbolic links.
 */
export function findStylesheets(
  roots: readonly string[],
  excludedDirectories: readonly string[] = [],
): string[] {
  const excluded = new Set(excludedDirectories.map((directory) => path.resolve(directory)));
  const files = new Set<string>();
  const visit = (directory: string): void => {
    if (excluded.has(path.resolve(directory))) {
      return;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
          visit(entryPath);
        }
      } else if (entry.isFile() && isStylesheetName(entry.name)) {
        files.add(entryPath);
      }
    }
  };
  for (const root of roots) {
    if (statSync(root).isDirectory()) {
      visit(root);
    } else if (isStylesheetName(root)) {
      files.add(path.resolve(root));
    }
  }
  return [...files].sort();
}

/** Checks every file and returns the findings in file order. */
export function checkStylesheetFiles(files: readonly string[], displayRoot: string): StylesheetFinding[] {
  return files.flatMap((file) => {
    const display = path.relative(displayRoot, file).split(path.sep).join('/');
    return checkStylesheet(readFileSync(file, 'utf8'), display);
  });
}
