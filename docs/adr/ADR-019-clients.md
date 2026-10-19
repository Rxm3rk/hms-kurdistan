# ADR-019: Clients: React/TypeScript with one design system, a Tauri 2 shell with the HAL, React Native mobile
Status: accepted
Date: 2026-10-18   Source: K §6, §7.2 (kept), §7.6; BP §6.6, §7.2, §7.7; R08 §1 #11, §8, §12.5; R16 §2.1; BUILD-PROMPT §4.1 (Web client, Desktop shell, Mobile, Locales), §5.4, §6.1, §6.5, §14, §15, §21 (WP-0.7), §4.2

## Context

**The question.** What the web, desktop and mobile clients are built with.

**The research** (R08 §12.5, §1 #11). TypeScript and React for the UI, with a design system on accessible primitives such as React Aria; the largest ecosystem, and it shares code with React Native. The desktop needs a thin native shell around the web app: Epic states that browser `window.print()` is "insufficient" for wristbands and labels, so we need silent ZPL printing, scanner, badge-tap and smart-card support (R08 §1 #11). Tauri 2 (WebView2 on Windows) is the recommended shell; React Native with Expo for mobile, offline through SQLite sync. The shell is integration plane A (R16 §2.1; ADR-011).

**Sources.** K keeps BP's ADR-019 text (K §7.2; K §7.6). The decision is K's; BUILD-PROMPT §4.1 marks the rest of the web stack (Vite, TanStack Router and Query, FormatJS, Zod), SQLCipher for the mobile offline store, and the locale set as [P] engineering choices, binding until an ADR changes them.

## Decision

**Clients:** React/TypeScript with one design system; Tauri 2 shell with the HAL; React Native mobile.

**Stack detail** (BUILD-PROMPT §4.1):
- **Web client:** React with strict TypeScript and React Aria Components; Vite; TanStack Router and TanStack Query; FormatJS (ICU MessageFormat); Zod for runtime validation [P for all but React and React Aria].
- **Desktop shell:** Tauri 2 with a hardware abstraction layer (HAL) for printers, scanners, badge and ID-card readers, MRZ readers and card terminals.
- **Mobile:** React Native (New Architecture) with Expo; encrypted SQLite (SQLCipher) for the offline store [P]; MDM-managed devices.
- **Locales [P]:** `en`, `ckb` (Central Kurdish / Sorani, Arabic script, RTL) and `ar` (Arabic, RTL) for the UI; `ku-Arab` (Badini/Kurmanji in Arabic script) for patient-facing templates only; `ku-Latn` only if Q-K17 says Latin-script Kurmanji output is needed. Default time zone `Asia/Baghdad`, configurable per tenant.
- **Layout [P]** (BUILD-PROMPT §6.1): `frontend/apps/web`, `apps/shell`, `apps/mobile`, `apps/signage`; `frontend/packages/design-system`, `packages/regulated-ui`, `packages/i18n`, `packages/api-client`. The pnpm workspace root is `frontend/`.
- **Conventions** (BUILD-PROMPT §6.5): strict TypeScript, no `any`; React Aria Components for every interactive primitive; design tokens only; CSS logical properties only; no string literals in JSX; clinical numerals through a `ClinicalNumber` component that always uses Western digits; the banner on every clinical route; defaults never select a dose, route or patient; WCAG 2.2 AA.
- **Resilience** (BUILD-PROMPT §5.4): drafts autosave, re-authentication is fast (badge tap ≤2 s), nothing is lost on a workstation reboot.

## Consequences (including safety and licence impact)

**Safety.**
- One design system carries the banner (SI-16), one patient context per window, and the sign/co-sign pattern, which address H1.
- The shell's silent printing makes wristbands and labels reliable (SI-01).
- Western digits for clinical numbers and bidi isolation of mixed strings prevent misreading doses in RTL layouts (H2).
- Regulated values are drawn only by Tier 2-owned components in `packages/regulated-ui` (ADR-016).

**Build host.** The Tauri shell needs Rust and the Tauri 2 system prerequisites. Rust 1.99.1 and the Tauri 2 Linux prerequisites are installed in the WSL2 build host (Ubuntu 24.04.5) by `tools/host/provision-ubuntu.sh` (DN-004, closed). The shell itself is built in WP-0.7; `frontend/apps/shell` holds only a placeholder, so no shell build has run yet. iOS builds still need macOS (BUILD-PROMPT, "Before the first session"). Windows packaging of the shell needs Windows (same source): building the Windows shell bundle needs a Windows Rust toolchain or a Windows build agent, which is not yet decided (WP-0.7).

**Licence.** React, React Aria, Vite, TanStack, FormatJS, Zod and Tauri are MIT or Apache-2.0; React Native and Expo are MIT or BSD (BUILD-PROMPT §4.1). Fonts are OFL-1.1. The ORT scan (ADR-022) confirms each pinned package.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** none is named ("—").

**Related checks** that touch the clients but are not guards of this decision: the fast tier's ESLint, TypeScript type-checking, unit tests and localisation lint (`corepack pnpm run fast`, run from `frontend/`, created in WP-0.1); BUILD-PROMPT §6.8 item 6 (no hard-coded user-facing strings, no physical CSS directions, banner present on clinical routes); the Playwright, axe and RTL-diff harnesses of WP-0.7.

**State on 2026-10-18:** no guard is defined for this ADR, and none is claimed.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
