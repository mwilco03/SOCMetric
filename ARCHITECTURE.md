# SOCMetric on Tines: Architecture

Version 1. Target schema: Tines story `schema_version` 28, `standard_lib_version` 90, `action_runtime_version` 75 (matches the actual tenant export of the merged soc-data story and the reference imports at `tines-story-examples/community-stories-historical/auto-action-collection.json` and `crowdstrike-secure.json`, confirmed to import cleanly via both the UI and the `/api/v1/stories/import` REST endpoint). All artefacts import-and-run inside a single Tines tenant.

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
├── Stories (1 total; ETL-layered internally)
│   └── soc-data       Single story with clean E/T/L separation:
│                      - EXTRACT entry (Scheduled): "Scheduled start"
│                        fires on cron, pulls Jira pages, writes
│                        soc_tickets_cache, terminates at "Mark sync ok".
│                      - TRANSFORM entry (Scheduled, independent cadence):
│                        "Transform schedule" fires on its own cron,
│                        reads soc_tickets_cache via "Load inputs",
│                        runs 7 compute slices, writes soc_metrics_cache.
│                      - OPERATIONS entry (Webhook, Page-driven):
│                        dispatches on body.action for CRUD
│                        (settings/status_map/labels/annotations),
│                        discover (projects/statuses), and manual
│                        sync_now. Not part of ETL.
│                      - LOAD: "Page action" FormAgent renders the
│                        dashboard by reading soc_metrics_cache. No
│                        compute in the render path.
│                      - Reset entry (Webhook): separate admin endpoint
│                        that wipes Resources by tier.
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

The story is an ETL pipeline with three independent layers sharing one Resource-backed cache.

### Extract (E) — Scheduled, standalone

1. The `Scheduled start` action fires on a cron attached in the UI (default hourly). No other trigger, no webhook path. Pages cannot start an extract — it is background-only.
2. Reads `soc_settings.project_key`. If unset, the gate exits with a no-op.
3. Computes the date window `[now - date_range_days, now]` (default 90 days) and builds a JQL for `project = <key> AND created >= <start> ORDER BY created ASC`, `expand=changelog`, `maxResults=<page_size>`.
4. Pages `POST /rest/api/3/search/jql` via the `jira_basic_auth` credential. Cursor-pages using `nextPageToken` until `isLast == true` or `total_fetched >= max_issues_per_sync`.
5. Each issue is flattened to the `TicketRow` shape; the changelog is filtered to status-change entries and re-serialized into `changelog_json`.
6. The accumulated array is written to `soc_tickets_cache` (inline mode) via the Tines `/api/v1/global_resources` endpoint.
7. `Mark sync ok` updates `soc_settings.last_sync_completed_at` / `last_sync_status` and the extract pipeline terminates. Extract does not trigger Transform; the layers are decoupled.

### Transform (T) — Scheduled, standalone, independent cadence

1. The `Transform schedule` action fires on its own cron (attach in UI; typical cadence is slightly behind Extract, e.g. hourly on the 5-minute mark).
2. `Load inputs` pulls `soc_tickets_cache`, `soc_status_map`, `soc_label_config`, and `soc_settings` from Resources.
3. Seven sequential Event Transformation actions compute one slice each (headline → flow → speed → capacity → patterns → projections → calendar) per the formulas documented in `docs/metric-mapping.md`.
4. `Merge results` assembles the full `soc_metrics_cache` payload and `Write metrics cache` persists it to the Resource in one PUT.
5. Transform reads the cached extract and writes the cached metrics. It does not call Jira and does not trigger any other flow.

### Load (L) — Pages Action, display-only

1. The `Page action` FormAgent exposes a Tines Pages URL at `/pages/<url_identifier>` with dashboard elements (metric cards, line/bar/pie charts, cluster table).
2. Every element's `value` / `content` / `data` binds directly to `RESOURCE.soc_metrics_cache.*` and `RESOURCE.soc_day_annotations`. The Page does not execute any compute or call out to Jira — it reads the warm cache.

### Operations (webhook) — separate from ETL

Page buttons (Setup page, Calendar annotations, etc.) post to the operations webhook with `{action, ...params}`. The webhook fans out into TriggerAgents that each route one action:

- `discover_projects` → Jira `/project/search` → `{projects: [...]}` response
- `discover_statuses` + `{project_key}` → Jira `/project/{key}/statuses` → `{discovered: [...]}` response
- `settings_op` / `status_map_op` / `labels_op` / `annotations_op` + `{op, key?, value?, mappings?}` → Resource mutate → `{value: ...}` response
- `sync_now` (optional manual override) → enters the Extract pipeline

Reset has its own webhook entry that wipes Resources by tier.

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

- Stories written to `schema_version: 23` (terraform-provider-tines testdata format). Tines imports older schemas into newer tenants; if your tenant requires a newer schema, re-export from the tenant after first import to pick up the current format.
- Pages: schema is the Page-export schema used by the tenant. `DEPLOYMENT.md` lists the exact header we target.
- Resources: no version header; the Resource JSON is the content.

## Progress

Track per task in the repo. At the moment of this document's first write: plan approved, directory scaffolded, documentation underway, story and page JSON authoring next.
