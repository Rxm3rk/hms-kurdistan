/**
 * Authentication of the person signing (BUILD-PROMPT.md §9.4 "authentication, intent and manifestation",
 * §12.8; docs/specs/modules/design-system.md §2.3 step 3).
 *
 * The signer authenticates for each signature; a co-signer taps a badge and enters a PIN (§12.8; R16 §9.6).
 * The Trust Plane provides both from WP-0.4. Until then the only authenticator is the simulated one, which
 * the dialog labels "Simulated sign-in (demonstration only)" (KA-032). It checks nothing: it vouches for the
 * user it was created for, and for a co-signature it reports badge-and-PIN once a PIN of 4 to 8 Western
 * digits has been entered. The PIN is never stored, logged or returned.
 *
 * The simulated authenticator cannot exist in a production build unless the demo flag is set
 * (`VITE_HMS_DEMO=1`, design-system §5 and §8): creating it there throws, so a real build can never sign
 * with a simulated identity (fail closed).
 */
import type { SignerAuthentication, SignKind, UserId } from '@hms/ui-core';

export interface SignAuthenticationRequest {
  readonly kind: SignKind;
  /** The PIN typed for a co-signature; undefined for a signature. Used once and dropped. */
  readonly pin: string | undefined;
}

export interface SignAuthenticator {
  /**
   * Authenticates the person at the dialog for this one signature. A rejected promise counts as a failed
   * authentication, never as a success.
   */
  authenticate(request: SignAuthenticationRequest): Promise<SignerAuthentication>;
}

/** A simulated co-signature PIN: 4 to 8 ASCII digits. Nothing checks it against a stored value. */
const SIMULATED_PIN = /^[0-9]{4,8}$/;

function demoBuildAllowed(): boolean {
  if (!import.meta.env.PROD) {
    return true;
  }
  const demo: unknown = import.meta.env.VITE_HMS_DEMO;
  return demo === '1';
}

/**
 * The WP-0.7 simulated authenticator for `userId` (KA-032). Throws in a production build without the demo
 * flag.
 */
export function createSimulatedAuthenticator(userId: UserId): SignAuthenticator {
  if (!demoBuildAllowed()) {
    throw new Error(
      'createSimulatedAuthenticator: simulated sign-in exists only in development, test and demo builds (KA-032)',
    );
  }
  return {
    authenticate(request: SignAuthenticationRequest): Promise<SignerAuthentication> {
      if (userId.length === 0) {
        return Promise.resolve({ status: 'failed' });
      }
      if (request.kind === 'cosign') {
        return Promise.resolve(
          request.pin !== undefined && SIMULATED_PIN.test(request.pin)
            ? { status: 'authenticated', userId, factors: 'badge-and-pin' }
            : { status: 'failed' },
        );
      }
      return Promise.resolve({ status: 'authenticated', userId, factors: 'single' });
    },
  };
}
