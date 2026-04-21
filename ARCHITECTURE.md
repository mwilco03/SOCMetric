# SOCMetric on Tines: Architecture

Version 1. Target schema: Tines story `schema_version` 18 (matches the caldera example export we validated against). All artefacts import-and-run inside a single Tines tenant.

## Goals

1. Replace the Tauri + Rust + React + SQLite desktop app with a fully Tines-hosted dashboard.
2. Preserve every metric the TypeScript engines computed, field for field, with one deferred exception called out below.
3. Ship nothing outside a Tines tenant. No external host, no companion service, no external storage.

## Non-goals

- Multi-tenant, multi-project single-tenant. Scope is one project per tenant installation, matching the original app's single-project assumption.
- Real-time streams. Sync runs on a schedule, not WebSocket push.
- Client-side computation. The Tines Pages renderer shows values, it does not compute them.
- User-facing Jira credential management. That stays an admin-only Tines-UI task.

## Runtime topology

```
Tines tenant
├── Credentials
│   └── jira_basic_auth            type: HTTP Basic (email + api_token). Admin-configured once.
│
├── Resources (Tines key-value Resources, JSON-object type)
│   ├── soc_settings               { project_key, sync_interval_minutes, date_range_days, first_sync_completed_at }
│   ├── soc_status_map             { "<projectKey>:<statusName>": "queue"|"active"|"done"|"blocked" }
│   ├── soc_label_config           { "<label>": true|false }
│   ├── soc_day_annotations        { "YYYY-MM-DD": "<note text>" }
│   ├── soc_tickets_cache          { last_synced_at, project_key, total, tickets: [ TicketRow, ... ] }
│   ├── soc_tickets_cache_shard_N  (optional; created on-demand by sync story if primary exceeds byte budget)
│   └── soc_metrics_cache          { computed_at, headline, flow, speed, capacity, patterns, projections, calendar }
│
├── Stories
│   │   (data ingest)
│   ├── soc-jira-sync
│   ├── soc-jira-discover-projects
│   ├── soc-jira-discover-statuses
│   │   (compute)
│   ├── soc-compute-all-metrics
│   ├── soc-compute-headline
│   ├── soc-compute-flow-lead-time
│   ├── soc-compute-response-speed
│   ├── soc-compute-capacity-shift
│   ├── soc-compute-patterns-recurrence
│   ├── soc-compute-projections
│   ├── soc-compute-calendar-view
│   │   (state CRUD)
│   ├── soc-settings-crud
│   ├── soc-status-map-crud
│   ├── soc-labels-crud
│   ├── soc-annotations-crud
│   └── soc-reset
│
└── Pages
    ├── SOC Dashboard Home
    ├── Calendar
    ├── Watch Status
    ├── Flow
    ├── Response Speed
    ├── Capacity
    ├── Patterns
    ├── Projections
    ├── Context Ledger
    └── Setup
```

## Data flow

### Sync path (scheduled)

1. `soc-jira-sync` fires on schedule. Default interval: 60 minutes. Overridable via `soc_settings.sync_interval_minutes`.
2. Reads `soc_settings.project_key`. If unset, exits with a no-op.
3. Computes the date window: `[now - soc_settings.date_range_days, now]`. Default window: 90 days.
4. Calls `POST https://<<CREDENTIAL.jira_basic_auth.domain>>/rest/api/3/search/jql` with a JQL of `project = "<project_key>" AND created >= "<start>" AND created <= "<end>" ORDER BY created ASC`, `expand=changelog`, `fields=summary,status,issuetype,priority,assignee,reporter,labels,components,created,updated,resolutiondate`, `maxResults=100`. Auth: HTTP Basic from the `jira_basic_auth` credential.
5. Cursor-pages using `nextPageToken` until `isLast == true` or `total_fetched >= 10000`. Pattern lifted from `tines-story-examples/tuckner-example-stories/common__paging__export.json`.
6. Each issue is normalized to the flat `TicketRow` shape inside an Event Transformation agent. The changelog is filtered to status-change entries only and re-serialized into `changelog_json`.
7. When the accumulated JSON would push `soc_tickets_cache` past the Resource byte budget, the sync story flips into sharded-write mode: writes `soc_tickets_cache_shard_001`, `_002`, and so on. The primary Resource stores `{ shards: N, last_synced_at, ... }` as a manifest.
8. On successful sync, the story fires a "Send to Story" into `soc-compute-all-metrics`.

### Compute path

1. `soc-compute-all-metrics` reads the manifest and (optionally) every shard, concatenates the tickets, and broadcasts the combined payload to each `compute-*` sub-story via "Send to Story".
2. Each sub-story runs its formula chain (see `docs/metric-mapping.md`), returns a JSON object shaped like the matching slice of `soc_metrics_cache`.
3. The parent story collects sub-story outputs, merges them, and writes the whole `soc_metrics_cache` Resource in a single operation.

### Read path (Pages)

Pages bind their components to `RESOURCE.soc_metrics_cache.<slice>` and `RESOURCE.soc_day_annotations`. No Page triggers a compute directly; all computed values come from the cache Resource. Pages can trigger CRUD stories (status-map, labels, annotations, settings) which write back to the matching Resource and optionally re-run compute.

## Why this shape, and what it buys us

- **One cache per slice** keeps Page reads cheap and eliminates per-view compute. Tines Pages do not have a natural "compute on render" hook; the cache is the contract.
- **Sharded tickets cache** keeps us inside per-Resource byte budgets without giving up "all history in one place."
- **Compute fan-out** makes each metric slice independently reviewable, diffable, and reproducible. Swapping `compute-response-speed` is a one-file change.
- **Scheduled sync + pull-based Pages** means the whole stack works even if nobody is looking at the dashboard. Cache is always warm.

## Credential handling

Jira credentials are a single Tines HTTP Basic Credential named `jira_basic_auth`, configured once via the Tines UI by the admin. Stories reference it as `<<CREDENTIAL.jira_basic_auth.email>>` and `<<CREDENTIAL.jira_basic_auth.api_token>>` and the domain is stored adjacent on the Credential record (or as `soc_settings.jira_domain`; `DEPLOYMENT.md` pins the choice for the tenant you deploy into).

Under no circumstance does a Page or story expose the token or allow an end user to rotate it. A rotation is a Tines-UI action on the Credential.

## Metric coverage

See `docs/metric-mapping.md` for the full per-module mapping. Summary table:

| Source TS module | Compute story | Formulas in use |
|---|---|---|
| headlineMetrics.ts | soc-compute-headline | FILTER, COUNT, PERCENTILE, AVG |
| leadTimeDecomposition.ts | soc-compute-flow-lead-time | MAP_LAMBDA, DATE_DIFF, PERCENTILE |
| ticketAging.ts | soc-compute-flow-lead-time | FILTER, DATE_DIFF, IF/CASE bucketing |
| shiftMetrics.ts | soc-compute-capacity-shift | GROUP_BY, COUNT, AVG on time-of-day |
| clusterAnalysis.ts | soc-compute-patterns-recurrence | REGEX_REPLACE, GROUP_BY, COUNT, DATE_DIFF |
| incidentImpact.ts | soc-compute-headline (+dedicated slice) | windowed FILTER + AVERAGE |
| closureIntegrity.ts | soc-compute-flow-lead-time | transition-count + nested IF |
| closureBurst.ts | soc-compute-response-speed | sort + windowed COUNT + threshold |
| afterHours.ts | soc-compute-capacity-shift | HOUR_OF_DAY, DAY_OF_WEEK |
| workingHours.ts | inline helper | DATE_DIFF minus weekends/holidays |
| staffingModel.ts | soc-compute-capacity-shift | nested IF on queue + TTFT trend |
| recurrenceEngine.ts | soc-compute-patterns-recurrence | REGEX_REPLACE + GROUP_BY |
| dimensionEngine.ts | inline helper | UNIQUE on dimensions |
| projectionEngine.ts | soc-compute-projections | linear regression via REDUCE |
| seasonalDecomposition.ts | (deferred, see limitations.md) | not implemented in v1 |
| entityNormalizer.ts | soc-compute-patterns-recurrence helper | REGEX_REPLACE chain |
| useCalendarData.ts | soc-compute-calendar-view | GROUP_BY on DATE(created), COUNT, top-N labels |

## Schema versions

- Stories written to `schema_version: 18`, matching the validated caldera export. Tines imports older schemas; if the tenant requires newer, re-export from the tenant after first import.
- Pages: schema is the Page-export schema used by the tenant. `DEPLOYMENT.md` lists the exact header we target.
- Resources: no version header; the Resource JSON is the content.

## Progress

Track per task in the repo. At the moment of this document's first write: plan approved, directory scaffolded, documentation underway, story and page JSON authoring next.
