/**
 * A simple report builder over the current inpatients: pick fields, choose the sort, preview the table,
 * then export (simulated) or save the definition to the catalogue.
 */
import { useState, type ReactNode } from 'react';
import { ENCOUNTERS, GOVERNORATE_LABEL, SEX_LABEL, findStaff, getPatient, getPayer, getWard, lengthOfStayDays } from '../../data/index.ts';
import type { Encounter } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Button, Card, Checkbox, Code, DataTable, EmptyState, SelectField, TextInput, personName, staffName, useToast, type Column } from '../../ui/index.ts';
import { messages } from './messages.ts';

const FIELDS = ['mrn', 'name', 'sex', 'age', 'ward', 'bed', 'admitted', 'los', 'attending', 'diagnosis', 'icd', 'payer', 'governorate'] as const;
type Field = (typeof FIELDS)[number];
const PREVIEW_ROWS = 15;

export function ReportBuilder({ onSave }: { readonly onSave: (name: string) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [picked, setPicked] = useState<readonly Field[]>(['mrn', 'name', 'ward', 'admitted', 'los', 'diagnosis']);
  const [sort, setSort] = useState<Field>('los');
  const [name, setName] = useState(() => t('myReport'));

  const inpatients = ENCOUNTERS.filter((e) => e.type === 'inpatient' && e.status === 'active');

  const value = (e: Encounter, field: Field): string | number => {
    const patient = getPatient(e.patientId);
    const primary = e.diagnoses.find((d) => d.primary) ?? e.diagnoses[0];
    switch (field) {
      case 'mrn':
        return patient.mrn;
      case 'name':
        return personName(patient.name, f.locale);
      case 'sex':
        return f.text(SEX_LABEL[patient.sex]);
      case 'age':
        return f.age(patient.dob);
      case 'ward':
        return e.wardId === null ? '–' : f.text(getWard(e.wardId).name);
      case 'bed':
        return e.bedId ?? '–';
      case 'admitted':
        return f.date(e.startIso);
      case 'los':
        return lengthOfStayDays(e);
      case 'attending': {
        const member = findStaff(e.attendingId);
        return member === undefined ? '–' : staffName(member, f.locale);
      }
      case 'diagnosis':
        return primary === undefined ? '–' : f.text(primary.text);
      case 'icd':
        return primary?.code ?? '–';
      case 'payer':
        return f.text(getPayer(patient.payerId).name);
      case 'governorate':
        return f.text(GOVERNORATE_LABEL[patient.governorate]);
    }
  };

  const sorted = inpatients.toSorted((a, b) => {
    const va = value(a, sort);
    const vb = value(b, sort);
    return typeof va === 'number' && typeof vb === 'number' ? vb - va : String(va).localeCompare(String(vb));
  });

  const columns: readonly Column<Encounter>[] = FIELDS.filter((field) => picked.includes(field)).map((field) => ({
    id: field,
    header: t(`f_${field}`),
    cell: (e: Encounter) => {
      const v = value(e, field);
      return field === 'mrn' || field === 'icd' || field === 'bed' ? <Code>{String(v)}</Code> : typeof v === 'number' ? f.number(v) : v;
    },
    ...(field === 'los' ? { align: 'end' as const } : {}),
  }));

  return (
    <div className="rpt-builder">
      <Card title={t('fields')} icon="filter" className="rpt-builder__fields">
        <div className="rpt-fields">
          {FIELDS.map((field) => (
            <Checkbox
              key={field}
              isSelected={picked.includes(field)}
              onChange={(on) => setPicked(on ? FIELDS.filter((x) => x === field || picked.includes(x)) : picked.filter((x) => x !== field))}
            >
              {t(`f_${field}`)}
            </Checkbox>
          ))}
        </div>
        <SelectField label={t('sortBy')} options={FIELDS.map((field) => ({ id: field, label: t(`f_${field}`) }))} selectedKey={sort} onSelectionChange={(id) => setSort(id as Field)} />
        <TextInput label={t('reportName')} value={name} onChange={setName} />
        <div className="rpt-actions">
          <Button variant="primary" icon="printer" isDisabled={picked.length === 0} onPress={() => toast({ tone: 'success', title: t('toastExported', { count: sorted.length }) })}>
            {t('exportCsv')}
          </Button>
          <Button
            icon="plus"
            isDisabled={picked.length === 0 || name.trim() === ''}
            onPress={() => {
              onSave(name.trim());
              toast({ tone: 'success', title: t('toastSaved', { name: name.trim() }) });
            }}
          >
            {t('saveReport')}
          </Button>
        </div>
      </Card>
      <Card title={t('preview')} subtitle={t('previewCount', { shown: Math.min(PREVIEW_ROWS, sorted.length), total: sorted.length })} icon="clipboard" flush className="rpt-builder__preview">
        {picked.length === 0 ? (
          <EmptyState icon="filter" title={t('noFields')} compact />
        ) : (
          <DataTable caption={t('preview')} columns={columns} rows={sorted.slice(0, PREVIEW_ROWS)} rowKey={(e) => e.id} dense />
        )}
      </Card>
    </div>
  );
}
