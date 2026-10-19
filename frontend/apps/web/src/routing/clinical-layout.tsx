/**
 * The `_clinical` layout: every clinical route renders inside it (BUILD-PROMPT.md §2.1 SI-16, §14.2;
 * docs/specs/modules/design-system.md §2.1, §2.2, §4; CTRL-0016-5).
 *
 * - **The banner on every clinical route.** With a patient in the window and the address naming that
 *   patient, the layout renders the design system's one `PatientBanner` above the route, with the "Close
 *   patient record" control. No clinical route renders a banner of its own, and a clinical route outside
 *   this layout fails the route-tree test (ArchTest:banner-present-on-every-clinical-route).
 * - **No patient, no stale banner.** With no patient in the window the layout shows the patient chooser in
 *   place of the route: never a blank page and never the previous patient's banner.
 * - **The context, not the address, selects the patient** (usePatientUrlSync). While the address names
 *   another patient than the context's (a switch waiting for confirmation, or a request being loaded), the
 *   layout renders nothing patient-specific: neither the banner nor the route.
 * - **Clinical actions follow the banner** (§2.1 rule 4; DN-032): while the banner is in its error state the
 *   route's clinical actions are disabled (`useClinicalLayout().actionsDisabled`); the sign and co-sign
 *   actions also check the banner's signing block themselves.
 */
import { Message, PatientBanner } from '@hms/design-system';
import { parseBannerData } from '@hms/ui-core';
import { Outlet } from '@tanstack/react-router';
import { createContext, use, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Button } from 'react-aria-components';
import { useAppServices, usePatientContext } from '../app/services.tsx';
import { PatientChooser } from '../patient/patient-chooser.tsx';
import { addressNamesContext, usePatientUrlSync } from '../patient/use-patient-url-sync.ts';
import { useAppSearch, useUpdateSearch } from './search.ts';

/** The route id of the clinical layout (a pathless layout route). */
export const CLINICAL_LAYOUT_ID = '_clinical';

export interface ClinicalLayoutValue {
  /** The banner's "Close patient record" control: where focus goes after "Not this patient" (§2.3). */
  readonly closeControl: RefObject<HTMLButtonElement | null>;
  /** True while the banner is in its error state: the route's clinical actions are disabled (DN-032). */
  readonly actionsDisabled: boolean;
}

const ClinicalLayoutContext = createContext<ClinicalLayoutValue | null>(null);

/** The clinical layout around this route. Throws outside it: a clinical screen needs the banner. */
export function useClinicalLayout(): ClinicalLayoutValue {
  const value = use(ClinicalLayoutContext);
  if (value === null) {
    throw new Error('useClinicalLayout: a clinical route must render inside the _clinical layout');
  }
  return value;
}

function NoPatient(): ReactNode {
  const { directory } = useAppServices();
  const updateSearch = useUpdateSearch();
  const headingId = useId();
  return (
    <section className="hms-no-patient" aria-labelledby={headingId} data-testid="patient-chooser">
      <h1 id={headingId} className="hms-page-title">
        <Message id="patientContext.none" />
      </h1>
      <PatientChooser
        entries={directory.list()}
        label="commandPalette.group.patients"
        onChoose={(patientId) => {
          updateSearch({ patient: patientId });
        }}
      />
    </section>
  );
}

export function ClinicalLayout(): ReactNode {
  const { store, directory } = useAppServices();
  const snapshot = usePatientContext();
  const { patient: requestedId } = useAppSearch();
  const closeControl = useRef<HTMLButtonElement>(null);
  usePatientUrlSync(requestedId);

  const patient = snapshot.patient;
  if (patient === null) {
    // A request in the address is being passed to the context: show nothing until it is decided.
    return requestedId === undefined ? <NoPatient /> : null;
  }
  if (!addressNamesContext(requestedId, patient.patientId)) {
    return null;
  }
  const banner = patient.banner ?? parseBannerData(undefined, directory.vocabularies);

  return (
    <ClinicalLayoutContext value={{ closeControl, actionsDisabled: banner.errorState }}>
      <div className="hms-clinical" data-patient-id={patient.patientId}>
        <PatientBanner
          model={banner}
          actions={
            <Button
              ref={closeControl}
              className="hms-clinical__close"
              onPress={() => {
                store.send({ type: 'ClosePatient' });
              }}
            >
              <Message id="patientContext.close" />
            </Button>
          }
        />
        <div className="hms-clinical__content">
          <Outlet />
        </div>
      </div>
    </ClinicalLayoutContext>
  );
}
