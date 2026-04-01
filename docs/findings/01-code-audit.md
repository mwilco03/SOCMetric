# Code Audit Findings

## Initial Review (Surface Level)
- No `.gitignore` — node_modules at risk of being committed
- Missing Tauri icon assets — build fails
- Hardcoded `https://jira/browse/` — broken ticket links
- Infinite loop on reversed date range in `getDateRangeArray`
- Non-null assertions on `Map.get()` in headlineMetrics
- `undefined` array access in useMetrics
- Bundle targets wrong for Linux (dmg/msi/nsis only)
- No domain validation on Jira URL construction
- Vault key duplicated as string literal
- Static placeholder data displayed as real metrics in 3 chapters
- Unused axios dependency
- PBKDF2 iterations too low (100k, should be 600k)
- Minimum passphrase too short (8 chars)
- CSP allows `unsafe-inline` styles
- No timeout on vault save

## Code Enforcement Audit (42 violations)
### Critical
- 7 HTTP status codes as magic numbers (401, 403, 429, 400)
- 13 type safety holes (`as unknown as`, non-null assertions, `filter(Boolean) as number[]`)
- Hardcoded hex colors used as business logic data
- No try-catch in useMetrics useMemo — one throw kills all metrics

### Medium
- 12 magic numbers in staffingModel, incidentImpact, closureBurst, chapters
- Hardcoded strings: 'application/json', 'content-type', field names
- 3 missing error handling points

### Low
- 3 unused parameter patterns
- 4 inconsistent export patterns
- 2 circular dependency risks

## Logic Bugs Found
- `clusterAnalysis.ts:92` — netVelocity formula always negative (closedCount - totalCount)
- `closureIntegrity.ts:92` — churn counter increments on first activation (should only count re-activations)
- `staffingModel.ts:49-54` — PSI used median instead of P85
- `staffingModel.ts:61` — isReliable was inverted
- `useMetrics.ts:113` — flow efficiency formula wrong (P85-P50 spread, not active/total)
- `PatternsChapter.tsx:22` — wasted work ratio counted tickets, not work hours
- `shiftMetrics.ts` — O(n*d*s) triple-nested loop, 2.7M iterations for 90d×3shifts×10k issues

## API Bugs Found
- `/rest/api/3/search` endpoint REMOVED by Atlassian (410 Gone) — must use `/search/jql`
- New endpoint requires: expand as comma-delimited string (not array), nextPageToken pagination (not startAt), no validateQuery parameter
- `httpClient.ts` — `JSON.parse(options.body)` was converting stringified JSON back to object, Tauri fetch needs string body
- `__TAURI__` detection fails in Tauri v2 production builds
- `getProjects()` didn't paginate — capped at 50 projects
- JQL double-quoted project keys (both formats valid, but unnecessary)
