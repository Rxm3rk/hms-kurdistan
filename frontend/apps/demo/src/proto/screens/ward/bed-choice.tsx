/**
 * Choosing a bed for a patient (admission or transfer). Only available beds can be chosen; every other bed is
 * listed with the reason it cannot take the patient (being cleaned, out of service, reserved, or not an
 * isolation room for a patient on airborne precautions). Occupied beds are counted, not listed.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { Label, Radio, RadioGroup, Text } from 'react-aria-components';
import type { Patient, WardId } from '../../data/index.ts';
import { getWard } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { EmptyState, Icon, cx } from '../../ui/index.ts';
import { isChild } from './board-data.ts';
import { StateLabel } from './bits.tsx';
import { messages } from './messages.ts';
import type { LiveBed } from './state.ts';

export interface BedOption {
  readonly bed: LiveBed;
  readonly selectable: boolean;
  /** Why the bed cannot be chosen. */
  readonly reason: string | null;
  /** Cautions on a bed that can be chosen. */
  readonly warnings: readonly string[];
}

export interface BedOptions {
  readonly options: readonly BedOption[];
  readonly occupiedHidden: number;
  readonly selectableCount: number;
}

/** The beds of a ward as choices for a patient (`excludeBedId`: the patient's own bed, for transfers). */
export function useBedOptions(): (beds: readonly LiveBed[], patient: Patient | undefined, wardId: WardId, excludeBedId?: string) => BedOptions {
  const t = useT(messages);
  const f = useFormat();
  return (beds, patient, wardId, excludeBedId) => {
    const airborne = patient?.isolation?.types.includes('airborne') === true;
    const singleRoomPreferred = patient?.isolation !== null && patient?.isolation !== undefined && !airborne;
    const child = patient !== undefined && isChild(patient);
    const options: BedOption[] = [];
    let occupiedHidden = 0;
    for (const bed of beds) {
      if (bed.id === excludeBedId) {
        continue;
      }
      const note = bed.note === null ? '' : f.text(bed.note);
      switch (bed.state) {
        case 'occupied':
          occupiedHidden += 1;
          break;
        case 'cleaning':
          options.push({ bed, selectable: false, reason: t('whyCleaning', { time: f.time(bed.sinceIso) }), warnings: [] });
          break;
        case 'blocked':
          options.push({ bed, selectable: false, reason: t('whyBlocked', { note }), warnings: [] });
          break;
        case 'reserved':
          options.push({ bed, selectable: false, reason: t('whyReserved', { note }), warnings: [] });
          break;
        case 'available': {
          if (airborne && !bed.isolationRoom) {
            options.push({ bed, selectable: false, reason: t('whyAirborne'), warnings: [] });
            break;
          }
          const warnings: string[] = [];
          if (singleRoomPreferred && !bed.isolationRoom) {
            warnings.push(t('warnSingleRoom'));
          }
          if (patient !== undefined && child && wardId !== 'paeds') {
            warnings.push(t('warnChildAdultWard'));
          }
          if (patient !== undefined && !child && wardId === 'paeds') {
            warnings.push(t('warnAdultPaeds'));
          }
          options.push({ bed, selectable: true, reason: null, warnings });
          break;
        }
      }
    }
    const sorted = options.toSorted((a, b) => Number(b.selectable) - Number(a.selectable));
    return { options: sorted, occupiedHidden, selectableCount: sorted.filter((option) => option.selectable).length };
  };
}

export interface BedChoiceProps {
  readonly wardId: WardId;
  readonly choices: BedOptions;
  readonly value: string | null;
  readonly onChange: (bedId: string) => void;
}

export function BedChoice({ wardId, choices, value, onChange }: BedChoiceProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const ward = f.text(getWard(wardId).name);
  return (
    <RadioGroup className="ward-choice" value={value} onChange={onChange}>
      <Label className="ui-field__label">{t('bedChoiceLabel')}</Label>
      <Text slot="description" className="ward-choice__hint">
        {t('bedChoiceHint')}
      </Text>
      {choices.selectableCount === 0 ? <EmptyState compact icon="bed" title={t('noBedTitle', { ward })} body={t('noBedBody')} /> : null}
      <div className="ward-choice__grid">
        {choices.options.map((option) => (
          <Radio
            key={option.bed.id}
            value={option.bed.id}
            isDisabled={!option.selectable}
            className={cx('ward-choice__option', `ward-choice__option--${option.bed.state}`, !option.selectable && 'ward-choice__option--unavailable')}
          >
            <span className="ward-choice__head">
              <span className="ward-choice__mark" aria-hidden="true">
                <Icon name="check" size="0.85em" />
              </span>
              <span className="ward-choice__id">
                <Bdi dir="ltr">{option.bed.id}</Bdi>
              </span>
              <StateLabel state={option.bed.state} />
            </span>
            {option.bed.isolationRoom ? (
              <span className="ward-choice__line">
                <Icon name="isolation" size="1em" />
                <span>{t('isolationRoom')}</span>
              </span>
            ) : null}
            {option.reason === null ? null : (
              <span className="ward-choice__line ward-choice__reason">
                <Icon name={option.bed.state === 'available' ? 'isolation' : 'lock'} size="1em" />
                <span>{option.reason}</span>
              </span>
            )}
            {option.warnings.map((warning) => (
              <span key={warning} className="ward-choice__line ward-choice__warning">
                <Icon name="alert" size="1em" />
                <span>{warning}</span>
              </span>
            ))}
          </Radio>
        ))}
      </div>
      {choices.occupiedHidden > 0 ? <p className="ward-choice__hidden">{t('occupiedHidden', { count: choices.occupiedHidden })}</p> : null}
    </RadioGroup>
  );
}
