# @hms/demo: HMS Kurdistan clickable prototype

Throwaway demo for management, outside the product repository. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.

- Prototype code: `src/proto/` (shell, shared UI helpers, synthetic data, i18n helpers, one folder per screen).
- Uses the real design system (`@hms/design-system`: PatientBanner, sign pattern, command palette, density,
  locale provider, modal stack) and the real patient-context machine (`@hms/ui-core`).
- Contract for screen builders: `C:\Users\Surface\hms-demo\CONTRACT.md`.

    ../../node_modules/.bin/tsc --noEmit -p .   type-check
    ../../node_modules/.bin/vite build          static build in dist/
    ../../node_modules/.bin/vite                dev server, http://127.0.0.1:5200 (loopback only)
