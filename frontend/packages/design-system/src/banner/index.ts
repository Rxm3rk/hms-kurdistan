/**
 * The patient banner (WP-0.7 slice S5a; docs/specs/modules/design-system.md §2.1). Its stylesheet is
 * `banner.css`, imported by the package stylesheet.
 */
export {
  BANNER_STATUSES,
  BannerStatus,
  type BannerStatusField,
  type BannerStatusId,
  type BannerStatusProps,
  type BannerStatusSpec,
  type StatusTone,
} from './banner-status.tsx';
export { GovernedLabel, useBannerLocale, type GovernedLabelProps } from './governed-label.tsx';
export { PatientBanner, type PatientBannerProps } from './patient-banner.tsx';
export {
  PatientIdentity,
  type PatientIdentityModel,
  type PatientIdentityProps,
} from './patient-identity.tsx';
export { PatientPhoto, type PatientPhotoProps } from './patient-photo.tsx';
export { ICON_SHAPES, StatusIcon, type IconShape, type StatusIconProps } from './status-icon.tsx';
