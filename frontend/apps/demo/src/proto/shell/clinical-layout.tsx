/**
 * The clinical layout of the prototype: every patient-scoped screen (chart, orders, eMAR, lab, billing)
 * renders inside it (docs/specs/modules/design-system.md §2.1, §2.2; CTRL-0016-5).
 *
 * - **The real PatientBanner** of the window's patient above the screen, sticky at the top of the content,
 *   with "Change patient" and "Close patient record".
 * - **No patient, no banner**: the friendly chooser in place of the screen, never a blank page and never the
 *   previous patient's banner.
 * - **The context, not the address, decides** (usePatientUrlSync): `?patient=<id>` is a request; while the
 *   address and the context disagree, nothing patient-specific is shown.
 * - One SignHost (one SignDialog) for the screen: `useSign()` / `<SignAction>`.
 *
 * Screens read the patient with `useClinicalPatient()`.
 */
import { Message, PatientBanner } from '@hms/design-system';
import { parseBannerData, type BannerModel } from '@hms/ui-core';
import { Outlet } from '@tanstack/react-router';
import { createContext, use, useRef, type ReactNode, type RefObject } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useAppServices, usePatientContext } from '../../app/services.tsx';
import { addressNamesContext, usePatientUrlSync } from '../../patient/use-patient-url-sync.ts';
import { useAppSearch, useUpdateSearch } from '../../routing/search.ts';
import { findPatient } from '../data/patients.ts';
import type { Patient } from '../data/types.ts';
import { useT } from '../i18n/use-t.ts';
import { EmptyState, Icon } from '../ui/index.ts';
import { shellMessages } from './messages.ts';
import { useCurrentScreen } from './navigation.ts';
import { usePatientChooser } from './patient.tsx';
import { PatientPicker } from './patient-picker.tsx';
import { SignHost } from './sign.tsx';

export interface ClinicalPatient {
  /** The window's patient (synthetic data record). */
  readonly patient: Patient;
  /** The banner model the PatientBanner shows. */
  readonly banner: BannerModel;
  /** True while the banner is in its error state: disable clinical actions (DN-032). */
  readonly actionsDisabled: boolean;
  /** The banner's "Close patient record" control. */
  readonly closeControl: RefObject<HTMLButtonElement | null>;
}

const ClinicalContext = createContext<ClinicalPatient | null>(null);

/** The patient of this patient-scoped screen. Throws outside the clinical layout. */
export function useClinicalPatient(): ClinicalPatient {
  const value = use(ClinicalContext);
  if (value === null) {
    throw new Error('useClinicalPatient: only patient-scoped screens (chart, orders, emar, lab, billing) have a patient');
  }
  return value;
}

function NoPatient(): ReactNode {
  const t = useT(shellMessages);
  const updateSearch = useUpdateSearch();
  const screen = useCurrentScreen();
  return (
    <section className="shell-no-patient" aria-labelledby="shell-no-patient-title">
      <header className="shell-no-patient__header">
        {screen === undefined ? null : (
          <p className="shell-no-patient__eyebrow">
            <Icon name={screen.icon} /> <Message id={screen.navKey} />
          </p>
        )}
        <h1 id="shell-no-patient-title" className="shell-no-patient__title">
          {t('chooserTitle')}
        </h1>
        <p className="shell-no-patient__intro">{t('chooserIntro')}</p>
      </header>
      <PatientPicker
        onChoose={(patientId) => {
          updateSearch({ patient: patientId });
        }}
      />
    </section>
  );
}

export function ProtoClinicalLayout(): ReactNode {
  const { store, directory } = useAppServices();
  const snapshot = usePatientContext();
  const { patient: requestedId } = useAppSearch();
  const closeControl = useRef<HTMLButtonElement>(null);
  const { openChooser } = usePatientChooser();
  const t = useT(shellMessages);
  usePatientUrlSync(requestedId);

  const current = snapshot.patient;
  if (current === null) {
    return requestedId === undefined ? <NoPatient /> : null;
  }
  if (!addressNamesContext(requestedId, current.patientId)) {
    return null;
  }
  const banner = current.banner ?? parseBannerData(undefined, directory.vocabularies);
  const patient = findPatient(current.patientId);

  return (
    <div className="shell-clinical" data-patient-id={current.patientId}>
      <div className="shell-clinical__banner">
        <PatientBanner
          model={banner}
          actions={
            <span className="shell-clinical__actions">
              <AriaButton
                className="ui-button ui-button--secondary ui-button--sm"
                onPress={() => {
                  openChooser();
                }}
              >
                <Icon name="users" />
                <span>{t('changePatient')}</span>
              </AriaButton>
              <AriaButton
                ref={closeControl}
                className="ui-button ui-button--ghost ui-button--sm"
                onPress={() => {
                  store.send({ type: 'ClosePatient' });
                }}
              >
                <Icon name="x" />
                <span>
                  <Message id="patientContext.close" />
                </span>
              </AriaButton>
            </span>
          }
        />
      </div>
      {patient === undefined ? (
        <EmptyState icon="alert" title={<Message id="banner.dataUnavailable" />} />
      ) : (
        <ClinicalContext value={{ patient, banner, actionsDisabled: banner.errorState, closeControl }}>
          <SignHost closeControl={closeControl}>
            <div className="shell-clinical__content">
              <Outlet />
            </div>
          </SignHost>
        </ClinicalContext>
      )}
    </div>
  );
}
