# Known Bugs and Issues

## Data Layer (14 items)
1. **Sequential project fetching** — fetches one project at a time instead of Promise.all
2. **Settings not persisting** — Zustand persist version not bumped, selectedProjectKeys missing from partialize (partially fixed, needs persist version bump)
3. **Headcount buried** — hidden inside shift editor, need to click "edit" to see it
4. **No loading progress** — spinner says "Loading..." with no ticket count or page number
5. **No persistent cache** — closes app, reopens, fetches everything again from scratch
6. **Wizard initial pull** — dashboard empty after setup, no immediate data pull
7. **Tickets grow right** — no incremental fetch, re-fetches everything on date range change
8. **Click no response** — buttons/actions have zero visual feedback
9. **Background data fetching** — UI blocks during fetch, user can't navigate
10. **No breadcrumbs** — at Capacity page with no context of where you are
11. **+/- 0.0 meaningless** — KPI delta badges show when there's nothing to compare
12. **TTFT undefined** — acronym used without being spelled out
13. **Historical data mining** — no way to pull more than the current date range
14. **Project settings cascade** — adding a project doesn't trigger discovery/classification/fetch

## API Issues
- `/rest/api/3/search` endpoint removed by Atlassian (410 Gone) — migrated to `/search/jql`
- Tauri HTTP plugin body handling: string body works, parsed object doesn't
- `__TAURI__` global detection fails in Tauri v2 production builds
- No error detail surfacing — 400 errors showed generic message, not Jira's response

## UI/CSS Issues (from audit agents)
- Z-index conflicts across 7 overlay components (all z-40/z-50)
- 15+ accessibility gaps (missing aria-labels, no focus traps, no keyboard nav)
- Empty state height inconsistency (80px vs 280px)
- Color contrast failures on gray-500 text
- TicketTable renders all rows on expand (no pagination — fixed with incremental load)
- ProgressBar track barely visible
- Toast behind panels (same z-level — fixed to z-60)
- Modal missing aria-labelledby
- No responsive sidebar collapse (fixed with chevron toggle + auto-collapse at 1024px)

## Performance Issues
- `shiftMetrics.ts` O(n*d*s) triple loop — 2.7M iterations for 90 days (fixed to O(n+d*s))
- `clusterAnalysis.ts` O(n²) per cluster for recurrence detection
- `useMetrics` useMemo recomputes on any store change due to object identity

## Resolved in Current Codebase
- [x] .gitignore created
- [x] Tauri icons generated
- [x] Domain validation + normalization (strips https://, trailing slashes)
- [x] Infinite loop guard on reversed date range
- [x] Non-null assertions replaced with null checks
- [x] Flow efficiency formula fixed
- [x] PSI uses P85, isReliable uses sample size
- [x] Wasted work ratio weighted by hours
- [x] 4-signal staffing verdict
- [x] Sigma-based KPI coloring
- [x] Lead time decomposition (3 phases)
- [x] Ticket aging + stalled detection for open queue
- [x] Cluster analysis with automation tiers
- [x] All stubs replaced with real computed data
- [x] Panel mutual exclusivity
- [x] Focus traps on SlideOut/BottomSheet
- [x] Sidebar collapsible
- [x] 42 magic number violations fixed
- [x] Migrated to /search/jql endpoint
- [x] Tauri HTTP body fix (pass string, not parsed object)
