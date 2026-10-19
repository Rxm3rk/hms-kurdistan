/**
 * Audit log sample: who opened which patient's record, when, from where and why (with the emergency access
 * to review), and the system and configuration events, including this session's own changes.
 */
import { useState, type ReactNode } from 'react';
import { AUDIT_EVENTS, STAFF_ROLE_LABEL, findStaff, getPatient, isToday } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Card, Code, DataTable, Dot, PatientInline, Segmented, StaffName, useToast, type Column } from '../../ui/index.ts';
import { ACCESS_ACTION_LABEL, ACCESS_EVENTS, ACCESS_PURPOSE_LABEL, type AccessEvent, type SessionEvent } from './audit-data.ts';
import { messages } from './messages.ts';

type View = 'access' | 'system';

interface SystemRow {
  readonly id: string;
  readonly iso: string;
  readonly actorId: string;
  readonly text: string;
  readonly reason: string | null;
  readonly target: string | null;
  readonly tone: Tone;
  readonly session: boolean;
}

export interface AuditPanelProps {
  readonly session: readonly SessionEvent[];
  readonly reviewed: ReadonlySet<string>;
  /** Marks an emergency access as reviewed; returns the audit id. */
  readonly onReview: (accessId: string) => string;
  /** Records an export; returns the audit id. */
  readonly onExport: () => string;
  readonly canEdit: boolean;
}

export function AuditPanel({ session, reviewed, onReview, onExport, canEdit }: AuditPanelProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [view, setView] = useState<View>('access');
  const toReview = ACCESS_EVENTS.filter((event) => event.action === 'emergency' && !reviewed.has(event.id));

  const when = (iso: string): ReactNode => (
    <span className="admin-two-line">
      <span className="admin-num admin-strong">{f.time(iso)}</span>
      <span className="admin-small">{isToday(iso) ? t('today') : f.date(iso)}</span>
    </span>
  );
  const actor = (actorId: string): ReactNode => {
    const member = findStaff(actorId);
    return member === undefined ? (
      <Code>{actorId}</Code>
    ) : (
      <span className="admin-two-line">
        <StaffName member={member} />
        <span className="admin-small">{f.text(STAFF_ROLE_LABEL[member.role])}</span>
      </span>
    );
  };

  const accessColumns: readonly Column<AccessEvent>[] = [
    { id: 'time', header: t('colWhen'), nowrap: true, cell: (event) => when(event.iso) },
    { id: 'user', header: t('colWho'), cell: (event) => actor(event.actorId) },
    {
      id: 'action',
      header: t('colWhat'),
      cell: (event) => (
        <span className="admin-two-line">
          {event.action === 'emergency' ? (
            <Badge tone="warning" icon="alert" size="sm">
              {f.text(ACCESS_ACTION_LABEL[event.action])}
            </Badge>
          ) : (
            <span className="admin-strong">{f.text(ACCESS_ACTION_LABEL[event.action])}</span>
          )}
          <span className="admin-small">{f.text(event.area)}</span>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (event) => <PatientInline patient={getPatient(event.patientId)} /> },
    {
      id: 'purpose',
      header: t('colPurpose'),
      cell: (event) => (
        <span className="admin-two-line">
          <Badge tone={event.purpose === 'emergency' ? 'warning' : 'neutral'} size="sm">
            {f.text(ACCESS_PURPOSE_LABEL[event.purpose])}
          </Badge>
          {event.action === 'emergency' ? (
            reviewed.has(event.id) ? (
              <Badge tone="success" icon="check-circle" size="sm">
                {t('reviewed')}
              </Badge>
            ) : (
              <Badge tone="warning" icon="clock" size="sm">
                {t('needsReview')}
              </Badge>
            )
          ) : null}
        </span>
      ),
    },
    { id: 'workstation', header: t('colWorkstation'), nowrap: true, cell: (event) => <Code>{event.workstation}</Code> },
  ];

  const sessionText = (event: SessionEvent): string => {
    const subject = f.text(event.subject);
    const level = event.detail === null ? '' : f.text(event.detail);
    const value = event.value === null ? '' : f.text(event.value);
    switch (event.kind) {
      case 'config-saved':
        return t('evConfigSaved', { setting: subject, value, level });
      case 'config-refused':
        return t('evConfigRefused', { setting: subject, value, level });
      case 'rule-off':
        return t('evRuleOff', { rule: subject });
      case 'rule-on':
        return t('evRuleOn', { rule: subject });
      case 'access-reviewed':
        return t('evAccessReviewed', { entry: subject });
      case 'export':
        return t('evExport');
    }
  };

  const systemRows: readonly SystemRow[] = [
    ...session.map((event) => ({
      id: event.id,
      iso: event.iso,
      actorId: event.actorId,
      text: sessionText(event),
      reason: event.reason,
      target: event.target,
      tone: event.tone,
      session: true,
    })),
    ...AUDIT_EVENTS.map((event) => ({
      id: event.id,
      iso: event.iso,
      actorId: event.actorId,
      text: f.text(event.action),
      reason: null,
      target: event.target,
      tone: event.tone,
      session: false,
    })),
  ];

  const systemColumns: readonly Column<SystemRow>[] = [
    { id: 'time', header: t('colWhen'), nowrap: true, cell: (row) => when(row.iso) },
    { id: 'user', header: t('colWho'), cell: (row) => actor(row.actorId) },
    {
      id: 'event',
      header: t('colEvent'),
      cell: (row) => (
        <span className="admin-event">
          <Dot tone={row.tone} />
          <span className="admin-two-line">
            <span>{row.text}</span>
            {row.reason === null ? null : <span className="admin-small">{t('reasonGiven', { reason: row.reason })}</span>}
            {row.session ? (
              <Badge tone="accent" size="sm">
                {t('thisSession')}
              </Badge>
            ) : null}
          </span>
        </span>
      ),
    },
    { id: 'target', header: t('colTarget'), nowrap: true, cell: (row) => (row.target === null ? <span className="admin-small">–</span> : <Code>{row.target}</Code>) },
    { id: 'id', header: t('colEntry'), nowrap: true, cell: (row) => <Code className="admin-small">{row.id}</Code> },
  ];

  return (
    <div className="admin-panel">
      <Callout
        tone="info"
        icon="shield"
        title={t('auditIntroTitle')}
        actions={
          <Button
            icon="printer"
            isDisabled={!canEdit}
            onPress={() => {
              const auditId = onExport();
              toast({ tone: 'info', title: t('toastExport'), body: t('toastAudited', { id: auditId }) });
            }}
          >
            {t('exportLog')}
          </Button>
        }
      >
        {t('auditIntro')}
      </Callout>

      {toReview.map((event) => {
        const member = findStaff(event.actorId);
        return (
          <Callout
            key={event.id}
            tone="warning"
            title={t('emergencyTitle')}
            actions={
              <Button
                icon="check"
                isDisabled={!canEdit}
                onPress={() => {
                  const auditId = onReview(event.id);
                  toast({ tone: 'success', title: t('toastReviewed'), body: t('toastAudited', { id: auditId }) });
                }}
              >
                {t('markReviewed')}
              </Button>
            }
          >
            <div className="admin-emergency">
              <p>
                {t.rich('emergencyBody', {
                  name: member === undefined ? <Code>{event.actorId}</Code> : <StaffName member={member} />,
                  time: `${f.date(event.iso)}, ${f.time(event.iso)}`,
                  workstation: <Code>{event.workstation}</Code>,
                })}
              </p>
              <PatientInline patient={getPatient(event.patientId)} />
              {event.reason === null ? null : <p className="admin-quote">{t('reasonGiven', { reason: f.text(event.reason) })}</p>}
            </div>
          </Callout>
        );
      })}

      <Card
        title={view === 'access' ? t('accessTitle') : t('systemTitle')}
        subtitle={view === 'access' ? t('accessSubtitle', { count: ACCESS_EVENTS.length }) : t('systemSubtitle', { count: systemRows.length })}
        icon="clipboard"
        flush
        actions={
          <Segmented
            label={t('auditView')}
            hideLabel
            value={view}
            onChange={(id) => {
              setView(id === 'system' ? 'system' : 'access');
            }}
            options={[
              { id: 'access', label: t('viewAccess') },
              { id: 'system', label: t('viewSystem') },
            ]}
          />
        }
        footer={t('auditNote')}
      >
        {view === 'access' ? (
          <DataTable
            caption={t('accessTitle')}
            columns={accessColumns}
            rows={ACCESS_EVENTS}
            rowKey={(event) => event.id}
            rowTone={(event) => (event.action === 'emergency' && !reviewed.has(event.id) ? 'warning' : undefined)}
            dense
          />
        ) : (
          <DataTable caption={t('systemTitle')} columns={systemColumns} rows={systemRows} rowKey={(row) => row.id} dense />
        )}
      </Card>
    </div>
  );
}
