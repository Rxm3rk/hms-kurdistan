# HMS Kurdistan clickable prototype: extra screens brief

**What this is.** HMS Kurdistan is a hospital management system for private hospitals in the Kurdistan Region of Iraq. The UI is in English, Sorani Kurdish (ckb) and Arabic (ar); ckb and ar are right-to-left. The human lead's team and boss are waiting urgently for a complete clickable frontend prototype covering every module "from A to Z". It runs with synthetic data only and has no backend. It is labelled as a prototype and is not for clinical use.

**Where.** `C:\Users\Surface\hms-demo\frontend`, a pnpm workspace that is its own local git repo; the app is `apps/demo` (React 19, TypeScript, Vite, TanStack Router, react-aria-components, react-intl).
- The 10 original screens are being finished right now by other agents: home, patients, outpatient, ward, chart, orders, emar, lab, billing, admin. **Do not edit them.**
- 18 extra screens were pre-wired by the lead as stubs: routes, navigation, nav labels and catalogue keys are already done. You replace the stubs assigned to you.

## Your job
For each screen assigned to you, replace the stub in `apps/demo/src/proto/screens/<id>/` with a complete, polished, realistic screen:
- Edit `index.tsx` (keep the exported component name), `messages.ts` and `<id>.css`.
- Add any number of new files inside that same folder.
- Put the screen's synthetic data in NEW files under `apps/demo/src/proto/data/ext/` (for example `data/ext/<id>.ts`).
- Import shared data from `apps/demo/src/proto/data/index.ts`: patients (SYN-PAT-…), staff, wards, departments, clinics, the demo clock and billing.

**Read first:**
- `src/proto/i18n/use-t.ts` (the messages pattern) and `src/proto/i18n/format.ts` (money, dates, ages).
- `src/proto/ui/index.ts`, the UI kit: PageHeader, StatTile, DataTable, Tabs, Badge, Button, Dialog, fields, charts, toast, person, quantity. Icons are in `ui/icons.tsx`; use existing icon names only.
- `src/proto/shell/index.ts`, `shell/navigation.ts` (`useGoTo`, `useScreenHref`, `useSearchParam`) and `shell/screens.ts` (all ScreenIds; link to other screens with them).
- `src/proto/data/types.ts` and `data/index.ts`.
- Look at one finished original screen for the visual style, without editing it.

**Quality bar.** Each screen should look like a real module of a modern commercial hospital system:
- **Header:** the page header and 3–5 KPI tiles.
- **Worklist:** a main worklist or table with 12–30 realistic rows, with filters, tabs and a search box where they make sense.
- **Detail:** clicking a row opens a detail panel or dialog.
- **Actions:** primary actions work in memory (React state, a toast on save, statuses that change), with status badges and empty states.
- **Coherence:** link to related screens through `useGoTo` (for example, from a patient row to their chart: `goTo('chart', { patient: id })`).

**Kurdistan realism (synthetic).**
- Dual currency: IQD and USD with a visible exchange rate.
- Places: Erbil, Sulaymaniyah and Duhok.
- Names: Kurdish and Arabic names in native script with a Latin transliteration.
- The weekend is Friday.
- Statutory items: KRG and MOH forms and returns.
- Payers: local corporate and NGO payers and insurers, all with invented names.
- Drug names, units and lab codes are always in Latin script.

**Languages.**
- Every visible string comes from `messages.ts`, in en, ckb and ar. `defineMessages` enforces matching keys.
- Use ICU plurals, including the Arabic plural categories.
- Add the header comment "AI-drafted ckb and ar, unreviewed."
- CSS uses logical properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`), never left or right.
- Format numbers, money and dates with `useFormat()`.

**Boundaries.**
- Do not edit any file outside your own screen folders and your own new `data/ext/*` files: not ui/, shell/, i18n/, the original data files, packages/, or other screens.
- If you need something shared, build it locally inside your own folder and mention it in your report.
- Never touch `C:\Users\Surface\.t3\` (the real product repo).
- No git commands that write; the lead's auto-save commits this folder every 10 minutes.
- No downloads or package installs.
- Never run `find /` or any whole-drive search; search only inside `C:\Users\Surface\hms-demo`.
- Don't start Vite or a browser (the lead takes the screenshots).
- This laptop is short on memory: at most 3 helper agents at a time, each owning whole screen folders.

**Done means:**
- `apps/demo` type-checks with no errors in your files. Run it through the limiter:
  `sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh demo-tsc-<yourname> sh -c 'cd /c/Users/Surface/hms-demo/frontend/apps/demo && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json'`
- Errors in other folders belong to other builders: ignore them, but report them if they block you.
- Aim to finish within about 60–90 minutes. A complete, solid screen beats an ambitious half-screen.

**Final report (your last message):** for each screen, what it shows and what can be clicked; the tsc result for your files; anything the lead must wire or fix in shared files.
