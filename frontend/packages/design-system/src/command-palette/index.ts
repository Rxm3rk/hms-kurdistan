/**
 * The command palette (WP-0.7 slice S5b; docs/specs/modules/design-system.md §2.4). Its stylesheet is
 * `command-palette.css`, imported by the package stylesheet.
 */
export { CommandPalette, isPaletteShortcut, type CommandPaletteProps } from './command-palette.tsx';
export {
  foldForSearch,
  languageCommands,
  matchesQuery,
  PALETTE_GROUP_LABEL,
  PALETTE_GROUPS,
  paletteItemGroup,
  patientSearchText,
  type PaletteCommand,
  type PaletteGroup,
  type PaletteItem,
  type PalettePatient,
} from './commands.ts';
