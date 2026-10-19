/**
 * The lab screen (patient-scoped: rendered under the PatientBanner by the clinical layout).
 *
 * - Above the tabs: the patient's critical results (potassium 6.8 mmol/L for Gulala Osman Rashid), with
 *   "Acknowledge critical result": read-back record, then the design system's sign dialog.
 * - Tab "Results": cumulative table, trends, corrected results, pending and text results.
 * - Tab "Specimens": this patient's specimens with a tracker; bedside collection (wristband scan, label
 *   preview and print, mark collected), all simulated hardware.
 * - Tab "Lab worklist": every patient's specimens by stage, with receive / start / reject (recollection task).
 *
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Changes live in the screen's own session store (lab-store.ts).
 */
import { Message, useIsModalOpen } from '@hms/design-system';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, findPatient, findStaff, resultsOf, type LabResult } from '../../data/index.ts';
import { useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useOpenPatient, useRole, useSign } from '../../shell/index.ts';
import { Badge, Button, Dialog, PageHeader, Tabs, useToast } from '../../ui/index.ts';
import { AckDialog, AckReview, type AckDraft } from './ack-dialog.tsx';
import { CollectDialog } from './collect-dialog.tsx';
import { CriticalPanel } from './critical-panel.tsx';
import { stageOf, type LabSpecimen } from './lab-data.ts';
import { labActions, useLabSpecimens, useLabState, type LabTab } from './lab-store.ts';
import { RejectDialog } from './reject-dialog.tsx';
import { ResultsTab } from './results-tab.tsx';
import { SpecimenLabel } from './specimen-label.tsx';
import { SpecimensTab } from './specimens-tab.tsx';
import { WorklistTab } from './worklist-tab.tsx';
import './lab.css';
import { messages } from './messages.ts';

interface PendingSign {
  readonly result: LabResult;
  readonly draft: AckDraft;
}

function isLabTab(value: string): value is LabTab {
  return value === 'results' || value === 'specimens' || value === 'worklist';
}

export function LabScreen(): ReactNode {
  const t = useT(messages);
  const toast = useToast();
  const { patient, actionsDisabled } = useClinicalPatient();
  const { roleId, user, setRole } = useRole();
  const sign = useSign();
  const openPatient = useOpenPatient();
  const isModalOpen = useIsModalOpen();
  const lab = useLabState();
  const all = useLabSpecimens(lab);
  const mine = useMemo(() => all.filter((specimen) => specimen.patientId === patient.id), [all, patient.id]);
  const results = useMemo(() => resultsOf(patient.id), [patient.id]);
  const criticals = results.filter((result) => result.critical !== null);
  const unacknowledged = criticals.filter((result) => result.critical?.acknowledged !== true && lab.acks[result.id] === undefined);

  const [collectId, setCollectId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [labelId, setLabelId] = useState<string | null>(null);
  const [ackResultId, setAckResultId] = useState<string | null>(null);
  const [signTick, setSignTick] = useState(0);
  const pendingSign = useRef<PendingSign | null>(null);

  // Collection asked for from the worklist before this patient's record was opened.
  useEffect(() => {
    if (isModalOpen || collectId !== null) {
      return;
    }
    const id = labActions.takePendingCollect(patient.id);
    if (id !== null) {
      setCollectId(id);
    }
  }, [patient.id, isModalOpen, collectId]);

  // Step 2 of the acknowledgement: the sign dialog, once the read-back dialog has released the modal slot.
  useEffect(() => {
    if (ackResultId !== null || isModalOpen) {
      return;
    }
    const pending = pendingSign.current;
    if (pending === null) {
      return;
    }
    pendingSign.current = null;
    const signer = user;
    const accepted = sign.requestSign({
      review: <AckReview result={pending.result} patient={patient} draft={pending.draft} />,
      onSigned: () => {
        labActions.acknowledge({
          resultId: pending.result.id,
          acknowledgedById: signer.id,
          acknowledgedIso: DEMO_NOW_ISO,
          callerId: pending.draft.callerId,
          informedId: pending.draft.informedId,
          informedAt: pending.draft.informedAt,
          actions: pending.draft.actions,
        });
      },
    });
    if (!accepted) {
      toast({ tone: 'warning', title: t('signRefused') });
    }
  }, [ackResultId, isModalOpen, signTick, sign, patient, user, toast, t]);

  const blockedByBanner = actionsDisabled || sign.blockedByBanner;
  const ackBlockedReason = blockedByBanner ? t('blockedBanner') : roleId === 'physician' ? null : t('ackPhysicianOnly');
  const collectBlockedReason = blockedByBanner
    ? t('blockedBanner')
    : roleId === 'physician' || roleId === 'nurse'
      ? null
      : t('collectRoleOnly');

  const toCollect = mine.filter((specimen) => specimen.status === 'ordered').length;
  const inLab = mine.filter((specimen) => ['transit', 'received', 'process'].includes(stageOf(specimen.status))).length;
  const openLabWork = all.filter((specimen) => ['collect', 'transit', 'received', 'process'].includes(stageOf(specimen.status))).length;

  const defaultTab: LabTab = roleId === 'nurse' && toCollect > 0 ? 'specimens' : 'results';
  const tab = lab.tab ?? defaultTab;

  const collectSpecimen = collectId === null ? undefined : mine.find((specimen) => specimen.id === collectId);
  const rejectSpecimen = rejectId === null ? undefined : all.find((specimen) => specimen.id === rejectId);
  const rejectPatient = rejectSpecimen === undefined ? undefined : findPatient(rejectSpecimen.patientId);
  const labelSpecimen = labelId === null ? undefined : mine.find((specimen) => specimen.id === labelId);
  const ackResult = ackResultId === null ? undefined : criticals.find((result) => result.id === ackResultId);

  const receive = (specimen: LabSpecimen): void => {
    labActions.receive(specimen.id);
    toast({ tone: 'success', title: t('receivedToast'), body: t('receivedToastBody', { id: specimen.id }) });
  };

  const collectFromWorklist = (specimen: LabSpecimen): void => {
    if (specimen.patientId === patient.id) {
      setCollectId(specimen.id);
      return;
    }
    labActions.requestCollectAfterSwitch(specimen.id, specimen.patientId);
    openPatient(specimen.patientId, 'lab');
  };

  const viewResults = (patientId: string): void => {
    labActions.setTab('results');
    if (patientId !== patient.id) {
      openPatient(patientId, 'lab');
    }
  };

  const tabs = [
    {
      id: 'results',
      label: t('tabResults'),
      badge: unacknowledged.length > 0 ? t('badgeCritical', { count: unacknowledged.length }) : String(results.length),
      content: <ResultsTab patient={patient} specimens={all} onShowSpecimens={() => { labActions.setTab('specimens'); }} />,
    },
    {
      id: 'specimens',
      label: t('tabSpecimens'),
      badge: toCollect > 0 ? t('badgeToCollect', { count: toCollect }) : String(mine.length),
      content: (
        <SpecimensTab
          specimens={mine}
          collectBlockedReason={collectBlockedReason}
          onCollect={setCollectId}
          onLabel={setLabelId}
          onReject={setRejectId}
          onReceive={(id) => {
            const specimen = mine.find((candidate) => candidate.id === id);
            if (specimen !== undefined) {
              receive(specimen);
            }
          }}
          onViewResults={() => { labActions.setTab('results'); }}
        />
      ),
    },
    {
      id: 'worklist',
      label: t('tabWorklist'),
      badge: String(openLabWork),
      content: (
        <WorklistTab
          currentPatientId={patient.id}
          specimens={all}
          acks={lab.acks}
          collectBlockedReason={collectBlockedReason}
          onCollect={collectFromWorklist}
          onReceive={receive}
          onStart={(specimen) => {
            labActions.startAnalysis(specimen.id);
            toast({ tone: 'info', title: t('startedToast'), body: t('startedToastBody', { id: specimen.id }) });
          }}
          onReject={(specimen) => { setRejectId(specimen.id); }}
          onViewResults={viewResults}
          onReset={() => {
            labActions.reset();
            toast({ tone: 'info', title: t('resetToast') });
          }}
        />
      ),
    },
  ];

  return (
    <div className="lab-screen" data-patient-id={patient.id}>
      <PageHeader icon="flask" eyebrow={<Message id="proto.nav.lab" />} title={t('title')} subtitle={t('subtitle')}>
        <div className="lab-summary" aria-label={t('summaryLabel')} role="group">
          {unacknowledged.length > 0 ? (
            <Badge tone="danger" strong icon="alert">
              {t('summaryCritical', { count: unacknowledged.length })}
            </Badge>
          ) : null}
          {toCollect > 0 ? (
            <Badge tone="warning" icon="droplet">
              {t('summaryToCollect', { count: toCollect })}
            </Badge>
          ) : null}
          {inLab > 0 ? (
            <Badge tone="info" icon="activity">
              {t('summaryInLab', { count: inLab })}
            </Badge>
          ) : null}
          {unacknowledged.length === 0 && toCollect === 0 && inLab === 0 ? (
            <Badge tone="success" icon="check-circle">
              {t('summaryNothingOpen')}
            </Badge>
          ) : null}
          <Badge tone="neutral" icon="info" size="sm">
            {t('simulatedFeed')}
          </Badge>
        </div>
      </PageHeader>

      {criticals.map((result) => (
        <CriticalPanel
          key={result.id}
          result={result}
          ack={lab.acks[result.id]}
          blockedReason={ackBlockedReason}
          onActAsPhysician={!blockedByBanner && roleId !== 'physician' ? () => { setRole('physician'); } : null}
          onAcknowledge={() => {
            setAckResultId(result.id);
          }}
        />
      ))}

      <Tabs
        aria-label={t('tabsLabel')}
        items={tabs}
        selectedKey={tab}
        onSelectionChange={(id) => {
          if (isLabTab(id)) {
            labActions.setTab(id);
          }
        }}
      />

      {collectSpecimen === undefined ? null : (
        <CollectDialog
          key={collectSpecimen.id}
          specimen={collectSpecimen}
          patient={patient}
          user={user}
          isOpen
          onClose={() => {
            setCollectId(null);
          }}
        />
      )}

      {rejectSpecimen === undefined || rejectPatient === undefined ? null : (
        <RejectDialog
          key={rejectSpecimen.id}
          specimen={rejectSpecimen}
          patient={rejectPatient}
          user={user}
          isOpen
          onClose={() => {
            setRejectId(null);
          }}
        />
      )}

      {labelSpecimen === undefined ? null : (
        <Dialog
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              setLabelId(null);
            }
          }}
          title={t('labelDialogTitle')}
          subtitle={`${labelSpecimen.id} · ${t('simulatedPrinter')}`}
          size="lg"
          actions={
            <>
              <Button
                variant="secondary"
                onPress={() => {
                  setLabelId(null);
                }}
              >
                {t('close')}
              </Button>
              <Button
                variant="primary"
                icon="printer"
                onPress={() => {
                  labActions.markPrinted(labelSpecimen.id);
                  toast({ tone: 'info', title: t('printedToast'), body: t('printedToastBody') });
                  setLabelId(null);
                }}
              >
                {t('reprintLabel')}
              </Button>
            </>
          }
        >
          <figure className="lab-label-figure">
            <SpecimenLabel
              specimen={labelSpecimen}
              patient={patient}
              collectedIso={labelSpecimen.collectedIso ?? DEMO_NOW_ISO}
              collector={findStaff(labelSpecimen.collectedById)}
              label={t('labelAria', { name: patient.name.latin, mrn: patient.mrn, id: labelSpecimen.id })}
            />
            <figcaption className="lab-muted">{t('labelCaption')}</figcaption>
          </figure>
        </Dialog>
      )}

      {ackResult === undefined ? null : (
        <AckDialog
          key={ackResult.id}
          result={ackResult}
          patient={patient}
          user={user}
          isOpen
          onCancel={() => {
            setAckResultId(null);
          }}
          onContinue={(draft) => {
            pendingSign.current = { result: ackResult, draft };
            setAckResultId(null);
            setSignTick((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
