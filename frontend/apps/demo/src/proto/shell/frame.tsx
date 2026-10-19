/**
 * The prototype frame: the root route's component.
 *
 * - Providers, once per window: LocaleProvider (`?locale=`, English by default; sets lang and dir on <html>),
 *   ModalStackProvider (one dialog at a time), DensityProvider (`?density=`), React Aria's router, the role,
 *   the toasts and the patient chooser.
 * - The ribbon "PROTOTYPE · SYNTHETIC DATA · NOT FOR CLINICAL USE" (always in English, with the Sorani or
 *   Arabic translation beside it), the top bar (hospital, demo clock, command palette, role switcher,
 *   language, density), the side navigation (mirrors in right-to-left locales) and the main region.
 * - The patient context's status line, the switch confirmation and the chooser dialog.
 */
import {
  Bdi,
  CommandPalette,
  DensityControl,
  DensityProvider,
  languageCommands,
  LocaleProvider,
  Message,
  ModalStackProvider,
  useDensity,
  useDensityCommand,
  type Density,
  type PaletteItem,
} from '@hms/design-system';
import { CATALOGUES, LOCALES, SOURCE_LOCALE, UI_LOCALES, type UiLocale } from '@hms/i18n';
import { Outlet, useRouter } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Button as AriaButton, Link, ListBox, ListBoxItem, Popover, RouterProvider as AriaRouterProvider, Select, Label, type Key } from 'react-aria-components';
import { useIntl } from 'react-intl';
import { useAppServices, usePatientContextMessage } from '../../app/services.tsx';
import { LanguagePicker } from '../../frame/language-picker.tsx';
import { SwitchConfirmation } from '../../patient/switch-confirmation.tsx';
import { useAppSearch, useUpdateSearch } from '../../routing/search.ts';
import { DEMO_NOW } from '../data/clock.ts';
import { HOSPITAL } from '../data/organisation.ts';
import { ROLE_LABEL } from '../data/labels.ts';
import { findPatient } from '../data/patients.ts';
import { formatDate, formatTime } from '../i18n/format.ts';
import { useT } from '../i18n/use-t.ts';
import { Avatar, Icon, ToastProvider, personName, staffName } from '../ui/index.ts';
import './shell.css';
import { shellMessages } from './messages.ts';
import { useCurrentScreen, useScreenHref } from './navigation.ts';
import { ChooserProvider, useCurrentPatientId, useOpenPatient, usePatientChooser } from './patient.tsx';
import { ChooserDialog } from './patient-picker.tsx';
import { ROLE_IDS, RoleProvider, useRole } from './role.tsx';
import { getStaffById } from './staff-lookup.ts';
import { DEMO_USERS } from '../data/organisation.ts';
import { NAV_GROUPS, SCREENS, SCREEN_IDS } from './screens.ts';

/** Sets the density from `?density=` when the address carries one. */
function DensityFromAddress({ density }: { readonly density: Density | undefined }): null {
  const { density: current, setDensity } = useDensity();
  useLayoutEffect(() => {
    if (density !== undefined && density !== current) {
      setDensity(density);
    }
    // Only a change of the address applies; a choice made in the density setting stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);
  return null;
}

/** The document title: the screen's name and the product. */
function DocumentTitle(): null {
  const intl = useIntl();
  const screen = useCurrentScreen();
  const name = intl.formatMessage({ id: screen?.navKey ?? 'proto.nav.home' });
  const title = `${name} · HMS Kurdistan`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

function Ribbon({ locale }: { readonly locale: UiLocale }): ReactNode {
  const t = useT(shellMessages);
  return (
    <div className="shell-ribbon" role="note" data-testid="prototype-ribbon">
      <Icon name="alert" size="1em" />
      <Bdi dir="ltr" lang={LOCALES.en.tag}>
        {shellMessages.en.ribbon}
      </Bdi>
      {locale === 'en' ? null : (
        <span lang={LOCALES[locale].tag} className="shell-ribbon__translation">
          {t('ribbon')}
        </span>
      )}
    </div>
  );
}

function Palette({ locale }: { readonly locale: UiLocale }): ReactNode {
  const { directory } = useAppServices();
  const router = useRouter();
  const updateSearch = useUpdateSearch();
  const href = useScreenHref();
  const openPatient = useOpenPatient();
  const screen = useCurrentScreen();
  const densityCommand = useDensityCommand();
  const items: PaletteItem[] = [
    ...SCREEN_IDS.map(
      (id): PaletteItem => ({
        kind: 'command',
        id: `nav.${id}`,
        group: 'navigation',
        label: SCREENS[id].navKey,
        run: () => {
          void router.navigate({ href: href(id) });
        },
      }),
    ),
    ...directory.list().map(
      (entry): PaletteItem => ({
        kind: 'patient',
        id: `patient.${entry.patientId}`,
        banner: entry.identity,
        open: () => {
          openPatient(entry.patientId, screen?.clinical === true ? screen.id : 'chart');
        },
      }),
    ),
    densityCommand,
    ...languageCommands(locale, UI_LOCALES, (next) => {
      updateSearch({ locale: next });
    }),
  ];
  return <CommandPalette items={items} />;
}

function RoleSwitcher(): ReactNode {
  const t = useT(shellMessages);
  const { roleId, user, setRole } = useRole();
  const locale = t.locale;
  return (
    <Select
      className="shell-role"
      selectedKey={roleId}
      onSelectionChange={(key: Key | null) => {
        const next = ROLE_IDS.find((id) => id === key);
        if (next !== undefined) {
          setRole(next);
        }
      }}
    >
      <Label className="hms-visually-hidden">{t('roleChange')}</Label>
      <AriaButton className="shell-role__button">
        <Avatar name={user.name} size="sm" />
        <span className="shell-role__text">
          <span className="shell-role__name">{staffName(user, locale)}</span>
          <span className="shell-role__role">{ROLE_LABEL[roleId][locale]}</span>
        </span>
        <Icon name="chevron-down" size="1em" />
      </AriaButton>
      <Popover className="ui-popover shell-role__popover" placement="bottom end">
        <ListBox className="ui-listbox" aria-label={t('roleChange')}>
          {ROLE_IDS.map((id) => {
            const member = getStaffById(DEMO_USERS[id]);
            return (
              <ListBoxItem key={id} id={id} className="ui-listbox__item shell-role__option" textValue={staffName(member, locale)}>
                <Avatar name={member.name} size="sm" />
                <span className="shell-role__text">
                  <span className="shell-role__name">{staffName(member, locale)}</span>
                  <span className="shell-role__role">
                    {ROLE_LABEL[id][locale]} · {member.title[locale]}
                  </span>
                </span>
              </ListBoxItem>
            );
          })}
        </ListBox>
      </Popover>
    </Select>
  );
}

function TopBar({ locale }: { readonly locale: UiLocale }): ReactNode {
  const t = useT(shellMessages);
  const updateSearch = useUpdateSearch();
  const href = useScreenHref();
  return (
    <header className="shell-topbar">
      <Link className="shell-brand" href={href('home')}>
        <span className="shell-brand__mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor" />
            <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5Z" fill="var(--hms-color-accent-text)" />
          </svg>
        </span>
        <span className="shell-brand__text">
          <span className="shell-brand__hospital">{HOSPITAL.name[locale]}</span>
          <span className="shell-brand__product">
            <Bdi dir="ltr">{t('product')}</Bdi>
          </span>
        </span>
      </Link>
      <div className="shell-topbar__clock" title={`${t('demoClock')}: ${formatDate(DEMO_NOW, locale, 'long')} ${formatTime(DEMO_NOW)} (${t('timeZone')})`}>
        <Icon name="clock" />
        <span>
          <span className="shell-topbar__date">{formatDate(DEMO_NOW, locale, 'medium')}</span>
          <span className="shell-topbar__time">
            <Bdi dir="ltr">{formatTime(DEMO_NOW)}</Bdi>
          </span>
        </span>
      </div>
      <div className="shell-topbar__tools">
        <span className="shell-topbar__palette">
          <Palette locale={locale} />
          <kbd className="shell-kbd" aria-hidden="true">
            {t('paletteHint')}
          </kbd>
        </span>
        <LanguagePicker
          locale={locale}
          onChange={(next) => {
            updateSearch({ locale: next });
          }}
        />
        <DensityControl />
        <RoleSwitcher />
      </div>
    </header>
  );
}

function CurrentPatientCard({ collapsed }: { readonly collapsed: boolean }): ReactNode {
  const t = useT(shellMessages);
  const patientId = useCurrentPatientId();
  const patient = findPatient(patientId);
  const { openChooser } = usePatientChooser();
  const locale = t.locale;
  if (collapsed) {
    return null;
  }
  return (
    <div className="shell-nav__patient">
      <span className="shell-nav__patient-label">{t('currentPatient')}</span>
      {patient === undefined ? (
        <span className="shell-nav__patient-none">{t('noPatient')}</span>
      ) : (
        <span className="shell-nav__patient-name">
          <Bdi dir={locale === 'en' ? 'ltr' : 'rtl'}>{personName(patient.name, locale)}</Bdi>
          <span className="shell-nav__patient-mrn">
            MRN <Bdi dir="ltr">{patient.mrn}</Bdi>
          </span>
        </span>
      )}
      <AriaButton
        className="ui-button ui-button--secondary ui-button--sm shell-nav__patient-button"
        onPress={() => {
          openChooser();
        }}
      >
        <Icon name="users" />
        <span>{patient === undefined ? t('choosePatient') : t('changePatient')}</span>
      </AriaButton>
    </div>
  );
}

const GROUP_LABEL = { hospital: 'navGroupHospital', record: 'navGroupRecord', system: 'navGroupSystem' } as const;

function SideNav(): ReactNode {
  const t = useT(shellMessages);
  const href = useScreenHref();
  const screen = useCurrentScreen();
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1180);
  return (
    <nav className={collapsed ? 'shell-nav shell-nav--collapsed' : 'shell-nav'} aria-label={t('navLabel')}>
      <div className="shell-nav__scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="shell-nav__group">
            <p className={collapsed ? 'hms-visually-hidden' : 'shell-nav__group-label'}>{t(GROUP_LABEL[group.id])}</p>
            {group.id === 'record' ? <CurrentPatientCard collapsed={collapsed} /> : null}
            <ul className="shell-nav__list">
              {group.screens.map((id) => {
                const info = SCREENS[id];
                const active = screen?.id === id;
                return (
                  <li key={id}>
                    <Link
                      className="shell-nav__link"
                      href={href(id)}
                      {...(active ? { 'aria-current': 'page' as const } : {})}
                    >
                      <Icon name={info.icon} className="shell-nav__icon" />
                      <span className={collapsed ? 'hms-visually-hidden' : 'shell-nav__text'}>
                        <Message id={info.navKey} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <AriaButton
        className="shell-nav__toggle"
        aria-label={collapsed ? t('navExpand') : t('navCollapse')}
        aria-expanded={!collapsed}
        onPress={() => {
          setCollapsed((value) => !value);
        }}
      >
        <Icon name={collapsed ? 'chevron-forward' : 'chevron-back'} />
        <span className={collapsed ? 'hms-visually-hidden' : ''}>{collapsed ? t('navExpand') : t('navCollapse')}</span>
      </AriaButton>
    </nav>
  );
}

/** The patient context's own messages (the sign dialog shows its messages itself). */
function PatientContextStatus(): ReactNode {
  const message = usePatientContextMessage();
  const shown = message?.key.startsWith('patientContext.') === true ? message : null;
  return (
    <div
      role="status"
      data-live-announcer="true"
      className={shown === null ? 'hms-visually-hidden' : 'shell-context-status'}
      data-testid="patient-context-status"
    >
      {shown === null ? null : (
        <span key={shown.seq}>
          <Message id={shown.key} />
        </span>
      )}
    </div>
  );
}

export function ProtoFrame(): ReactNode {
  const { store } = useAppServices();
  const router = useRouter();
  const { locale = SOURCE_LOCALE, density } = useAppSearch();
  return (
    <LocaleProvider locale={locale}>
      <ModalStackProvider>
        <DensityProvider {...(store.sessionUser === null ? {} : { userKey: store.sessionUser })}>
          <AriaRouterProvider
            navigate={(path) => {
              void router.navigate({ href: path });
            }}
          >
            <RoleProvider>
              <ToastProvider>
                <ChooserProvider>
                  <DensityFromAddress density={density} />
                  <DocumentTitle />
                  <div className="shell">
                    <a
                      className="shell-skip-link"
                      href="#main"
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById('main')?.focus();
                      }}
                    >
                      {CATALOGUES[locale]['app.skipToContent']}
                    </a>
                    <Ribbon locale={locale} />
                    <TopBar locale={locale} />
                    <div className="shell-body">
                      <SideNav />
                      <main id="main" className="shell-main" tabIndex={-1}>
                        <Outlet />
                      </main>
                    </div>
                    <PatientContextStatus />
                    <SwitchConfirmation />
                    <ChooserDialog />
                  </div>
                </ChooserProvider>
              </ToastProvider>
            </RoleProvider>
          </AriaRouterProvider>
        </DensityProvider>
      </ModalStackProvider>
    </LocaleProvider>
  );
}
