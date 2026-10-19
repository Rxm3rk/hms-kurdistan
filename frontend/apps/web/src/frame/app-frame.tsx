/**
 * The workspace frame: the root route's component (BUILD-PROMPT.md §6.5, §14.1, §14.2, §14.4;
 * docs/specs/modules/design-system.md §2.4, §2.5, §2.9, §4, §5).
 *
 * - **Providers, once per window**: `LocaleProvider` with the locale of `?locale=` (English by default; a
 *   change re-renders in place and keeps the patient context), the window's `ModalStackProvider`,
 *   `DensityProvider` (stored per session user on the device; `?density=` sets it), and React Aria's router,
 *   so that React Aria links navigate inside the app.
 * - **The frame**: a skip link to the main content; a header with the app's name, the main navigation, the
 *   command palette, the language choice and the density setting; the main region with the route; the
 *   status region for the patient context's messages; the switch confirmation; and, in demo builds, the
 *   "NOT FOR CLINICAL USE" watermark.
 * - **The window's user**: when the window gains focus, a patient context opened under another user than the
 *   session's is cleared (`UserChanged`; DN-028, fail closed). The badge flow that changes users, and the
 *   message to other tabs, come with WP-0.4 (KA-044).
 */
import {
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
import { SOURCE_LOCALE, UI_LOCALES, type MessageKey, type UiLocale } from '@hms/i18n';
import { contextUserMismatch } from '@hms/ui-core';
import { Outlet, useMatches, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useLayoutEffect, type ReactNode } from 'react';
import { Link, RouterProvider as AriaRouterProvider } from 'react-aria-components';
import { useIntl } from 'react-intl';
import { useAppServices, usePatientContextMessage } from '../app/services.tsx';
import { stringifySearch, useAppSearch, useUpdateSearch } from '../routing/search.ts';
import { SwitchConfirmation } from '../patient/switch-confirmation.tsx';
import { DemoWatermark } from './demo-watermark.tsx';
import { LanguagePicker } from './language-picker.tsx';

/** A link of the main navigation and the palette's "Go to" group. */
interface NavigationItem {
  readonly id: string;
  readonly path: string;
  readonly label: MessageKey;
}

function useNavigationItems(): readonly NavigationItem[] {
  const { demo } = useAppServices();
  return [
    { id: 'nav.home', path: '/', label: 'app.name' },
    ...(demo?.pages.map((page) => ({ id: `nav.${page.path}`, path: page.path, label: page.label })) ?? []),
  ];
}

/** A path with the app-wide parameters (locale, density) of the current address kept. */
function useHrefWithAppSearch(): (path: string, extra?: Record<string, string>) => string {
  const { locale, density } = useAppSearch();
  return (path, extra = {}) => `${path}${stringifySearch({ locale, density, ...extra })}`;
}

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

/** The document title: the deepest matched route's title key, or the app's name. */
function DocumentTitle(): null {
  const intl = useIntl();
  const matches = useMatches();
  let titleKey: MessageKey = 'app.name';
  for (const match of matches) {
    const key = match.staticData.titleKey;
    if (key !== undefined) {
      titleKey = key;
    }
  }
  const title = intl.formatMessage({ id: titleKey });
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

/** The patient context's own messages (the sign dialog shows its messages itself). */
function PatientContextStatus(): ReactNode {
  const message = usePatientContextMessage();
  const shown = message !== null && message.key.startsWith('patientContext.') ? message : null;
  return (
    <div
      role="status"
      data-live-announcer="true"
      className={shown === null ? 'hms-visually-hidden' : 'hms-context-status'}
      data-testid="patient-context-status"
      data-message={shown?.key}
    >
      {shown === null ? null : (
        <span key={shown.seq}>
          <Message id={shown.key} />
        </span>
      )}
    </div>
  );
}

/** Clears the window's patient context when it was opened under another user (checked on focus). */
function UserGuard(): null {
  const { store } = useAppServices();
  const check = useEffectEvent(() => {
    if (contextUserMismatch(store.getSnapshot(), store.sessionUser)) {
      store.send({ type: 'UserChanged', userId: store.sessionUser });
    }
  });
  useEffect(() => {
    const listener = (): void => {
      check();
    };
    window.addEventListener('focus', listener);
    return () => {
      window.removeEventListener('focus', listener);
    };
  }, []);
  return null;
}

function Palette({ locale }: { readonly locale: UiLocale }): ReactNode {
  const { directory, demo } = useAppServices();
  const router = useRouter();
  const updateSearch = useUpdateSearch();
  const href = useHrefWithAppSearch();
  const navigation = useNavigationItems();
  const densityCommand = useDensityCommand();
  const items: PaletteItem[] = [
    ...navigation.map(
      (item): PaletteItem => ({
        kind: 'command',
        id: item.id,
        group: 'navigation',
        label: item.label,
        run: () => {
          void router.navigate({ href: href(item.path) });
        },
      }),
    ),
    ...(demo === null
      ? []
      : directory.list().map(
          (entry): PaletteItem => ({
            kind: 'patient',
            id: `patient.${entry.patientId}`,
            banner: entry.identity,
            open: () => {
              // A request through the address; the clinical layout passes it to the patient context.
              void router.navigate({ href: href(demo.patientPath, { patient: entry.patientId }) });
            },
          }),
        )),
    densityCommand,
    ...languageCommands(locale, UI_LOCALES, (next) => {
      updateSearch({ locale: next });
    }),
  ];
  return <CommandPalette items={items} />;
}

function Header({ locale }: { readonly locale: UiLocale }): ReactNode {
  const intl = useIntl();
  const updateSearch = useUpdateSearch();
  const href = useHrefWithAppSearch();
  const navigation = useNavigationItems();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <header className="hms-frame__header">
      <nav className="hms-frame__nav" aria-label={intl.formatMessage({ id: 'app.mainNav.label' })}>
        <ul className="hms-frame__nav-list">
          {navigation.map((item) => (
            <li key={item.id}>
              <Link
                className="hms-frame__nav-link"
                href={href(item.path)}
                {...(pathname === item.path ? { 'aria-current': 'page' as const } : {})}
              >
                <Message id={item.label} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hms-frame__tools">
        <Palette locale={locale} />
        <LanguagePicker
          locale={locale}
          onChange={(next) => {
            updateSearch({ locale: next });
          }}
        />
        <DensityControl />
      </div>
    </header>
  );
}

export function AppFrame(): ReactNode {
  const { store, demo } = useAppServices();
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
            <DensityFromAddress density={density} />
            <DocumentTitle />
            <UserGuard />
            <div className={demo === null ? 'hms-frame' : 'hms-frame hms-frame--demo'}>
              <a
                className="hms-skip-link"
                href="#main"
                onClick={(event) => {
                  // Focus the main region without a navigation, so the router sees no change of address.
                  event.preventDefault();
                  document.getElementById('main')?.focus();
                }}
              >
                <Message id="app.skipToContent" />
              </a>
              <Header locale={locale} />
              <main id="main" className="hms-frame__main" tabIndex={-1}>
                <Outlet />
              </main>
              <PatientContextStatus />
              <SwitchConfirmation />
              {demo === null ? null : <DemoWatermark locale={locale} />}
            </div>
          </AriaRouterProvider>
        </DensityProvider>
      </ModalStackProvider>
    </LocaleProvider>
  );
}
