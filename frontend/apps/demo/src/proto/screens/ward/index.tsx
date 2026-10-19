/**
 * Ward & beds: the bed board of the four wards. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * - Ward picker with each ward's occupancy; the ward's census (occupancy, available beds, admissions and
 *   discharges today, pending transfers); what needs attention (open critical results, early warning scores).
 * - The board: one tile per bed in its state colour (available, occupied, cleaning, blocked, reserved), with
 *   the occupant (two identifiers), early warning score, isolation, fall risk, allergies and expected
 *   discharge; filters and a legend. Selecting a bed shows its details and next steps beside the board.
 * - Admit (from the "awaiting a bed" list, available beds only, the others say why), transfer, discharge
 *   (checklist with what is missing), mark clean, return to service, release a reservation. The bed state
 *   machine (./state.ts) refuses any other move. Changes stay in this screen (no data is written).
 */
import { Bdi } from '@hms/design-system';
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react';
import { BED_STATE_LABEL, DEMO_NOW_ISO, findPatient, getStaff, getWard } from '../../data/index.ts';
import type { BedState, WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  Button,
  Callout,
  Card,
  Checkbox,
  Code,
  Dot,
  EmptyState,
  Grid,
  Icon,
  PageHeader,
  PatientInline,
  Qty,
  SearchField,
  Segmented,
  StaffName,
  StatTile,
  personName,
  useToast,
} from '../../ui/index.ts';
import { AdmitDialog } from './admit-dialog.tsx';
import { BedPanel } from './bed-panel.tsx';
import { BedTile } from './bed-tile.tsx';
import {
  ADMISSIONS_BEFORE_NOW,
  BED_REQUESTS,
  DISCHARGES_BEFORE_NOW,
  LAST_HANDOVER_ISO,
  TRANSFER_REQUESTS,
  earlyWarningOf,
  hasFallRisk,
  openCriticalsOf,
  type TransferReason,
} from './board-data.ts';
import { AllergyBadge, EarlyWarningBadge, FallRiskBadge, dischargeWhen, stayOf, useBandLabel, useDeferredOpenPatient } from './bits.tsx';
import { DischargeDialog } from './discharge-dialog.tsx';
import { messages } from './messages.ts';
import { ActivityCard, AwaitingCard, RulesCard, TransfersCard } from './side-cards.tsx';
import {
  boardReducer,
  liveBedOfPatient,
  liveBedsOfWard,
  loadSessionBoard,
  saveSessionBoard,
  wardCounts,
  type BoardState,
  type LiveBed,
} from './state.ts';
import { TransferDialog } from './transfer-dialog.tsx';
import { WardPicker } from './ward-picker.tsx';
import './ward.css';

type StateFilter = 'all' | BedState;
const STATE_FILTERS: readonly StateFilter[] = ['all', 'available', 'occupied', 'cleaning', 'blocked', 'reserved'];

interface Flags {
  readonly isolation: boolean;
  readonly fall: boolean;
  readonly warning: boolean;
  readonly discharge: boolean;
}
const NO_FLAGS: Flags = { isolation: false, fall: false, warning: false, discharge: false };

type DialogState =
  | { readonly kind: 'admit'; readonly requestId: string | null; readonly bedId: string | null; readonly wardId: WardId }
  | { readonly kind: 'transfer'; readonly bedId: string; readonly requestId: string | null }
  | { readonly kind: 'discharge'; readonly bedId: string }
  | null;

const LEGEND_STATES: readonly BedState[] = ['available', 'occupied', 'cleaning', 'blocked', 'reserved'];

export function WardScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const bandLabel = useBandLabel();
  const [board, dispatch] = useReducer(boardReducer, undefined, loadSessionBoard);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [flags, setFlags] = useState<Flags>(NO_FLAGS);
  const [query, setQuery] = useState('');

  useEffect(() => {
    saveSessionBoard(board);
  }, [board]);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);
  const openPatient = useDeferredOpenPatient(dialog !== null, closeDialog);

  const wardId = board.wardId;
  const ward = getWard(wardId);
  const wardName = f.text(ward.name);
  const beds = liveBedsOfWard(board, wardId);
  const counts = wardCounts(board, wardId);
  const selectedBed = selectedBedId === null ? undefined : board.beds[selectedBedId];

  const nameOf = (patientId: string | null): string => {
    const patient = findPatient(patientId);
    return patient === undefined ? '' : personName(patient.name, f.locale);
  };

  // ---- Census -------------------------------------------------------------------------------------------
  const occupants = beds.flatMap((bed) => {
    const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;
    return patient === undefined ? [] : [{ bed, patient }];
  });
  const expectedToday = occupants.filter(({ bed, patient }) => dischargeWhen(stayOf(board, patient.id, bed.wardId).expectedDischargeOn) === 'today').length;
  const waitingHere = BED_REQUESTS.filter((request) => board.waiting.includes(request.id) && request.requestedWardId === wardId).length;
  const pending = TRANSFER_REQUESTS.filter((request) => board.transfers.includes(request.id));
  const inbound = pending.filter((request) => request.toWardId === wardId);
  const outbound = pending.filter((request) => liveBedOfPatient(board, request.patientId)?.wardId === wardId);
  const transfersHere = new Set([...inbound, ...outbound].map((request) => request.id)).size;
  const admissions = ADMISSIONS_BEFORE_NOW[wardId] + board.admittedToday[wardId];
  const discharges = DISCHARGES_BEFORE_NOW[wardId] + board.dischargedToday[wardId];

  // ---- Attention ----------------------------------------------------------------------------------------
  const attention = occupants.flatMap(({ bed, patient }) => {
    const criticals = openCriticalsOf(patient.id);
    const warning = earlyWarningOf(patient, bed.wardId);
    if (criticals.length === 0 && warning.band === 'low') {
      return [];
    }
    return [{ bed, patient, criticals, warning }];
  });
  const attentionTone = attention.some((item) => item.criticals.length > 0 || item.warning.band === 'high') ? 'danger' : 'warning';

  // ---- Filters ------------------------------------------------------------------------------------------
  const anyFlag = flags.isolation || flags.fall || flags.warning || flags.discharge;
  const needle = query.trim().toLowerCase();
  const filtered = stateFilter !== 'all' || anyFlag || needle !== '';
  const matches = (bed: LiveBed): boolean => {
    if (stateFilter !== 'all' && bed.state !== stateFilter) {
      return false;
    }
    const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;
    if (anyFlag) {
      if (patient === undefined) {
        return false;
      }
      if (flags.isolation && patient.isolation === null) {
        return false;
      }
      if (flags.fall && !hasFallRisk(patient)) {
        return false;
      }
      if (flags.warning && earlyWarningOf(patient, bed.wardId).band === 'low') {
        return false;
      }
      if (flags.discharge && dischargeWhen(stayOf(board, patient.id, bed.wardId).expectedDischargeOn) !== 'today') {
        return false;
      }
    }
    if (needle !== '') {
      const haystack = [bed.id, patient?.mrn ?? '', patient?.name.latin ?? '', patient?.name.ckb ?? '', patient?.name.ar ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  };
  const shown = beds.filter(matches);
  const clearFilters = (): void => {
    setStateFilter('all');
    setFlags(NO_FLAGS);
    setQuery('');
  };

  // ---- Actions ------------------------------------------------------------------------------------------
  const selectWard = (next: WardId): void => {
    dispatch({ type: 'selectWard', wardId: next });
    setSelectedBedId(null);
  };

  const admit = (patientId: string, bedId: string, requestId: string): void => {
    const bed = board.beds[bedId];
    dispatch({ type: 'admit', patientId, bedId, requestId });
    if (bed !== undefined) {
      dispatch({ type: 'selectWard', wardId: bed.wardId });
    }
    setSelectedBedId(bedId);
    setDialog(null);
    clearFilters();
    toast({ tone: 'success', title: t('admittedToast', { name: nameOf(patientId), bed: bedId }), body: t('admittedBody') });
  };

  const transfer = (fromBedId: string, toBedId: string, requestId: string | null, reason: TransferReason): void => {
    const from = board.beds[fromBedId];
    const to = board.beds[toBedId];
    dispatch({ type: 'transfer', fromBedId, toBedId, requestId, reason });
    if (to !== undefined) {
      dispatch({ type: 'selectWard', wardId: to.wardId });
    }
    setSelectedBedId(toBedId);
    setDialog(null);
    clearFilters();
    toast({
      tone: 'success',
      title: t('transferredToast', { name: nameOf(from?.patientId ?? null), bed: toBedId }),
      body: t('transferredBody', { bed: fromBedId }),
    });
  };

  const discharge = (bedId: string): void => {
    const bed = board.beds[bedId];
    dispatch({ type: 'discharge', bedId });
    setDialog(null);
    toast({ tone: 'success', title: t('dischargedToast', { name: nameOf(bed?.patientId ?? null) }), body: t('dischargedBody', { bed: bedId }) });
  };

  return (
    <div className="ward-screen">
      <PageHeader
        icon="bed"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle', { time: f.time(DEMO_NOW_ISO), handover: f.time(LAST_HANDOVER_ISO) })}
        actions={
          <>
            <Button
              variant="ghost"
              icon="refresh"
              onPress={() => {
                dispatch({ type: 'reset' });
                setSelectedBedId(null);
                toast({ tone: 'info', title: t('resetDone'), body: t('resetBody') });
              }}
            >
              {t('resetBoard')}
            </Button>
            <Button
              variant="primary"
              icon="plus"
              onPress={() => {
                setDialog({ kind: 'admit', requestId: null, bedId: null, wardId });
              }}
            >
              {t('admitPatient')}
            </Button>
          </>
        }
      />

      <WardPicker board={board} value={wardId} onChange={selectWard} />

      <div className="ward-meta">
        <span className="ward-meta__item">
          <span className="ward-meta__icon">
            <Icon name="building" size="1em" />
          </span>
          <span className="ward-meta__label">{t('location')}</span>
          <span>{f.text(ward.floor)}</span>
        </span>
        <span className="ward-meta__item">
          <span className="ward-meta__icon">
            <Icon name="user" size="1em" />
          </span>
          <span className="ward-meta__label">{t('chargeNurse')}</span>
          <StaffName member={getStaff(ward.chargeNurseId)} />
        </span>
        <span className="ward-meta__item">
          <span className="ward-meta__icon">
            <Icon name="stethoscope" size="1em" />
          </span>
          <span className="ward-meta__label">{t('consultant')}</span>
          <StaffName member={getStaff(ward.consultantId)} />
        </span>
        <span className="ward-meta__item">
          <span className="ward-meta__icon">
            <Icon name="phone" size="1em" />
          </span>
          <span className="ward-meta__label">{t('extension')}</span>
          <Code>{ward.phoneExt}</Code>
        </span>
      </div>

      <section className="ward-census" aria-labelledby="ward-census-title">
        <h2 id="ward-census-title" className="hms-visually-hidden">
          {t('censusTitle')}
        </h2>
        <Grid min="11.5rem" gap="md">
          <StatTile
            label={t('occupancy')}
            value={f.percent(counts.occupancy)}
            hint={t('occupancyHint', { occupied: counts.occupied, usable: counts.usable })}
            icon="bed"
            {...(counts.occupancy >= 0.95 ? { tone: 'warning' as const } : {})}
          />
          <StatTile
            label={t('availableNow')}
            value={String(counts.available)}
            hint={t('availableHint', { cleaning: counts.cleaning })}
            icon="check-circle"
            tone={counts.available === 0 ? 'warning' : 'success'}
            onPress={() => {
              setStateFilter('available');
            }}
          />
          <StatTile label={t('admissionsToday')} value={String(admissions)} hint={t('admissionsHint', { count: waitingHere })} icon="plus" />
          <StatTile label={t('dischargesToday')} value={String(discharges)} hint={t('dischargesHint', { count: expectedToday })} icon="logout" />
          <StatTile
            label={t('pendingTransfers')}
            value={String(transfersHere)}
            hint={t('transfersHint', { inbound: inbound.length, outbound: outbound.length })}
            icon="arrow-forward"
          />
        </Grid>
      </section>

      {attention.length === 0 ? (
        <Callout tone="success" icon="check-circle">
          {t('attentionNone')}
        </Callout>
      ) : (
        <Callout tone={attentionTone} title={t('attentionTitle')}>
          <ul className="ward-attention">
            {attention.map(({ bed, patient, criticals, warning }) => (
              <li key={bed.id} className="ward-attention__item">
                <span className="ward-attention__bed">
                  <Bdi dir="ltr">{bed.id}</Bdi>
                </span>
                <span className="ward-attention__who">
                  <PatientInline patient={patient} />
                </span>
                <span className="ward-attention__what">
                  {criticals.map((result) => (
                    <span key={result.id} className="ward-attention__critical">
                      <Icon name="flask" size="1em" />
                      {t.rich('attentionCritical', { analyte: f.text(result.analyte), value: <Qty value={result.value} unit={result.unit} /> })}
                    </span>
                  ))}
                  {warning.band === 'low' ? null : (
                    <span>{t('attentionWarning', { scale: warning.scale, score: warning.score, band: bandLabel(warning.band) })}</span>
                  )}
                </span>
                <span className="ward-attention__action">
                  {criticals.length > 0 ? (
                    <Button
                      size="sm"
                      variant="danger"
                      icon="flask"
                      onPress={() => {
                        openPatient(patient.id, 'lab');
                      }}
                    >
                      {t('openLab')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="chart"
                      onPress={() => {
                        openPatient(patient.id, 'chart');
                      }}
                    >
                      {t('openChart')}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="ward-layout">
        <Card
          className="ward-board-card"
          title={t('boardLabel', { ward: wardName })}
          icon="bed"
          actions={
            <span className="ward-board-card__count">
              {t('showing', { shown: shown.length, total: beds.length })}
              {filtered ? (
                <Button variant="ghost" size="sm" icon="x" onPress={clearFilters}>
                  {t('clearFilters')}
                </Button>
              ) : null}
            </span>
          }
        >
          <div className="ward-filters" role="group" aria-label={t('filtersLabel')}>
            <Segmented
              label={t('stateFilter')}
              hideLabel
              options={STATE_FILTERS.map((id) => ({
                id,
                label: id === 'all' ? `${t('all')} (${String(counts.total)})` : `${f.text(BED_STATE_LABEL[id])} (${String(counts[id])})`,
              }))}
              value={stateFilter}
              onChange={(id) => {
                const next = STATE_FILTERS.find((candidate) => candidate === id);
                if (next !== undefined) {
                  setStateFilter(next);
                }
              }}
            />
            <SearchField label={t('searchLabel')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="ward-filters__search" />
          </div>
          <div className="ward-flags" role="group" aria-label={t('flagsLabel')}>
            <Checkbox isSelected={flags.isolation} onChange={(on) => { setFlags((current) => ({ ...current, isolation: on })); }}>
              {t('flagIsolation')}
            </Checkbox>
            <Checkbox isSelected={flags.fall} onChange={(on) => { setFlags((current) => ({ ...current, fall: on })); }}>
              {t('flagFallRisk')}
            </Checkbox>
            <Checkbox isSelected={flags.warning} onChange={(on) => { setFlags((current) => ({ ...current, warning: on })); }}>
              {t('flagWarning')}
            </Checkbox>
            <Checkbox isSelected={flags.discharge} onChange={(on) => { setFlags((current) => ({ ...current, discharge: on })); }}>
              {t('flagDischarge')}
            </Checkbox>
          </div>

          <div className="ward-legend" aria-label={t('legendTitle')} role="group">
            {LEGEND_STATES.map((state) => (
              <span key={state} className={`ward-legend__item ward-legend__swatch--${state}`}>
                <span className="ward-legend__swatch" aria-hidden="true" />
                <span>{f.text(BED_STATE_LABEL[state])}</span>
                <span className="ward-legend__count">{counts[state]}</span>
              </span>
            ))}
            <span className="ward-legend__sep" aria-hidden="true" />
            <span className="ward-legend__item">
              <Icon name="isolation" size="1em" />
              <span>{t('legendIsolation')}</span>
            </span>
            <span className="ward-legend__item">
              <Dot tone="warning" />
              <span>{t('legendFall')}</span>
            </span>
            <span className="ward-legend__item">
              <Dot tone="danger" />
              <span>{t('legendAllergy')}</span>
            </span>
            <span className="ward-legend__item ward-legend__item--wide">
              <Icon name="activity" size="1em" />
              <span>{wardId === 'paeds' ? t('legendPews') : t('legendNews')}</span>
            </span>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon="filter"
              title={t('noMatch')}
              body={t('noMatchBody')}
              action={
                <Button icon="x" onPress={clearFilters}>
                  {t('clearFilters')}
                </Button>
              }
            />
          ) : (
            <div className="ward-board" role="group" aria-label={t('boardLabel', { ward: wardName })}>
              {shown.map((bed) => (
                <BedTile
                  key={bed.id}
                  bed={bed}
                  board={board}
                  isSelected={bed.id === selectedBedId}
                  onSelect={(id) => {
                    setSelectedBedId(id);
                  }}
                />
              ))}
            </div>
          )}
        </Card>

        <aside className="ward-side" aria-label={t('panelTitle')}>
          <BedPanel
            bed={selectedBed}
            board={board}
            onOpenPatient={openPatient}
            onTransfer={(bedId) => {
              setDialog({ kind: 'transfer', bedId, requestId: null });
            }}
            onDischarge={(bedId) => {
              setDialog({ kind: 'discharge', bedId });
            }}
            onAdmitHere={(bedId) => {
              setDialog({ kind: 'admit', requestId: null, bedId, wardId: board.beds[bedId]?.wardId ?? wardId });
            }}
            onMarkClean={(bedId) => {
              dispatch({ type: 'markClean', bedId });
              toast({ tone: 'success', title: t('markedClean', { bed: bedId }) });
            }}
            onReturnToService={(bedId) => {
              dispatch({ type: 'returnToService', bedId });
              toast({ tone: 'info', title: t('returnedToService', { bed: bedId }) });
            }}
            onRelease={(bedId) => {
              dispatch({ type: 'releaseReservation', bedId });
              toast({ tone: 'info', title: t('released', { bed: bedId }) });
            }}
            onPrintWristband={(bedId) => {
              toast({ tone: 'info', title: t('wristbandSent'), body: t('wristbandBody', { bed: bedId }) });
            }}
          />
          {selectedBed?.state === 'occupied' ? null : <WardFlagsSummary board={board} wardId={wardId} />}
        </aside>
      </div>

      <Grid min="24rem" gap="lg">
        <AwaitingCard
          board={board}
          wardId={wardId}
          onAdmit={(requestId) => {
            const request = BED_REQUESTS.find((candidate) => candidate.id === requestId);
            setDialog({ kind: 'admit', requestId, bedId: null, wardId: request?.requestedWardId ?? wardId });
          }}
          onOpenPatient={openPatient}
        />
        <TransfersCard
          board={board}
          wardId={wardId}
          onChooseBed={(requestId, fromBedId) => {
            setDialog({ kind: 'transfer', bedId: fromBedId, requestId });
          }}
        />
      </Grid>

      <Grid min="24rem" gap="lg">
        <ActivityCard board={board} wardId={wardId} />
        <RulesCard />
      </Grid>

      {dialog?.kind === 'admit' ? (
        <AdmitDialog
          board={board}
          initialRequestId={dialog.requestId}
          initialBedId={dialog.bedId}
          initialWardId={dialog.wardId}
          onClose={closeDialog}
          onAdmit={admit}
        />
      ) : null}
      {dialog?.kind === 'transfer' ? (
        <TransferDialog board={board} fromBedId={dialog.bedId} requestId={dialog.requestId} onClose={closeDialog} onTransfer={transfer} />
      ) : null}
      {dialog?.kind === 'discharge' ? (
        <DischargeDialog
          board={board}
          bedId={dialog.bedId}
          onClose={closeDialog}
          onCheck={(patientId, item) => {
            dispatch({ type: 'check', patientId, item });
          }}
          onDischarge={discharge}
          onOpenPatient={openPatient}
        />
      ) : null}
    </div>
  );
}

/** Under the panel when no patient is selected: the ward's patients with safety flags, at a glance. */
function WardFlagsSummary({ board, wardId }: { readonly board: BoardState; readonly wardId: WardId }): ReactNode {
  const t = useT(messages);
  const flagged = liveBedsOfWard(board, wardId).flatMap((bed) => {
    const patient = bed.state === 'occupied' ? findPatient(bed.patientId) : undefined;
    if (patient === undefined) {
      return [];
    }
    const fall = hasFallRisk(patient);
    const allergy = patient.allergies.kind !== 'nka';
    const warning = earlyWarningOf(patient, wardId);
    return fall || allergy || warning.band !== 'low' ? [{ bed, patient, fall, warning }] : [];
  });
  if (flagged.length === 0) {
    return null;
  }
  return (
    <Card title={t('flagsLabel')} icon="alert" headingLevel={2} className="ward-flagged">
      <ul className="ward-flagged__list">
        {flagged.map(({ bed, patient, fall, warning }) => (
          <li key={bed.id} className="ward-flagged__item">
            <span className="ward-flagged__bed">
              <Bdi dir="ltr">{bed.id}</Bdi>
            </span>
            <span className="ward-flagged__who">
              <PatientInline patient={patient} />
            </span>
            <span className="ward-flagged__badges">
              {warning.band === 'low' ? null : <EarlyWarningBadge warning={warning} />}
              {fall ? <FallRiskBadge /> : null}
              <AllergyBadge patient={patient} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
