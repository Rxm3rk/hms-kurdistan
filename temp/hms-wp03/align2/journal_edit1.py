p = r'C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-4f6f2a03\docs\specs\modules\platform-journal.md'
s = open(p, encoding='utf-8').read()
reps = [
("It cannot prove that a decision or an episode is real; the ports do that (J-8, J-9).",
 "It cannot prove that a decision or an episode is real; `BackDatingAuthorization` and the kernel's `BackEntryAuthority` do that (J-8, J-9)."),
("""2. It derives the entry mode from the `CommandContext`, never from request input, through the kernel's derivation (D10). The mapping it assumes: actor kind `USER` → `USER`; `DEVICE` and `INTERFACE` → `INTERFACE`; `MIGRATION_LOADER` → `MIGRATION`; `SYSTEM` → no mode (system rows use `AtRecordedTime`, J-10). `BACK_ENTRY` replaces `USER` only when the append asks for back-entry and `BackEntryAuthorization` returns `Authorised` with the episode (J-9).
3. For a clinical aggregate type it gets the type's `EntryTimePolicy` from `EntryTimePolicies` (J-7) and calls `EntryTimeClassifier.classify(clinical, recorded, mode, policy, episode)`. For an administrative type it applies the administrative rule below.
4. `Refused(reason)` refuses the append (`EntryTimeRefused`), including `CLINICAL_TIME_IN_FUTURE`.
5. The result's kind must equal the entry's `expectedTiming`, or the append is refused (`TimingMismatch`). The client therefore cannot slip a late row in as contemporaneous, and a user who expected a contemporaneous entry is sent back to the back-dating flow rather than silently back-dated.
6. `BackDated` requires a reason and a verified decision (J-8). The appender calls `BackDatingAuthorization.verify` and stores the returned decision id.

**Time classes [P].** Each registered aggregate type declares a time class (`envelope.md` §12):

- **`CLINICAL`**: the kernel classifier and the type's policy apply, as above.
- **`ADMINISTRATIVE`**: effective-dated configuration and structure (the tenancy and config aggregate types), and work management (`Task`, `DeadLetterItem`), whose rows record who did what to the work, not a clinical act. A clinical act and its clinical time are journaled by the owning clinical module on its own aggregate; a task's "performed at" is event data. A valid time at or after the recorded time (a planned change) is `Contemporaneous`; this means "not back-dated", not "now". A valid time before the recorded time is a retroactive change: `BackDated(lag)` with label `LATE_ENTRY`, which needs a reason and a verified decision like any back-dating (J-8). No tolerance applies, so `entry_policy_ref` is null. This matches `platform-tenancy`'s rule that retroactive changes are privileged and labelled (tenancy W-11). It is this build's reading (OQ-J5).

**`AtRecordedTime`.** A row may define its valid time as its own recorded time (`ValidTimeSpec.AtRecordedTime`): the appender writes `valid_from` = the J-4 reading with offset 0, and the classification is `Contemporaneous` by construction, so no policy is needed. Only `SYSTEM` actors (timers such as `TaskOrphaned`) and administrative aggregate types may use it (J-17). Clinical acts always carry their own clinical time, so an act captured offline keeps its capture time and never takes the sync time (D10).
""",
"""2. It takes the entry mode only from `context.entryMode`, which the kernel derives from the authenticated context (kernel §7.3), never from request input (D10). `BACK_ENTRY` arises only when the context carries a `BackEntryAuthority` (J-9); the journal has no back-entry flag of its own.
3. It reads the event type's `ValidTimeKind` and, where declared, its `TimingClass` from the catalogue entry (`envelope.md` §12). When `EntryTimeClassifier.needsPolicy(input, kind, mode)` is true, it asks the kernel's `EntryTimePolicySource.policyFor(context, timingClass, AsOf.latest(recorded))` (J-7); otherwise it passes `NotLookedUp`. It then calls `EntryTimeClassifier.classify(input, kind, recorded, mode, policy, episode)`, with `episode = context.backEntry?.episode`.
4. `Refused(reason)` refuses the append (`EntryTimeRefused`), including `CLINICAL_TIME_IN_FUTURE` and `TIMING_POLICY_NOT_CONFIGURED`.
5. The result's `EntryTimingCode` must equal the entry's `expectedTiming`, or the append is refused (`TimingMismatch`). The client therefore cannot slip a late row in as contemporaneous, and a user who expected a contemporaneous entry is sent back to the back-dating flow rather than silently back-dated.
6. It enforces the result's requirements (kernel §6.2). `BACK_DATING_AUTHORIZATION` and `USER_ENTERED_REASON`: a `ChangeReason.Entered` reason and a verified decision (J-8, J-11b); the appender calls `BackDatingAuthorization.verify` and stores the returned decision id. `BACK_ENTRY_AUTHORITY`: the context's authority (J-9). `MIGRATION_PROVENANCE`: J-10. It stores the code, the `ClinicalTimeSource`, the accepted `ValidTime` and the sources of the policy's `ResolvedParameter`s.

**One classifier, no per-module rules (D10).** Every row goes through the kernel classifier; the journal has no rule of its own for any aggregate type. Configuration and structure (tenancy and config) are event types of kind `EFFECTIVE`. A start not earlier than the recorded time is `EffectiveDated` (code `EFFECTIVE_DATED`). A start earlier than the recorded time is a retroactive change: `BackDated` (code `BACK_DATED`, source `EFFECTIVE_DATE`), which needs a `ChangeReason.Entered` and a verified decision like any back-dating (J-8). Work management (`Task`, `TaskRequest`, `Pool`, `Queue`, `DeadLetterItem`) is `CLINICAL_AT_RECORDING` and uses `AtRecording`; a task's "performed at" is event data. A clinical act and its clinical time are journaled by the owning clinical module on its own aggregate. No tolerance applies to `EFFECTIVE` and `AtRecording` rows, so `entry_policy_ref` is null.

**`AtRecording`.** A row may define its valid time as its own recorded time (`ValidTimeInput.AtRecording`). The appender writes `valid_from` = the J-4 reading with offset 0 and an open end, and the classifier answers `Contemporaneous(AT_RECORDING)` or `EffectiveDated` without a policy. The classifier refuses it for `CLINICAL_CAPTURED` event types and for offline-captured, back-entered, device, interface and migrated entries (`CAPTURE_TIME_REQUIRED`; J-17). So an act captured offline keeps its capture time and never takes the sync time (D10).
"""),
("""| Kernel classification | `entry_timing` | `entry_label` | Also required |
|---|---|---|---|
| `Contemporaneous` | `CONTEMPORANEOUS` | null | — |
| `BackDated(lag)` | `BACK_DATED` | `LATE_ENTRY` | reason; `USER` actor; decision id from `BackDatingAuthorization` (J-8) |
| `BackEntry(lag, episodeId)` | `BACK_ENTRY` | `DOWNTIME_ENTRY` | reason; episode id from `BackEntryAuthorization` (J-9) |
| `LateArrival(lag)` | `LATE_ARRIVAL` | `LATE_ARRIVAL` | — (the channel is the actor) |
| `Migrated(lag)` | `MIGRATED` | `MIGRATED` | `MIGRATION_LOADER` actor and `migrated` source (J-10) |
| `Refused(reason)` | not stored | — | the append is refused |

The label travels into every event (`envelope.md` §5, extensions `entrytiming` and `entrylabel`), so screens, prints and exports downstream can show it (CTRL-0010-5).""",
"""| Kernel classification | `entry_timing` | Labelled | Also required |
|---|---|---|---|
| `Contemporaneous(source)` | `CONTEMPORANEOUS` | no | — |
| `EffectiveDated` | `EFFECTIVE_DATED` | no | — |
| `BackDated(lag, source)` | `BACK_DATED` | yes | `ChangeReason.Entered`; `USER` actor; decision id from `BackDatingAuthorization` (J-8) |
| `BackEntry(lag, episodeId)` | `BACK_ENTRY` | yes | reason; the context's `BackEntryAuthority`, whose episode id is stored (J-9) |
| `OfflineCapture(lag)` | `OFFLINE_CAPTURE` | yes | the device of the offline session (`CHANNEL_IDENTITY`) |
| `LateArrival(lag, source)` | `LATE_ARRIVAL` | yes | — (the channel is the actor) |
| `Migrated(lag)` | `MIGRATED` | yes | `MIGRATION_LOADER` actor and `migrated` source (J-10) |
| `Refused(reason)` | not stored | — | the append is refused |

"Labelled" is `EntryTimingCode.labelled`; the display text is localisation content keyed `entry-timing.<code>` (kernel §6.2). The code travels into every event (`envelope.md` §5, extension `entrytiming`), so screens, prints and exports downstream can show the label (CTRL-0010-5). No separate label is stored or published."""),
("""| Every back-entry append | `RefusingBackEntryAuthorization` returns `Refused(NO_BACK_ENTRY_TOOLING)` | `UnitTest:back-entry-append-refused-by-production-authorization` |
| Every user-timed append to a clinical aggregate type | The tenancy resolver behind `EntryTimePolicies` finds no configured tolerances (DN-KN1) and returns `Unavailable`; a policy with `Synthetic` provenance is refused in TRAIN and PROD by the D11 production gate | `UnitTest:clinical-append-refused-without-entry-time-policy`; the D11 gate's own test (kernel and tenancy specifications) |

Test doubles of the three ports live in `hms.kernel.journal.testing` and are never bound in production (D8).""",
"""| Every back-entry append | The kernel mechanism: no production code can issue a `BackEntryAuthority` (the `BACK_ENTRY_TOOLING` allow-list is empty in WP-0.3), and without one `context.entryMode` is never `BACK_ENTRY` (kernel §7.2, §7.3) | `ArchTest:back-entry-authority-only-from-back-entry-tooling`; `PropertyTest:kernel-entry-mode-derived-from-context` (kernel specification) |
| Every user-timed append to a clinical event type | The resolver behind the kernel's `EntryTimePolicySource` answers `NotConfigured` while no tolerance definition or value exists (DN-KN1), and the classifier answers `Refused(TIMING_POLICY_NOT_CONFIGURED)`. A policy with `Synthetic` provenance is refused in TRAIN and PROD by the D11 production gate. This row is a control only once `platform-tenancy` specifies its `EntryTimePolicyResolver` (D16) | `UnitTest:clinical-append-refused-without-entry-time-policy`; the D11 gate's own test (kernel and tenancy specifications) |

Test doubles of `BackDatingAuthorization` and `EntryTimePolicySource` live in `hms.kernel.journal.testing` and are never bound in production (D8)."""),
]
for a, b in reps:
    assert s.count(a) == 1, a[:80]
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
