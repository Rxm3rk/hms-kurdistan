/**
 * Users and roles: the synthetic staff accounts (role, department, last sign-in, status) and a simplified
 * matrix of what each role may do. Read-only in the prototype.
 */
import { useState, type ReactNode } from 'react';
import { DEPARTMENTS, STAFF, STAFF_ROLE_LABEL } from '../../data/index.ts';
import type { StaffMember } from '../../data/index.ts';
import { Bdi } from '@hms/design-system';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Avatar, Badge, Card, Code, DataTable, Icon, SearchField, Segmented, StaffName, Toolbar, type Column } from '../../ui/index.ts';
import { ACCESS_SCOPE, LOCKED_ACCOUNTS, MATRIX_ROLES, PERMISSIONS, type Grant, type Permission } from './users-data.ts';
import { messages } from './messages.ts';

type RoleFilter = 'all' | 'physician' | 'nurse' | 'other';

function matchesFilter(member: StaffMember, filter: RoleFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'other') {
    return member.role !== 'physician' && member.role !== 'nurse';
  }
  return member.role === filter;
}

function matchesQuery(member: StaffMember, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q === '') {
    return true;
  }
  return [member.id, member.name.latin, member.name.ckb, member.name.ar, member.title.en, member.title.ckb, member.title.ar].some((text) =>
    text.toLocaleLowerCase().includes(q),
  );
}

export function UsersPanel(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const rows = STAFF.filter((member) => matchesFilter(member, filter) && matchesQuery(member, query));

  const columns: readonly Column<StaffMember>[] = [
    {
      id: 'user',
      header: t('colUser'),
      cell: (member) => (
        <span className="admin-user">
          <Avatar name={member.name} size="sm" />
          <span className="admin-two-line">
            <StaffName member={member} className="admin-strong" />
            <Code className="admin-small">{member.id}</Code>
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: t('colRole'),
      cell: (member) => (
        <span className="admin-two-line">
          <Badge tone={member.role === 'admin' ? 'accent' : 'neutral'} size="sm">
            {f.text(STAFF_ROLE_LABEL[member.role])}
          </Badge>
          <span className="admin-small">{f.text(member.title)}</span>
        </span>
      ),
    },
    {
      id: 'department',
      header: t('colDepartment'),
      cell: (member) => {
        const department = DEPARTMENTS.find((candidate) => candidate.id === member.departmentId);
        return (
          <span className="admin-two-line">
            <span>{department === undefined ? member.departmentId : f.text(department.name)}</span>
            <span className="admin-small">{f.text(ACCESS_SCOPE[member.role])}</span>
          </span>
        );
      },
    },
    {
      id: 'phone',
      header: t('colPhone'),
      nowrap: true,
      cell: (member) => (
        <Bdi dir="ltr" className="admin-num">
          {member.phone}
        </Bdi>
      ),
    },
    {
      id: 'signin',
      header: t('colLastSignIn'),
      nowrap: true,
      cell: (member) => (
        <span className="admin-two-line">
          <span className="admin-num">{f.dateTime(member.lastSignInIso)}</span>
          <span className="admin-small">{f.relative(member.lastSignInIso)}</span>
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colAccount'),
      cell: (member) => (
        <span className="admin-badges">
          {member.active ? (
            <Badge tone="success" icon="check-circle" size="sm">
              {t('statusActive')}
            </Badge>
          ) : (
            <Badge tone="neutral" icon="x" size="sm">
              {t('statusDisabled')}
            </Badge>
          )}
          {LOCKED_ACCOUNTS.has(member.id) ? (
            <Badge tone="warning" icon="lock" size="sm">
              {t('statusLocked')}
            </Badge>
          ) : null}
        </span>
      ),
    },
  ];

  const permissionColumns: readonly Column<Permission>[] = [
    {
      id: 'permission',
      header: t('colPermission'),
      cell: (permission) => (
        <span className="admin-two-line">
          <span className="admin-strong">{f.text(permission.name)}</span>
          {permission.limitedNote === null ? null : <span className="admin-small">{f.text(permission.limitedNote)}</span>}
        </span>
      ),
    },
    ...MATRIX_ROLES.map(
      (role): Column<Permission> => ({
        id: role,
        header: f.text(STAFF_ROLE_LABEL[role]),
        align: 'center',
        cell: (permission) => <GrantCell grant={permission.grants[role]} />,
      }),
    ),
  ];

  const active = STAFF.filter((member) => member.active).length;

  return (
    <div className="admin-panel">
      <Card
        title={t('usersTitle')}
        subtitle={t('usersSubtitle', { active, total: STAFF.length })}
        icon="users"
        flush
        footer={t('usersNote')}
      >
        <div className="admin-filters">
          <Toolbar label={t('usersFilters')}>
            <SearchField label={t('usersSearch')} value={query} onChange={setQuery} placeholder={t('usersSearchPlaceholder')} />
            <Segmented
              label={t('usersRoleFilter')}
              value={filter}
              onChange={(id) => {
                setFilter(id === 'physician' || id === 'nurse' || id === 'other' ? id : 'all');
              }}
              options={[
                { id: 'all', label: t('filterAll') },
                { id: 'physician', label: t('filterPhysicians') },
                { id: 'nurse', label: t('filterNurses') },
                { id: 'other', label: t('filterOther') },
              ]}
            />
          </Toolbar>
        </div>
        <DataTable
          caption={t('usersTitle')}
          columns={columns}
          rows={rows}
          rowKey={(member) => member.id}
          rowTone={(member) => (LOCKED_ACCOUNTS.has(member.id) ? 'warning' : undefined)}
          emptyText={t('usersEmpty')}
          dense
        />
      </Card>

      <Card title={t('matrixRolesTitle')} subtitle={t('matrixRolesSubtitle')} icon="shield" flush footer={t('matrixRolesNote')}>
        <DataTable caption={t('matrixRolesTitle')} columns={permissionColumns} rows={PERMISSIONS} rowKey={(permission) => permission.id} dense />
      </Card>
    </div>
  );
}

function GrantCell({ grant }: { readonly grant: Grant }): ReactNode {
  const t = useT(messages);
  if (grant === 'full') {
    return (
      <span className="admin-grant admin-grant--full">
        <Icon name="check" />
        <span>{t('grantFull')}</span>
      </span>
    );
  }
  if (grant === 'limited') {
    return (
      <span className="admin-grant admin-grant--limited">
        <Icon name="minus" />
        <span>{t('grantLimited')}</span>
      </span>
    );
  }
  return (
    <span className="admin-grant admin-grant--none">
      <Icon name="x" />
      <span>{t('grantNone')}</span>
    </span>
  );
}
