/**
 * What screens may use from the prototype frame (screens never edit the shell):
 *
 *   import { useClinicalPatient, useOpenPatient, useRole, useScreenHref, SignAction } from '../../shell/index.ts';
 */
export { SCREENS, SCREEN_IDS, type ScreenId, type ScreenInfo } from './screens.ts';
export { useCurrentScreen, useGoTo, useScreenHref, useSearchParam, type ScreenParams } from './navigation.ts';
export { useClosePatient, useCurrentPatient, useCurrentPatientId, useOpenPatient, usePatientChooser } from './patient.tsx';
export { useClinicalPatient, type ClinicalPatient } from './clinical-layout.tsx';
export { PatientPicker, type PatientPickerProps } from './patient-picker.tsx';
export { SignAction, useSign, type SignActionProps, type SignApi, type SignRequest } from './sign.tsx';
export { ROLE_IDS, useRole, type RoleContextValue } from './role.tsx';
export { bannerModelOf, PROTO_SESSION_USER } from './proto-module.ts';
