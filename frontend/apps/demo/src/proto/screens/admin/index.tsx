/**
 * Administration: configuration with locks (the chain Vendor → Kurdistan pack → Hospital group → Facility →
 * Department → Unit → User), users and roles, clinical safety switches (kill switches, audited) and a sample
 * of the audit log. Changes live in this screen's state for the session; nothing is saved.
 * Only the administrator role may change things; other roles see the screen read-only.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, ROLE_LABEL, STAFF, isToday, AUDIT_EVENTS } from '../../data/index.ts';
import type { Text3 } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useRole } from '../../shell/index.ts';
import { Button, Callout, Grid, PageHeader, StaffName, StatTile, Tabs } from '../../ui/index.ts';
import './admin.css';
import { ACCESS_EVENTS, type SessionEvent } from './audit-data.ts';
import { AuditPanel } from './audit.tsx';
import { SETTINGS, type LevelId, type Overrides } from './config-data.ts';
import { ConfigurationPanel } from './configuration.tsx';
import { messages } from './messages.ts';
import { SAFETY_RULES, type SafetyRule } from './rules-data.ts';
import { SafetyPanel } from './safety.tsx';
import { LOCKED_ACCOUNTS } from './users-data.ts';
import { UsersPanel } from './users.tsx';

type TabId = 'config' | 'users' | 'safety' | 'audit';
const TAB_IDS: readonly TabId[] = ['config', 'users', 'safety', 'audit'];

const EXPORT_SUBJECT: Text3 = { en: 'Audit log', ckb: 'تۆماری چاودێری', ar: 'سجل التدقيق' };

export function AdminScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { roleId, user, setRole } = useRole();
  const canEdit = roleId === 'admin';
  const [tab, setTab] = useState<TabId>('config');
  const [overrides, setOverrides] = useState<Overrides>({});
  const [rules, setRules] = useState<readonly SafetyRule[]>(SAFETY_RULES);
  const [session, setSession] = useState<readonly SessionEvent[]>([]);
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const seq = useRef(100);

  const record = useCallback(
    (event: Omit<SessionEvent, 'id' | 'iso' | 'actorId'>): string => {
      seq.current += 1;
      const id = `SYN-AUD-${String(seq.current).padStart(4, '0')}`;
      setSession((current) => [{ ...event, id, iso: DEMO_NOW_ISO, actorId: user.id }, ...current]);
      return id;
    },
    [user.id],
  );

  const saveOverride = (settingId: string, level: LevelId, optionId: string): void => {
    setOverrides((current) => ({ ...current, [settingId]: { ...current[settingId], [level]: optionId } }));
  };

  const changeRule = (ruleId: string, on: boolean, reason: string | null): string => {
    const rule = rules.find((candidate) => candidate.id === ruleId);
    setRules((current) =>
      current.map((candidate) =>
        candidate.id === ruleId
          ? {
              ...candidate,
              on,
              changedById: user.id,
              changedIso: DEMO_NOW_ISO,
              reason:
                reason === null
                  ? { en: messages.en.ruleBackOn, ckb: messages.ckb.ruleBackOn, ar: messages.ar.ruleBackOn }
                  : { en: reason, ckb: reason, ar: reason },
            }
          : candidate,
      ),
    );
    return record({
      kind: on ? 'rule-on' : 'rule-off',
      subject: rule?.name ?? { en: ruleId, ckb: ruleId, ar: ruleId },
      detail: null,
      value: null,
      reason,
      target: ruleId,
      tone: on ? 'success' : 'warning',
    });
  };

  const review = (accessId: string): string => {
    setReviewed((current) => new Set(current).add(accessId));
    return record({
      kind: 'access-reviewed',
      subject: { en: accessId, ckb: accessId, ar: accessId },
      detail: null,
      value: null,
      reason: null,
      target: accessId,
      tone: 'success',
    });
  };

  const exportLog = (): string =>
    record({ kind: 'export', subject: EXPORT_SUBJECT, detail: null, value: null, reason: null, target: null, tone: 'info' });

  const active = STAFF.filter((member) => member.active).length;
  const rulesOn = rules.filter((rule) => rule.on).length;
  const lockedSettings = SETTINGS.filter((setting) => setting.lock !== null).length;
  const eventsToday =
    ACCESS_EVENTS.filter((event) => isToday(event.iso)).length + AUDIT_EVENTS.filter((event) => isToday(event.iso)).length + session.length;
  const toReview = ACCESS_EVENTS.filter((event) => event.action === 'emergency' && !reviewed.has(event.id)).length;

  return (
    <div className="admin-screen">
      <PageHeader
        icon="settings"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <span className="admin-signed-in">
            {t.rich('signedInAs', { name: <StaffName member={user} />, role: f.text(ROLE_LABEL[roleId]) })}
          </span>
        }
      />

      {canEdit ? null : (
        <Callout
          tone="warning"
          icon="lock"
          title={t('readOnlyTitle')}
          actions={
            <Button
              variant="primary"
              icon="user"
              onPress={() => {
                setRole('admin');
              }}
            >
              {t('switchToAdmin')}
            </Button>
          }
        >
          {t('readOnlyBody', { role: f.text(ROLE_LABEL[roleId]) })}
        </Callout>
      )}

      <Grid min="13rem">
        <StatTile
          label={t('tileSettings')}
          value={f.number(lockedSettings)}
          unit={t('ofCount', { total: SETTINGS.length })}
          icon="lock"
          hint={t('tileSettingsHint')}
          onPress={() => {
            setTab('config');
          }}
        />
        <StatTile
          label={t('tileUsers')}
          value={f.number(active)}
          unit={t('ofCount', { total: STAFF.length })}
          icon="users"
          hint={t('tileUsersHint', { disabled: STAFF.length - active, locked: LOCKED_ACCOUNTS.size })}
          onPress={() => {
            setTab('users');
          }}
        />
        <StatTile
          label={t('tileRules')}
          value={f.number(rulesOn)}
          unit={t('ofCount', { total: rules.length })}
          icon="shield"
          tone={rulesOn < rules.length ? 'warning' : 'success'}
          hint={t('tileRulesHint', { off: rules.length - rulesOn })}
          onPress={() => {
            setTab('safety');
          }}
        />
        <StatTile
          label={t('tileAudit')}
          value={f.number(eventsToday)}
          icon="clipboard"
          {...(toReview > 0 ? { tone: 'warning' as const } : {})}
          hint={toReview > 0 ? t('tileAuditReview', { count: toReview }) : t('tileAuditHint')}
          onPress={() => {
            setTab('audit');
          }}
        />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={(id) => {
          const next = TAB_IDS.find((candidate) => candidate === id);
          if (next !== undefined) {
            setTab(next);
          }
        }}
        items={[
          {
            id: 'config',
            label: t('tabConfig'),
            content: <ConfigurationPanel overrides={overrides} onSave={saveOverride} canEdit={canEdit} record={record} />,
          },
          { id: 'users', label: t('tabUsers'), badge: f.number(STAFF.length), content: <UsersPanel /> },
          {
            id: 'safety',
            label: t('tabSafety'),
            badge: t('rulesOnShort', { on: rulesOn, total: rules.length }),
            content: <SafetyPanel rules={rules} onChange={changeRule} canEdit={canEdit} />,
          },
          {
            id: 'audit',
            label: t('tabAudit'),
            ...(toReview > 0 ? { badge: f.number(toReview) } : {}),
            content: <AuditPanel session={session} reviewed={reviewed} onReview={review} onExport={exportLog} canEdit={canEdit} />,
          },
        ]}
      />
    </div>
  );
}
