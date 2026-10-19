/**
 * @hms/design-system: the one design system (BUILD-PROMPT.md §6.5, §14.2; docs/specs/modules/design-system.md
 * §2). The stylesheet (fonts, tokens and base styles) is imported separately, once, at the application root:
 * `import '@hms/design-system/styles.css'`.
 *
 * Slice S4 (the foundation): LocaleProvider, DensityProvider, Bdi, ClinicalNumber, Message, Modal and its
 * stack guard. Slice S5a adds the patient banner; slice S5b the sign and co-sign pattern, the command palette
 * and the density control.
 */
export { Bdi, type BdiDirection, type BdiProps } from './bdi/bdi.tsx';
export { ClinicalNumber, type ClinicalNumberProps } from './clinical-number/clinical-number.tsx';
export { Message, type MessageProps, type MessageValues } from './message/message.tsx';
export { messageKey } from './message-key.ts';
export { Modal, type ModalProps } from './modal/modal.tsx';
// createModalStackGuard is deliberately not exported here: a window has one guard. Tests import it from
// '@hms/design-system/testing', which fails in production builds.
export {
  ModalStackError,
  windowModalStackGuard,
  type ModalHold,
  type ModalHolder,
  type ModalHolderKind,
  type ModalOwner,
  type ModalRefusalMode,
  type ModalStackGuard,
  type ModalStackSnapshot,
} from './modal/modal-stack.ts';
export {
  ModalStackProvider,
  useIsModalOpen,
  useModalStackGuard,
  type ModalStackProviderProps,
} from './modal/modal-stack-provider.tsx';
export {
  DEFAULT_DENSITY,
  DENSITIES,
  DensityProvider,
  densityStorageKey,
  isDensity,
  loadDensity,
  useDensity,
  type Density,
  type DensityContextValue,
  type DensityProviderProps,
} from './providers/density-provider.tsx';
export {
  LocaleProvider,
  type LocaleProviderProps,
  type MessageErrorReport,
} from './providers/locale-provider.tsx';
// Slice S5a: the patient banner (§2.1) and PatientIdentity, which the switch confirmation, the re-verification
// step, the palette's patient results and the patient chooser reuse.
export {
  BANNER_STATUSES,
  BannerStatus,
  GovernedLabel,
  ICON_SHAPES,
  PatientBanner,
  PatientIdentity,
  PatientPhoto,
  StatusIcon,
  useBannerLocale,
  type BannerStatusField,
  type BannerStatusId,
  type BannerStatusProps,
  type BannerStatusSpec,
  type GovernedLabelProps,
  type IconShape,
  type PatientBannerProps,
  type PatientIdentityModel,
  type PatientIdentityProps,
  type PatientPhotoProps,
  type StatusIconProps,
  type StatusTone,
} from './banner/index.ts';
