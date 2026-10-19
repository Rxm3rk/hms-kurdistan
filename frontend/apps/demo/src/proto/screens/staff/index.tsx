/**
 * The Staff & rosters screen (hospital-wide): the staff master with typed practitioner identifiers
 * (Kurdistan Medical Syndicate, Iraqi Medical Association, KRG MOH licence; all numbers invented),
 * clinical privileges with approval, the weekly duty roster grid (Saturday to Friday, Friday the weekend),
 * today's on-call rota and expiring credentials. Changes stay in React state.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DEMO_NOW, DEMO_TODAY, STAFF_ROLE_LABEL, demoDate, getDepartment } from '../../data/index.ts';
import type { StaffMember, StaffRole, Tone } from '../../data/index.ts';
import { ALL_STAFF, ON_CALL, PROFILES, staffById, type OnCall, type PractitionerId, type StaffProfile } from '../../data/ext/staff.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useScreenHref } from '../../shell/index.ts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Code,
  DataTable,
  EmptyState,
  Grid,
  IconButton,
  KeyValueList,
  LinkButton,
  PageHeader,
  SearchField,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  Toolbar,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { RosterTab, useRoster } from './roster.tsx';
import './staff.css';

const SOON = demoDate(-90);

type Expiry = 'lapsed' | 'soon' | 'valid' | 'none';
function expiryOf(id: PractitionerId): Expiry {
  if (id.expires === null) {
    return 'none';
  }
  if (id.expires < DEMO_TODAY) {
    return 'lapsed';
  }
  return id.expires <= SOON ? 'soon' : 'valid';
}
const EXPIRY_TONE: Readonly<Record<Expiry, Tone>> = { lapsed: 'danger', soon: 'warning', valid: 'success', none: 'neutral' };

function ExpiryBadge({ id }: { readonly id: PractitionerId }): ReactNode {
  const t = useT(messages);
  const state = expiryOf(id);
  const key = state === 'lapsed' ? 'lapsed' : state === 'soon' ? 'expiresSoon' : state === 'valid' ? 'valid' : 'noExpiry';
  return (
    <Badge tone={EXPIRY_TONE[state]} size="sm" {...(state === 'lapsed' ? { icon: 'alert' as const } : {})}>
      {t(key)}
    </Badge>
  );
}

export function StaffScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const href = useScreenHref();
  const [profiles, setProfiles] = useState<Readonly<Record<string, StaffProfile>>>(PROFILES);
  const [onCall, setOnCall] = useState<readonly OnCall[]>(ON_CALL);
  const [reminded, setReminded] = useState<ReadonlySet<string>>(new Set());
  const [tab, setTab] = useState('master');
  const roster = useRoster();

  const profileOf = (id: string): StaffProfile | undefined => profiles[id];
  const active = ALL_STAFF.filter((m) => m.active);
  const onDuty = active.filter((m) => {
    const code = roster.shift(m.id, DEMO_TODAY);
    return code === 'M' || code === 'D';
  }).length;
  const credentialRows = ALL_STAFF.flatMap((member) =>
    (profileOf(member.id)?.identifiers ?? []).filter((i) => expiryOf(i) === 'lapsed' || expiryOf(i) === 'soon').map((i) => ({ member, id: i })),
  ).toSorted((a, b) => (a.id.expires ?? '').localeCompare(b.id.expires ?? ''));
  const lapsed = credentialRows.filter((r) => expiryOf(r.id) === 'lapsed').length;
  const pending = Object.values(profiles).reduce((sum, p) => sum + p.privileges.filter((pr) => pr.status === 'pending').length, 0);

  const updateProfile = (next: StaffProfile): void => setProfiles((current) => ({ ...current, [next.staffId]: next }));

  const onCallColumns: readonly Column<OnCall>[] = [
    { id: 'service', header: t('colService'), cell: (o) => <span className="stf-strong">{f.text(o.service)}</span> },
    { id: 'hours', header: t('colHours'), cell: (o) => <Code>{t('hours', { from: o.from, to: o.to })}</Code>, nowrap: true },
    ...(['firstId', 'secondId', 'consultantId'] as const).map((key) => ({
      id: key,
      header: t(key === 'firstId' ? 'colFirst' : key === 'secondId' ? 'colSecond' : 'colConsultant'),
      cell: (o: OnCall) => {
        const member = staffById(o[key]);
        if (member === undefined) {
          return '–';
        }
        return (
          <span className="stf-oncall-person">
            <span className="stf-stack">
              <StaffName member={member} />
              <Code className="stf-muted">{member.phone}</Code>
            </span>
            {key === 'firstId' ? (
              <IconButton icon="phone" label={t('call')} size="sm" onPress={() => toast({ tone: 'info', title: t('toastCall', { name: staffName(member, f.locale), phone: member.phone }) })} />
            ) : null}
          </span>
        );
      },
    })),
    {
      id: 'swap',
      header: <span className="hms-visually-hidden">{t('swap')}</span>,
      cell: (o) =>
        o.firstId === o.secondId ? null : (
          <Button
            size="sm"
            variant="ghost"
            icon="refresh"
            onPress={() => {
              setOnCall((current) => current.map((c) => (c.id === o.id ? { ...c, firstId: c.secondId, secondId: c.firstId } : c)));
              toast({ tone: 'success', title: t('toastSwap', { service: f.text(o.service) }) });
            }}
          >
            {t('swap')}
          </Button>
        ),
      align: 'end',
    },
  ];

  const credentialColumns: readonly Column<(typeof credentialRows)[number]>[] = [
    { id: 'staff', header: t('colStaff'), cell: (r) => <StaffName member={r.member} /> },
    { id: 'system', header: t('colIdentifier'), cell: (r) => t(`sys_${r.id.system}`) },
    { id: 'number', header: t('colNumber'), cell: (r) => <Code>{r.id.value}</Code>, nowrap: true },
    { id: 'expires', header: t('colExpires'), cell: (r) => (r.id.expires === null ? '–' : f.date(r.id.expires)), nowrap: true },
    { id: 'state', header: t('colStatus'), cell: (r) => <ExpiryBadge id={r.id} /> },
    {
      id: 'remind',
      header: <span className="hms-visually-hidden">{t('remind')}</span>,
      cell: (r) => {
        const key = `${r.member.id}|${r.id.value}`;
        return reminded.has(key) ? (
          <Badge tone="info" icon="check" size="sm">
            {t('reminded')}
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            icon="bell"
            onPress={() => {
              setReminded(new Set([...reminded, key]));
              toast({ tone: 'success', title: t('toastReminded', { name: staffName(r.member, f.locale) }) });
            }}
          >
            {t('remind')}
          </Button>
        );
      },
      align: 'end',
    },
  ];

  return (
    <div className="staff-screen">
      <PageHeader
        icon="user"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <LinkButton href={href('admin')} variant="ghost" icon="settings">
              {t('openAdmin')}
            </LinkButton>
            <Button variant="primary" icon="calendar" onPress={() => toast({ tone: 'success', title: t('toastPublished', { date: f.date(roster.week) }) })}>
              {t('publishRoster')}
            </Button>
          </>
        }
      >
        <Badge tone="neutral" icon="info" size="sm">
          {t('synthetic')}
        </Badge>
      </PageHeader>

      <Grid min="12rem">
        <StatTile label={t('tileActive')} value={f.number(active.length)} icon="users" hint={t('tileActiveHint', { count: ALL_STAFF.length - active.length })} onPress={() => setTab('master')} />
        <StatTile label={t('tileOnDuty')} value={f.number(onDuty)} icon="clock" hint={t('tileOnDutyHint', { time: f.time(DEMO_NOW) })} onPress={() => setTab('roster')} />
        <StatTile label={t('tileOnCall')} value={f.number(new Set(onCall.map((o) => o.firstId)).size)} icon="phone" hint={t('tileOnCallHint', { count: onCall.length })} onPress={() => setTab('oncall')} />
        <StatTile label={t('tileExpiring')} value={f.number(credentialRows.length)} icon="alert" tone={lapsed > 0 ? 'danger' : 'warning'} hint={t('tileExpiringHint', { count: lapsed })} onPress={() => setTab('credentials')} />
        <StatTile label={t('tilePending')} value={f.number(pending)} icon="shield" tone={pending > 0 ? 'info' : undefined} hint={t('tilePendingHint')} onPress={() => setTab('master')} />
      </Grid>

      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'master', label: t('tabMaster'), badge: String(ALL_STAFF.length), content: <MasterTab profileOf={profileOf} onUpdate={updateProfile} /> },
          { id: 'roster', label: t('tabRoster'), content: <RosterTab roster={roster} /> },
          {
            id: 'oncall',
            label: t('tabOnCall'),
            content: (
              <Card title={t('onCallTable')} subtitle={t('onCallSubtitle', { date: f.date(DEMO_TODAY, 'long') })} icon="phone" flush>
                <DataTable caption={t('onCallTable')} columns={onCallColumns} rows={onCall} rowKey={(o) => o.id} dense />
              </Card>
            ),
          },
          {
            id: 'credentials',
            label: t('tabCredentials'),
            badge: String(credentialRows.length),
            content: (
              <Card title={t('credentialsTable')} icon="shield" flush>
                <DataTable
                  caption={t('credentialsTable')}
                  columns={credentialColumns}
                  rows={credentialRows}
                  rowKey={(r) => `${r.member.id}|${r.id.value}`}
                  rowTone={(r) => (expiryOf(r.id) === 'lapsed' ? 'danger' : undefined)}
                  emptyText={t('credentialsEmpty')}
                  dense
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function MasterTab({ profileOf, onUpdate }: { readonly profileOf: (id: string) => StaffProfile | undefined; readonly onUpdate: (profile: StaffProfile) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | StaffRole>('all');
  const [selectedId, setSelectedId] = useState<string | null>(ALL_STAFF[0]?.id ?? null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_STAFF.filter((m) => {
      if (role !== 'all' && m.role !== role) {
        return false;
      }
      if (q === '') {
        return true;
      }
      const ids = profileOf(m.id)?.identifiers.map((i) => i.value).join(' ') ?? '';
      return [m.name.latin, m.name.ckb, m.name.ar, f.text(m.title), ids].join(' ').toLowerCase().includes(q);
    });
  }, [query, role, profileOf, f]);

  const roles: readonly StaffRole[] = ['physician', 'nurse', 'pharmacist', 'lab', 'radiology', 'cashier', 'reception', 'admin'];
  const mainId = (m: StaffMember): PractitionerId | undefined => profileOf(m.id)?.identifiers[0];

  const columns: readonly Column<StaffMember>[] = [
    {
      id: 'name',
      header: t('colName'),
      cell: (m) => (
        <span className="stf-person">
          <Avatar name={m.name} size="sm" />
          <StaffName member={m} />
        </span>
      ),
    },
    {
      id: 'title',
      header: t('colTitle'),
      cell: (m) => (
        <span className="stf-stack">
          <span>{f.text(m.title)}</span>
          <span className="stf-muted">{f.text(getDepartment(m.departmentId).name)}</span>
        </span>
      ),
    },
    { id: 'role', header: t('colRole'), cell: (m) => f.text(STAFF_ROLE_LABEL[m.role]) },
    {
      id: 'reg',
      header: t('colRegistration'),
      cell: (m) => {
        const id = mainId(m);
        return id === undefined ? (
          '–'
        ) : (
          <span className="stf-stack">
            <Code>{id.value}</Code>
            <span className="stf-muted">{t(`sys_${id.system}`)}</span>
          </span>
        );
      },
    },
    {
      id: 'expires',
      header: t('colExpires'),
      cell: (m) => {
        const id = mainId(m);
        return id === undefined ? '–' : <ExpiryBadge id={id} />;
      },
      nowrap: true,
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (m) => (
        <Badge tone={m.active ? 'success' : 'neutral'} size="sm" {...(m.active ? {} : { icon: 'lock' as const })}>
          {m.active ? t('active') : t('disabled')}
        </Badge>
      ),
      nowrap: true,
    },
  ];

  const selected = selectedId === null ? undefined : staffById(selectedId);
  const profile = selected === undefined ? undefined : profileOf(selected.id);

  return (
    <div className="stf-tab">
      <Toolbar label={t('staffTable')}>
        <SelectField
          label={t('roleFilter')}
          hideLabel
          options={[{ id: 'all', label: t('allRoles') }, ...roles.map((r) => ({ id: r, label: f.text(STAFF_ROLE_LABEL[r]) }))]}
          selectedKey={role}
          onSelectionChange={(id) => setRole(id as 'all' | StaffRole)}
          className="stf-select"
        />
        <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={query} onChange={setQuery} className="stf-search" />
      </Toolbar>
      <div className="stf-split">
        <Card flush className="stf-list">
          <DataTable
            caption={t('staffTable')}
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            onRowAction={(m) => setSelectedId(m.id)}
            selectedKey={selectedId}
            rowTone={(m) => (mainId(m) !== undefined && expiryOf(mainId(m) as PractitionerId) === 'lapsed' ? 'danger' : undefined)}
            emptyText={t('noMatches')}
            dense
          />
        </Card>
        {selected === undefined || profile === undefined ? (
          <Card>
            <EmptyState icon="user" title={t('selectTitle')} body={t('selectBody')} compact />
          </Card>
        ) : (
          <Card
            title={<StaffName member={selected} />}
            subtitle={f.text(selected.title)}
            icon="user"
            className="stf-detail"
            actions={<IconButton icon="x" label={t('close')} onPress={() => setSelectedId(null)} />}
          >
            <div className="stf-detail__body">
              <KeyValueList
                items={[
                  { id: 'dept', label: t('colTitle'), value: f.text(getDepartment(selected.departmentId).name) },
                  { id: 'emp', label: t('employment'), value: t(profile.employment === 'full-time' ? 'emp_full' : profile.employment === 'part-time' ? 'emp_part' : 'emp_visiting') },
                  { id: 'joined', label: t('joined'), value: f.date(profile.joinedOn) },
                  { id: 'phone', label: t('phone'), value: <Code>{selected.phone}</Code> },
                  { id: 'langs', label: t('languages'), value: profile.languages.map((l) => t(`lang_${l}`)).join(f.locale === 'en' ? ', ' : '، ') },
                  { id: 'signin', label: t('lastSignIn'), value: f.relative(selected.lastSignInIso) },
                  { id: 'oncall', label: t('onCallEligible'), value: profile.onCallEligible ? t('yes') : t('no') },
                  { id: 'status', label: t('colStatus'), value: selected.active ? t('active') : t('disabled') },
                ]}
              />
              <h3 className="stf-h3">{t('identifiers')}</h3>
              <ul className="stf-ids">
                {profile.identifiers.map((id) => (
                  <li key={id.value} className="stf-id">
                    <span className="stf-stack">
                      <span className="stf-muted">{t(`sys_${id.system}`)}</span>
                      <Code className="stf-strong">{id.value}</Code>
                      {id.expires === null ? null : <span className="stf-muted">{`${t('colExpires')}: ${f.date(id.expires)}`}</span>}
                    </span>
                    <span className="stf-inline">
                      <ExpiryBadge id={id} />
                      {id.verified ? (
                        <Badge tone="success" icon="check" size="sm">
                          {t('verified')}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon="shield"
                          onPress={() => {
                            onUpdate({ ...profile, identifiers: profile.identifiers.map((x) => (x.value === id.value ? { ...x, verified: true } : x)) });
                            toast({ tone: 'success', title: t('toastVerified', { system: t(`sys_${id.system}`) }) });
                          }}
                        >
                          {t('verify')}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <h3 className="stf-h3">{t('privileges')}</h3>
              {profile.privileges.length === 0 ? <p className="stf-muted">{t('noPrivileges')}</p> : null}
              <ul className="stf-ids">
                {profile.privileges.map((pr) => (
                  <li key={pr.id} className="stf-id">
                    <span>{f.text(pr.text)}</span>
                    <span className="stf-inline">
                      <Badge tone={pr.status === 'granted' ? 'success' : pr.status === 'pending' ? 'info' : pr.status === 'suspended' ? 'danger' : 'accent'} size="sm">
                        {t(`pr_${pr.status}`)}
                      </Badge>
                      {pr.status === 'pending' ? (
                        <Button
                          size="sm"
                          variant="primary"
                          icon="check"
                          onPress={() => {
                            onUpdate({ ...profile, privileges: profile.privileges.map((x) => (x.id === pr.id ? { ...x, status: 'granted' } : x)) });
                            toast({ tone: 'success', title: t('toastApproved') });
                          }}
                        >
                          {t('approve')}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

