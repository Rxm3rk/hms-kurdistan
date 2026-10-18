# WP-0.7: Design system and client shells
Phase / release: Phase 0 Foundation / no clinical go-live (features first run in R1)   Features: `PLT-UX-01`, `PLT-UX-02`, `PLT-UX-03` (base), `KRI-LOC-01` (base)
Read first: BUILD-PROMPT §2.1 (SI-01, SI-16); §4.1 (web client, desktop shell, mobile, fonts, locales); §5.4; §6.5; §11.1; §12.8 (the HAL contract and badge tap rule); §14.1, §14.2, §14.4, §14.7; §15; §18.9. Research: K §6; BP §6; R10 §2–§3; R03 §15 (the §14 "Read:" line); R16 §2, §6–§12 (peripherals)
Depends on: WP-0.1 (badge flow: WP-0.4)   Simulators needed: the simulated devices behind the HAL (badge reader; label and wristband printers as a capture endpoint that stores the ZPL or PDF; scanners) (§3.7, §21)
Entry criteria:
- WP-0.1 merged, or reviewed and stacked (§3.6, §21).
- On this host the web parts can start after WP-0.1, and the Tauri shell can be built in the WSL build host, which has Rust and the Tauri 2 Linux prerequisites (DN-004, closed). The badge-tap exit criterion needs the badge flow from WP-0.4, which waits on WP-0.2. iOS builds need macOS and Windows packaging of the shell needs Windows; a human provides those build steps when they are needed ("Before the first session").
Deliverables:
- The web workspace frame: React with strict TypeScript and React Aria Components; Vite; TanStack Router and TanStack Query; FormatJS (ICU MessageFormat); Zod (§4.1) (`PLT-UX-01`).
- The banner component (SI-16): photo, two identifiers, allergies with "NKA" distinct from "not assessed", code status, isolation, dated weight, trilingual name display with the name in the patient's script plus a Latin transliteration (SI-01); one patient context per window; identity re-verified at signing if the context changed within the last 60 s. The banner is a design-system component, mandatory on every clinical route, enforced by a test (§6.5, §14.2).
- One sign/co-sign pattern; a command palette (keyboard-first); density modes; no stacked modals; defaults never select a dose, route or patient (§6.5, §14.2).
- `ClinicalNumber`: Western digits for clinical numerals on every locale; doses with a leading zero and never a trailing zero (§6.5).
- Locales `en`, `ckb`, `ar` with RTL by construction: CSS logical properties only (a lint rule bans physical directions); `dir` from the locale; bidi isolation of mixed strings; no string literals in JSX; missing keys fail the build for clinical paths (§6.5, §14.7) (`PLT-UX-03` base, `KRI-LOC-01` base). `ku-Arab` is for patient-facing templates only; `ku-Latn` only if Q-K17 requires it (§4.1).
- OFL-licensed fonts covering every Sorani letter (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە), with a glyph-coverage test (§4.1).
- The Tauri 2 shell with the HAL interfaces of §12.8 (`hal.print.label / raw / document()`, `hal.scan.onBarcode / document()`, `hal.id.read({type})`, `hal.auth.onBadge()`, `hal.sign.capture()`, `hal.pay.request()`, `hal.camera.photo()`, `hal.kiosk.lock()`, `hal.capabilities()`), each call returning a typed result and an audit ID, and simulated devices (`PLT-UX-02`).
- The React Native (New Architecture, Expo) app skeleton for one app with nurse and physician modes (§15).
- Playwright, axe and RTL-diff harnesses, with pseudo-localisation (§14.7, §18.9).
- Accessibility rules from §6.5: text contrast ≥4.5:1; colour never the only carrier of meaning; targets ≥24×24 px; WCAG 2.2 AA.
Exit criteria (evidence required):
- A demo route renders the banner in three languages with correct RTL.
- axe clean.
- Visual diffs stored.
- A simulated badge tap switches users in ≤2 s.
- §22.2 work-package Definition of Done and a reviewer report.
Hazards touched:
- H1 wrong patient (SI-01 two identifiers and script-plus-Latin name; SI-16 banner, one context per window, re-verification at signing).
- H2 wrong drug, dose, route or time (clinical numerals in Western digits; leading-zero and no-trailing-zero dose display; no defaulted dose or route).
[HUMAN] gates:
- None in §21.
- Clinician review of translations is a later release gate (§11.1), not part of this work package's exit.
