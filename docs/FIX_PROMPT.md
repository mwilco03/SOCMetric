# SOC Dashboard Remediation

Working dir: `soc-dashboard/`. Fixes grouped by file.

## `.gitignore` (NEW FILE)
- [ ] Create with `node_modules/`, `dist/`, `target/`, `*.log`, `.DS_Store`
- [ ] Untrack anything already committed: `git rm -r --cached node_modules/ dist/ target/`

## `src-tauri/tauri.conf.json`
- [ ] `:23` — remove `'unsafe-inline'` from `style-src` CSP
- [ ] `:28` — add `"appimage"` to bundle targets, current list fails on Linux
- [ ] `:29-34` — create `src-tauri/icons/` with `32x32.png`, `128x128.png`, `icon.icns`, `icon.ico` (missing, build fails)

## `src-tauri/Cargo.toml`
- [ ] Remove unused `serde`, `serde_json` deps
- [ ] Decide: strip `tauri-plugin-http` (client-only) or build real `#[tauri::command]` handlers

## `src-tauri/src/main.rs`
- [ ] 8 lines, zero commands, zero state — either document as intentionally empty or implement backend for cred handling

## `vite.config.ts`
- [ ] `:10` — replace `__dirname` with `fileURLToPath(new URL('.', import.meta.url))`

## `package.json`
- [ ] `:18` — `npm uninstall axios` (declared, never imported)

## `src/constants.ts` (NEW FILE)
- [ ] Extract: `HTTP_TIMEOUT_MS = 30000` (from `jiraClient.ts:34`, `httpClient.ts:38`)
- [ ] Extract: `JIRA_PAGE_SIZE = 100` (from `jiraClient.ts:76,100`)
- [ ] Extract: `JIRA_MAX_ISSUES = 10000` (from `jiraClient.ts:109`)
- [ ] Extract: `JIRA_RATE_LIMIT_DELAY_MS = 200` (from `jiraClient.ts:110`)
- [ ] Extract: `MAX_WORKING_DAYS_CAP = 400` (from `workingHours.ts:76`)
- [ ] Extract: `DEFAULT_DATE_RANGE_DAYS = 14` (from `dashboardStore.ts:91`)

## `src/api/jiraClient.ts`
- [ ] `:19` — validate domain matches `*.atlassian.net` before sending creds
- [ ] `:34` — replace `30000` with `HTTP_TIMEOUT_MS`
- [ ] `:76,100` — replace `100` with `JIRA_PAGE_SIZE`
- [ ] `:109` — replace `10000` with `JIRA_MAX_ISSUES`
- [ ] `:110` — replace `200` with `JIRA_RATE_LIMIT_DELAY_MS`

## `src/api/httpClient.ts`
- [ ] `:38` — replace `30000` with `HTTP_TIMEOUT_MS`

## `src/vault/encryption.ts`
- [ ] `:4` — raise `PBKDF2_ITERATIONS` from `100000` to `600000`

## `src/vault/vaultManager.ts`
- [ ] `:3` — export `VAULT_KEY` so other files can import it

## `src/utils/dateUtils.ts`
- [ ] `:17` — add `if (start > end) return [];` (reversed range = infinite loop)

## `src/metrics/headlineMetrics.ts`
- [ ] `:54` — remove unused `_dateRange` param
- [ ] `:140,147` — replace `.get(date)!` with null check: `if (!stats) continue;`

## `src/metrics/workingHours.ts`
- [ ] `:76` — replace `400` with `MAX_WORKING_DAYS_CAP`

## `src/store/dashboardStore.ts`
- [ ] `:70` — replace `'America/New_York'` with `Intl.DateTimeFormat().resolvedOptions().timeZone`
- [ ] `:91` — replace `14` with `DEFAULT_DATE_RANGE_DAYS`; recalculate date range on hydration
- [ ] Add persist `version` + `migrate` function for schema changes

## `src/hooks/useMetrics.ts`
- [ ] `:60` — change `fetchedIssues ?? storeIssues` to `fetchedIssues ?? storeIssues ?? []`
- [ ] `:157` — remove unused `ledgerEvents` from useMemo deps

## `src/hooks/useLocalStorage.ts`
- [ ] `:25` — replace `instanceof Function` with `typeof value === 'function'`

## `src/hooks/useWindowSize.ts`
- [ ] `:33` — debounce the resize handler

## `src/components/shared/TicketTable.tsx`
- [ ] `:53` — replace `https://jira/browse/` with `https://${config.domain}/browse/`

## `src/components/shared/ExportButton.tsx`
- [ ] `:60-82` — delete unused `exportMetricsToCSV()` and `convertToCSV()`

## `src/components/chapters/CapacityChapter.tsx`
- [ ] `:20-45` — `staticRolloverData`/`staticAgingData` are fake. Implement or show "Not Implemented" placeholder
- [ ] `:54` — verdict key doesn't match `VERDICT_STYLES` keys, fix alignment

## `src/components/chapters/PatternsChapter.tsx`
- [ ] `:12-19` — `staticCategoryData` is fake. Implement or show placeholder

## `src/components/chapters/ProjectionsChapter.tsx`
- [ ] `:64` — "full modeling not implemented" hidden in comment, add user-visible indicator

## `src/components/discovery-ui/SetupWizard.tsx`
- [ ] `:72` — import `VAULT_KEY` from `vaultManager.ts` instead of hardcoding `'soc_dashboard_vault'`
- [ ] `:192` — raise min passphrase from 8 to 12 chars

## `README.md`
- [ ] `:72` — fix path from `/root/soc-dashboard` to actual location

## Empty dirs
- [ ] `src/dimensions/`, `discovery/`, `ledger/`, `narrative/`, `staffing/`, `components/ledger-ui/` — add `.gitkeep` or delete

## Validate
```bash
npm run build && npm run tauri build && npm run test
```
