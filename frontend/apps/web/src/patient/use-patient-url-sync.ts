/**
 * The address and the window's patient context (docs/specs/modules/design-system.md §2.2 "The context decides
 * whose data is shown", §4; CTRL-0016-6).
 *
 * A patient id in the address (`?patient=<id>`) is a request, never a selection:
 *
 * 1. When the window's context changes (a confirmed switch, a close, a change of user), the address follows
 *    the context, replacing the history entry; the old address is never taken as a new request.
 * 2. When the address names a patient other than the context's (a link, a chooser, the palette, the browser
 *    history, a typed address), the patient is requested from the context once. The machine opens the first
 *    patient of an empty window, asks for confirmation when another patient is open, and refuses while a
 *    dialog is open.
 * 3. When a request is refused, names a patient the directory does not know, or its confirmation is
 *    cancelled, the address is put back to the current patient by replacing the history entry, so the
 *    address, the banner and the content name one patient. In an empty window that leaves no patient in the
 *    address, and the clinical layout shows the chooser.
 * 4. A clinical address without a patient gets the context's patient added.
 * 5. A request still loading when the address stops naming its patient (another address, the context's
 *    patient, none, or a change of context it did not make) is cancelled: it sends nothing to the machine
 *    when its data arrives, and its result is ignored.
 *
 * While the address and the context disagree, the clinical layout shows nothing patient-specific
 * (`addressNamesContext`).
 */
import { useEffect, useRef } from 'react';
import { useAppServices, usePatientContext } from '../app/services.tsx';
import { useUpdateSearch } from '../routing/search.ts';

/** True when the address names the window's patient, or names none. */
export function addressNamesContext(requestedId: string | undefined, contextId: string | undefined): boolean {
  return requestedId === undefined || requestedId === contextId;
}

export function usePatientUrlSync(requestedId: string | undefined): void {
  const { store } = useAppServices();
  const snapshot = usePatientContext();
  const updateSearch = useUpdateSearch();
  const contextId = snapshot.patient?.patientId;
  const version = snapshot.lastChange.version;
  const state = snapshot.state;
  const seenVersion = useRef(version);
  /** The address value already passed to the context, so it is requested once. */
  const handled = useRef<string | undefined>(undefined);
  /** The patient of the request still loading, and the number of the latest request this hook made. */
  const loading = useRef<string | undefined>(undefined);
  const requestNumber = useRef(0);

  useEffect(() => {
    const restore = (): void => {
      updateSearch({ patient: store.getSnapshot().patient?.patientId }, { replace: true });
    };
    const cancelLoading = (): void => {
      requestNumber.current += 1;
      loading.current = undefined;
      store.cancelPatientRequest();
    };

    // 5. A request still loading whose patient the address or the context no longer names.
    if (loading.current !== undefined) {
      const contextChangedElsewhere = version !== seenVersion.current && loading.current !== contextId;
      if (requestedId !== loading.current || contextChangedElsewhere) {
        cancelLoading();
      }
    }

    // 1. The context changed: the address follows it.
    if (version !== seenVersion.current) {
      seenVersion.current = version;
      handled.current = requestedId;
      if (requestedId !== contextId) {
        restore();
      }
      return;
    }

    // 4. The address names the context's patient, or none.
    if (requestedId === undefined || requestedId === contextId) {
      handled.current = undefined;
      if (requestedId === undefined && contextId !== undefined) {
        restore();
      }
      return;
    }

    // 2. A new request from the address.
    if (requestedId !== handled.current) {
      handled.current = requestedId;
      requestNumber.current += 1;
      const request = requestNumber.current;
      loading.current = requestedId;
      const settle = (taken: boolean): void => {
        if (request !== requestNumber.current) {
          return; // overtaken: the newer request, or the change that cancelled this one, governs the address
        }
        loading.current = undefined;
        if (!taken) {
          restore();
        }
      };
      void store.requestPatient(requestedId).then(
        (outcome) => {
          if (outcome.kind !== 'superseded') {
            settle(outcome.kind === 'sent' && outcome.result.outcome !== 'refused');
          }
        },
        () => {
          settle(false);
        },
      );
      return;
    }

    // 3. The request was handled and not taken (its confirmation was cancelled).
    if (loading.current === undefined && state !== 'switch-pending-confirmation') {
      restore();
    }
  }, [requestedId, contextId, version, state, store, updateSearch]);
}
