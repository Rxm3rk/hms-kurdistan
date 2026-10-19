/**
 * The density setting (WP-0.7 slice S5b; docs/specs/modules/design-system.md §2.5). Its stylesheet is
 * `density-control.css`, imported by the package stylesheet. DensityProvider itself is in providers/ (S4).
 */
export {
  DENSITY_LABEL,
  DensityControl,
  otherDensity,
  useDensityCommand,
} from './density-control.tsx';
