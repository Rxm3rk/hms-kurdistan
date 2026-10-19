/**
 * The patient's specimens: one card per specimen with a tracker (ordered, collected, received, in analysis,
 * resulted, verified; or rejected), the tube, who collected it and how the patient was identified, and the
 * next action (collect, reprint the label, see the recollection task, view results).
 */
import type { ReactNode } from 'react';
import { findStaff } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Code, EmptyState, Icon, StaffName } from '../../ui/index.ts';
import { PRIORITY_RANK, type LabSpecimen } from './lab-data.ts';
import { PriorityBadge, StatusBadge, TubeSwatch } from './lab-parts.tsx';
import { messages } from './messages.ts';

type TrackStep = 'ordered' | 'collected' | 'received' | 'in-progress' | 'resulted' | 'verified';
const TRACK: readonly TrackStep[] = ['ordered', 'collected', 'received', 'in-progress', 'resulted', 'verified'];

const OPEN_RANK: Readonly<Record<LabSpecimen['status'], number>> = {
  ordered: 0,
  collected: 1,
  received: 2,
  'in-progress': 3,
  rejected: 4,
  resulted: 5,
  verified: 6,
};

export interface SpecimensTabProps {
  /** This patient's specimens. */
  readonly specimens: readonly LabSpecimen[];
  readonly collectBlockedReason: string | null;
  readonly onCollect: (specimenId: string) => void;
  readonly onLabel: (specimenId: string) => void;
  readonly onReject: (specimenId: string) => void;
  readonly onReceive: (specimenId: string) => void;
  readonly onViewResults: () => void;
}

function Tracker({ specimen }: { readonly specimen: LabSpecimen }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const label: Readonly<Record<TrackStep, string>> = {
    ordered: t('trackOrdered'),
    collected: t('trackCollected'),
    received: t('trackReceived'),
    'in-progress': t('trackAnalysis'),
    resulted: t('trackResulted'),
    verified: t('trackVerified'),
  };
  const time: Readonly<Record<TrackStep, string | null>> = {
    ordered: specimen.orderedIso,
    collected: specimen.collectedIso,
    received: specimen.receivedIso,
    'in-progress': null,
    resulted: specimen.resultedIso,
    verified: specimen.status === 'verified' ? specimen.resultedIso : null,
  };
  const rejected = specimen.status === 'rejected';
  // How far the specimen got: for a rejected one, the last step with a time.
  const reached = rejected
    ? specimen.receivedIso !== null
      ? 2
      : specimen.collectedIso !== null
        ? 1
        : 0
    : TRACK.indexOf(specimen.status as TrackStep);
  const steps = rejected ? TRACK.slice(0, reached + 1) : TRACK;
  return (
    <ol className="lab-track" aria-label={t('trackLabel')}>
      {steps.map((step, index) => {
        const state = index < reached ? 'done' : index === reached ? (rejected ? 'done' : 'current') : 'todo';
        const at = time[step];
        return (
          <li key={step} className="lab-track__step" data-state={state} {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}>
            <span className="lab-track__dot" aria-hidden="true">
              {state === 'done' ? <Icon name="check" size="0.8em" /> : null}
            </span>
            <span className="lab-track__label">{label[step]}</span>
            <span className="lab-track__time">{at === null ? '' : f.time(at)}</span>
          </li>
        );
      })}
      {rejected ? (
        <li className="lab-track__step" data-state="rejected" aria-current="step">
          <span className="lab-track__dot" aria-hidden="true">
            <Icon name="x" size="0.8em" />
          </span>
          <span className="lab-track__label">{t('trackRejected')}</span>
          <span className="lab-track__time">{specimen.rejectedIso === null ? '' : f.time(specimen.rejectedIso)}</span>
        </li>
      ) : null}
    </ol>
  );
}

export function SpecimensTab({ specimens, collectBlockedReason, onCollect, onLabel, onReject, onReceive, onViewResults }: SpecimensTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const sorted = specimens.toSorted(
    (a, b) => OPEN_RANK[a.status] - OPEN_RANK[b.status] || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.orderedIso.localeCompare(a.orderedIso),
  );
  if (sorted.length === 0) {
    return <EmptyState icon="droplet" title={t('noSpecimensTitle')} body={t('noSpecimensBody')} />;
  }
  const toCollect = sorted.filter((specimen) => specimen.status === 'ordered').length;
  return (
    <div className="lab-specimens">
      {toCollect > 0 ? (
        <Callout tone="warning" icon="droplet" title={t('toCollectTitle', { count: toCollect })}>
          {collectBlockedReason ?? t('toCollectBody')}
        </Callout>
      ) : null}
      {sorted.map((specimen) => {
        const collector = findStaff(specimen.collectedById);
        const rejector = findStaff(specimen.rejectedById);
        const tone = specimen.status === 'rejected' ? 'lab-specimen--rejected' : specimen.status === 'ordered' ? 'lab-specimen--open' : '';
        return (
          <article key={specimen.id} className={`lab-specimen ${tone}`} aria-labelledby={`lab-sp-${specimen.id}`}>
            <header className="lab-specimen__head">
              <div className="lab-specimen__titles">
                <h3 id={`lab-sp-${specimen.id}`} className="lab-specimen__title">
                  {f.text(specimen.panel)}
                </h3>
                <span className="lab-specimen__meta">
                  <TubeSwatch container={specimen.container} />
                  <span className="lab-muted">{f.text(specimen.specimenType)}</span>
                  <Code className="lab-muted">{specimen.id}</Code>
                </span>
              </div>
              <span className="lab-specimen__badges">
                <PriorityBadge priority={specimen.priority} />
                <StatusBadge status={specimen.status} />
                {specimen.recollectOf === null ? null : (
                  <Badge tone="warning" size="sm" icon="refresh">
                    {t('recollection')}
                  </Badge>
                )}
              </span>
            </header>

            <Tracker specimen={specimen} />

            {specimen.note === null ? null : (
              <p className="lab-specimen__note">
                <Icon name="info" size="1em" /> {f.text(specimen.note)}
              </p>
            )}
            {specimen.status === 'rejected' ? (
              <p className="lab-specimen__rejected">
                <Icon name="alert" size="1em" />{' '}
                {t.rich('rejectedBecause', {
                  reason: specimen.rejectionReason === null ? '' : f.text(specimen.rejectionReason),
                  name: rejector === undefined ? '' : <StaffName member={rejector} />,
                })}
                {specimen.rejectComment === null ? null : <span className="lab-muted"> · {specimen.rejectComment}</span>}
              </p>
            ) : null}

            <footer className="lab-specimen__foot">
              <span className="lab-muted lab-specimen__who">
                {collector === undefined
                  ? t('orderedAt', { time: f.time(specimen.orderedIso), date: f.date(specimen.orderedIso) })
                  : t.rich('collectedByLine', {
                      name: <StaffName member={collector} />,
                      check: specimen.identityCheck === 'manual' ? t('identityManual') : t('identityScan'),
                    })}
              </span>
              <span className="lab-actions-row">
                {specimen.status === 'ordered' ? (
                  <Button variant="primary" icon="droplet" isDisabled={collectBlockedReason !== null} onPress={() => { onCollect(specimen.id); }}>
                    {t('collect')}
                  </Button>
                ) : null}
                {specimen.status === 'collected' ? (
                  <Button variant="secondary" size="sm" icon="scan" onPress={() => { onReceive(specimen.id); }}>
                    {t('receive')}
                  </Button>
                ) : null}
                {specimen.collectedIso !== null && specimen.status !== 'rejected' ? (
                  <Button variant="ghost" size="sm" icon="printer" onPress={() => { onLabel(specimen.id); }}>
                    {t('reprintLabel')}
                  </Button>
                ) : null}
                {specimen.status === 'collected' || specimen.status === 'received' ? (
                  <Button variant="ghost" size="sm" icon="x" onPress={() => { onReject(specimen.id); }}>
                    {t('reject')}
                  </Button>
                ) : null}
                {specimen.status === 'resulted' || specimen.status === 'verified' ? (
                  <Button variant="secondary" size="sm" iconEnd="chevron-forward" onPress={onViewResults}>
                    {t('viewResults')}
                  </Button>
                ) : null}
              </span>
            </footer>
          </article>
        );
      })}
      <p className="lab-muted lab-footnote">{t('specimensFootnote')}</p>
    </div>
  );
}
