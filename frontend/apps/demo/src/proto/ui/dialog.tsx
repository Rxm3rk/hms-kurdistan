/**
 * Dialog: the design system's Modal (the window's single modal slot; no stacked dialogs) with a title, a body
 * and an action row. Escape closes it; a press outside does not (clinical dialogs close on purpose).
 *
 *   const [open, setOpen] = useState(false);
 *   <Dialog isOpen={open} onOpenChange={setOpen} title={t('newOrder')} actions={<>…buttons…</>}>…</Dialog>
 *
 * Only one dialog can be open in the window at a time (the patient switch confirmation and the sign dialog
 * use the same slot). In development a second dialog throws; close yours before navigating to a patient.
 */
import { Modal } from '@hms/design-system';
import type { ReactNode } from 'react';
import { Heading } from 'react-aria-components';

export interface DialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly title: ReactNode;
  /** A line under the title. */
  readonly subtitle?: ReactNode;
  /** The action buttons, at the end of the dialog (the safe choice first). */
  readonly actions?: ReactNode;
  readonly size?: 'md' | 'lg';
  readonly role?: 'dialog' | 'alertdialog';
  readonly children?: ReactNode;
}

export function Dialog({ isOpen, onOpenChange, title, subtitle, actions, size = 'md', role = 'dialog', children }: DialogProps): ReactNode {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} role={role}>
      <div className={`ui-dialog ui-dialog--${size}`}>
        <Heading slot="title" level={2} className="ui-dialog__title">
          {title}
        </Heading>
        {subtitle === undefined ? null : <p className="ui-dialog__subtitle">{subtitle}</p>}
        <div className="ui-dialog__body">{children}</div>
        {actions === undefined ? null : <div className="ui-dialog__actions">{actions}</div>}
      </div>
    </Modal>
  );
}
