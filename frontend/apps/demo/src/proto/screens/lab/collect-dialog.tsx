/**
 * Specimen collection at the bedside, in three steps of one dialog:
 * 1. Confirm the patient: scan the wristband (simulated scanner). A wrong wristband stops the collection; an
 *    unreadable one needs a verbal check of two identifiers.
 * 2. Label: preview of the 50 x 25 mm label, print (simulated printer), attach at the bedside.
 * 3. Collect: the right tube, filled, then "Mark collected" (in transit to the lab).
 * Only for the window's patient: the worklist opens another patient's record first.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PatientIdentity } from '@hms/design-system';
import { CURATED_PATIENTS, DEMO_NOW_ISO, PATIENTS, bedOfPatient, findPatient, type Patient, type StaffMember } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { bannerModelOf } from '../../shell/index.ts';
import { Badge, Button, Callout, Checkbox, Code, Dialog, Icon, KeyValueList, PatientInline, StaffName, useToast } from '../../ui/index.ts';
import type { IdentityCheck, LabSpecimen } from './lab-data.ts';
import { PriorityBadge, TubeSwatch } from './lab-parts.tsx';
import { labActions, useLabState } from './lab-store.ts';
import { messages } from './messages.ts';
import { SpecimenLabel } from './specimen-label.tsx';

type Step = 'identify' | 'label' | 'collect';
const STEPS: readonly Step[] = ['identify', 'label', 'collect'];
type ScanState = 'idle' | 'scanning' | 'match' | 'mismatch' | 'manual';

/** A different patient's wristband for the "wrong wristband" simulation: the look-alike, else a neighbour. */
function wrongPatientFor(patient: Patient): Patient {
  const lookAlike: Readonly<Record<string, string>> = { 'SYN-PAT-0107': 'SYN-PAT-0108', 'SYN-PAT-0108': 'SYN-PAT-0107' };
  const twin = findPatient(lookAlike[patient.id]);
  if (twin !== undefined) {
    return twin;
  }
  const ward = bedOfPatient(patient.id)?.wardId;
  const neighbour = PATIENTS.find((candidate) => candidate.id !== patient.id && ward !== undefined && bedOfPatient(candidate.id)?.wardId === ward);
  return neighbour ?? CURATED_PATIENTS.find((candidate) => candidate.id !== patient.id) ?? patient;
}

export interface CollectDialogProps {
  readonly specimen: LabSpecimen;
  readonly patient: Patient;
  readonly user: StaffMember;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function CollectDialog({ specimen, patient, user, isOpen, onClose }: CollectDialogProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const lab = useLabState();
  const [step, setStep] = useState<Step>('identify');
  const [scan, setScan] = useState<ScanState>('idle');
  const [manualAsked, setManualAsked] = useState(false);
  const [manualBand, setManualBand] = useState(false);
  const [attached, setAttached] = useState(false);
  const [tubeOk, setTubeOk] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrong = wrongPatientFor(patient);
  const printed = lab.printed[specimen.id] ?? 0;

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const simulateScan = (result: 'match' | 'mismatch'): void => {
    setScan('scanning');
    timer.current = setTimeout(() => {
      setScan(result);
    }, 700);
  };

  const identity: IdentityCheck | null = scan === 'match' ? 'scan' : scan === 'manual' && manualAsked && manualBand ? 'manual' : null;
  const stepIndex = STEPS.indexOf(step);
  const canNext = step === 'identify' ? identity !== null : step === 'label' ? printed > 0 && attached : tubeOk && identity !== null;

  const next = (): void => {
    if (step === 'identify') {
      setStep('label');
    } else if (step === 'label') {
      setStep('collect');
    } else if (identity !== null) {
      labActions.collect(specimen.id, user.id, identity);
      toast({ tone: 'success', title: t('collectedToast'), body: t('collectedToastBody', { id: specimen.id }) });
      onClose();
    }
  };

  const back = (): void => {
    setStep(STEPS[Math.max(0, stepIndex - 1)] ?? 'identify');
  };

  const stepLabel: Readonly<Record<Step, string>> = { identify: t('stepIdentify'), label: t('stepLabel'), collect: t('stepCollect') };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t('collectTitle')}
      subtitle={`${f.text(specimen.panel)} · ${specimen.id}`}
      size="lg"
      actions={
        <>
          <Button variant="secondary" onPress={onClose}>
            {t('cancel')}
          </Button>
          {stepIndex > 0 ? (
            <Button variant="ghost" icon="chevron-back" onPress={back}>
              {t('back')}
            </Button>
          ) : null}
          <Button variant="primary" isDisabled={!canNext} onPress={next} {...(step === 'collect' ? { icon: 'check' as const } : { iconEnd: 'chevron-forward' as const })}>
            {step === 'collect' ? t('markCollected') : t('next')}
          </Button>
        </>
      }
    >
      <div className="lab-collect">
        <ol className="lab-steps" aria-label={t('stepsLabel')}>
          {STEPS.map((candidate, index) => (
            <li
              key={candidate}
              className="lab-steps__item"
              data-state={index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'}
              {...(index === stepIndex ? { 'aria-current': 'step' as const } : {})}
            >
              <span className="lab-steps__dot" aria-hidden="true">
                {index < stepIndex ? <Icon name="check" size="0.9em" /> : String(index + 1)}
              </span>
              <span>{stepLabel[candidate]}</span>
            </li>
          ))}
        </ol>

        {step === 'identify' ? (
          <div className="lab-collect__body">
            <p>{t('identifyIntro')}</p>
            <div className="lab-collect__expected">
              <p className="lab-collect__caption">{t('expectedPatient')}</p>
              <PatientIdentity model={bannerModelOf(patient.id)} />
            </div>
            <div className="lab-collect__scan">
              <Button variant="primary" icon="scan" onPress={() => { simulateScan('match'); }} isDisabled={scan === 'scanning'}>
                {t('scanWristband')}
              </Button>
              <Badge tone="info" icon="info" size="sm">
                {t('simulatedScanner')}
              </Badge>
              <Button variant="ghost" size="sm" onPress={() => { simulateScan('mismatch'); }} isDisabled={scan === 'scanning'}>
                {t('simulateWrongBand')}
              </Button>
              <Button variant="ghost" size="sm" onPress={() => { setScan('manual'); }} isDisabled={scan === 'scanning'}>
                {t('bandUnreadable')}
              </Button>
            </div>
            <div aria-live="polite" className="lab-collect__result">
              {scan === 'scanning' ? (
                <p className="lab-muted">
                  <Icon name="scan" /> {t('scanning')}
                </p>
              ) : null}
              {scan === 'match' ? (
                <Callout tone="success" title={t('scanMatchTitle')}>
                  {t('scanMatchBody')}
                </Callout>
              ) : null}
            </div>
            {scan === 'mismatch' ? (
              <Callout tone="danger" role="alert" title={t('scanMismatchTitle')}>
                <p>{t('scanMismatchBody')}</p>
                <div className="lab-compare">
                  <div className="lab-compare__item lab-compare__item--bad">
                    <span className="lab-compare__label">{t('scannedBand')}</span>
                    <PatientInline patient={wrong} secondary />
                  </div>
                  <div className="lab-compare__item">
                    <span className="lab-compare__label">{t('expectedPatient')}</span>
                    <PatientInline patient={patient} secondary />
                  </div>
                </div>
              </Callout>
            ) : null}
            {scan === 'manual' ? (
              <Callout tone="warning" title={t('manualTitle')}>
                <div className="lab-fieldset__options">
                  <Checkbox isSelected={manualAsked} onChange={setManualAsked}>
                    {t('manualAsk')}
                  </Checkbox>
                  <Checkbox isSelected={manualBand} onChange={setManualBand}>
                    {t('manualBand')}
                  </Checkbox>
                </div>
              </Callout>
            ) : null}
          </div>
        ) : null}

        {step === 'label' ? (
          <div className="lab-collect__label">
            <figure className="lab-label-figure">
              <SpecimenLabel
                specimen={specimen}
                patient={patient}
                collectedIso={DEMO_NOW_ISO}
                collector={user}
                label={t('labelAria', { name: patient.name.latin, mrn: patient.mrn, id: specimen.id })}
              />
              <figcaption className="lab-muted">{t('labelCaption')}</figcaption>
            </figure>
            <div className="lab-collect__label-side">
              <KeyValueList
                columns={1}
                items={[
                  { id: 'test', label: t('test'), value: f.text(specimen.panel) },
                  { id: 'type', label: t('specimenType'), value: f.text(specimen.specimenType) },
                  { id: 'tube', label: t('tube'), value: <TubeSwatch container={specimen.container} /> },
                  { id: 'priority', label: t('priority'), value: <PriorityBadge priority={specimen.priority} /> },
                  { id: 'barcode', label: t('barcode'), value: <Code>{specimen.id}</Code> },
                ]}
              />
              <div className="lab-collect__print">
                <Button
                  variant={printed > 0 ? 'secondary' : 'primary'}
                  icon="printer"
                  onPress={() => {
                    labActions.markPrinted(specimen.id);
                    toast({ tone: 'info', title: t('printedToast'), body: t('printedToastBody') });
                  }}
                >
                  {printed > 0 ? t('reprintLabel') : t('printLabel')}
                </Button>
                <Badge tone="info" icon="info" size="sm">
                  {t('simulatedPrinter')}
                </Badge>
              </div>
              {printed > 0 ? (
                <p className="lab-ok">
                  <Icon name="check-circle" /> {t('printedCount', { count: printed })}
                </p>
              ) : null}
              <Checkbox isSelected={attached} onChange={setAttached} isDisabled={printed === 0}>
                {t('labelAttached')}
              </Checkbox>
            </div>
          </div>
        ) : null}

        {step === 'collect' ? (
          <div className="lab-collect__body">
            {specimen.note === null ? null : (
              <Callout tone="warning" title={t('collectorNote')}>
                {f.text(specimen.note)}
              </Callout>
            )}
            <KeyValueList
              columns={2}
              items={[
                { id: 'patient', label: t('patient'), value: <PatientInline patient={patient} /> },
                { id: 'test', label: t('test'), value: f.text(specimen.panel) },
                { id: 'tube', label: t('tube'), value: <TubeSwatch container={specimen.container} /> },
                { id: 'when', label: t('collectedAt'), value: f.dateTime(DEMO_NOW_ISO) },
                { id: 'who', label: t('collectedBy'), value: <StaffName member={user} /> },
                {
                  id: 'identity',
                  label: t('identityCheck'),
                  value: identity === 'manual' ? t('identityManual') : t('identityScan'),
                },
              ]}
            />
            <Checkbox isSelected={tubeOk} onChange={setTubeOk}>
              {t('tubeCheck')}
            </Checkbox>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
