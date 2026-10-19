/**
 * Toasts: short confirmations after an action ("Order signed", "Payment recorded"). The frame mounts
 * ToastProvider once; screens call `useToast()`:
 *
 *   const toast = useToast();
 *   toast({ tone: 'success', title: t('signed') });
 *
 * Toasts appear at the bottom inline-end corner, are announced politely, and close after 6 seconds or on
 * Dismiss. Never put patient-critical information only in a toast.
 */
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { Tone } from '../data/types.ts';
import { useT } from '../i18n/use-t.ts';
import { Icon, type IconName } from './icons.tsx';
import { uiMessages } from './messages.ts';

export interface ToastInput {
  readonly tone?: Tone;
  readonly title: string;
  readonly body?: string;
}

interface ToastEntry extends ToastInput {
  readonly id: number;
}

type Notify = (toast: ToastInput) => void;

const ToastContext = createContext<Notify | null>(null);

const TONE_ICON: Readonly<Record<Tone, IconName>> = {
  neutral: 'info',
  info: 'info',
  accent: 'info',
  success: 'check-circle',
  warning: 'alert',
  danger: 'alert',
};

const LIFETIME_MS = 6000;

export function ToastProvider({ children }: { readonly children?: ReactNode }): ReactNode {
  const t = useT(uiMessages);
  const [toasts, setToasts] = useState<readonly ToastEntry[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<Notify>(
    (toast) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, LIFETIME_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return (
    <ToastContext value={notify}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite" aria-label={t('notifications')} data-live-announcer="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ui-toast--${toast.tone ?? 'info'}`}>
            <Icon name={TONE_ICON[toast.tone ?? 'info']} className="ui-toast__icon" />
            <div className="ui-toast__content">
              <p className="ui-toast__title">{toast.title}</p>
              {toast.body === undefined ? null : <p className="ui-toast__body">{toast.body}</p>}
            </div>
            <AriaButton
              className="ui-toast__close"
              aria-label={t('dismiss')}
              onPress={() => {
                dismiss(toast.id);
              }}
            >
              <Icon name="x" size="1em" />
            </AriaButton>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

/** Shows a toast. Throws outside the frame's ToastProvider. */
export function useToast(): Notify {
  const notify = use(ToastContext);
  if (notify === null) {
    throw new Error('useToast: render inside <ToastProvider> (the prototype frame provides it)');
  }
  return notify;
}
