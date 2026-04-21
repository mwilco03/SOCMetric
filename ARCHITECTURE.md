# SOCMetric on Tines: Architecture

Version 1. Target schema: Tines story `schema_version` 28, `standard_lib_version` 90, `action_runtime_version` 74 (matches the auto-action-collection and crowdstrike-secure exports validated against a live tenant). All artefacts import-and-run inside a single Tines tenant.

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
│   ├── jira_basic_auth            type: HTTP Basic (email + api_token). Admin-configured once.
│   └── tines_api_token            type: HTTP Token (or Text). Token for the Tines tenant's own
│                                  /api/v1/global_resources endpoint. Scope: global_resources:write.
│
├── Resources (Tines key-value Resources, JSON-object type)
│   ├── soc_settings               { project_key, sync_interval_minutes, date_range_days, first_sync_completed_at }
│   ├── soc_status_map             { "<projectKey>:<statusName>": "queue"|"active"|"done"|"blocked" }
│   ├── soc_label_config           { "<label>": true|false }
│   ├── soc_day_annotations        { "YYYY-MM-DD": "<note text>" }
│   ├── soc_tickets_cache          { last_synced_at, project_key, total, tickets: [ TicketRow, ... ] }
│   ├── soc_tickets_cache_shard_N  (optional; created on-demand by sync story if primary exceeds byte budget)
│   ├── soc_metrics_cache          { computed_at, headline, flow, speed, capacity, patterns, projections, calendar }
│   └── soc_tines_api              { domain, user_email, resource_ids: { soc_settings: 111, ... } }
│                                  Bootstrap map the stories use to find each Resource's numeric ID
│                                  when writing back via the Tines /api/v1/global_resources endpoint.
│
├── Stories (3 total)
│   ├── soc-data       Scheduled entry drives the Jira sync on cron.
│   │                  Webhook entry dispatches on body.action:
│   │                  sync_now, discover_projects, discover_statuses,
│   │                  settings_op, status_map_op, labels_op, annotations_op.
│   ├── soc-compute    Inlines all 7 metric slices sequentially, writes soc_metrics_cache.
│   │                  Triggered by soc-data after a successful sync.
│   └── soc-reset      Admin-only destructive reset. Kept standalone for audit clarity.
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

### Sync path (scheduled or on-demand)

1. The `Scheduled start` action inside `soc-data` fires on schedule (default hourly), OR a Page button posts `{action: "sync_now"}` to the `soc-data` webhook. Both feed the same `Sync entry` action.
2. Reads `soc_settings.project_key`. If unset, the gate exits with a no-op.
3. Computes the date window: `[now - soc_settings.date_range_days, now]`. Default window: 90 days.
4. Calls `POST https://<jira_domain>/rest/api/3/search/jql` with a JQL of `project = "<project_key>" AND created >= "<start>" ORDER BY created ASC`, `expand=changelog`, `fields=summary,status,issuetype,priority,assignee,reporter,labels,components,created,updated,resolutiondate`, `maxResults=100`. Auth: HTTP Basic from the `jira_basic_auth` credential.
5. Cursor-pages using `nextPageToken` until `isLast == true` or `total_fetched >= max_issues_per_sync`.
6. Each issue is normalized to the flat `TicketRow` shape inside an Event Transformation agent. The changelog is filtered to status-change entries only and re-serialized into `changelog_json`.
7. The accumulated JSON is written to `soc_tickets_cache` (inline mode). Sharded-write mode is scaffolded in `docs/limitations.md` for tenants with strict per-Resource byte budgets.
8. On successful sync, soc-data fires a "Send to Story" into `soc-compute`.

### Compute path

1. `soc-compute` reads `soc_tickets_cache` (handles sharded mode), plus `soc_status_map`, `soc_label_config`, `soc_settings`.
2. Seven sequential Event Transformation actions each compute one metric slice (headline → flow → speed → capacity → patterns → projections → calendar) per the formula chains in `docs/metric-mapping.md`.
3. A final Merge action assembles the full `soc_metrics_cache` payload and an HTTP action writes the Resource in a single operation.

### CRUD + discover paths

All Page-driven reads and writes hit the `soc-data` webhook with `{action, ...params}`. The entry webhook fans out into seven TriggerAgents, each matching one action:

- `discover_projects` → Jira `/project/search` → `{projects: [...]}` exit
- `discover_statuses` + `{project_key}` → Jira `/project/{key}/statuses` → `{discovered: [...]}` exit
- `settings_op` / `status_map_op` / `labels_op` / `annotations_op` + `{op: get|set|delete|bulk_set, key?, value?, mappings?}` → Resource read or write → `{value: ...}` exit
- `sync_now` → same pipeline as the scheduled entry

### Read path (Pages)

Pages bind their components to `RESOURCE.soc_metrics_cache.<slice>` and `RESOURCE.soc_day_annotations`. No Page triggers a compute directly; all computed values come from the cache Resource. Pages can trigger CRUD stories (status-map, labels, annotations, settings) which write back to the matching Resource and optionally re-run compute.

## Why this shape, and what it buys us

- **Three stories, not sixteen.** The earlier design split into 16 stories for per-metric diffability and fan-out parallelism. The current design trades those for operator simplicity: two imports instead of sixteen, no Send-to-Story reference cleanup, one action dispatcher instead of four CRUD endpoints.
- **One cache per slice** keeps Page reads cheap and eliminates per-view compute. Tines Pages do not have a natural "compute on render" hook; the cache is the contract.
- **Sharded tickets cache** keeps us inside per-Resource byte budgets without giving up "all history in one place."
- **Action-routed single webhook** means Pages only need to know one story slug (`soc_data`) plus the action name in the payload. No cross-story GUID plumbing.
- **Scheduled sync + pull-based Pages** means the whole stack works even if nobody is looking at the dashboard. Cache is always warm.

## Trade-offs we accepted by collapsing to 3 stories

- **Compute is sequential, not parallel.** The seven metric slices run one after another inside `soc-compute`. Swap back to fan-out only if the sequential runtime exceeds the Page-staleness tolerance.
- **One failing metric fails the whole compute run.** Previously each sub-story failed in isolation. Now a bad formula in one slice halts the write to `soc_metrics_cache`. Mitigation: the last known-good cache stays in place until the next successful run.
- **Per-metric diffs are harder.** A change to the headline formula shows up in the same file (`soc-compute.json`) as every other metric. Reviewers must scope by action name, not filename.

## Credential handling

Jira credentials are a single Tines HTTP Basic Credential named `jira_basic_auth`, configured once via the Tines UI by the admin. Stories reference it as `<<CREDENTIAL.jira_basic_auth.email>>` and `<<CREDENTIAL.jira_basic_auth.api_token>>` and the domain is stored adjacent on the Credential record (or as `soc_settings.jira_domain`; `DEPLOYMENT.md` pins the choice for the tenant you deploy into).

Under no circumstance does a Page or story expose the token or allow an end user to rotate it. A rotation is a Tines-UI action on the Credential.

## Metric coverage

See `docs/metric-mapping.md` for the full per-module mapping. Summary table:

All slices live inside `soc-compute` as sequential EventTransformation actions.

| Source TS module | Slice action in soc-compute | Formulas in use |
|---|---|---|
| headlineMetrics.ts | Compute headline | FILTER, COUNT, PERCENTILE, AVG |
| leadTimeDecomposition.ts | Compute flow | MAP_LAMBDA, DATE_DIFF, PERCENTILE |
| ticketAging.ts | Compute flow | FILTER, DATE_DIFF, IF/CASE bucketing |
| shiftMetrics.ts | Compute capacity | GROUP_BY, COUNT, AVG on time-of-day |
| clusterAnalysis.ts | Compute patterns | REGEX_REPLACE, GROUP_BY, COUNT, DATE_DIFF |
| incidentImpact.ts | Compute headline (dedicated slice) | windowed FILTER + AVERAGE |
| closureIntegrity.ts | Compute flow | transition-count + nested IF |
| closureBurst.ts | Compute speed | sort + windowed COUNT + threshold |
| afterHours.ts | Compute capacity | HOUR_OF_DAY, DAY_OF_WEEK |
| workingHours.ts | inline helper | DATE_DIFF minus weekends/holidays |
| staffingModel.ts | Compute capacity | nested IF on queue + TTFT trend |
| recurrenceEngine.ts | Compute patterns | REGEX_REPLACE + GROUP_BY |
| dimensionEngine.ts | inline helper | UNIQUE on dimensions |
| projectionEngine.ts | Compute projections | linear regression via REDUCE |
| seasonalDecomposition.ts | (deferred, see limitations.md) | not implemented in v1 |
| entityNormalizer.ts | Compute patterns helper | REGEX_REPLACE chain |
| useCalendarData.ts | Compute calendar | GROUP_BY on DATE(created), COUNT, top-N labels |

## Schema versions

- Stories written to `schema_version: 18`, matching the validated caldera export. Tines imports older schemas; if the tenant requires newer, re-export from the tenant after first import.
- Pages: schema is the Page-export schema used by the tenant. `DEPLOYMENT.md` lists the exact header we target.
- Resources: no version header; the Resource JSON is the content.

## Progress

Track per task in the repo. At the moment of this document's first write: plan approved, directory scaffolded, documentation underway, story and page JSON authoring next.
