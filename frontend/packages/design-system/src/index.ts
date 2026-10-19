/**
 * @hms/design-system: the one design system (BUILD-PROMPT.md §6.5, §14.2; docs/specs/modules/design-system.md
 * §2). The stylesheet (fonts, tokens and base styles) is imported separately, once, at the application root:
 * `import '@hms/design-system/styles.css'`.
 *
 * Slice S4 (the foundation): LocaleProvider, DensityProvider, Bdi, ClinicalNumber, Message, Modal and its
 * stack guard. Slices S5a and S5b add the banner, the sign and co-sign pattern, the command palette and the
 * density control, and export them here.
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
