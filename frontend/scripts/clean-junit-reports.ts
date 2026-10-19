/**
 * Removes frontend/reports/junit before a test run, so the CI runner never counts a report left over from an
 * earlier run or from a package that no longer exists (BUILD-PROMPT.md §3.5, §19.1).
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const reports = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'junit');
rmSync(reports, { recursive: true, force: true });
