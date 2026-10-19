/**
 * The simulated authenticator of the sign and co-sign dialog (docs/specs/modules/design-system.md §2.3
 * step 3, §5, §8; KA-032). No §9 row names this test; it guards the fail-closed rule that a production
 * build cannot sign with a simulated identity unless it is a demo build (`VITE_HMS_DEMO=1`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSimulatedAuthenticator } from '../../src/sign/index.ts';
import { DOCTOR } from './harness.tsx';

describe('simulated-authenticator', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('cannot be created in a production build without the demo flag', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_HMS_DEMO', undefined);
    expect(() => createSimulatedAuthenticator(DOCTOR)).toThrow(/KA-032/);
  });

  it.each(['0', 'true', 'yes', ' 1', ''])(
    'cannot be created in a production build when the demo flag is %j, not "1"',
    (flag) => {
      vi.stubEnv('PROD', true);
      vi.stubEnv('VITE_HMS_DEMO', flag);
      expect(() => createSimulatedAuthenticator(DOCTOR)).toThrow(/KA-032/);
    },
  );

  it('can be created in a production demo build (VITE_HMS_DEMO=1)', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_HMS_DEMO', '1');
    const authenticator = createSimulatedAuthenticator(DOCTOR);
    await expect(authenticator.authenticate({ kind: 'sign', pin: undefined })).resolves.toEqual({
      status: 'authenticated',
      userId: DOCTOR,
      factors: 'single',
    });
  });

  it('vouches for a co-signature only with a PIN of 4 to 8 Western digits', async () => {
    const authenticator = createSimulatedAuthenticator(DOCTOR);
    const cosign = (pin: string | undefined) => authenticator.authenticate({ kind: 'cosign', pin });
    await expect(cosign('1234')).resolves.toEqual({
      status: 'authenticated',
      userId: DOCTOR,
      factors: 'badge-and-pin',
    });
    await expect(cosign('12345678')).resolves.toMatchObject({ status: 'authenticated' });
    for (const pin of [undefined, '', '123', '123456789', '١٢٣٤', '12a4']) {
      await expect(cosign(pin), String(pin)).resolves.toEqual({ status: 'failed' });
    }
  });

  it('refuses an empty user id', async () => {
    await expect(
      createSimulatedAuthenticator('').authenticate({ kind: 'sign', pin: undefined }),
    ).resolves.toEqual({ status: 'failed' });
  });
});
