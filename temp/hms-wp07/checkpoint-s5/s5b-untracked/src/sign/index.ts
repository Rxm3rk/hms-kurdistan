/**
 * The sign and co-sign pattern (WP-0.7 slice S5b; docs/specs/modules/design-system.md §2.3). Its stylesheet
 * is `sign.css`, imported by the package stylesheet.
 */
export {
  createSimulatedAuthenticator,
  type SignAuthenticationRequest,
  type SignAuthenticator,
} from './authenticator.ts';
export { SignButton, signingIdentityValid, type SignButtonProps } from './sign-button.tsx';
export {
  DEFAULT_SIGN_SUBMIT_TIMEOUT_MS,
  SignDialog,
  type SignDialogProps,
  type SignSubmissionOutcome,
  type SignSubmitter,
} from './sign-dialog.tsx';
