# Known Limitations and Open Questions

Confidence levels below follow the project's epistemic rules: Confirmed (directly observed), Likely (strong inference), Possible (plausible, needs verification).

## 1. STL seasonal decomposition is deferred

The original TypeScript `seasonalDecomposition.ts` performs STL (Seasonal-Trend decomposition using Loess) on the daily queue-depth series. Tines formulas do not expose a native STL primitive and the iterative loess smoothing required is not practical to express in a formula chain.

- **v1 behavior:** `soc-compute-projections` ships linear regression only. The Projections Page shows a banner stating this.
- **Escape hatch (if needed):** add a `soc-compute-projections-seasonal` story that POSTs the time series to an external statistics microservice (Flask + statsmodels, Python) and feeds the decomposition output back into `soc_metrics_cache.projections`. That is explicitly out of scope for this plan since the plan is Tines-only.
- **Confidence:** Confirmed that STL is not formula-expressible in a useful way. Likely that linear regression is sufficient for the first SOC user's needs (Confirmed only by shipping).

## 2. Tines Resource size limit

The Tines-documented Resource maximum size is tenant-specific (Likely 1 MB in standard tenants; not a published universal number).

- **Mitigation:** the sync story enforces a 900 KB soft budget on `soc_tickets_cache`. Above that, it writes to shard Resources (`soc_tickets_cache_shard_001`, ...) and the primary Resource holds only a manifest.
- **What this affects:** 10k tickets at ~200 bytes average is ~2 MB, so any tenant with >4.5k tickets in the rolling window will end up sharded. Compute stories iterate shards transparently.
- **Open question:** the hard ceiling of sharding (how many shards one Tines tenant supports in aggregate) is not documented. Likely not a problem below 20 shards. Possible that very active tenants hit it.

## 3. No real-time progress events

The Tauri app emitted `sync:progress` and `sync:complete` events during a sync run. Tines does not offer an SSE / WebSocket analog to stream progress into a Page.

- **v1 behavior:** the Setup Page polls `soc_settings.last_sync_status` and `last_sync_completed_at` every few seconds while a sync runs. The user sees a spinner and a "running" badge, then "ok" on completion.
- **Confidence:** Confirmed. Polling is the standard Tines-Page pattern for long-running stories.

## 4. Jira cursor paging cap

The Rust app capped sync at 10,000 issues (`JIRA_MAX_ISSUES`). The Tines sync story mirrors this.

- **Behavior:** after 10k issues the sync story stops and sets `last_sync_status = "truncated"`. The Setup Page surfaces this.
- **To raise the cap:** edit `soc-jira-sync` to change the `max_issues` constant at the top of the story's first Event Transformation agent. This is the only place the value lives in the Tines side.

## 5. Jira rate limiting

Atlassian rate-limits the `/search/jql` endpoint. The Rust app used a 200 ms delay between pages.

- **v1 behavior:** `soc-jira-sync` includes a Trigger agent in the paging loop that delays 200 ms between HTTPRequest invocations.
- **Confidence:** Likely sufficient for standard tenants. Possible that large single-page responses with `expand=changelog` trigger throttles even with this delay. If we see 429 responses in practice, the story's retry-with-backoff branch handles it (already modeled on the tuckner throttle example story).

## 6. Business hours and holidays

The TypeScript code pulled US federal holidays from `src/ledger/holidays.ts` and used a configurable business-hours window.

- **Business hours** are stored in `soc_settings.business_hours` and are configurable via the Setup Page.
- **Holidays** are currently hardcoded as a list inside `soc-compute-capacity-shift`'s first Event Transformation agent, covering the next three calendar years (2026 through 2028). The list is refreshed by editing the story. Likely acceptable for v1; a cleaner design would store holidays in their own Resource.

## 7. Page calendar grid renders via HTML template

Tines Pages do not have a native calendar-grid component. The Calendar Page renders a six-by-seven grid via a Markdown/HTML component whose body is a formula template with `<for>` loops over a pre-computed 42-cell array.

- **Limitation:** styling is inline CSS; any theming change requires editing the template formula.
- **Possible improvement:** a Tines-marketplace calendar component may land in a future Tines release; until then, the HTML-template approach is the Confirmed path.

## 8. Ticket drill-down

The Tauri Calendar chapter opened a slide-out with every ticket created on a day. In Tines, clicking a day cell navigates to a filtered Watch Status Page view keyed by date. Confirmed behavior; the day-to-list drill uses a Page URL query parameter read by the Watch Status Page's filter formula.

## 9. Credential rotation has no self-service path

Rotating the Jira API token is a Tines-UI action on the `jira_basic_auth` Credential. No Page flow exposes it. Deliberate: the Pages are end-user UI; credentials are admin-surface.

## 10. Single project per tenant

This matches the original app. Multi-project would require every Resource to become project-keyed at the outer level and every story to take a `projectKey` parameter. Not in scope for v1.

## 11. Formula runtime coverage

Every formula referenced in `metric-mapping.md` is documented as Confirmed in `../tines-formulas-reference.md`. If the tenant's formula runtime reports one as unavailable (e.g. `PERCENTILE` is missing from some older Tines versions), the fallback is:

- **`PERCENTILE` missing:** implement via SORT + index math: `SORTED[FLOOR(p * (COUNT - 1) / 100)]`.
- **`GROUP_BY` missing:** implement via `REDUCE` accumulating a keyed object.
- **`MAP2` missing:** implement via `MAP_LAMBDA` over indices (`RANGE(0, COUNT(x))`).

`compute-*` stories should include a small "formula-capabilities" probe agent at the top that exits with a useful error if a required primitive is missing.
