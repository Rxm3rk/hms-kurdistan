/**
 * The address is a request to the window's patient context, never a selection
 * (docs/specs/modules/design-system.md §2.2, §4, §5; CTRL-0016-6). The browser-level checks of the same rules
 * are slice S7's E2E:url-never-overrides-patient-context and E2E:one-patient-context-per-window.
 *
 * - A first patient in an empty window opens from the address with no confirmation.
 * - An address naming another patient shows nothing patient-specific and opens the switch confirmation, with
 *   both patients; the confirm control is not focused when it opens.
 * - Cancel keeps the current patient and puts the address back; confirm switches and the address follows.
 * - A requested patient with invalid identity data cannot be confirmed.
 * - An address naming a patient the directory does not know opens nothing and is put back (OQ-163).
 * - A request still loading when the address moves on sends nothing: the confirmation names the patient
 *   the address names now, or none.
 * - `?fixture=<id>` names a demo fixture and becomes `?patient=<id>`.
 * - A language change re-renders in place and keeps the patient.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { UiLocale } from '@hms/i18n';
import type { PatientDirectory } from '../src/patient/directory.ts';
import { address, bannerRegion, demoModule, patientIdOf, renderApp, text } from './harness.tsx';

const A = patientIdOf('complete');
const B = patientIdOf('nka');
const C = patientIdOf('not-assessed');
const ERROR = patientIdOf('banner-error');
const UNKNOWN = 'SYN-PAT-9999';

/** The demo module, except that B's data loads only when the test releases it. */
function demoWithBHeld() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const directory: PatientDirectory = {
    ...demoModule.directory,
    loadBannerData: async (patientId) => {
      if (patientId === B) {
        await gate;
      }
      return demoModule.directory.loadBannerData(patientId);
    },
  };
  return {
    demo: { ...demoModule, directory },
    release: () => {
      release();
    },
  };
}

async function bannerShowing(name: string, locale: UiLocale = 'en'): Promise<HTMLElement> {
  return waitFor(() => {
    const banner = bannerRegion(locale);
    if (banner === null) {
      throw new Error('no patient banner is shown');
    }
    expect(within(banner).getByText(name)).toBeInTheDocument();
    return banner;
  });
}

const switchDialog = (): Promise<HTMLElement> =>
  screen.findByRole('alertdialog', { name: text('patientContext.switch.title') });

describe('the address is a request to the patient context', () => {
  it('opens the first patient of an empty window from the address, with no confirmation', async () => {
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');
    expect(services.store.getSnapshot().patient?.patientId).toBe(A);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(address(router)).toBe(`/demo/banner?patient=${A}`);
  });

  it('asks before switching; cancel keeps the patient and puts the address back', async () => {
    const user = userEvent.setup();
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');

    await router.navigate({ href: `/demo/banner?patient=${B}` });
    const dialog = await switchDialog();
    // Nothing patient-specific behind the dialog while the address and the context disagree.
    expect(bannerRegion()).toBeNull();
    expect(services.store.getSnapshot().patient?.patientId).toBe(A);
    const current = within(dialog).getByRole('region', { name: text('patientContext.switch.current') });
    const requested = within(dialog).getByRole('region', { name: text('patientContext.switch.requested') });
    expect(within(current).getByText('Hêmin Azad Omer')).toBeInTheDocument();
    expect(within(requested).getByText('Şîlan Kerîm Ehmed')).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: text('patientContext.switch.confirm') });
    expect(confirm).not.toHaveFocus();
    expect(confirm).toHaveAttribute('aria-describedby', requested.id);

    await user.click(within(dialog).getByRole('button', { name: text('patientContext.switch.cancel') }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    await bannerShowing('Hêmin Azad Omer');
    await waitFor(() => {
      expect(address(router)).toBe(`/demo/banner?patient=${A}`);
    });
    expect(services.store.getSnapshot().patient?.patientId).toBe(A);
  });

  it('confirming switches the patient and the address follows', async () => {
    const user = userEvent.setup();
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');
    await router.navigate({ href: `/demo/banner?patient=${B}` });
    const dialog = await switchDialog();
    await user.click(within(dialog).getByRole('button', { name: text('patientContext.switch.confirm') }));
    const banner = await bannerShowing('Şîlan Kerîm Ehmed');
    expect(services.store.getSnapshot().patient?.patientId).toBe(B);
    expect(address(router)).toBe(`/demo/banner?patient=${B}`);
    expect(within(banner).queryByText('Hêmin Azad Omer')).toBeNull();
  });

  it('cannot confirm a switch to a patient whose identity data is invalid', async () => {
    const { router } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');
    await router.navigate({ href: `/demo/banner?patient=${ERROR}` });
    const dialog = await switchDialog();
    expect(
      within(dialog).getByRole('button', { name: text('patientContext.switch.confirm') }),
    ).toBeDisabled();
    expect(within(dialog).getByText(text('patientContext.switch.requestedInvalid'))).toBeInTheDocument();
  });

  it('an unknown patient in the address of an empty window opens nothing and shows the chooser', async () => {
    const { router, services } = await renderApp(`/demo/banner?patient=${UNKNOWN}`);
    await waitFor(() => {
      expect(address(router)).toBe('/demo/banner');
    });
    expect(await screen.findByTestId('patient-chooser')).toBeInTheDocument();
    expect(services.store.getSnapshot().patient).toBeNull();
    expect(bannerRegion()).toBeNull();
  });

  it('an unknown patient in the address keeps the open patient and puts the address back', async () => {
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');
    await router.navigate({ href: `/demo/banner?patient=${UNKNOWN}` });
    await waitFor(() => {
      expect(address(router)).toBe(`/demo/banner?patient=${A}`);
    });
    await bannerShowing('Hêmin Azad Omer');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(services.store.getSnapshot().patient?.patientId).toBe(A);
    expect(services.store.getSnapshot().requested).toBeNull();
  });

  it('a request overtaken while it loads sends nothing: the confirmation names the newer patient', async () => {
    const { demo, release } = demoWithBHeld();
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`, demo);
    await bannerShowing('Hêmin Azad Omer');
    await router.navigate({ href: `/demo/banner?patient=${B}` });
    await router.navigate({ href: `/demo/banner?patient=${C}` });
    const dialog = await switchDialog();
    release();
    // Let B's data arrive; it must change nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(services.store.getSnapshot().requested?.patientId).toBe(C);
    expect(address(router)).toBe(`/demo/banner?patient=${C}`);
    const requested = within(dialog).getByRole('region', { name: text('patientContext.switch.requested') });
    expect(within(requested).queryByText('Şîlan Kerîm Ehmed')).toBeNull();
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  });

  it('a request still loading when the address goes back sends nothing', async () => {
    const { demo, release } = demoWithBHeld();
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`, demo);
    await bannerShowing('Hêmin Azad Omer');
    await router.navigate({ href: `/demo/banner?patient=${B}` });
    await router.navigate({ href: `/demo/banner?patient=${A}` });
    await bannerShowing('Hêmin Azad Omer');
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(services.store.getSnapshot().requested).toBeNull();
    expect(services.store.getSnapshot().patient?.patientId).toBe(A);
    expect(address(router)).toBe(`/demo/banner?patient=${A}`);
  });

  it('closing the patient empties the window and the address, and shows the chooser', async () => {
    const user = userEvent.setup();
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    const banner = await bannerShowing('Hêmin Azad Omer');
    await user.click(within(banner).getByRole('button', { name: text('patientContext.close') }));
    expect(await screen.findByTestId('patient-chooser')).toBeInTheDocument();
    expect(services.store.getSnapshot().patient).toBeNull();
    await waitFor(() => {
      expect(address(router)).toBe('/demo/banner');
    });
  });

  it('turns ?fixture=<id> into the patient request', async () => {
    const { router } = await renderApp('/demo/banner?locale=ckb&fixture=nka');
    await bannerShowing('Şîlan Kerîm Ehmed', 'ckb');
    expect(address(router)).toBe(`/demo/banner?locale=ckb&patient=${B}`);
  });

  it('a language change re-renders in place, right to left, and keeps the patient', async () => {
    const { router, services } = await renderApp(`/demo/banner?patient=${A}`);
    await bannerShowing('Hêmin Azad Omer');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    await router.navigate({ href: `/demo/banner?patient=${A}&locale=ckb` });
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
      expect(document.documentElement).toHaveAttribute('lang', 'ckb');
    });
    await bannerShowing('Hêmin Azad Omer', 'ckb');
    expect(services.store.getSnapshot().lastChange.version).toBe(1);
    expect(screen.getByTestId('demo-watermark')).toHaveTextContent('NOT FOR CLINICAL USE');
  });
});
