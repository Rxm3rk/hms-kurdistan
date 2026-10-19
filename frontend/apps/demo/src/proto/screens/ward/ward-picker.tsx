/**
 * The ward picker: four cards (a radio group) with each ward's occupancy and free beds, so the presenter sees
 * the whole hospital at a glance and picks the ward to show on the board.
 */
import type { ReactNode } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { WARDS } from '../../data/index.ts';
import type { WardId } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { cx } from '../../ui/index.ts';
import { messages } from './messages.ts';
import { wardCounts, type BoardState } from './state.ts';

export function WardPicker({
  board,
  value,
  onChange,
}: {
  readonly board: BoardState;
  readonly value: WardId;
  readonly onChange: (wardId: WardId) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <RadioGroup
      className="ward-picker"
      orientation="horizontal"
      value={value}
      onChange={(id) => {
        const ward = WARDS.find((candidate) => candidate.id === id);
        if (ward !== undefined) {
          onChange(ward.id);
        }
      }}
    >
      <Label className="hms-visually-hidden">{t('wardPickerLabel')}</Label>
      <div className="ward-picker__grid">
        {WARDS.map((ward) => {
          const counts = wardCounts(board, ward.id);
          const level = counts.occupancy >= 0.95 ? 'full' : counts.occupancy >= 0.85 ? 'busy' : 'ok';
          return (
            <Radio key={ward.id} value={ward.id} className="ward-picker__option">
              <span className="ward-picker__name">{f.text(ward.name)}</span>
              <span className="ward-picker__floor">{f.text(ward.floor)}</span>
              <span className="ward-picker__bar" aria-hidden="true">
                <span
                  className={cx('ward-picker__fill', `ward-picker__fill--${level}`)}
                  style={{ inlineSize: `${String(Math.round(counts.occupancy * 100))}%` }}
                />
              </span>
              <span className="ward-picker__stats">
                <span className="ward-picker__pct">{t('wardOccupied', { percent: f.percent(counts.occupancy) })}</span>
                <span className={cx('ward-picker__free', counts.available === 0 && 'ward-picker__free--none')}>
                  {t('wardFree', { count: counts.available })}
                </span>
              </span>
            </Radio>
          );
        })}
      </div>
    </RadioGroup>
  );
}
