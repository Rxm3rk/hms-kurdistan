/**
 * Opens the shell's sign dialog right after one of this screen's own dialogs has closed. The window has one
 * modal slot: our dialog releases it when its close is committed, and only then (in an effect after that
 * commit) may the sign dialog take it. Calling `requestSign` in the same handler that closes our dialog could
 * try to stack two modals.
 */
import { useEffect, useEffectEvent, useState } from 'react';
import { useSign, type SignRequest } from '../../shell/index.ts';

export function useDeferredSign(): (request: SignRequest) => void {
  const sign = useSign();
  const [pending, setPending] = useState<SignRequest | null>(null);
  const open = useEffectEvent((request: SignRequest) => {
    sign.requestSign(request);
  });

  useEffect(() => {
    if (pending === null) {
      return;
    }
    setPending(null);
    open(pending);
  }, [pending]);

  return (request: SignRequest) => {
    setPending(request);
  };
}
