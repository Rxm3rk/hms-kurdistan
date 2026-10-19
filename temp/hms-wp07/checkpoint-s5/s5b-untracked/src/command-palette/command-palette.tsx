/**
 * `CommandPalette`: the keyboard-first command palette (BUILD-PROMPT.md §6.5, §14.2;
 * docs/specs/modules/design-system.md §2.4).
 *
 * - **Opening.** Ctrl+K (Cmd+K on macOS; the physical K key, so it works on Sorani and Arabic keyboard
 *   layouts) and a visible button named `commandPalette.open.label`. It is a `Modal`, so the window's stack
 *   guard applies: while another dialog is open the shortcut does nothing (the other dialog hides the
 *   button).
 * - **Keyboard-only operation.** Focus starts in the search field; typing filters, the arrow keys move the
 *   highlight, Enter runs the highlighted item and Escape closes. Every item is reachable without a pointer.
 *   Built on React Aria's Autocomplete, TextField and Menu (§6.5: every interactive primitive is a React
 *   Aria Component).
 * - **Never preselects** (§6.5 "defaults never select a patient"): nothing is highlighted when the palette
 *   opens or when its results change, even when one result is left, and Enter with nothing highlighted does
 *   nothing. React Aria's "focus the first item while typing" is turned off, and a change of the result list
 *   remounts the list and clears the highlight, so a highlight never survives onto other results.
 * - **The palette closes first.** Choosing an item closes the palette; the item runs only once the palette's
 *   content has unmounted, with no modal open. A patient result then requests the patient, and the switch
 *   confirmation of §2.2 opens after the palette has gone, never over it.
 * - Patient results show the banner's PatientIdentity: every name form, the MRN and the date of birth,
 *   wrapped and never truncated (§2.1 rule 3).
 */
import { textDirection } from '@hms/i18n';
import {
  use,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Autocomplete,
  AutocompleteStateContext,
  Button,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  TextField,
} from 'react-aria-components';
import { useIntl, type IntlShape } from 'react-intl';
import { PatientIdentity } from '../banner/index.ts';
import { Bdi } from '../bdi/bdi.tsx';
import { Message } from '../message/message.tsx';
import { messageKey } from '../message-key.ts';
import { useModalStackGuard } from '../modal/modal-stack-provider.tsx';
import { Modal } from '../modal/modal.tsx';
import {
  matchesQuery,
  PALETTE_GROUP_LABEL,
  PALETTE_GROUPS,
  paletteItemGroup,
  patientSearchText,
  type PaletteCommand,
  type PaletteItem,
} from './commands.ts';

export interface CommandPaletteProps {
  /** The commands and patient results; ids must be unique. */
  readonly items: readonly PaletteItem[];
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad/i.test(platform);
}

/** Ctrl+K, or Cmd+K on Apple platforms, on the physical K key. */
export function isPaletteShortcut(event: KeyboardEvent, apple = isApplePlatform()): boolean {
  const modifier = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return modifier && !event.altKey && !event.shiftKey && event.code === 'KeyK';
}

export function CommandPalette({ items }: CommandPaletteProps): ReactNode {
  const intl = useIntl();
  const guard = useModalStackGuard();
  const [isOpen, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isPaletteShortcut(event)) {
      return;
    }
    event.preventDefault();
    if (isOpen || guard.isHeld()) {
      return; // already open, or another dialog holds the window's single modal slot
    }
    setOpen(true);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => {
      onKeyDown(event);
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);

  const choose = (item: PaletteItem): void => {
    pending.current = item.kind === 'patient' ? item.open : item.run;
    setOpen(false);
  };

  const runPending = (): void => {
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  return (
    <>
      <Button
        className="hms-palette-trigger"
        aria-label={intl.formatMessage({ id: messageKey('commandPalette.open.label') })}
        onPress={() => {
          setOpen(true);
        }}
      >
        <SearchIcon />
      </Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={setOpen}
        isDismissable
        aria-label={intl.formatMessage({ id: messageKey('commandPalette.dialog.label') })}
      >
        <PaletteBody items={items} onChoose={choose} onUnmounted={runPending} />
      </Modal>
    </>
  );
}

function SearchIcon(): ReactNode {
  return (
    <svg className="hms-palette-trigger__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="15" y1="15" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface PaletteBodyProps {
  readonly items: readonly PaletteItem[];
  readonly onChoose: (item: PaletteItem) => void;
  /** Called when the palette's content unmounts: the palette has closed and released the modal slot. */
  readonly onUnmounted: () => void;
}

interface Entry {
  readonly item: PaletteItem;
  readonly text: string;
}

function commandText(intl: IntlShape, command: PaletteCommand): string {
  const label = intl.formatMessage({ id: command.label });
  return command.detail === undefined ? label : `${label} ${intl.formatMessage({ id: command.detail.key })}`;
}

function PaletteBody({ items, onChoose, onUnmounted }: PaletteBodyProps): ReactNode {
  const intl = useIntl();
  const hintId = useId();
  const [query, setQuery] = useState('');

  const unmounted = useEffectEvent(onUnmounted);
  useEffect(
    () => () => {
      unmounted();
    },
    [],
  );

  const entries: Entry[] = items.map((item) => ({
    item,
    text: item.kind === 'patient' ? patientSearchText(item.banner) : commandText(intl, item),
  }));
  const visible = entries.filter((entry) => matchesQuery(entry.text, query));
  const sections = PALETTE_GROUPS.map((group) => ({
    group,
    entries: visible.filter((entry) => paletteItemGroup(entry.item) === group),
  })).filter((section) => section.entries.length > 0);
  // A new result list is a new list: remounting it drops any highlight (never carried to other results).
  const signature = visible.map((entry) => entry.item.id).join('\n');

  return (
    <div className="hms-palette">
      <Autocomplete inputValue={query} onInputChange={setQuery} disableAutoFocusFirst>
        <TextField
          className="hms-palette__search"
          aria-label={intl.formatMessage({ id: messageKey('commandPalette.search.label') })}
          aria-describedby={hintId}
          autoFocus
        >
          <Input
            className="hms-palette__input"
            placeholder={intl.formatMessage({ id: messageKey('commandPalette.search.placeholder') })}
          />
        </TextField>
        <p id={hintId} className="hms-palette__hint">
          <Message id="commandPalette.hint" />
        </p>
        <ClearHighlight signature={signature} />
        <Menu
          key={signature}
          className="hms-palette__results"
          aria-label={intl.formatMessage({ id: messageKey('commandPalette.dialog.label') })}
          onAction={(key) => {
            const entry = visible.find((candidate) => candidate.item.id === key);
            if (entry !== undefined) {
              onChoose(entry.item);
            }
          }}
          renderEmptyState={() => (
            <p className="hms-palette__empty">
              <Message id="commandPalette.noResults" />
            </p>
          )}
        >
          {sections.map((section) => (
            <MenuSection key={section.group} id={section.group} className="hms-palette__section">
              <Header className="hms-palette__group">
                <Message id={PALETTE_GROUP_LABEL[section.group]} />
              </Header>
              {section.entries.map(({ item, text }) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  textValue={text}
                  className="hms-palette__item"
                  data-kind={item.kind}
                >
                  {item.kind === 'patient' ? (
                    <PatientIdentity model={item.banner} />
                  ) : (
                    <CommandLabel command={item} />
                  )}
                </MenuItem>
              ))}
            </MenuSection>
          ))}
        </Menu>
      </Autocomplete>
      <p role="status" className="hms-palette__count">
        <Message id="commandPalette.resultCount" values={{ count: visible.length }} />
      </p>
    </div>
  );
}

function CommandLabel({ command }: { readonly command: PaletteCommand }): ReactNode {
  return (
    <span className="hms-palette__command">
      <span className="hms-palette__label">
        <Message id={command.label} />
      </span>
      {command.detail === undefined ? null : (
        <span className="hms-palette__detail">
          {command.detail.lang === undefined ? (
            <Message id={command.detail.key} />
          ) : (
            <Bdi dir={textDirection(command.detail.lang)} lang={command.detail.lang}>
              <Message id={command.detail.key} />
            </Bdi>
          )}
        </span>
      )}
    </span>
  );
}

/** Clears the search field's active descendant whenever the result list changes. */
function ClearHighlight({ signature }: { readonly signature: string }): ReactNode {
  const state = use(AutocompleteStateContext);
  const clear = useEffectEvent(() => {
    state?.setFocusedNodeId(null);
  });
  useEffect(() => {
    clear();
  }, [signature]);
  return null;
}
