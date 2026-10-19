I confirmed 34 of the 35 issues and fixed every one of them in the worktree `C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\wp07`. Issue 15 needed no file change, only a correction of the author's report. Four pairs were the same defect found by both reviewers: 3 and 17, 2 and 35, 6 and 1, 4 and 29.

I did not commit, stage or touch git. I did not touch the main checkout or any programme file. All files are still untracked. My scratch scripts are outside the repository, in `C:\Users\Surface\AppData\Local\Temp\hms-wp07\s0fix\`: `gen_hal.py`, `check_hal.py`, `check_machine.py`, the splice helpers and `renumber.py`. The author's originals in `...\s0\` are unchanged.

**Files changed**
- `docs/specs/modules/design-system.md` (397 lines): §2.1–§2.4, §2.6, §4–§6, §9, §10 and §11 rewritten; a new paragraph after the status of the human decisions.
- `docs/specs/state-machines/patient-context.yaml`: machine redesigned. It now has 7 states (`submitting` is new), 21 predicates and 24 transitions.
- `docs/specs/state-machines/patient-context.md`: rewritten.
- `docs/specs/hal/README.md`: rewritten.
- `docs/specs/hal/hal-v1.schema.json` and `docs/specs/hal/fixtures/*.json`: regenerated, now 69 fixtures (67 before).

**Placeholder renumbering.** The six safety readings moved from OQ to DN, so the remaining OQ placeholders were renumbered. Old OQ-new-1, 11, 12, 13, 16 and 18 became DN-new-7, 8, 9, 10, 11 and 13. Old OQ-new-2…10 became OQ-new-1…9, old 14 became 10, old 15 became 11 and old 17 became 12. OQ-new-13 and DN-new-12 are new.

---

**1. Safety readings filed as open questions (plan, major): CONFIRMED, fixed.**
- §3.4 items 1 and 8 forbid the agent deciding these readings, and DN-014 / R-04 is the precedent.
- The readings are now DN-new-7 (inclusive 60 s), DN-new-8 (what re-verification is), DN-new-9 (context change and user change), DN-new-10 (trilingual name), DN-new-11 (number normalisation and result precision) and DN-new-13 (blocking rules). Each is marked [HUMAN] for the CSO, with options and a default. DN-new-12 (grouping) was added for issue 24.
- The author's two-form reading of "trilingual name display" did narrow SI-16 clause c. The new default is stricter:
  - the banner shows the Kurdish, Arabic and Latin forms;
  - each missing form is flagged;
  - a missing own-script or Latin form also shows "Identity incomplete".
  The old reading is now option 2 of DN-new-10, labelled as narrowing clause c.
- A new paragraph near the top of the spec says these readings are the CSO's decisions.
- The author's claim that "none weakens one" was wrong for the two-form reading and is withdrawn.

**2 and 35. Server-side patient context of CTRL-0016-1 not recorded as missing (plan and clinical, major): CONFIRMED, fixed.**
- The yaml header, `patient-context.md`, design-system §2.1 rule 7 and §2.2 now say the client machine is the client half only. The server-side context, banner data and re-verification rule of CTRL-0016-1 are not built. The machine mirrors the server's context once it exists and stays as a second line of defence.
- The yaml notes that `record` has no domain package yet, so the predicates live in `ui-core` until it does.
- KA-new-1 is widened to name CTRL-0016-1 as well as the server part of CTRL-0016-7. It closes with WP-0.3, WP-0.4 and WP-1.4 [P].

**3 and 17. The machine ignored the banner's blocking rules (plan and clinical, major): CONFIRMED, fixed.**
- New predicates `bannerIdentityValid` and `bannerIdentityInvalid`: patient id, MRN, at least one name form and a valid date of birth (an approximate date counts as valid).
- OpenSign on an invalid banner is refused, and every OpenSign path that leads to signing requires a valid banner. SubmitSign re-checks it.
- New predicate `requestedPatientIdentityValid` on ConfirmSwitch.
- The §9 tests `context-switch-requires-confirmation`, `banner-missing-data-visible` and the SI-16 property test now cover these rules.

**4. Co-sign needs tap plus PIN (plan, major): CONFIRMED, fixed.**
- Evidence: §12.8 line 1730 and R16 §9.6.
- §2.3 now says the pattern is the same but the authentication strength differs: a co-signer taps a badge and enters a PIN. The PIN step is simulated in the demo until WP-0.4.
- `signerAuthenticated` says so; `UnitTest:cosign-same-pattern` asserts the PIN step; KA-new-8 is extended; new key `sign.authenticate.cosignPin`.

**5. Raw badge credential sent to the web app (plan, major): CONFIRMED, fixed in the contract.**
- `badgeEvent` no longer has `credential`. The shell runs the Keycloak step-up over the workstation certificate (§12.8), and the event carries only:
  - `outcome` (`step-up-completed` or `step-up-refused`);
  - on completion, `stepUpRef`: an opaque, single-use, short-lived reference [P], whose redemption WP-0.4 designs.
- A refused tap is audited as `not-permitted` / `step-up-refused`, a reason added under an existing kind. New key `hal.reason.stepUpRefused`.
- The README has a "Badge taps" paragraph and a security bullet. OQ-new-11 records the choice.

**6. Tightenings not recorded in control notes or the Tightenings table (plan, minor): CONFIRMED.** I cannot edit the hazard log or the safety README. The exact text for the lead is in the programme entries:
- new notes for CTRL-0016-7, CTRL-0016-3 and CTRL-0005-17;
- an addition to the CTRL-0016-6 notes;
- three new table rows, one changed row, and a new item 10 for the CSO's open questions.

**7. Fail-closed rule contradicted itself (plan, minor): CONFIRMED, fixed.**
- One precedence: with no shell, `transport-none` returns `no-shell` for every call, `hal.id.read` and `hal.pay.request` included. With a shell, those two return `not-implemented`.
- Fixture names may now carry a reason suffix, and the schema checks that the suffix matches the error. New fixtures: `hal.id.read.unavailable.no-shell` and `hal.pay.request.unavailable.no-shell`.
- The README, design-system §6 and §9 (`no-shell-fails-closed`), the fixture descriptions and KA-new-3 now agree.

**8. Schema consistency gaps (plan, minor): CONFIRMED.**
- I reproduced all three mutations against the old schema; all were valid.
- The schema now enforces:
  - `ok` matches the audit `outcome`;
  - the error kind and reason match between the response and the audit record;
  - each kind's reasons in the audit record;
  - `event` only with its own subscription call;
  - `events` and `eventAudits` only together, and only on the two subscription calls;
  - `writtenBy: hal-client` if and only if the reason is `no-shell`.
- Subscription fixtures now hold `eventAudits`.
- The README lists the five checks the schema cannot make (identifier equality, including `subscriptionId`). Its one-line command now also checks the event audit IDs.
- The README's claim that "the schema cannot compare two fields" is corrected.

**9. HAZ-0011 missing from §9 (plan, minor): CONFIRMED** (backlog PLT-UX-02 hazards; hazard-log line 1837). Fixed: H8 / HAZ-0011 is added, citing CTRL-0011-11 (barcode reads) and CTRL-0011-8 (relabel printing), with "verifies no HAZ-0011 control".

**10. CTRL-0016-3 not marked as partly built (plan, minor): CONFIRMED, fixed.**
- §9 has a new paragraph, "Controls that WP-0.7 builds only in part", listing CTRL-0016-3, -5, -7, -1 and CTRL-0005-17; these stay short of `verified` at S12.
- §2.1 rule 7 and KA-new-9 say the same.

**11. No "weight unavailable" state (plan, minor): CONFIRMED, fixed.** New key `banner.weight.unavailable`, used for invalid data, an undated weight and a value that is not greater than zero. "No dated weight" is kept for valid data that holds no weight. Both cases are in `banner-missing-data-visible`.

**12. ClinicalNumber does change the string, which sits uneasily with CTRL-0005-6 (plan, minor): CONFIRMED, fixed.** The §2.6 bullet now says the numeric value never changes and only the display form is normalised (CTRL-0005-17). Reading that as "no change" under CTRL-0005-6, and the loss of written precision for results, are both part of DN-new-11.

**13. Extra `parameters` key outside Appendix B.3 (plan, minor): CONFIRMED, fixed.** The key is removed. The 60 000 ms value and its vendor lock are in the `contextChangedWithinWindow` description. My checker confirms the top-level keys are exactly the B.3 keys.

**14. KA-013 becomes untrue (plan, minor): CONFIRMED.** The edit is in the programme entries.

**15. Two inaccurate statements in the report (plan, minor): CONFIRMED; corrected in this report, no file change needed.**
- The §10 table had 106 keys, not 111. I counted 106 unique keys in the original. After my changes it has 121.
- The safety check does not validate state-machine structure. `tools/hmstools/safety/check.py` lines 580–582 only count the spec files, and the approval-field scan follows. "Validated" should read: approval gate passed with 0 filled fields; structure checked by a scratch script.

**16. Locale tags not in canonical form (plan, minor): CONFIRMED with Node.** `Intl.getCanonicalLocales` returns `ckb-u-ca-gregory-nu-latn`. Fixed in §2.6, OQ-new-2 and the `ui-intl-western-digits` test. The approved `plan.md` (S2) still says `ckb-u-nu-latn-ca-gregory`; slice S2 should use the canonical form.

**18. The palette contradicts the modal guard (clinical, major): CONFIRMED, fixed.**
- §2.4: choosing a patient closes the palette first and only then requests the patient. The palette is never exempt from the stack guard. The `noModalOpen` description says the same.
- New test `UnitTest:palette-selects-patient-via-confirmation`.

**19. URL versus context as the source of truth (clinical, major): CONFIRMED, fixed.**
- New rule in §2.2 and §4: clinical routes read data only by the context's patient id. A URL is only a request: a differing id shows nothing patient-specific, and a cancelled or refused switch restores the URL by replacing the history entry.
- New test `E2E:url-never-overrides-patient-context`.

**20. HAL results not bound to a window or patient (clinical, major): CONFIRMED, fixed.**
- New README section "Windows and patients":
  - barcode reads go only to the focused window;
  - badge taps go to every window;
  - `hal-client` binds each capture to the window's patient id and change time, and discards a late result with `hal.capture.discardedAfterContextChange`, releasing the blob;
  - a capture that waits for a device holds the modal guard.
- Reflected in design-system §2.2, §2.8 and §6, and in the `noModalOpen` predicate.
- New tests: `UnitTest:hal-capture-discarded-after-context-change`, plus focused-window routing in the S9 mock-runtime tests.

**21. A user change cleared only one window (clinical, major): CONFIRMED, fixed.**
- §2.2 now says a user change clears every window of the workstation session. The shell sends it to all its windows; browser tabs learn it through `BroadcastChannel`; and each window checks its user against the session's user on focus and before every clinical action, clearing on a mismatch (fail closed).
- New test `E2E:user-change-clears-every-window`.

**22. Allergy parsing could show NKA despite bad data (clinical, major): CONFIRMED, fixed.**
- Each field's value is parsed with a strict schema; allergies are a closed discriminated union.
- An extra key, or NKA / not-assessed together with items, is invalid. One malformed item makes the whole field "Allergy status unavailable"; an item is never dropped.
- Rule 1 now ignores unknown top-level keys, so the room/bed test still holds.
- These cases are added to the CTRL-0016-4 test.

**23. Raw UCUM codes shown as units (clinical, major): CONFIRMED, fixed.**
- §2.6 now uses a governed UCUM display map (`ug` → `mcg`, `U` and `[iU]` → `units`). A unit not in the map shows "Invalid value".
- WP-0.7 ships a synthetic sample; content request OQ-new-13 and KA-new-12 record the rest.

**24. "No grouping" presented as an ISMP rule (clinical, major): CONFIRMED, fixed.**
- Integer parts of 1000 and above are now grouped with U+202F (narrow no-break space).
- The table states this departs from the letter of ISMP's comma, because a comma can be read as the Arabic decimal separator `٫`.
- It is decision DN-new-12 for the CSO, with the comma, no grouping and words as options.

**25. No-truncation rule covered only the banner (clinical, major): CONFIRMED, fixed.**
- Rule 3 now covers the banner, the switch confirmation, the re-verification step, the palette's patient results and every patient list or chooser, and MRNs and allergy substances too.
- `banner-long-names-wrap` and `E2E:pseudo-locale` are extended, with two patients whose names differ only in the grandfather's name; a matching demo fixture is added.

**26. "Nothing was saved" shown when the outcome is unknown (clinical, major): CONFIRMED, fixed.**
- `sign.failed` now covers only a confirmed rejection.
- New keys `sign.outcomeUnknown` ("It is not known whether this was signed. Check the record before signing again.") and `sign.contextChanged`.
- The machine has a new `submitting` state with SignAccepted, SignRefused, SignRejected and SignOutcomeUnknown outcomes. A retry reuses the idempotency key created when the sign step opened (§6.2).
- New test `UnitTest:sign-outcome-unknown-reuses-idempotency-key`.

**27. Ambiguous "Open this patient" label (clinical, major): CONFIRMED, fixed.**
- The heading `patientContext.switch.requested` is now "Requested patient", and the confirm label is "Switch to requested patient" (27 characters).
- `patientContext.close` is now "Close patient record".
- The translator notes say it means the record, never an act on the person's body.

**28. Translator notes for Arabic incomplete (clinical, minor): CONFIRMED with Node** (Arabic categories zero/one/two/few/many/other; 60 falls in `many`; ckb uses one/other). Fixed:
- general notes on plurals (keep `#` in every branch), gender-neutral forms and the Arabic comma `،`;
- `banner.codeStatus.recordedOn` is now a whole message, "{status}, recorded {date}";
- per-key plural notes;
- second-person text reworded where possible ("before signing", "Cancelled at the device.").

**29. Gaps in the re-verification logic (clinical, minor): CONFIRMED, fixed.**
1. Re-verification is bound to the signer through `reverificationHeldBySigner`. If someone else authenticates, the dialog returns to re-verification with `sign.reverify.signerDiffers`.
2. `reverifiedSinceLastChange` is defined as false when the change time is unknown.
3. A context mismatch on submit closes the dialog without signing (`sign.contextChanged`).

**30. Date-of-birth wording ambiguous (clinical, minor): CONFIRMED, fixed.**
- The wording now reads "date of birth at its recorded precision with the approximate-DOB flag where it applies".
- A missing or invalid date of birth blocks signing (new key `banner.dob.unavailable`).
- The flag is shown whenever the precision is less than a day (the reviewer's second option; the schema still allows a partial precision with `approximate: false`).

**31. "Not this patient" left the wrong patient open with no message (clinical, minor): CONFIRMED, fixed.**
- New event `RejectPatient` with `sign.reverify.rejected`; focus goes to the banner's close and change controls.
- New predicate `identityDisputed`: after a rejection, re-verification is required at signing even beyond 60 s, until a context change or a confirmed re-verification. This is a tightening I added.
- The switch confirmation shows each field's unavailable state, and confirm is disabled while the requested patient's identity is invalid.

**32. Timeouts marked retryable for print and payment (clinical, minor): CONFIRMED, fixed.**
- New required error field `outcomeUnknown`. For device-error and timeout on the three print calls and `hal.pay.request`, it is true and `retryable` is false; the schema enforces this per call.
- New key `hal.error.outcomeUnknown`. Optional `reprintOf` (a job id) on label and document requests and in the audit record makes a reprint explicit and audited.

**33. No fallback for unknown codes or missing labels (clinical, minor): CONFIRMED, fixed.**
- New rule 6: a label missing in the user's locale shows another locale's label with "Not translated" (new key `banner.label.untranslated`).
- An allergy substance with no label at all shows its code with the same marker, so no allergy is hidden.
- An unknown code-status or isolation code makes that field show its unavailable state.

**34. Weight could be zero or negative (clinical, minor): CONFIRMED, fixed.** The data model requires a decimal greater than zero, checked by pattern and never by arithmetic; anything else shows "Weight unavailable".

**Side observation, not a reviewer issue.** PyYAML, a YAML 1.1 parser, reads the Appendix B.3 transition key `on` as the boolean `true`. My checker handles it, and `patient-context.md` notes it. WP-0.5's generator must read the key as written.