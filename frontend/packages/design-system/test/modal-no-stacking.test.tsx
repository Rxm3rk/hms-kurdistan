/**
 * UnitTest:modal-no-stacking (docs/specs/modules/design-system.md §2.8, §9; BUILD-PROMPT.md §6.5 "No stacked
 * modals", §14.2): a second modal is refused while one is open.
 *
 * In development and tests the refusal throws ModalStackError; in production the second modal does not open,
 * `onOpenChange(false)` and `onRefused` are called, and a polite live region says `modal.blocked`, both to
 * assistive technology (the open modal hides the rest of the page, but not this region) and on screen. A
 * refused modal is not queued, and a HAL capture waiting for a device holds the guard as a modal does. The
 * guard cannot be split or released by anyone but its holder: one guard per window, a release only with the
 * holder's own token, and a modal shows only while it holds the guard itself.
 */
import { CATALOGUES } from '@hms/i18n';
import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as designSystem from '../src/index.ts';
import {
  LocaleProvider,
  Modal,
  ModalStackError,
  ModalStackProvider,
  type ModalStackGuard,
} from '../src/index.ts';
import { createModalStackGuard, ModalStackTestProvider } from '../src/testing.tsx';

const en = CATALOGUES.en;
const FIRST = en['language.en.endonym'];
const SECOND = en['language.ckb.endonym'];
const BLOCKED = en['modal.blocked'];

const owner = (label: string): { readonly label: string } => ({ label });

class Boundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

interface HarnessProps {
  readonly guard: ModalStackGuard;
  readonly openFirst: boolean;
  readonly openSecond: boolean;
  readonly nested?: boolean;
  readonly onFirstChange?: (open: boolean) => void;
  readonly onSecondChange?: (open: boolean) => void;
  readonly onSecondRefused?: () => void;
}

function Harness({
  guard,
  openFirst,
  openSecond,
  nested = false,
  onFirstChange = () => undefined,
  onSecondChange = () => undefined,
  onSecondRefused = () => undefined,
}: HarnessProps): ReactNode {
  const second = (
    <Modal isOpen={openSecond} onOpenChange={onSecondChange} onRefused={onSecondRefused} aria-label={SECOND}>
      <p>{SECOND}</p>
    </Modal>
  );
  return (
    <LocaleProvider locale="en">
      <ModalStackTestProvider guard={guard}>
        <Modal isOpen={openFirst} onOpenChange={onFirstChange} aria-label={FIRST}>
          <p>{FIRST}</p>
          {nested ? second : null}
        </Modal>
        {nested ? null : second}
      </ModalStackTestProvider>
    </LocaleProvider>
  );
}

const dialogs = (): HTMLElement[] => screen.queryAllByRole('dialog');

/** The nearest element, from `element` up, that hides it from assistive technology, if any. */
function hidingAncestor(element: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = element; node !== null; node = node.parentElement) {
    if (node.getAttribute('aria-hidden') === 'true' || node.inert || node.hidden) {
      return node;
    }
  }
  return null;
}

/** Fails a test that expects an error to be thrown in render, without React's console noise. */
function renderExpectingError(ui: ReactNode): unknown[] {
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<Boundary onError={(error) => errors.push(error)}>{ui}</Boundary>);
  } finally {
    consoleError.mockRestore();
  }
  return errors;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('modal-no-stacking', () => {
  describe('the stack guard', () => {
    it('refuses a second holder by throwing in development and test builds', () => {
      const guard = createModalStackGuard();
      expect(guard.refusalMode).toBe('throw');
      const a = owner('a');
      expect(guard.acquire('modal', a)).not.toBeNull();
      expect(() => guard.acquire('modal', owner('b'))).toThrow(ModalStackError);
      expect(guard.getSnapshot().holder).toEqual({ kind: 'modal', owner: a });
    });

    it('refuses a second holder without throwing in production mode, and counts the refusal', () => {
      const guard = createModalStackGuard('announce');
      const a = owner('a');
      guard.acquire('modal', a);
      expect(guard.acquire('modal', owner('b'))).toBeNull();
      expect(guard.getSnapshot()).toEqual({ holder: { kind: 'modal', owner: a }, refusedWhileHeld: 1 });
    });

    it('treats a HAL capture waiting for a device as a modal, both ways', () => {
      const guard = createModalStackGuard('announce');
      const capture = guard.acquire('hal-capture', owner('camera'));
      expect(guard.isHeld()).toBe(true);
      expect(guard.acquire('modal', owner('sign'))).toBeNull();
      if (capture === null) {
        throw new Error('capture not granted');
      }
      guard.release(capture);
      expect(guard.acquire('modal', owner('sign'))).not.toBeNull();
      expect(guard.acquire('hal-capture', owner('camera'))).toBeNull();
    });

    it('ignores a stale release, so an old hold never frees a newer one', () => {
      const guard = createModalStackGuard('announce');
      const first = guard.acquire('modal', owner('a'));
      if (first === null) {
        throw new Error('not granted');
      }
      guard.release(first);
      const b = owner('b');
      guard.acquire('modal', b);
      guard.release(first);
      expect(guard.getSnapshot().holder?.owner).toBe(b);
      expect(guard.acquire('modal', owner('c'))).toBeNull();
    });

    it('can be released only with the holder token, never with what the snapshot shows', () => {
      const guard = createModalStackGuard('announce');
      const capture = owner('document-scan');
      guard.acquire('hal-capture', capture);
      const { holder } = guard.getSnapshot();
      expect(holder).not.toBeNull();
      expect(Object.keys(holder ?? {}).sort()).toEqual(['kind', 'owner']);
      // A caller that only sees the snapshot tries to free the guard for itself.
      guard.release(holder as never);
      guard.release({} as never);
      expect(guard.isHeld()).toBe(true);
      expect(guard.getSnapshot().holder?.owner).toBe(capture);
      expect(guard.acquire('modal', owner('intruder'))).toBeNull();
    });
  });

  describe('one guard per window', () => {
    it('exports no way to create a second guard from the package entry point', () => {
      expect('createModalStackGuard' in designSystem).toBe(false);
      expect(designSystem.windowModalStackGuard()).toBe(designSystem.windowModalStackGuard());
    });

    it('throws for a provider of another guard nested inside a provider', () => {
      const errors = renderExpectingError(
        <LocaleProvider locale="en">
          <ModalStackProvider>
            <ModalStackTestProvider guard={createModalStackGuard('announce')}>
              <p>{FIRST}</p>
            </ModalStackTestProvider>
          </ModalStackProvider>
        </LocaleProvider>,
      );
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(/second modal stack guard/);
    });

    it('adds no second live region for a provider of the same guard nested inside it', () => {
      render(
        <LocaleProvider locale="en">
          <ModalStackProvider>
            <ModalStackProvider>
              <p>{FIRST}</p>
            </ModalStackProvider>
          </ModalStackProvider>
        </LocaleProvider>,
      );
      expect(screen.getAllByTestId('hms-modal-stack-status')).toHaveLength(1);
    });

    it('refuses the test entry point in production builds', () => {
      vi.stubEnv('PROD', true);
      expect(() => createModalStackGuard('announce')).toThrow(/tests only/);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        expect(() =>
          render(
            <ModalStackTestProvider guard={designSystem.windowModalStackGuard()}>
              <p>{FIRST}</p>
            </ModalStackTestProvider>,
          ),
        ).toThrow(/tests only/);
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('Modal', () => {
    it('opens one modal and holds the guard while it is open', () => {
      const guard = createModalStackGuard('announce');
      const view = render(<Harness guard={guard} openFirst openSecond={false} />);
      expect(dialogs()).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: FIRST })).toBeInTheDocument();
      expect(guard.isHeld()).toBe(true);
      view.rerender(<Harness guard={guard} openFirst={false} openSecond={false} />);
      expect(dialogs()).toHaveLength(0);
      expect(guard.isHeld()).toBe(false);
    });

    it('throws ModalStackError in development and tests when a second modal opens over the first', () => {
      const errors: unknown[] = [];
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const guard = createModalStackGuard();
        const view = render(
          <Boundary onError={(error) => errors.push(error)}>
            <Harness guard={guard} openFirst openSecond={false} />
          </Boundary>,
        );
        expect(dialogs()).toHaveLength(1);
        view.rerender(
          <Boundary onError={(error) => errors.push(error)}>
            <Harness guard={guard} openFirst openSecond />
          </Boundary>,
        );
      } finally {
        consoleError.mockRestore();
      }
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(ModalStackError);
    });

    it('throws for a modal opened inside an open modal (a confirmation inside a confirmation)', () => {
      const errors = renderExpectingError(
        <Harness guard={createModalStackGuard()} openFirst openSecond nested />,
      );
      expect(errors[0]).toBeInstanceOf(ModalStackError);
    });

    it('in production, refuses the second modal, keeps the first, and announces modal.blocked politely', () => {
      const guard = createModalStackGuard('announce');
      const onSecondChange = vi.fn();
      const onSecondRefused = vi.fn();
      const view = render(<Harness guard={guard} openFirst openSecond={false} />);
      const status = screen.getByTestId('hms-modal-stack-status');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toBeEmptyDOMElement();

      view.rerender(
        <Harness
          guard={guard}
          openFirst
          openSecond
          onSecondChange={onSecondChange}
          onSecondRefused={onSecondRefused}
        />,
      );
      expect(dialogs()).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: FIRST })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: SECOND })).not.toBeInTheDocument();
      expect(onSecondRefused).toHaveBeenCalledTimes(1);
      expect(onSecondChange).toHaveBeenCalledWith(false);
      // Reachable by assistive technology while the first modal hides the rest of the page.
      const announced = screen.getByRole('status');
      expect(announced).toBe(status);
      expect(announced).toHaveTextContent(BLOCKED);
      expect(hidingAncestor(announced)).toBeNull();
      // The modal did hide the rest of the page, so the check above is not empty.
      expect(screen.queryByText(SECOND)).not.toBeInTheDocument();
      expect(document.querySelector('[aria-hidden="true"], [inert]')).not.toBeNull();
    });

    it('in production, shows the refusal on screen, not to assistive technology only', () => {
      const guard = createModalStackGuard('announce');
      const view = render(<Harness guard={guard} openFirst openSecond={false} />);
      const status = screen.getByTestId('hms-modal-stack-status');
      expect(status).toHaveClass('hms-visually-hidden');
      view.rerender(<Harness guard={guard} openFirst openSecond />);
      expect(status).toHaveTextContent(BLOCKED);
      expect(status).toHaveClass('hms-modal-stack-status');
      expect(status).not.toHaveClass('hms-visually-hidden');
      view.rerender(<Harness guard={guard} openFirst={false} openSecond />);
      expect(status).toBeEmptyDOMElement();
      expect(status).toHaveClass('hms-visually-hidden');
    });

    it('in production, refuses two modals that open in the same render: only the first opens', () => {
      const guard = createModalStackGuard('announce');
      const onSecondRefused = vi.fn();
      render(<Harness guard={guard} openFirst openSecond onSecondRefused={onSecondRefused} />);
      expect(dialogs()).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: FIRST })).toBeInTheDocument();
      expect(onSecondRefused).toHaveBeenCalledTimes(1);
    });

    it('in production, refuses a modal nested in an open modal', () => {
      const guard = createModalStackGuard('announce');
      render(<Harness guard={guard} openFirst openSecond nested />);
      expect(dialogs()).toHaveLength(1);
      expect(screen.queryByRole('dialog', { name: SECOND })).not.toBeInTheDocument();
    });

    it('in production, shows one modal across two React roots of one window', () => {
      const guard = createModalStackGuard('announce');
      const onRefused = vi.fn();
      const root = (): ReactNode => (
        <LocaleProvider locale="en">
          <ModalStackTestProvider guard={guard}>
            <Modal isOpen onOpenChange={() => undefined} onRefused={onRefused} aria-label={FIRST}>
              <p>{FIRST}</p>
            </Modal>
          </ModalStackTestProvider>
        </LocaleProvider>
      );
      render(root());
      render(root());
      expect(dialogs()).toHaveLength(1);
      expect(onRefused).toHaveBeenCalledTimes(1);
    });

    it('in production, never shows a modal because another holder carries the same label', () => {
      const guard = createModalStackGuard('announce');
      const onRefused = vi.fn();
      const view = render(<Harness guard={guard} openFirst openSecond={false} />);
      const label = guard.getSnapshot().holder?.owner.label ?? '';
      expect(label).not.toBe('');
      view.rerender(<Harness guard={guard} openFirst={false} openSecond={false} />);
      // Another holder (a second React root whose useId values collide, or any other code) uses that label.
      guard.acquire('modal', owner(label));
      view.rerender(<Harness guard={guard} openFirst openSecond={false} onFirstChange={onRefused} />);
      expect(dialogs()).toHaveLength(0);
      expect(onRefused).toHaveBeenCalledWith(false);
    });

    it('does not queue a refused modal: it stays closed after the first closes, until it is asked again', () => {
      const guard = createModalStackGuard('announce');
      const view = render(<Harness guard={guard} openFirst openSecond={false} />);
      view.rerender(<Harness guard={guard} openFirst openSecond />);
      view.rerender(<Harness guard={guard} openFirst={false} openSecond />);
      expect(dialogs()).toHaveLength(0);
      expect(guard.isHeld()).toBe(false);
      expect(screen.getByTestId('hms-modal-stack-status')).toBeEmptyDOMElement();

      view.rerender(<Harness guard={guard} openFirst={false} openSecond={false} />);
      view.rerender(<Harness guard={guard} openFirst={false} openSecond />);
      expect(screen.getByRole('dialog', { name: SECOND })).toBeInTheDocument();
    });

    it('refuses a modal while a HAL capture holds the guard', () => {
      const guard = createModalStackGuard('announce');
      const capture = owner('document-scan');
      guard.acquire('hal-capture', capture);
      const onFirstChange = vi.fn();
      render(<Harness guard={guard} openFirst openSecond={false} onFirstChange={onFirstChange} />);
      expect(dialogs()).toHaveLength(0);
      expect(onFirstChange).toHaveBeenCalledWith(false);
      expect(guard.getSnapshot().holder?.owner).toBe(capture);
      expect(screen.getByRole('status')).toHaveTextContent(BLOCKED);
    });

    it('fails at once when rendered without a ModalStackProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        expect(() =>
          render(
            <LocaleProvider locale="en">
              <Modal isOpen onOpenChange={() => undefined} aria-label={FIRST}>
                <p>{FIRST}</p>
              </Modal>
            </LocaleProvider>,
          ),
        ).toThrow(/ModalStackProvider/);
      } finally {
        consoleError.mockRestore();
      }
    });
  });
});
