/** Where each rule is documented: its section of this package's README, relative to the repository root. */
export function docsUrl(ruleName: string): string {
  return `frontend/packages/eslint-plugin-hms/README.md#hms${ruleName}`;
}
