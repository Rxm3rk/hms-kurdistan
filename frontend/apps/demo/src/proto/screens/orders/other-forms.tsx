/**
 * Laboratory, imaging and order-set parts of order entry.
 */
import { useState, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { PRIORITY_LABEL, PRIORITY_TONE, ROUTE_LABEL, type Order, type OrderPriority, type Patient, type Text3 } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Checkbox, Code, Icon, Segmented, SelectField, TextInput, useToast } from '../../ui/index.ts';
import {
  COLLECTION,
  FREQUENCY,
  IMAGING_STUDIES,
  LAB_TESTS,
  ORDER_SETS,
  findDrug,
  type CollectionId,
  type ImagingStudy,
  type LabTest,
  type OrderSet,
  type PregnancyId,
  type SetItem,
} from './catalogue.ts';
import { checkDose } from './dose.ts';
import { messages } from './messages.ts';
import {
  ageYears,
  allergyByCode,
  allergyMatches,
  allergyText3,
  labDuplicate,
  medicationDuplicates,
  nextDraftId,
  same,
  type DraftOrder,
  type DraftWarning,
} from './model.ts';
import { CATEGORY_ICON, DoseQty, WarningList } from './parts.tsx';

const PRIORITIES: readonly OrderPriority[] = ['routine', 'urgent', 'stat'];

function joinText(a: Text3, b: Text3): Text3 {
  return { en: `${a.en} · ${b.en}`, ckb: `${a.ckb} · ${b.ckb}`, ar: `${a.ar} · ${b.ar}` };
}

export interface OtherFormProps {
  readonly patient: Patient;
  readonly existing: readonly Order[];
  readonly basket: readonly DraftOrder[];
  readonly onAdd: (drafts: readonly DraftOrder[]) => void;
}

// ---------------------------------------------------------------------------------------------------------
// Laboratory
// ---------------------------------------------------------------------------------------------------------

function labDraft(test: LabTest, priority: OrderPriority, detail: Text3, warnings: readonly DraftWarning[], fromSet: Text3 | null): DraftOrder {
  return {
    id: nextDraftId(),
    category: 'lab',
    title: test.name,
    code: test.short,
    priority,
    medication: null,
    detail,
    warnings,
    override: null,
    fromSet,
  };
}

function labWarnings(test: LabTest, existing: readonly Order[]): DraftWarning[] {
  const duplicate = labDuplicate(test.match, existing);
  return duplicate === undefined ? [] : [{ tone: 'warning', key: 'labDuplicate', vars: { order: duplicate.title } }];
}

export function LabForm({ existing, onAdd }: OtherFormProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [priority, setPriority] = useState<OrderPriority>('routine');
  const [collection, setCollection] = useState<CollectionId>('round');
  const [attempted, setAttempted] = useState(false);

  const toggle = (id: string, on: boolean): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const add = (): void => {
    setAttempted(true);
    const tests = LAB_TESTS.filter((test) => selected.has(test.id));
    if (tests.length === 0) {
      return;
    }
    onAdd(tests.map((test) => labDraft(test, priority, joinText(test.container, COLLECTION[collection]), labWarnings(test, existing), null)));
    toast({ tone: 'success', title: t('addedToast'), body: tests.map((test) => test.short).join(', ') });
    setSelected(new Set());
    setAttempted(false);
  };

  return (
    <div className="orders-form">
      <fieldset className="orders-fieldset">
        <legend className="ui-field__label">{t('labPick')}</legend>
        <ul className="orders-tests">
          {LAB_TESTS.map((test) => {
            const duplicate = labDuplicate(test.match, existing);
            return (
              <li key={test.id} className={selected.has(test.id) ? 'orders-test orders-test--on' : 'orders-test'}>
                <Checkbox isSelected={selected.has(test.id)} onChange={(on) => toggle(test.id, on)}>
                  <span className="orders-test__name">
                    {f.text(test.name)} <Code className="orders-muted">{test.short}</Code>
                  </span>
                </Checkbox>
                <span className="orders-test__meta">{f.text(test.container)}</span>
                {duplicate === undefined ? null : (
                  <Badge tone="warning" size="sm" icon="alert">
                    {t('labDuplicate', { order: f.text(duplicate.title) })}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="orders-fields orders-fields--two">
        <SelectField
          label={t('labCollect')}
          options={(Object.keys(COLLECTION) as CollectionId[]).map((id) => ({ id, label: f.text(COLLECTION[id]) }))}
          selectedKey={collection}
          onSelectionChange={(id) => setCollection(id as CollectionId)}
        />
        <Segmented
          label={t('priorityLabel')}
          options={PRIORITIES.map((id) => ({ id, label: f.text(PRIORITY_LABEL[id]) }))}
          value={priority}
          onChange={(id) => setPriority(id as OrderPriority)}
        />
      </div>
      <div className="orders-form__footer">
        {attempted && selected.size === 0 ? (
          <p className="orders-field-error" role="alert">
            {t('labNone')}
          </p>
        ) : (
          <span />
        )}
        <Button variant="primary" icon="plus" onPress={add}>
          {t('labAdd', { count: selected.size })}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Imaging
// ---------------------------------------------------------------------------------------------------------

function needsPregnancy(patient: Patient, study: ImagingStudy): boolean {
  const age = ageYears(patient);
  return patient.sex === 'female' && age >= 12 && age <= 55 && study.radiation;
}

function imagingWarnings(patient: Patient, study: ImagingStudy): DraftWarning[] {
  const out: DraftWarning[] = [];
  const contrast = allergyByCode(patient, 'SYN-ALG-CONTRAST');
  if (study.contrast && contrast !== undefined) {
    out.push({ tone: 'danger', key: 'imgContrastAllergy', vars: { allergy: allergyText3(contrast) } });
  }
  if (study.departmental && study.id === 'cxr-pa' && (patient.isolation?.types.includes('airborne') ?? false)) {
    out.push({ tone: 'info', key: 'imgIsolation' });
  }
  return out;
}

export function ImagingForm({ patient, onAdd }: OtherFormProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [studyId, setStudyId] = useState<string>('cxr-pa');
  const [question, setQuestion] = useState('');
  const [pregnancy, setPregnancy] = useState<PregnancyId | ''>('');
  const [priority, setPriority] = useState<OrderPriority>('routine');
  const [attempted, setAttempted] = useState(false);

  const study = IMAGING_STUDIES.find((candidate) => candidate.id === studyId) ?? IMAGING_STUDIES[0];
  if (study === undefined) {
    return null;
  }
  const askPregnancy = needsPregnancy(patient, study);
  const warnings = imagingWarnings(patient, study);
  if (askPregnancy && (pregnancy === 'possible' || pregnancy === 'yes')) {
    warnings.push({ tone: 'warning', key: 'pregnancyWarn' });
  }
  const questionMissing = question.trim() === '';
  const pregnancyMissing = askPregnancy && pregnancy === '';

  const add = (): void => {
    setAttempted(true);
    if (questionMissing || pregnancyMissing) {
      return;
    }
    onAdd([
      {
        id: nextDraftId(),
        category: 'imaging',
        title: study.name,
        code: study.short,
        priority,
        medication: null,
        detail: same(question.trim()),
        warnings,
        override: null,
        fromSet: null,
      },
    ]);
    toast({ tone: 'success', title: t('addedToast'), body: f.text(study.name) });
    setQuestion('');
    setPregnancy('');
    setAttempted(false);
  };

  const pregnancyOptions: readonly { id: PregnancyId; label: string }[] = [
    { id: 'no', label: t('pregNo') },
    { id: 'possible', label: t('pregPossible') },
    { id: 'yes', label: t('pregYes') },
    { id: 'na', label: t('pregNa') },
  ];

  return (
    <div className="orders-form">
      <fieldset className="orders-fieldset">
        <legend className="ui-field__label">{t('imgPick')}</legend>
        <ul className="orders-studies">
          {IMAGING_STUDIES.map((candidate) => (
            <li key={candidate.id}>
              <AriaButton
                className={candidate.id === studyId ? 'orders-study orders-study--on' : 'orders-study'}
                aria-pressed={candidate.id === studyId}
                onPress={() => setStudyId(candidate.id)}
              >
                <Icon name={candidate.id === studyId ? 'check-circle' : 'scan'} />
                <span className="orders-study__name">{f.text(candidate.name)}</span>
                <span className="orders-study__badges">
                  {candidate.radiation ? (
                    <Badge size="sm" tone="neutral">
                      {t('imgRadiation')}
                    </Badge>
                  ) : null}
                  {candidate.contrast ? (
                    <Badge size="sm" tone="info">
                      {t('imgContrast')}
                    </Badge>
                  ) : null}
                </span>
              </AriaButton>
            </li>
          ))}
        </ul>
      </fieldset>
      <TextInput label={t('imgQuestion')} value={question} onChange={setQuestion} description={t('imgQuestionHint')} multiline isRequired />
      {attempted && questionMissing ? (
        <p className="orders-field-error" role="alert">
          <Icon name="x" size="1em" /> {t('imgQuestionRequired')}
        </p>
      ) : null}
      {askPregnancy ? (
        <div>
          <Segmented label={t('imgPregnancy')} options={pregnancyOptions} value={pregnancy} onChange={(id) => setPregnancy(id as PregnancyId)} />
          {attempted && pregnancyMissing ? (
            <p className="orders-field-error" role="alert">
              <Icon name="x" size="1em" /> {t('imgPregnancyRequired')}
            </p>
          ) : null}
        </div>
      ) : null}
      <Segmented
        label={t('priorityLabel')}
        options={PRIORITIES.map((id) => ({ id, label: f.text(PRIORITY_LABEL[id]) }))}
        value={priority}
        onChange={(id) => setPriority(id as OrderPriority)}
      />
      <WarningList warnings={warnings} />
      <div className="orders-form__footer">
        <span />
        <Button variant="primary" icon="plus" onPress={add}>
          {t('imgAdd')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Order sets
// ---------------------------------------------------------------------------------------------------------

interface ResolvedItem {
  readonly key: string;
  readonly item: SetItem;
  readonly icon: ReturnType<typeof iconOf>;
  readonly blockedBy: Text3 | null;
  readonly warnings: readonly DraftWarning[];
  readonly draft: (set: OrderSet, indication: string) => DraftOrder | null;
}

function iconOf(item: SetItem): (typeof CATEGORY_ICON)[keyof typeof CATEGORY_ICON] {
  return item.kind === 'medication' ? CATEGORY_ICON.medication : item.kind === 'lab' ? CATEGORY_ICON.lab : CATEGORY_ICON.imaging;
}

function resolveItems(set: OrderSet, patient: Patient, existing: readonly Order[], basket: readonly DraftOrder[]): readonly ResolvedItem[] {
  return set.items.map((item, index): ResolvedItem => {
    const key = `${set.id}-${String(index)}`;
    if (item.kind === 'medication') {
      const drug = findDrug(item.drugId);
      const matches = drug === undefined ? [] : allergyMatches(patient, drug);
      const block = matches.find((match) => match.level === 'block');
      const warnings: DraftWarning[] = [];
      if (drug !== undefined) {
        for (const match of matches) {
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
      return {
        key,
        item,
        icon: iconOf(item),
        blockedBy: block === undefined ? null : allergyText3(block.allergy),
        warnings,
        draft: (owner, indication) => {
          if (drug === undefined) {
            return null;
          }
          const dose = checkDose(item.dose, drug);
          if (!dose.ok) {
            return null;
          }
          return {
            id: nextDraftId(),
            category: 'medication',
            title: same(drug.drug),
            code: null,
            priority: owner.priority,
            medication: {
              drugId: drug.id,
              drug: drug.drug,
              dose: dose.value,
              unit: dose.unit,
              route: item.route,
              frequency: item.frequency,
              duration: item.duration,
              indication,
              highAlert: drug.highAlert,
            },
            detail: null,
            warnings,
            override: null,
            fromSet: owner.name,
          };
        },
      };
    }
    if (item.kind === 'lab') {
      const test = LAB_TESTS.find((candidate) => candidate.id === item.testId);
      const warnings = test === undefined ? [] : labWarnings(test, existing);
      return {
        key,
        item,
        icon: iconOf(item),
        blockedBy: null,
        warnings,
        draft: (owner) => (test === undefined ? null : labDraft(test, owner.priority, joinText(test.container, COLLECTION.now), warnings, owner.name)),
      };
    }
    const study = IMAGING_STUDIES.find((candidate) => candidate.id === item.studyId);
    const warnings: DraftWarning[] = study === undefined ? [] : imagingWarnings(patient, study);
    if (study !== undefined && needsPregnancy(patient, study)) {
      warnings.push({ tone: 'warning', key: 'imgPregnancyRequired' });
    }
    return {
      key,
      item,
      icon: iconOf(item),
      blockedBy: null,
      warnings,
      draft: (owner) =>
        study === undefined
          ? null
          : {
              id: nextDraftId(),
              category: 'imaging',
              title: study.name,
              code: study.short,
              priority: owner.priority,
              medication: null,
              detail: owner.indication,
              warnings,
              override: null,
              fromSet: owner.name,
            },
    };
  });
}

function ItemLabel({ item }: { readonly item: SetItem }): ReactNode {
  const f = useFormat();
  if (item.kind === 'medication') {
    const drug = findDrug(item.drugId);
    const dose = drug === undefined ? null : checkDose(item.dose, drug);
    return (
      <span className="orders-set-item__label">
        <Code className="orders-strong">{drug?.drug ?? item.drugId}</Code>
        <span className="orders-line">
          {dose?.ok === true ? <DoseQty value={dose.value} unit={dose.unit} /> : null}
          <span aria-hidden="true">·</span>
          <span>{f.text(ROUTE_LABEL[item.route])}</span>
          <span aria-hidden="true">·</span>
          <span>{f.text(FREQUENCY[item.frequency])}</span>
        </span>
      </span>
    );
  }
  if (item.kind === 'lab') {
    const test = LAB_TESTS.find((candidate) => candidate.id === item.testId);
    return (
      <span className="orders-set-item__label">
        <span>{test === undefined ? item.testId : f.text(test.name)}</span>
        {test === undefined ? null : <Code className="orders-muted">{test.short}</Code>}
      </span>
    );
  }
  const study = IMAGING_STUDIES.find((candidate) => candidate.id === item.studyId);
  return (
    <span className="orders-set-item__label">
      <span>{study === undefined ? item.studyId : f.text(study.name)}</span>
    </span>
  );
}

export function OrderSetsPanel({
  patient,
  existing,
  basket,
  onAdd,
  allergyChecked,
  onAllergyChecked,
}: OtherFormProps & { readonly allergyChecked: boolean; readonly onAllergyChecked: (checked: boolean) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [setId, setSetId] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const notAssessed = patient.allergies.kind === 'not-assessed';

  const set = setId === null ? undefined : ORDER_SETS.find((candidate) => candidate.id === setId);

  const open = (next: OrderSet): void => {
    const items = resolveItems(next, patient, existing, basket);
    setSetId(next.id);
    setChecked(
      new Set(
        items
          .filter((entry) => entry.blockedBy === null && entry.item.optional !== true && !entry.warnings.some((warning) => warning.key === 'labDuplicate' || warning.key === 'duplicateWarn'))
          .map((entry) => entry.key),
      ),
    );
    setAttempted(false);
  };

  if (set === undefined) {
    return (
      <div className="orders-form">
        <p className="orders-muted">{t('setsIntro')}</p>
        <ul className="orders-sets">
          {ORDER_SETS.map((candidate) => (
            <li key={candidate.id}>
              <AriaButton className="orders-set" onPress={() => open(candidate)}>
                <span className="orders-set__head">
                  <Icon name="clipboard" />
                  <span className="orders-set__name">{f.text(candidate.name)}</span>
                  <Badge size="sm" tone={PRIORITY_TONE[candidate.priority]}>
                    {f.text(PRIORITY_LABEL[candidate.priority])}
                  </Badge>
                </span>
                <span className="orders-set__desc">{f.text(candidate.description)}</span>
                <span className="orders-set__foot">
                  <span>{t('setItems', { count: candidate.items.length })}</span>
                  <span className="orders-set__open">
                    {t('setOpen')} <Icon name="chevron-forward" size="1em" />
                  </span>
                </span>
              </AriaButton>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const items = resolveItems(set, patient, existing, basket);
  const chosen = items.filter((entry) => checked.has(entry.key) && entry.blockedBy === null);
  const chosenMeds = chosen.some((entry) => entry.item.kind === 'medication');

  const add = (): void => {
    setAttempted(true);
    if (chosen.length === 0 || (notAssessed && chosenMeds && !allergyChecked)) {
      return;
    }
    const indication = f.text(set.indication);
    const drafts = chosen.map((entry) => entry.draft(set, indication)).filter((draft): draft is DraftOrder => draft !== null);
    onAdd(drafts);
    toast({ tone: 'success', title: t('setAddedToast', { count: drafts.length }), body: f.text(set.name) });
    setSetId(null);
  };

  return (
    <div className="orders-form">
      <div className="orders-set-head">
        <Button variant="ghost" size="sm" icon="chevron-back" onPress={() => setSetId(null)}>
          {t('setBack')}
        </Button>
      </div>
      <div>
        <p className="orders-med__name">
          <Icon name="clipboard" />
          <span>{f.text(set.name)}</span>
        </p>
        <p className="orders-muted orders-small">{f.text(set.description)}</p>
      </div>
      {notAssessed ? (
        <Callout tone="warning" title={t('notAssessed')}>
          <p>{t('notAssessedWarn')}</p>
          <Checkbox isSelected={allergyChecked} onChange={onAllergyChecked}>
            {t('notAssessedConfirm')}
          </Checkbox>
        </Callout>
      ) : null}
      <ul className="orders-set-items">
        {items.map((entry) => (
          <li key={entry.key} className={entry.blockedBy === null ? 'orders-set-item' : 'orders-set-item orders-set-item--blocked'}>
            <div className="orders-set-item__row">
              <Checkbox
                isSelected={checked.has(entry.key) && entry.blockedBy === null}
                isDisabled={entry.blockedBy !== null}
                onChange={(on) =>
                  setChecked((current) => {
                    const next = new Set(current);
                    if (on) {
                      next.add(entry.key);
                    } else {
                      next.delete(entry.key);
                    }
                    return next;
                  })
                }
              >
                <span className="orders-set-item__main">
                  <Icon name={entry.icon} size="1.1em" />
                  <ItemLabel item={entry.item} />
                </span>
              </Checkbox>
              {entry.item.optional === true ? (
                <Badge size="sm" tone="neutral">
                  {t('setOptional')}
                </Badge>
              ) : null}
              {entry.blockedBy === null ? null : (
                <Badge size="sm" tone="danger" icon="alert" strong>
                  {t('setRemovedAllergy', { allergy: f.text(entry.blockedBy) })}
                </Badge>
              )}
            </div>
            <WarningList warnings={entry.warnings} compact />
          </li>
        ))}
      </ul>
      <div className="orders-form__footer">
        {attempted && (chosen.length === 0 || (notAssessed && chosenMeds && !allergyChecked)) ? (
          <p className="orders-field-error" role="alert">
            {chosen.length === 0 ? t('setNone') : t('notAssessedRequired')}
          </p>
        ) : (
          <span />
        )}
        <Button variant="primary" icon="plus" onPress={add}>
          {t('setAdd', { count: chosen.length })}
        </Button>
      </div>
    </div>
  );
}
