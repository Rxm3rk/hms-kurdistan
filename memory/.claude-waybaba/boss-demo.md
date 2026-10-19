---
name: boss-demo
description: "19 Oct 2026: clickable HMS prototype for the user's boss, built outside the product repo at C:\\Users\\Surface\\hms-demo (apps/demo, port 5200); how it was built and how to run it"
metadata:
  node_type: memory
  type: project
  originSessionId: a7252630-2217-4120-a4d4-d624bcd2935a
  modified: 2026-10-19T09:22:12.585Z
---

On 2026-10-19 around 11:20 the user asked to "quickly finish the frontend as a sample so I show the boss how it looks". I told them the real screens can't be finished quickly, because they need back-end parts that are months away, and built a clickable prototype instead.

**What and where:**
- **Location:** `C:\Users\Surface\hms-demo\frontend`, a copy of the design-system workspace (wp/0.7 at 5438e9e plus the uncommitted demo route), copied from the preview snapshot `%TEMP%\hms-preview\snap2`.
- **App:** `apps/demo` (package `@hms/demo`), a copy of apps/web.
- **Setup:** `.tools` is a junction to the project toolchain; pnpm was installed offline.
- **Contents:** synthetic data only, the real PatientBanner, sign, command palette and density components, and en/ckb/ar text (ckb and ar AI-drafted, unreviewed).
- **Build:** workflow `wf_66c543d9-ca3` (hms-boss-demo). A scaffold agent writes the frame, the shared data in `src/proto/data`, the useT i18n hook, ui helpers and `CONTRACT.md`. Then 7 screen builders (home+admin, patients+outpatient, chart, orders+emar, lab, ward, billing) work in `src/proto/screens/<id>/`. Then an integrator type-checks, builds, does an RTL pass and writes `README.md` with the demo script.
- **Run it:** `cd C:\Users\Surface\hms-demo\frontend\apps\demo; ..\..\node_modules\.bin\vite --host 127.0.0.1 --port 5200`.
- **Protection:** auto-committed locally every 10 minutes by the auto-save ([[autosave]]).

**Extension "A to Z" (19 Oct ~12:25):** the user said the team is urgently waiting and asked for the frontend "fully from A to Z right now".
- I pre-wired 18 more screens as stubs with `%TEMP%\hms-demo\prewire.py`: screens.ts, routes.tsx, the nav groups (hospital, services, record, finance, management, system), shell group labels, and the catalogue keys `proto.nav.*` in packages/i18n.
- I delegated them across the three spare accounts, using the brief at `%TEMP%\hms-demo\ext-brief.md`:
  - A7a, `hms-demo-ext-a7a-1`: appointments, emergency, nursing, theatre, icu, maternity.
  - Ahmad@, `hms-demo-ext-ahmad-1`: labworklist, radiology, pharmacy, bloodbank, inventory, cashier.
  - mi, `hms-demo-ext-mi-1`: insurance, dashboard, quality, staff, reports, messaging.
- Each builder writes only in its own screen folders and `data/ext/*`.
- The dev server now runs on :5200 (background task); the old :5199 preview was stopped.
- When the builders and workflow wf_66c543d9-ca3 finish: type-check the whole app, build, screenshot all 28 screens in en/ckb/ar, fix, and update README.md's demo script.

**Why:** the user's boss needs to see what the product will look like. Keep the prototype separate from the real build and honest: it is labelled prototype, synthetic data, not for clinical use.

**How to apply:**
- It is not evidence of anything and not part of the product. Never copy prototype code into the repo without the spec-first process.
- Sharing it beyond this laptop (hosting it, uploading it) needs the user's OK.
