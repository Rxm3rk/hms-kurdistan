/**
 * Safety switches: clinical decision-support rules with kill switches. Rules locked by the vendor or the
 * Kurdistan pack cannot be switched off here. Switching a rule off asks for a reason; every change is
 * audited (this session only; nothing is saved).
 */
import { useState, type ReactNode } from 'react';
import { Switch } from 'react-aria-components';
import { DEMO_NOW_ISO, findStaff } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useRole } from '../../shell/index.ts';
import { Badge, Button, Callout, Card, Code, DataTable, Dialog, Icon, KeyValueList, StaffName, TextInput, useToast, type Column } from '../../ui/index.ts';
import { levelInfo } from './config-data.ts';
import type { SafetyRule } from './rules-data.ts';
import { messages } from './messages.ts';

const MIN_REASON = 10;

export interface SafetyPanelProps {
  readonly rules: readonly SafetyRule[];
  /** Applies a switch change and returns the audit id. */
  readonly onChange: (ruleId: string, on: boolean, reason: string | null) => string;
  readonly canEdit: boolean;
}

export function SafetyPanel({ rules, onChange, canEdit }: SafetyPanelProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { user } = useRole();
  const [pending, setPending] = useState<SafetyRule | null>(null);
  const [reason, setReason] = useState('');
  const on = rules.filter((rule) => rule.on).length;
  const locked = rules.filter((rule) => rule.locked).length;

  const toggle = (rule: SafetyRule, next: boolean): void => {
    if (!canEdit || rule.locked) {
      return;
    }
    if (!next) {
      setReason('');
      setPending(rule);
      return;
    }
    const auditId = onChange(rule.id, true, null);
    toast({ tone: 'success', title: t('toastRuleOn', { rule: f.text(rule.name) }), body: t('toastAudited', { id: auditId }) });
  };

  const confirmOff = (): void => {
    if (pending === null || reason.trim().length < MIN_REASON) {
      return;
    }
    const auditId = onChange(pending.id, false, reason.trim());
    toast({ tone: 'warning', title: t('toastRuleOff', { rule: f.text(pending.name) }), body: t('toastAudited', { id: auditId }) });
    setPending(null);
  };

  const columns: readonly Column<SafetyRule>[] = [
    {
      id: 'rule',
      header: t('colRule'),
      cell: (rule) => (
        <span className="admin-two-line">
          <span className="admin-strong">{f.text(rule.name)}</span>
          <span className="admin-small">{f.text(rule.description)}</span>
          <Code className="admin-small">{rule.id}</Code>
        </span>
      ),
    },
    {
      id: 'kind',
      header: t('colKind'),
      cell: (rule) =>
        rule.kind === 'interruptive' ? (
          <Badge tone="accent" icon="alert" size="sm">
            {t('kindInterruptive')}
          </Badge>
        ) : (
          <Badge tone="neutral" icon="info" size="sm">
            {t('kindAdvisory')}
          </Badge>
        ),
    },
    {
      id: 'owner',
      header: t('colOwner'),
      cell: (rule) => (
        <span className="admin-two-line">
          <span>{f.text(levelInfo(rule.level).name)}</span>
          {rule.locked ? (
            <Badge tone="neutral" icon="lock" size="sm">
              {t('ruleLocked')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    { id: 'fired', header: t('colFired'), align: 'end', nowrap: true, cell: (rule) => <span className="admin-num">{f.number(rule.firedToday)}</span> },
    {
      id: 'change',
      header: t('colLastChange'),
      cell: (rule) => {
        const who = findStaff(rule.changedById);
        return (
          <span className="admin-two-line">
            <span>{who === undefined ? t('changedByRelease') : <StaffName member={who} />}</span>
            <span className="admin-small admin-num">{f.dateTime(rule.changedIso)}</span>
            <span className="admin-small">{f.text(rule.reason)}</span>
          </span>
        );
      },
    },
    {
      id: 'switch',
      header: t('colSwitch'),
      nowrap: true,
      cell: (rule) => (
        <span className="admin-two-line">
          <Switch
            className="admin-switch"
            isSelected={rule.on}
            isDisabled={!canEdit || rule.locked}
            onChange={(next) => {
              toggle(rule, next);
            }}
            aria-label={t('switchLabel', { rule: f.text(rule.name) })}
          >
            <span className="admin-switch__track" aria-hidden="true">
              <span className="admin-switch__thumb" />
            </span>
            <span className="admin-switch__text">{rule.on ? t('switchOn') : t('switchOff')}</span>
          </Switch>
          {rule.locked ? (
            <span className="admin-small">
              <Icon name="lock" size="1em" /> {t('cannotSwitchOff')}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="admin-panel">
      <Callout tone="info" title={t('safetyIntroTitle')}>
        {t('safetyIntro')}
      </Callout>
      <Card
        title={t('safetyTitle')}
        subtitle={t('safetySubtitle', { on, total: rules.length, locked })}
        icon="shield"
        flush
        footer={t('safetyNote')}
      >
        <DataTable
          caption={t('safetyTitle')}
          columns={columns}
          rows={rules}
          rowKey={(rule) => rule.id}
          rowTone={(rule) => (rule.on ? undefined : 'warning')}
          dense
        />
      </Card>

      <Dialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        role="alertdialog"
        title={pending === null ? '' : t('offTitle', { rule: f.text(pending.name) })}
        subtitle={t('offSubtitle')}
        actions={
          <>
            <Button
              onPress={() => {
                setPending(null);
              }}
            >
              {t('keepOn')}
            </Button>
            <Button variant="danger" icon="x" isDisabled={reason.trim().length < MIN_REASON} onPress={confirmOff}>
              {t('turnOff')}
            </Button>
          </>
        }
      >
        {pending === null ? null : (
          <div className="admin-dialog-body">
            <Callout tone="warning" title={t('offWarningTitle')}>
              {t('offWarning', { rule: f.text(pending.name) })}
            </Callout>
            <TextInput
              label={t('reasonLabel')}
              description={t('reasonHelp', { min: MIN_REASON })}
              value={reason}
              onChange={setReason}
              multiline
              isRequired
            />
            <KeyValueList
              columns={2}
              items={[
                { id: 'who', label: t('recordedAs'), value: <StaffName member={user} /> },
                { id: 'when', label: t('recordedWhen'), value: <span className="admin-num">{f.dateTime(DEMO_NOW_ISO)}</span> },
              ]}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
