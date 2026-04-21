# Resource Schemas

Every Tines Resource used by SOCMetric is an object-typed Resource with a fixed top-level shape. Stories read and write the whole object; there is no partial patch in Tines' Resource API (Confirmed), so every write emits the full object.

Size budget note: Tines Resource maximum size is tenant-configurable and not published as a universal number (Likely 1 MB per Resource in standard tenants, Confirmed once tested in your tenant). The sync story enforces a 900 KB soft cap on `soc_tickets_cache` before flipping to sharded writes.

## soc_settings

Single app-settings object. One Resource, one tenant.

```json
{
  "project_key": "SOC",
  "jira_domain": "example.atlassian.net",
  "sync_interval_minutes": 60,
  "date_range_days": 90,
  "first_sync_completed_at": "2026-04-21T14:00:00Z",
  "last_sync_completed_at": "2026-04-21T14:12:33Z",
  "last_sync_status": "ok",
  "last_sync_error": null,
  "business_hours": {
    "start_hour": 9,
    "end_hour": 17,
    "timezone": "America/New_York",
    "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"]
  }
}
```

| Field | Type | Purpose | Default |
|---|---|---|---|
| project_key | string | Jira project key to sync. Required before sync runs. | null |
| jira_domain | string | e.g. `your-company.atlassian.net`. | null |
| sync_interval_minutes | int | Sync story re-schedule interval. | 60 |
| date_range_days | int | Rolling window pulled each sync. | 90 |
| first_sync_completed_at | ISO8601 or null | Set once. Pages gate "dashboard ready" on this. | null |
| last_sync_completed_at | ISO8601 or null | Updated every successful sync. | null |
| last_sync_status | enum: `ok`, `error`, `running` | Surfaced on Setup page. | `running` |
| last_sync_error | string or null | Error message on failure. | null |
| business_hours | object | Feeds afterHours and workingHours calculations. | 09:00-17:00 ET Mon-Fri |

## soc_status_map

Key: `<projectKey>:<statusName>`. Value: one of `queue`, `active`, `done`, `blocked`. Keeps the same four-class taxonomy as the Rust app.

```json
{
  "SOC:Open": "queue",
  "SOC:Triage": "queue",
  "SOC:In Progress": "active",
  "SOC:Analyst Review": "active",
  "SOC:Waiting for User": "blocked",
  "SOC:Resolved": "done",
  "SOC:Closed": "done"
}
```

## soc_label_config

Per-label toggle: whether a label's tickets participate in metrics. Default is `true` for any label the sync sees; `false` means the label is excluded.

```json
{
  "phishing": true,
  "malware": true,
  "noise": false,
  "duplicate": false,
  "pentest": true
}
```

## soc_day_annotations

Calendar annotations. Key: `YYYY-MM-DD`. Value: free-text note shown on that day's cell.

```json
{
  "2026-04-10": "Rule deployment",
  "2026-04-15": "Known noise: phishing simulation",
  "2026-04-17": "Campaign"
}
```

## soc_tickets_cache

Primary tickets Resource. Either holds all tickets inline (small tenants), or holds a manifest pointing at shards (large tenants).

Inline form (no sharding):

```json
{
  "mode": "inline",
  "project_key": "SOC",
  "last_synced_at": "2026-04-21T14:12:33Z",
  "total": 1842,
  "tickets": [
    {
      "id": "10001",
      "key": "SOC-123",
      "project_key": "SOC",
      "summary": "...",
      "status_name": "In Progress",
      "status_category_key": "indeterminate",
      "issue_type": "Task",
      "priority": "High",
      "assignee": "alice@example.com",
      "reporter": "bob@example.com",
      "labels": ["phishing"],
      "components": ["SOC"],
      "created_at": "2026-03-12T08:14:00Z",
      "updated_at": "2026-04-12T09:00:00Z",
      "resolved_at": null,
      "changelog_json": "[{\"id\":\"...\",\"created\":\"...\",\"items\":[...]}]",
      "fetched_at": "2026-04-21T14:12:33Z"
    }
  ]
}
```

Sharded form (when ticket count pushes past the byte budget):

```json
{
  "mode": "sharded",
  "project_key": "SOC",
  "last_synced_at": "2026-04-21T14:12:33Z",
  "total": 8423,
  "shards": 9,
  "shard_size": 1000
}
```

Shards are `soc_tickets_cache_shard_001`, `soc_tickets_cache_shard_002`, ..., each with shape:

```json
{
  "shard_index": 1,
  "tickets": [ /* up to shard_size TicketRow entries */ ]
}
```

TicketRow field semantics match `soc-dashboard/src/types.ts` `TicketRow` verbatim. Seventeen fields per row. Approximately 200 bytes per row average.

## soc_metrics_cache

The read surface for Pages. Computed once per sync and read on every Page load.

```json
{
  "computed_at": "2026-04-21T14:12:40Z",
  "project_key": "SOC",
  "date_range": { "start": "2026-01-21T00:00:00Z", "end": "2026-04-21T00:00:00Z" },

  "headline": {
    "queue_depth": 47,
    "active_incident_count": 12,
    "net_velocity_7d": 3.4,
    "ttft_p50_hours": 1.2,
    "ttft_p85_hours": 4.8,
    "ttft_p95_hours": 9.1
  },

  "flow": {
    "lead_time": {
      "queue_wait": { "p50": 0.4, "p85": 2.1, "p95": 6.2 },
      "active_work": { "p50": 3.1, "p85": 12.6, "p95": 40.0 },
      "post_active_wait": { "p50": 0.0, "p85": 1.2, "p95": 8.0 }
    },
    "aging_buckets": [
      { "label": "0-4h", "count": 12 },
      { "label": "4-8h", "count": 8 },
      { "label": "8-24h", "count": 15 },
      { "label": "1-3d", "count": 9 },
      { "label": "3d+", "count": 3 }
    ],
    "stalled_tickets": 4,
    "closure_integrity": {
      "instant": 30, "untouched": 120, "normal": 540, "churned": 45
    }
  },

  "speed": {
    "ttft_percentiles": { "p50": 1.2, "p85": 4.8, "p95": 9.1 },
    "response_time_trend": [ { "date": "2026-04-14", "p85": 4.0 }, { "date": "2026-04-15", "p85": 4.5 } ],
    "closure_bursts": [ { "start": "2026-04-17T15:00:00Z", "count": 12 } ]
  },

  "capacity": {
    "shift_rollover": [
      { "shift": "day", "date": "2026-04-20", "rollover_count": 4 }
    ],
    "after_hours_transitions": 23,
    "staffing_verdict": "healthy",
    "velocity_under_load": 0.87
  },

  "patterns": {
    "clusters": [
      { "cluster_name": "brute force ssh <IP>", "count": 24, "first_seen": "2026-03-01T00:00:00Z", "automation_tier": 2 }
    ],
    "recurrence": {
      "rapid": 7,
      "slow": 12
    }
  },

  "projections": {
    "method": "linear",
    "forecast": [
      { "date": "2026-04-22", "predicted_queue": 49 },
      { "date": "2026-04-23", "predicted_queue": 50 }
    ],
    "r2": 0.72
  },

  "calendar": {
    "days": [
      {
        "date": "2026-04-20",
        "total": 34,
        "labels": [
          { "label": "phishing", "count": 12 },
          { "label": "malware", "count": 8 },
          { "label": "other", "count": 14 }
        ]
      }
    ]
  }
}
```

Every number above originates from the formulas documented in `metric-mapping.md`. The shape is what Pages bind to.

## Write semantics

- Every Resource write is a full-object replace. The compute stories read, mutate in memory via Event Transformation, then `set_resource` the whole object.
- Race protection: the sync story acquires a sentinel before running (`soc_settings.last_sync_status == "running"` gate). A second sync invocation that sees `running` exits without work. Stale lock timeout: 15 minutes.
- The CRUD stories use the same read-modify-write pattern but on much smaller Resources so the race window is negligible.
