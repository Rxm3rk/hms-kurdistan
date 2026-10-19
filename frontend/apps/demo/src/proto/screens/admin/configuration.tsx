/**
 * Configuration with locks: the chain Vendor → Kurdistan pack → Hospital group → Facility → Department →
 * Unit → User, a matrix of settings across it, and a form that tries a change. A change below a lock is
 * refused with a clear message and the attempt is audited; an allowed change is saved (in this session only)
 * and audited.
 */
import { Fragment, useState, type ReactNode } from 'react';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Card, Code, DataTable, Icon, KeyValueList, SelectField, Toolbar, cx, useToast, type Column } from '../../ui/index.ts';
import type { SessionEvent } from './audit-data.ts';
import {
  EDITABLE_LEVELS,
  LEVELS,
  SETTINGS,
  effectiveAt,
  isBelowLock,
  levelInfo,
  optionLabel,
  valueAt,
  type ConfigSetting,
  type LevelId,
  type Overrides,
} from './config-data.ts';
import { messages } from './messages.ts';

type Result =
  | { readonly kind: 'refused' | 'saved'; readonly settingId: string; readonly level: LevelId; readonly optionId: string; readonly auditId: string }
  | { readonly kind: 'same'; readonly settingId: string; readonly level: LevelId; readonly optionId: string };

export interface ConfigurationPanelProps {
  readonly overrides: Overrides;
  readonly onSave: (settingId: string, level: LevelId, optionId: string) => void;
  readonly canEdit: boolean;
  readonly record: (event: Omit<SessionEvent, 'id' | 'iso' | 'actorId'>) => string;
}

function settingById(id: string): ConfigSetting {
  return SETTINGS.find((setting) => setting.id === id) ?? (SETTINGS[0] as ConfigSetting);
}

function isEditableLevel(value: string): value is LevelId {
  return (EDITABLE_LEVELS as readonly string[]).includes(value);
}

export function ConfigurationPanel({ overrides, onSave, canEdit, record }: ConfigurationPanelProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState('critical-potassium');
  const [level, setLevel] = useState<LevelId>('unit');
  const [optionId, setOptionId] = useState('6');
  const [result, setResult] = useState<Result | null>(null);
  const selected = settingById(selectedId);
  const userEffective = effectiveAt(selected, overrides, 'user');

  const select = (setting: ConfigSetting): void => {
    setSelectedId(setting.id);
    setResult(null);
    const current = effectiveAt(setting, overrides, level)?.optionId;
    setOptionId(setting.options.find((option) => option.id !== current)?.id ?? setting.options[0]?.id ?? '');
  };

  const apply = (settingId: string, atLevel: LevelId, toOption: string): void => {
    if (!canEdit) {
      return;
    }
    const setting = settingById(settingId);
    setSelectedId(settingId);
    setLevel(atLevel);
    setOptionId(toOption);
    if (isBelowLock(setting, atLevel)) {
      const auditId = record({
        kind: 'config-refused',
        subject: setting.name,
        detail: levelInfo(atLevel).name,
        value: optionLabel(setting, toOption),
        reason: null,
        target: setting.id,
        tone: 'danger',
      });
      setResult({ kind: 'refused', settingId, level: atLevel, optionId: toOption, auditId });
      toast({ tone: 'warning', title: t('toastRefused'), body: t('toastAudited', { id: auditId }) });
      return;
    }
    if (valueAt(setting, overrides, atLevel) === toOption) {
      setResult({ kind: 'same', settingId, level: atLevel, optionId: toOption });
      return;
    }
    onSave(settingId, atLevel, toOption);
    const auditId = record({
      kind: 'config-saved',
      subject: setting.name,
      detail: levelInfo(atLevel).name,
      value: optionLabel(setting, toOption),
      reason: null,
      target: setting.id,
      tone: 'info',
    });
    setResult({ kind: 'saved', settingId, level: atLevel, optionId: toOption, auditId });
    toast({ tone: 'success', title: t('toastSaved'), body: t('toastAudited', { id: auditId }) });
  };

  const columns: readonly Column<ConfigSetting>[] = [
    {
      id: 'setting',
      header: t('colSetting'),
      width: '13rem',
      cell: (setting) => (
        <span className="admin-setting-name">
          <span className="admin-strong">{f.text(setting.name)}</span>
          {setting.lock === null ? null : (
            <Badge tone="neutral" icon="lock" size="sm">
              {t('lockedAt', { level: f.text(levelInfo(setting.lock).name) })}
            </Badge>
          )}
        </span>
      ),
    },
    ...LEVELS.map(
      (info): Column<ConfigSetting> => ({
        id: info.id,
        header: (
          <span className={cx('admin-level-head', EDITABLE_LEVELS.includes(info.id) && 'admin-level-head--editable')}>
            {f.text(info.name)}
          </span>
        ),
        cell: (setting) => <LevelCell setting={setting} level={info.id} overrides={overrides} />,
      }),
    ),
  ];

  const levelOptions = EDITABLE_LEVELS.map((id) => {
    const info = levelInfo(id);
    return { id, label: `${f.text(info.name)} · ${f.text(info.entity)}` };
  });
  const valueOptions = selected.options.map((option) => ({ id: option.id, label: f.text(option.label) }));

  return (
    <div className="admin-panel">
      <Callout tone="info" title={t('configIntroTitle')}>
        {t('configIntro')}
      </Callout>

      <Card title={t('chainTitle')} subtitle={t('chainSubtitle')} icon="building">
        <ol className="admin-chain">
          {LEVELS.map((info, index) => (
            <Fragment key={info.id}>
              <li className={cx('admin-chain__step', EDITABLE_LEVELS.includes(info.id) && 'admin-chain__step--editable')}>
                <span className="admin-chain__number">{f.number(index + 1)}</span>
                <span className="admin-strong">{f.text(info.name)}</span>
                <span className="admin-chain__entity">{f.text(info.entity)}</span>
                <span className="admin-small">{f.text(info.managedBy)}</span>
              </li>
              {index < LEVELS.length - 1 ? (
                <li className="admin-chain__arrow" aria-hidden="true">
                  <Icon name="arrow-forward" />
                </li>
              ) : null}
            </Fragment>
          ))}
        </ol>
        <div className="admin-legend">
          <span className="admin-legend__item">
            <span className="admin-swatch admin-swatch--editable" aria-hidden="true" />
            {t('legendEditable')}
          </span>
          <span className="admin-legend__item">
            <span className="admin-swatch admin-swatch--set" aria-hidden="true" />
            {t('legendSet')}
          </span>
          <span className="admin-legend__item">
            <span className="admin-swatch admin-swatch--inherited" aria-hidden="true" />
            {t('legendInherited')}
          </span>
          <span className="admin-legend__item">
            <Icon name="lock" size="1em" />
            {t('legendLock')}
          </span>
          <span className="admin-legend__item">
            <span className="admin-swatch admin-swatch--blocked" aria-hidden="true" />
            {t('legendBlocked')}
          </span>
          <span className="admin-legend__item">
            <span className="admin-swatch admin-swatch--changed" aria-hidden="true" />
            {t('legendChanged')}
          </span>
        </div>
      </Card>

      <Card title={t('matrixTitle')} subtitle={t('matrixSubtitle')} icon="settings" flush footer={t('matrixHint')}>
        <DataTable
          caption={t('matrixTitle')}
          columns={columns}
          rows={SETTINGS}
          rowKey={(setting) => setting.id}
          selectedKey={selectedId}
          onRowAction={select}
          dense
        />
      </Card>

      <Card title={t('tryTitle')} subtitle={t('trySubtitle')} icon="pen" tone="accent">
        <Toolbar label={t('tryTitle')}>
          <Button
            icon="flask"
            isDisabled={!canEdit}
            onPress={() => {
              apply('critical-potassium', 'unit', '6');
            }}
          >
            {t('tryPotassium')}
          </Button>
          <Button
            icon="clock"
            isDisabled={!canEdit}
            onPress={() => {
              apply('auto-signout', 'department', '15');
            }}
          >
            {t('trySignout')}
          </Button>
          <Button
            icon="users"
            isDisabled={!canEdit}
            onPress={() => {
              apply('language', 'unit', 'ar');
            }}
          >
            {t('tryLanguage')}
          </Button>
        </Toolbar>

        {result === null ? null : <ResultCallout result={result} />}

        <div className="admin-config-detail">
          <div className="admin-config-about">
            <h3 className="admin-h3">{f.text(selected.name)}</h3>
            <p className="admin-small">{f.text(selected.description)}</p>
            <KeyValueList
              columns={1}
              items={[
                {
                  id: 'effective',
                  label: t('effectiveFor', { user: f.text(levelInfo('user').entity), unit: f.text(levelInfo('unit').entity) }),
                  value: userEffective === undefined ? t('cellNotSet') : <span className="admin-strong">{f.text(optionLabel(selected, userEffective.optionId))}</span>,
                },
                {
                  id: 'source',
                  label: t('comesFrom'),
                  value:
                    userEffective === undefined
                      ? t('cellNotSet')
                      : `${f.text(levelInfo(userEffective.source).name)} · ${f.text(levelInfo(userEffective.source).entity)}`,
                },
                {
                  id: 'lock',
                  label: t('lockLabel'),
                  value:
                    selected.lock === null ? (
                      t('notLocked')
                    ) : (
                      <span className="admin-two-line">
                        <span>
                          <Icon name="lock" size="1em" /> {t('lockedAtLong', { level: f.text(levelInfo(selected.lock).name) })}
                        </span>
                        {selected.lockReason === null ? null : <span className="admin-small">{f.text(selected.lockReason)}</span>}
                      </span>
                    ),
                },
              ]}
            />
          </div>

          <form
            className="admin-config-form"
            onSubmit={(event) => {
              event.preventDefault();
              apply(selected.id, level, optionId);
            }}
          >
            <h3 className="admin-h3">{t('changeTitle')}</h3>
            <SelectField
              label={t('fieldSetting')}
              options={SETTINGS.map((setting) => ({ id: setting.id, label: f.text(setting.name) }))}
              selectedKey={selected.id}
              onSelectionChange={(id) => {
                select(settingById(id));
              }}
            />
            <SelectField
              label={t('fieldLevel')}
              options={levelOptions}
              selectedKey={level}
              onSelectionChange={(id) => {
                if (isEditableLevel(id)) {
                  setLevel(id);
                  setResult(null);
                }
              }}
            />
            <SelectField
              label={t('fieldValue')}
              options={valueOptions}
              selectedKey={optionId}
              onSelectionChange={(id) => {
                setOptionId(id);
                setResult(null);
              }}
            />
            <div>
              <Button type="submit" variant="primary" icon="check" isDisabled={!canEdit}>
                {t('applyChange')}
              </Button>
            </div>
            <p className="admin-small">{t('levelsNote')}</p>
          </form>
        </div>
      </Card>
    </div>
  );
}

function LevelCell({ setting, level, overrides }: { readonly setting: ConfigSetting; readonly level: LevelId; readonly overrides: Overrides }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  if (isBelowLock(setting, level)) {
    return (
      <span className="admin-cell admin-cell--blocked">
        <Icon name="lock" size="1em" />
        <span>{t('cellBlocked')}</span>
      </span>
    );
  }
  const own = valueAt(setting, overrides, level);
  if (own !== undefined) {
    const changed = overrides[setting.id]?.[level] !== undefined;
    const lockedHere = setting.lock === level;
    return (
      <span className={cx('admin-cell', 'admin-cell--set', lockedHere && 'admin-cell--lock', changed && 'admin-cell--changed')}>
        <span className="admin-cell__value">{f.text(optionLabel(setting, own))}</span>
        {lockedHere ? (
          <span className="admin-cell__note">
            <Icon name="lock" size="1em" /> {t('cellLockedHere')}
          </span>
        ) : null}
        {changed ? <span className="admin-cell__note">{t('cellChanged')}</span> : null}
      </span>
    );
  }
  const inherited = effectiveAt(setting, overrides, level);
  if (inherited === undefined) {
    return (
      <span className="admin-cell admin-cell--empty">
        <span aria-hidden="true">–</span>
        <span className="hms-visually-hidden">{t('cellNotSet')}</span>
      </span>
    );
  }
  return (
    <span className="admin-cell admin-cell--inherited">
      <span>{f.text(optionLabel(setting, inherited.optionId))}</span>
      <span className="hms-visually-hidden">{t('cellInherited')}</span>
    </span>
  );
}

function ResultCallout({ result }: { readonly result: Result }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const setting = settingById(result.settingId);
  const info = levelInfo(result.level);
  const value = f.text(optionLabel(setting, result.optionId));
  if (result.kind === 'refused') {
    const lockInfo = setting.lock === null ? info : levelInfo(setting.lock);
    return (
      <Callout tone="danger" role="status" icon="lock" title={t('refusedTitle')} className="admin-result">
        <p>
          {t('refusedBody', {
            setting: f.text(setting.name),
            lockLevel: f.text(lockInfo.name),
            lockEntity: f.text(lockInfo.entity),
            level: f.text(info.name),
          })}
        </p>
        {setting.lockReason === null ? null : <p>{t('refusedReason', { reason: f.text(setting.lockReason) })}</p>}
        <p>{t('refusedWho', { who: f.text(lockInfo.managedBy) })}</p>
        <p className="admin-small">{t.rich('auditedAs', { id: <Code>{result.auditId}</Code> })}</p>
      </Callout>
    );
  }
  if (result.kind === 'saved') {
    return (
      <Callout tone="success" role="status" title={t('savedTitle')} className="admin-result">
        <p>{t('savedBody', { setting: f.text(setting.name), value, level: f.text(info.name), entity: f.text(info.entity) })}</p>
        <p className="admin-small">{t.rich('auditedAs', { id: <Code>{result.auditId}</Code> })}</p>
      </Callout>
    );
  }
  return (
    <Callout tone="info" role="status" title={t('sameTitle')} className="admin-result">
      <p>{t('sameBody', { value, level: f.text(info.name) })}</p>
    </Callout>
  );
}
