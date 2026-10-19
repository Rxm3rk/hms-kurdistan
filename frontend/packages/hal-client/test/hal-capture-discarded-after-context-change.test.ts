/**
 * UnitTest:hal-capture-discarded-after-context-change (docs/specs/modules/design-system.md §9; slice S8;
 * CTRL-0016-6). A capture result that arrives after the window's patient context changed is discarded with
 * `hal.capture.discardedAfterContextChange`, and its blob is released. The capture holds the window's
 * modal guard while it waits.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_DISCARDED_MESSAGE_KEY,
  createCaptureBinding,
  type WindowPatientContext,
} from '../src/capture.ts';
import { UUID7_PATTERN, type CaptureCallName, type HalRequest, type HalValue } from '../src/contract.ts';
import { createSimTransport, type SimOutcome } from '../src/transport-sim.ts';

/** A promise the test resolves when it decides the device has answered. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const PATIENT_A = 'SYN-PATIENT-0001';
const PATIENT_B = 'SYN-PATIENT-0002';

const requests = {
  'hal.camera.photo': { purpose: 'patient-photo' },
  'hal.scan.document': {
    mediaType: 'application/pdf',
    resolutionDpi: 300,
    colour: 'greyscale',
    duplex: false,
  },
  'hal.sign.capture': { purpose: 'consent', promptKey: 'hal.sign.prompt.consent' },
  'hal.id.read': { type: 'passport-mrz' },
} as const satisfies { [C in CaptureCallName]: HalRequest<C> };

/** A window whose patient context the test changes, and a simulated shell whose devices wait for the test. */
function setUp() {
  let context: WindowPatientContext = { patientId: PATIENT_A, changeVersion: 1, changedAt: 1000 };
  const pendingPhoto = deferred<SimOutcome<'hal.camera.photo'>>();
  let guardHeld = 0;
  const guardEvents: string[] = [];
  const sim = createSimTransport({
    script: {
      'hal.camera.photo': () => pendingPhoto.promise,
    },
  });
  // Records every release the binding asks the transport for.
  const releaseRequests: string[] = [];
  const transport = {
    ...sim,
    releaseBlob: (blobRef: string) => {
      releaseRequests.push(blobRef);
      return sim.releaseBlob(blobRef);
    },
  };
  const binding = createCaptureBinding({
    transport,
    context: () => context,
    holdModalGuard: () => {
      guardHeld += 1;
      guardEvents.push('hold');
      return () => {
        guardHeld -= 1;
        guardEvents.push('release');
      };
    },
  });
  return {
    sim,
    binding,
    pendingPhoto,
    setContext: (next: WindowPatientContext) => {
      context = next;
    },
    guardHeld: () => guardHeld,
    guardEvents,
    releaseRequests,
  };
}

function photo(blobRef: string): SimOutcome<'hal.camera.photo'> {
  const value: HalValue<'hal.camera.photo'> = {
    mediaType: 'image/jpeg',
    blobRef,
    sha256: 'a'.repeat(64),
    byteLength: 2048,
    widthPx: 640,
    heightPx: 480,
  };
  return { ok: true, value };
}

describe('hal-capture-discarded-after-context-change', () => {
  it('discards a photo that arrives after the patient changed, and releases its blob', async () => {
    const { binding, pendingPhoto, setContext, guardHeld, releaseRequests } = setUp();
    const outcome = binding.capture('hal.camera.photo', requests['hal.camera.photo']);
    expect(guardHeld()).toBe(1);
    expect(binding.waiting()).toBe(1);

    // The patient changes while the camera waits; then the photo arrives.
    setContext({ patientId: PATIENT_B, changeVersion: 2, changedAt: 2000 });
    const blobRef = 'hal-blob:019a3c00-0000-7000-8000-0000000000a1';
    pendingPhoto.resolve(photo(blobRef));

    const result = await outcome;
    expect(result.status === 'discarded' ? result.auditId : null).toMatch(UUID7_PATTERN);
    expect(result).toStrictEqual({
      status: 'discarded',
      messageKey: 'hal.capture.discardedAfterContextChange',
      auditId: result.status === 'discarded' ? result.auditId : null,
    });
    expect(CAPTURE_DISCARDED_MESSAGE_KEY).toBe('hal.capture.discardedAfterContextChange');
    expect(releaseRequests).toStrictEqual([blobRef]);
    expect(guardHeld()).toBe(0);
    expect(binding.waiting()).toBe(0);
  });

  it.each(['hal.scan.document', 'hal.sign.capture'] as const)(
    'discards %s after a context change and releases the blob the shell holds',
    async (call) => {
      const { sim, binding, setContext } = setUp();
      const outcome = binding.capture(call, requests[call]);
      // The change happens while the request is in flight, before the result is read.
      setContext({ patientId: PATIENT_B, changeVersion: 2, changedAt: 2000 });
      const result = await outcome;
      expect(result.status).toBe('discarded');
      expect(sim.heldBlobs().size).toBe(0);
      expect(sim.releasedBlobs().size).toBe(1);
    },
  );

  it('discards hal.id.read after a context change too (its result is an error in WP-0.7)', async () => {
    const { binding, setContext } = setUp();
    const outcome = binding.capture('hal.id.read', requests['hal.id.read']);
    setContext({ patientId: null, changeVersion: 2, changedAt: 2000 });
    expect((await outcome).status).toBe('discarded');
  });

  it('discards a result after the window closed the patient and reopened the same one', async () => {
    const { sim, binding, setContext } = setUp();
    const outcome = binding.capture('hal.sign.capture', requests['hal.sign.capture']);
    setContext({ patientId: PATIENT_A, changeVersion: 3, changedAt: 3000 });
    expect((await outcome).status).toBe('discarded');
    expect(sim.releasedBlobs().size).toBe(1);
  });

  it('discards a result when only the change counter moved', async () => {
    const { binding, pendingPhoto, setContext } = setUp();
    const outcome = binding.capture('hal.camera.photo', requests['hal.camera.photo']);
    setContext({ patientId: PATIENT_A, changeVersion: 2, changedAt: 1000 });
    pendingPhoto.resolve(photo('hal-blob:019a3c00-0000-7000-8000-0000000000a2'));
    expect((await outcome).status).toBe('discarded');
  });

  it('delivers the result, and keeps the blob, when the context did not change', async () => {
    const { sim, binding, guardEvents } = setUp();
    const result = await binding.capture('hal.scan.document', requests['hal.scan.document']);
    expect(result.status).toBe('delivered');
    if (result.status !== 'delivered' || !result.result.ok) {
      throw new Error('expected a delivered scan');
    }
    expect(sim.heldBlobs().has(result.result.value.blobRef)).toBe(true);
    expect(sim.releasedBlobs().size).toBe(0);
    expect(guardEvents).toStrictEqual(['hold', 'release']);
  });

  it('fails closed when the context cannot be read or its change time is unknown', async () => {
    const unreadable = setUp();
    let reads = 0;
    const flaky = createCaptureBinding({
      transport: unreadable.sim,
      context: () => {
        reads += 1;
        if (reads > 1) {
          throw new Error('context unavailable');
        }
        return { patientId: PATIENT_A, changeVersion: 1, changedAt: 1000 };
      },
    });
    expect((await flaky.capture('hal.scan.document', requests['hal.scan.document'])).status).toBe(
      'discarded',
    );

    const unknown = setUp();
    unknown.setContext({ patientId: PATIENT_A, changeVersion: null, changedAt: null });
    expect((await unknown.binding.capture('hal.sign.capture', requests['hal.sign.capture'])).status).toBe(
      'discarded',
    );

    // An unreadable clock alone does not discard: the change counter still shows that nothing changed.
    const counted = setUp();
    counted.setContext({ patientId: PATIENT_A, changeVersion: 4, changedAt: null });
    expect((await counted.binding.capture('hal.sign.capture', requests['hal.sign.capture'])).status).toBe(
      'delivered',
    );

    // A window that never had a patient has nothing to change.
    const empty = setUp();
    empty.setContext({ patientId: null, changeVersion: null, changedAt: null });
    expect((await empty.binding.capture('hal.sign.capture', requests['hal.sign.capture'])).status).toBe(
      'delivered',
    );
  });

  it('sends nothing when the modal guard refuses, and releases the guard when the transport fails', async () => {
    const { sim } = setUp();
    const records: unknown[] = [];
    const refused = createCaptureBinding({
      transport: createSimTransport({ audit: (record) => records.push(record) }),
      context: () => ({ patientId: PATIENT_A, changeVersion: 1, changedAt: 1000 }),
      holdModalGuard: () => {
        throw new Error('a modal is already open');
      },
    });
    await expect(refused.capture('hal.camera.photo', requests['hal.camera.photo'])).rejects.toThrow();
    expect(records).toHaveLength(0);

    let held = 0;
    const failing = createCaptureBinding({
      transport: { ...sim, call: () => Promise.reject(new Error('transport down')) },
      context: () => ({ patientId: PATIENT_A, changeVersion: 1, changedAt: 1000 }),
      holdModalGuard: () => {
        held += 1;
        return () => {
          held -= 1;
        };
      },
    });
    await expect(failing.capture('hal.camera.photo', requests['hal.camera.photo'])).rejects.toThrow();
    expect(held).toBe(0);
  });
});
