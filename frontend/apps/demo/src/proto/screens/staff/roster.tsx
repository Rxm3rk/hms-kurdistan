/**
 * The duty roster: a week grid (Saturday to Friday; Friday is the weekend) of staff by day, with a
 * department filter and week switch. Pressing a cell cycles the shift; the change stays in React state.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_TODAY, DEPARTMENTS, getDepartment } from '../../data/index.ts';
import type { DepartmentId, StaffMember } from '../../data/index.ts';
import { ROSTER, ROSTER_STAFF_IDS, ROSTER_WEEKS, SHIFT_CYCLE, staffById, weekDays, type ShiftCode } from '../../data/ext/staff.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Card, IconButton, SelectField, StaffName, staffName, useToast } from '../../ui/index.ts';
import { messages } from './messages.ts';

export interface RosterApi {
  readonly week: string;
  readonly weekIndex: number;
  readonly setWeekIndex: (index: number) => void;
  readonly shift: (staffId: string, day: string) => ShiftCode;
  readonly cycle: (staffId: string, day: string) => ShiftCode;
}

export function useRoster(): RosterApi {
  const [weekIndex, setWeekIndex] = useState(1);
  const [changes, setChanges] = useState<Readonly<Record<string, ShiftCode>>>({});
  const shift = (staffId: string, day: string): ShiftCode => changes[`${staffId}|${day}`] ?? ROSTER[`${staffId}|${day}`] ?? 'OFF';
  return {
    week: ROSTER_WEEKS[weekIndex] ?? DEMO_TODAY,
    weekIndex,
    setWeekIndex,
    shift,
    cycle: (staffId, day) => {
      const current = shift(staffId, day);
      const next = SHIFT_CYCLE[(SHIFT_CYCLE.indexOf(current) + 1) % SHIFT_CYCLE.length] ?? 'OFF';
      setChanges((c) => ({ ...c, [`${staffId}|${day}`]: next }));
      return next;
    },
  };
}

const WORKING: readonly ShiftCode[] = ['M', 'E', 'N', 'D', 'OC'];

export function RosterTab({ roster }: { readonly roster: RosterApi }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [dept, setDept] = useState<'all' | DepartmentId>('all');
  const days = weekDays(roster.week);
  const staff = ROSTER_STAFF_IDS.map((id) => staffById(id))
    .filter((m): m is StaffMember => m !== undefined && (dept === 'all' || m.departmentId === dept));
  const usedDepartments = DEPARTMENTS.filter((d) => ROSTER_STAFF_IDS.some((id) => staffById(id)?.departmentId === d.id));

  return (
    <Card
      title={t('weekOf', { date: f.date(roster.week) })}
      subtitle={t('rosterHint')}
      icon="calendar"
      flush
      actions={
        <div className="stf-week">
          <SelectField
            label={t('deptFilter')}
            hideLabel
            options={[{ id: 'all', label: t('allDepartments') }, ...usedDepartments.map((d) => ({ id: d.id, label: f.text(d.name) }))]}
            selectedKey={dept}
            onSelectionChange={(id) => setDept(id as 'all' | DepartmentId)}
            className="stf-select"
          />
          <IconButton icon="chevron-back" label={t('prevWeek')} isDisabled={roster.weekIndex === 0} onPress={() => roster.setWeekIndex(roster.weekIndex - 1)} variant="secondary" />
          <IconButton icon="chevron-forward" label={t('nextWeek')} isDisabled={roster.weekIndex === ROSTER_WEEKS.length - 1} onPress={() => roster.setWeekIndex(roster.weekIndex + 1)} variant="secondary" />
        </div>
      }
      footer={
        <ul className="stf-legend">
          {SHIFT_CYCLE.map((code) => (
            <li key={code} className="stf-legend__item">
              <span className={`stf-shift stf-shift--${code}`}>{code}</span>
              {t(`sh_${code}`)}
            </li>
          ))}
        </ul>
      }
    >
      <div className="ui-table-wrap stf-roster-wrap">
        <table className="ui-table ui-table--dense stf-roster">
          <caption className="hms-visually-hidden">{t('rosterTable')}</caption>
          <thead>
            <tr>
              <th scope="col" className="ui-table__th ui-align-start stf-roster__name">
                {t('colName')}
              </th>
              {days.map((day, i) => (
                <th key={day} scope="col" className={['ui-table__th', 'ui-align-center', i === 6 ? 'stf-roster__weekend' : '', day === DEMO_TODAY ? 'stf-roster__today' : ''].filter(Boolean).join(' ')}>
                  <span className="stf-stack stf-center">
                    <span>{f.weekday(day)}</span>
                    <span className="stf-muted">{day === DEMO_TODAY ? t('today') : i === 6 ? t('weekend') : f.date(day, 'short').slice(0, 5)}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="ui-table__row">
                <th scope="row" className="ui-table__td ui-align-start stf-roster__name">
                  <span className="stf-stack">
                    <StaffName member={member} />
                    <span className="stf-muted">{f.text(getDepartment(member.departmentId).name)}</span>
                  </span>
                </th>
                {days.map((day, i) => {
                  const code = roster.shift(member.id, day);
                  const label = t(`sh_${code}`);
                  return (
                    <td key={day} className={['ui-table__td', 'ui-align-center', i === 6 ? 'stf-roster__weekend' : '', day === DEMO_TODAY ? 'stf-roster__today' : ''].filter(Boolean).join(' ')}>
                      <button
                        type="button"
                        className={`stf-shift stf-shift--${code} stf-shift--button`}
                        title={label}
                        aria-label={t('cellLabel', { name: staffName(member, f.locale), day: f.weekday(day), shift: label })}
                        onClick={() => {
                          const next = roster.cycle(member.id, day);
                          toast({ tone: 'info', title: t('toastShift', { name: staffName(member, f.locale), shift: t(`sh_${next}`), day: f.date(day) }) });
                        }}
                      >
                        {code}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="ui-table__td ui-align-start stf-roster__name">
                {t('coverage')}
              </th>
              {days.map((day) => (
                <td key={day} className="ui-table__td ui-align-center stf-muted">
                  {t('coverageValue', { count: staff.filter((m) => WORKING.includes(roster.shift(m.id, day))).length })}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
