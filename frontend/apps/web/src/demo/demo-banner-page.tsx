/**
 * `/demo/banner`: the banner demonstration, the evidence route of the WP-0.7 exit criteria
 * (BUILD-PROMPT.md §21 row 0.7; docs/specs/modules/design-system.md §5). Demo builds only.
 *
 * It is a clinical route: the `_clinical` layout renders the banner of the window's patient above it. The page
 * adds the sign and co-sign pattern (the design system's SignButton and SignDialog over the window's patient
 * context, with the simulated sign-in, KA-032, and a simulated server, KA-025) and the chooser of synthetic
 * patients. The locale and density switches and the command palette are in the frame; the watermark covers
 * every screen of a demo build.
 */
import { Message, SignButton, SignDialog } from '@hms/design-system';
import { useId, type ReactNode } from 'react';
import { useAppServices, usePatientContext } from '../app/services.tsx';
import { PatientChooser } from '../patient/patient-chooser.tsx';
import { useClinicalLayout } from '../routing/clinical-layout.tsx';
import { useUpdateSearch } from '../routing/search.ts';
import type { DemoModule } from './demo-module.ts';

export function DemoBannerPage({ demo }: { readonly demo: DemoModule }): ReactNode {
  const { store, directory } = useAppServices();
  const snapshot = usePatientContext();
  const { closeControl } = useClinicalLayout();
  const updateSearch = useUpdateSearch();
  const signHeadingId = useId();
  const fixturesHeadingId = useId();

  return (
    <div className="hms-demo">
      <h1 className="hms-page-title">
        <Message id="demo.banner.title" />
      </h1>
      <p className="hms-demo__notice">
        <Message id="demo.syntheticNotice" />
      </p>
      <section className="hms-demo__section" aria-labelledby={signHeadingId}>
        <h2 id={signHeadingId} className="hms-demo__heading">
          <Message id="sign.title" />
        </h2>
        <div className="hms-demo__actions">
          <SignButton kind="sign" snapshot={snapshot} send={store.send} />
          <SignButton kind="cosign" snapshot={snapshot} send={store.send} />
        </div>
        <SignDialog
          snapshot={snapshot}
          send={store.send}
          sessionUser={demo.sessionUser}
          authenticator={demo.authenticator}
          submit={demo.submit}
          review={<Message id="demo.syntheticNotice" />}
          rejectedFocusTarget={closeControl}
          contextDeps={store.deps}
        />
      </section>
      <section className="hms-demo__section" aria-labelledby={fixturesHeadingId}>
        <h2 id={fixturesHeadingId} className="hms-demo__heading">
          <Message id="demo.fixture.label" />
        </h2>
        <PatientChooser
          entries={directory.list()}
          label="demo.fixture.label"
          onChoose={(patientId) => {
            updateSearch({ patient: patientId });
          }}
        />
      </section>
    </div>
  );
}
