/**
 * The medicine part of order entry: formulary search, the dose field that refuses a number without a unit,
 * route, frequency, duration, indication and priority; the allergy check (blocking alert with an override
 * that needs a second prescriber's co-signature), duplicate and dose-range warnings.
 */
import { useState, type ReactNode } from 'react';
import { Button as AriaButton, FieldError, Input, Label, Text, TextField } from 'react-aria-components';
import {
  currentEncounter,
  PRIORITY_LABEL,
  ROUTE_LABEL,
  type Allergy,
  type Order,
  type OrderPriority,
  type Patient,
  type RouteId,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { SignAction, type SignRequest } from '../../shell/index.ts';
import { Badge, Button, Callout, Checkbox, Code, Icon, SearchField, Segmented, SelectField, TextInput, useToast } from '../../ui/index.ts';
import {
  DURATION,
  DURATION_IDS,
  FORMULARY,
  FREQUENCY,
  FREQUENCY_IDS,
  findDrug,
  type DurationId,
  type FormularyDrug,
  type FrequencyId,
} from './catalogue.ts';
import { AllergyAlertDialog, OverrideReview } from './dialogs.tsx';
import { checkDose, roundDose, UNIT_TEXT, type DoseCheck } from './dose.ts';
import { messages, type OrdersMessageKey } from './messages.ts';
import {
  ageYears,
  allergyMatches,
  allergyText3,
  blockingAllergy,
  medicationDuplicates,
  nextDraftId,
  same,
  type DraftOrder,
  type DraftOverride,
  type DraftWarning,
} from './model.ts';
import { DoseQty, WarningList } from './parts.tsx';

export interface MedicationFormProps {
  readonly patient: Patient;
  readonly existing: readonly Order[];
  readonly basket: readonly DraftOrder[];
  readonly onAdd: (drafts: readonly DraftOrder[]) => void;
  /** Opens the sign dialog after our own dialog has closed. */
  readonly requestSign: (request: SignRequest) => void;
  readonly allergyChecked: boolean;
  readonly onAllergyChecked: (checked: boolean) => void;
}

interface OverrideState extends DraftOverride {
  readonly drugId: string;
  readonly cosigned: boolean;
}

const PRIORITIES: readonly OrderPriority[] = ['routine', 'urgent', 'stat'];

const DOSE_ERROR_KEY: Readonly<Record<Exclude<DoseCheck, { ok: true }>['error'], OrdersMessageKey>> = {
  empty: 'doseErrEmpty',
  'no-unit': 'doseErrNoUnit',
  'no-number': 'doseErrNoNumber',
  'leading-decimal': 'doseErrLeading',
  'trailing-zero': 'doseErrTrailing',
  'bad-number': 'doseErrNumber',
  zero: 'doseErrZero',
  'unknown-unit': 'doseErrUnknownUnit',
  'unsafe-unit': 'doseErrUnsafeUnit',
  'unit-not-allowed': 'doseErrUnitNotAllowed',
  tenfold: 'doseErrTenfold',
};

function matchesQuery(drug: FormularyDrug, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return true;
  }
  return (
    drug.drug.toLowerCase().includes(q) ||
    drug.search.some((word) => word.toLowerCase().includes(q)) ||
    [drug.drugClass.en, drug.drugClass.ckb, drug.drugClass.ar].some((text) => text.toLowerCase().includes(q))
  );
}

export function MedicationForm({ patient, existing, basket, onAdd, requestSign, allergyChecked, onAllergyChecked }: MedicationFormProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [drugId, setDrugId] = useState<string | null>(null);
  const [alertDrugId, setAlertDrugId] = useState<string | null>(null);
  const [override, setOverride] = useState<OverrideState | null>(null);
  const [dose, setDose] = useState('');
  const [doseTouched, setDoseTouched] = useState(false);
  const [route, setRoute] = useState<RouteId>('po');
  const [frequency, setFrequency] = useState<FrequencyId>('daily');
  const [duration, setDuration] = useState<DurationId>('d5');
  const [indication, setIndication] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('routine');
  const [attempted, setAttempted] = useState(false);

  const drug = drugId === null ? undefined : findDrug(drugId);
  const alertDrug = alertDrugId === null ? null : (findDrug(alertDrugId) ?? null);
  const alertAllergy: Allergy | null = alertDrug === null ? null : (blockingAllergy(patient, alertDrug) ?? null);
  const notAssessed = patient.allergies.kind === 'not-assessed';
  const diagnoses = currentEncounter(patient.id)?.diagnoses ?? [];
  const sep = f.locale === 'en' ? ', ' : '، ';

  const select = (next: FormularyDrug): void => {
    setDrugId(next.id);
    setDose('');
    setDoseTouched(false);
    setRoute(next.defaultRoute);
    setFrequency(next.defaultFrequency);
    setDuration(next.defaultDuration);
    setAttempted(false);
    setOverride((current) => (current !== null && current.drugId === next.id ? current : null));
  };

  const choose = (next: FormularyDrug): void => {
    if (blockingAllergy(patient, next) !== undefined && !(override?.drugId === next.id && override.cosigned)) {
      setAlertDrugId(next.id);
      return;
    }
    select(next);
  };

  const onRemove = (): void => {
    const removed = alertDrug;
    setAlertDrugId(null);
    if (removed !== null) {
      toast({ tone: 'info', title: t('removedToast', { drug: removed.drug }) });
    }
  };

  const onOverride = (chosen: DraftOverride): void => {
    const target = alertDrug;
    if (target === null) {
      return;
    }
    const allergy = alertAllergy;
    setAlertDrugId(null);
    select(target);
    setOverride({ ...chosen, drugId: target.id, cosigned: false });
    requestSign({
      kind: 'cosign',
      review: <OverrideReview drug={target} allergy={allergy} override={chosen} />,
      onSigned: () => {
        setOverride((current) => (current !== null && current.drugId === target.id ? { ...current, cosigned: true } : current));
      },
    });
  };

  // ------------------------------------------------------------------ derived state of the chosen medicine
  const check = drug === undefined ? null : checkDose(dose, drug);
  const unitsText = drug === undefined ? '' : drug.units.map((unit) => UNIT_TEXT[unit]).join(sep);
  const doseErrorVisible = check !== null && !check.ok && (attempted || (doseTouched && check.error !== 'empty'));
  const doseErrorText =
    check === null || check.ok || drug === undefined
      ? ''
      : t(DOSE_ERROR_KEY[check.error], {
          example: drug.example,
          units: unitsText,
          unit: check.unitTyped,
          safe: check.safe,
          drug: drug.drug,
          max: drug.maxSingle.label,
        });
  const blocker = drug === undefined ? undefined : blockingAllergy(patient, drug);
  const overrideForDrug = drug !== undefined && override !== null && override.drugId === drug.id ? override : null;
  const blocked = blocker !== undefined && !(overrideForDrug?.cosigned ?? false);
  const indicationMissing = indication.trim() === '';

  const warnings: DraftWarning[] = [];
  if (drug !== undefined) {
    if (check?.ok === true && check.aboveMax) {
      warnings.push({ tone: 'warning', key: 'doseWarnHigh', vars: { max: drug.maxSingle.label } });
    }
    for (const match of allergyMatches(patient, drug)) {
      if (match.level === 'caution') {
        warnings.push({ tone: 'warning', key: 'crossReactWarn', vars: { allergy: allergyText3(match.allergy) } });
      } else if (match.level === 'note') {
        warnings.push({ tone: 'info', key: 'codeineNote', vars: { allergy: allergyText3(match.allergy) } });
      }
    }
    warnings.push(...medicationDuplicates(drug, existing, basket));
    if (drug.highAlert) {
      warnings.push({ tone: 'info', key: 'highAlertNote' });
    }
  }

  // Weight-based suggestion for children with a recorded weight.
  const kg = patient.weight === null ? null : Number(patient.weight.kg);
  const suggestion =
    drug !== undefined && drug.perKg !== null && kg !== null && ageYears(patient) < 16
      ? roundDose(Math.min(drug.perKg * kg, drug.maxSingle.value))
      : null;
  const baseUnit = drug?.units[0] ?? 'mg';

  const add = (): void => {
    setAttempted(true);
    if (drug === undefined || check === null || !check.ok || indicationMissing || blocked || (notAssessed && !allergyChecked)) {
      return;
    }
    const draft: DraftOrder = {
      id: nextDraftId(),
      category: 'medication',
      title: same(drug.drug),
      code: null,
      priority,
      medication: {
        drugId: drug.id,
        drug: drug.drug,
        dose: check.value,
        unit: check.unit,
        route,
        frequency,
        duration,
        indication: indication.trim(),
        highAlert: drug.highAlert,
      },
      detail: null,
      warnings: overrideForDrug === null ? warnings : [...warnings, { tone: 'danger', key: 'overrideCosigned', vars: { reason: overrideForDrug.reason } }],
      override: overrideForDrug === null ? null : { reason: overrideForDrug.reason, comment: overrideForDrug.comment },
      fromSet: null,
    };
    onAdd([draft]);
    toast({ tone: 'success', title: t('addedToast'), body: drug.drug });
    setDrugId(null);
    setQuery('');
    setDose('');
    setDoseTouched(false);
    setIndication('');
    setPriority('routine');
    setAttempted(false);
    setOverride(null);
  };

  const results = FORMULARY.filter((candidate) => matchesQuery(candidate, query));

  return (
    <div className="orders-form">
      <AllergyAlertDialog
        key={alertDrugId ?? 'none'}
        drug={alertDrug}
        allergy={alertAllergy}
        onRemove={onRemove}
        onOverride={onOverride}
      />

      {notAssessed ? (
        <Callout tone="warning" title={t('notAssessed')}>
          <p>{t('notAssessedWarn')}</p>
          <Checkbox isSelected={allergyChecked} onChange={onAllergyChecked}>
            {t('notAssessedConfirm')}
          </Checkbox>
        </Callout>
      ) : null}

      {drug === undefined ? (
        <div className="orders-search">
          <SearchField label={t('searchLabel')} value={query} onChange={setQuery} placeholder={t('searchPlaceholder')} />
          <p className="orders-muted orders-small">{t('formularyNote')}</p>
          {results.length === 0 ? (
            <p className="orders-muted">{t('noMatch', { query })}</p>
          ) : (
            <ul className="orders-formulary" aria-label={t('searchLabel')}>
              {results.map((candidate) => {
                const matches = allergyMatches(patient, candidate);
                const blocks = matches.some((match) => match.level === 'block');
                const caution = matches.some((match) => match.level === 'caution');
                return (
                  <li key={candidate.id}>
                    <AriaButton className={blocks ? 'orders-drug orders-drug--blocked' : 'orders-drug'} onPress={() => choose(candidate)}>
                      <span className="orders-drug__name">
                        <Code>{candidate.drug}</Code>
                      </span>
                      <span className="orders-drug__class">{f.text(candidate.drugClass)}</span>
                      <span className="orders-drug__forms">{f.text(candidate.forms)}</span>
                      <span className="orders-drug__badges">
                        {blocks ? (
                          <Badge tone="danger" size="sm" icon="alert" strong>
                            {t('allergyBadge')}
                          </Badge>
                        ) : null}
                        {caution ? (
                          <Badge tone="warning" size="sm" icon="alert">
                            {t('cautionBadge')}
                          </Badge>
                        ) : null}
                        {candidate.highAlert ? (
                          <Badge tone="warning" size="sm" icon="shield">
                            {t('highAlert')}
                          </Badge>
                        ) : null}
                      </span>
                    </AriaButton>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="orders-med">
          <div className="orders-med__head">
            <div>
              <p className="orders-eyebrow">{t('selectedMedicine')}</p>
              <p className="orders-med__name">
                <Icon name="pill" />
                <Code>{drug.drug}</Code>
                {drug.highAlert ? (
                  <Badge tone="warning" size="sm" icon="shield">
                    {t('highAlert')}
                  </Badge>
                ) : null}
                {overrideForDrug === null ? null : (
                  <Badge tone="danger" size="sm" icon="alert">
                    {t('overrideBadge')}
                  </Badge>
                )}
              </p>
              <p className="orders-muted orders-small">
                {f.text(drug.drugClass)} · {f.text(drug.forms)}
              </p>
            </div>
            <Button variant="ghost" size="sm" icon="refresh" onPress={() => setDrugId(null)}>
              {t('changeMedicine')}
            </Button>
          </div>

          {overrideForDrug !== null && !overrideForDrug.cosigned ? (
            <Callout
              tone="danger"
              title={t('overridePending')}
              actions={
                <SignAction
                  kind="cosign"
                  label={t('cosignOverride')}
                  variant="danger"
                  size="sm"
                  review={<OverrideReview drug={drug} allergy={blocker ?? null} override={overrideForDrug} />}
                  onSigned={() => {
                    setOverride((current) => (current !== null && current.drugId === drug.id ? { ...current, cosigned: true } : current));
                  }}
                />
              }
            />
          ) : null}
          {overrideForDrug?.cosigned === true ? (
            <Callout tone="warning" icon="check-circle">
              {t('overrideCosigned', { reason: f.text(overrideForDrug.reason) })}
            </Callout>
          ) : null}

          <div className="orders-fields">
            <div className="orders-fields__dose">
              <TextField
                className="ui-field orders-dose"
                value={dose}
                onChange={setDose}
                onBlur={() => setDoseTouched(true)}
                isInvalid={doseErrorVisible}
                validationBehavior="aria"
                isRequired
              >
                <Label className="ui-field__label">{t('doseLabel')}</Label>
                <Input className="ui-input orders-dose__input" dir="ltr" autoComplete="off" placeholder={t('dosePlaceholder', { example: drug.example })} />
                <Text slot="description" className="ui-field__description">
                  {t('doseHint', { example: drug.example, units: unitsText })}
                </Text>
                <FieldError className="orders-field-error">
                  <Icon name="x" size="1em" /> {doseErrorText}
                </FieldError>
              </TextField>
              {check?.ok === true ? (
                <p className="orders-reads">
                  <Icon name="check-circle" size="1em" />
                  <span>{t('doseReads')}:</span>
                  <strong>
                    <DoseQty value={check.value} unit={check.unit} />
                  </strong>
                  {check.normalised ? <span className="orders-muted">({t('digitsNormalised', { value: check.value })})</span> : null}
                </p>
              ) : null}
              {suggestion === null || kg === null || drug.perKg === null ? null : (
                <div className="orders-suggest">
                  <Icon name="info" size="1em" />
                  <span>
                    {t.rich('weightSuggest', {
                      weight: <Code>{String(kg)}</Code>,
                      dose: <DoseQty value={suggestion} unit={baseUnit} />,
                      perKg: <DoseQty value={String(drug.perKg)} unit={baseUnit} />,
                    })}
                  </span>
                  <Button size="sm" variant="secondary" onPress={() => setDose(`${suggestion} ${UNIT_TEXT[baseUnit]}`)}>
                    {t('useSuggested')}
                  </Button>
                </div>
              )}
            </div>
            <SelectField
              label={t('routeLabel')}
              options={drug.routes.map((id) => ({ id, label: f.text(ROUTE_LABEL[id]) }))}
              selectedKey={route}
              onSelectionChange={(id) => setRoute(id as RouteId)}
            />
            <SelectField
              label={t('freqLabel')}
              options={FREQUENCY_IDS.map((id) => ({ id, label: f.text(FREQUENCY[id]) }))}
              selectedKey={frequency}
              onSelectionChange={(id) => setFrequency(id as FrequencyId)}
            />
            <SelectField
              label={t('durationLabel')}
              options={DURATION_IDS.map((id) => ({ id, label: f.text(DURATION[id]) }))}
              selectedKey={duration}
              onSelectionChange={(id) => setDuration(id as DurationId)}
            />
          </div>

          <div className="orders-indication">
            <TextInput
              label={t('indicationLabel')}
              value={indication}
              onChange={setIndication}
              description={t('indicationHint')}
              isRequired
            />
            {diagnoses.length === 0 ? null : (
              <div className="orders-chips" role="group" aria-label={t('diagnosisChips')}>
                {diagnoses.map((diagnosis) => (
                  <AriaButton key={diagnosis.code} className="orders-chip" onPress={() => setIndication(f.text(diagnosis.text))}>
                    <Code>{diagnosis.code}</Code> {f.text(diagnosis.text)}
                  </AriaButton>
                ))}
              </div>
            )}
            {attempted && indicationMissing ? (
              <p className="orders-field-error" role="alert">
                <Icon name="x" size="1em" /> {t('indicationRequired')}
              </p>
            ) : null}
          </div>

          <Segmented
            label={t('priorityLabel')}
            options={PRIORITIES.map((id) => ({ id, label: f.text(PRIORITY_LABEL[id]) }))}
            value={priority}
            onChange={(id) => setPriority(id as OrderPriority)}
          />

          <WarningList warnings={warnings} />

          <div className="orders-form__footer">
            {attempted && (check?.ok !== true || indicationMissing || blocked || (notAssessed && !allergyChecked)) ? (
              <p className="orders-field-error" role="alert">
                {notAssessed && !allergyChecked ? t('notAssessedRequired') : blocked ? t('overridePending') : t('fixErrors')}
              </p>
            ) : (
              <span />
            )}
            <Button variant="primary" icon="plus" onPress={add}>
              {t('addToBasket')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
