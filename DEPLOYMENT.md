# Deployment

Operator runbook. Everything here happens inside a single Tines tenant and the Jira Cloud site you want to measure. Nothing else.

## 0. Prerequisites (one time)

- A Tines tenant where you have story, resource, and page import privileges.
- A Jira Cloud user with read access to the project you want to measure. Create an API token at `https://id.atlassian.com/manage-profile/security/api-tokens`.
- The `tines-webapp/` directory on a machine you can copy files from to the Tines UI.

No Node, no npm, no CLI tooling. Imports happen via the Tines UI or the Tines API if you prefer scripted installs. The rest of this runbook assumes the UI.

## 1. Create credentials

### 1a. Jira credential

Tines UI -> Credentials -> New credential.

- Name: **jira_basic_auth**
- Type: **HTTP Basic Auth** (or two-field custom: email + api_token)
- Username / email field: Jira account email.
- Password / api_token field: Jira API token.
- Access: per your team's Tines policy.

Stories reference both sub-fields as `<<CREDENTIAL.jira_basic_auth.email>>` and `<<CREDENTIAL.jira_basic_auth.api_token>>`.

The Jira domain is stored on `soc_settings.jira_domain`, set during first-run from the Setup Page. Not on the credential.

### 1b. Tines API credential (required for Resource writes)

The sync and CRUD stories write Resources by POSTing to the Tines tenant's own `/api/v1/global_resources/:id` endpoint. This needs a tenant API token.

Tines UI -> Credentials -> New credential.

- Name: **tines_api_token**
- Type: **Text** (single-value) or **HTTP Token**
- Value: a Tines API token with `global_resources:write` scope. Generate from User Settings -> API Keys in your tenant.
- Access: per your policy; treat as sensitive.

Stories reference it as `<<CREDENTIAL.tines_api_token>>`.

## 2. Import Resources

Tines UI -> Resources -> New resource. For each seed in `resources/`, create a Resource (value_type: **JSON**) with the exact name and paste the seed content as the initial value:

| Resource name | Seed file | value_type |
|---|---|---|
| `soc_settings` | `resources/soc_settings.seed.json` | JSON |
| `soc_status_map` | `resources/soc_status_map.seed.json` | JSON |
| `soc_label_config` | `resources/soc_label_config.seed.json` | JSON |
| `soc_day_annotations` | `resources/soc_day_annotations.seed.json` | JSON |
| `soc_tickets_cache` | `resources/soc_tickets_cache.seed.json` | JSON |
| `soc_metrics_cache` | `resources/soc_metrics_cache.seed.json` | JSON |
| `soc_tines_api` | `resources/soc_tines_api.seed.json` | JSON |

Access scope: tenant or team, per your policy.

### 2a. Fill in `soc_tines_api` with real values

After the seven Resources exist, every Tines Resource gets an auto-assigned numeric ID visible in the Resource URL (`/team_resources/{id}`). Open `soc_tines_api` and edit its JSON:

```json
{
  "domain": "your-tenant.tines.com",
  "user_email": "admin@example.com",
  "resource_ids": {
    "soc_settings": 111,
    "soc_status_map": 112,
    "soc_label_config": 113,
    "soc_day_annotations": 114,
    "soc_tickets_cache": 115,
    "soc_metrics_cache": 116
  }
}
```

Replace `your-tenant.tines.com` with your actual tenant hostname, `admin@example.com` with the user-email associated with the Tines API token, and each `0` with the real numeric ID from that Resource's URL. The sync story and every CRUD story look these IDs up when writing back.

## 3. Import Stories

Tines UI -> Stories -> Import story. Import in this order so any "Send to Story" references resolve on the first pass:

1. CRUD stories (no dependencies):
   - `soc-settings-crud.json`
   - `soc-status-map-crud.json`
   - `soc-labels-crud.json`
   - `soc-annotations-crud.json`
2. Compute sub-stories (no dependencies):
   - `soc-compute-headline.json`
   - `soc-compute-flow-lead-time.json`
   - `soc-compute-response-speed.json`
   - `soc-compute-capacity-shift.json`
   - `soc-compute-patterns-recurrence.json`
   - `soc-compute-projections.json`
   - `soc-compute-calendar-view.json`
3. Fan-out orchestrator (depends on compute subs):
   - `soc-compute-all-metrics.json`
4. Data ingest (depends on compute-all-metrics):
   - `soc-jira-discover-projects.json`
   - `soc-jira-discover-statuses.json`
   - `soc-jira-sync.json`
5. Admin:
   - `soc-reset.json`

After the second-pass import, open each compute-fan-out link and the sync story. If any "Send to Story" target reads `<unresolved>`, pick the correct story from the dropdown and save. This is because story GUIDs in exports are installation-specific.

## 4. Import Pages

Tines UI -> Pages -> Import page. Import order does not matter. All ten Page JSONs are in `pages/`. Access scope: tenant or team.

If your tenant's Page export schema differs from the one here (Tines Page export format is tenant-dependent), the import may prompt you to map component types. The `docs/page-layouts.md` spec enumerates every component's purpose so you can rebuild any that do not import cleanly.

## 5. Wire the sync schedule

Open `soc-jira-sync`. Click the first action (**Scheduled start**). In the Tines UI attach a **Schedule** to it:

- Schedule type: cron
- Recommended cron: `0 * * * *` (hourly on the hour)
- Timezone: UTC or your local zone

Schedules in schema-28 Tines live as a property attached to the entry action via the UI. They do not round-trip in the exported JSON (Confirmed from the `auto-action-collection.json` and `crowdstrike-secure.json` reference exports where every agent's export has no schedule but live scheduling is still possible). After saving the schedule in the UI, the story self-fires.

Sync interval is NOT read from `soc_settings.sync_interval_minutes` at story-runtime in v1. The Resource key is a documentation hint for operators; to change cadence, edit the schedule in the UI.

## 6. First run

Open the Setup Page (`/pages/soc-setup`).

1. Confirm credentials are wired: the "Status" metric cards should all resolve. If `Sync status` shows an error, inspect the Credential and the `jira_basic_auth` domain binding.
2. Click **Discover projects**. A dropdown populates.
3. Pick your project. Click **Save project**. The Resource updates.
4. Click **Discover statuses**. The classifier table populates.
5. Click **Queue / Active / Done / Blocked** on each row to classify. `soc_status_map` updates per click.
6. Fill in **Business hours**. Save.
7. Click **Run sync now**. The sync story runs; the "Sync status" card flips from `idle` -> `running` -> `ok` (it may take several minutes for large projects).
8. Click each Label row's Include / Exclude button based on noise vs real.
9. Open `SOC Dashboard Home`. Metrics render.

## 7. Verify

- Every Resource is non-empty after the first sync: `soc_settings.first_sync_completed_at` is set, `soc_tickets_cache.total > 0`, `soc_metrics_cache.computed_at` is within a minute of the sync completion.
- The headline KPIs on Home match a manual spot check in Jira JQL: e.g. `project = SOC AND statusCategory = "To Do"` should equal Home's Queue Depth.

## 8. Ongoing operations

- Sync runs on schedule. The Setup Page "Sync status" shows the last run state.
- Annotations are added from the Calendar or Context Ledger Page.
- Label filters are updated from Setup Page's Labels section.
- Status reclassification: Setup Page -> Status classification. Updates take effect on the next compute run (or manually trigger "Run sync now" again).
- Credential rotation: Tines UI -> Credentials -> edit `jira_basic_auth`. No Page action.

## 9. Reset

- **Settings only:** Setup Page -> Reset settings. Clears settings, status map, label config, annotations. Keeps the tickets cache so the dashboard still has data while the admin re-configures.
- **Everything:** Setup Page -> Reset everything. Clears all six Resources. Does not touch the `jira_basic_auth` Credential.

## 10. Upgrading

To push a new version of the stories or pages from this directory:

1. Export the target story or page from Tines (to preserve the tenant's GUIDs).
2. Diff against the file in this directory.
3. Apply the changes you want from this directory into the Tines UI.
4. Re-save.

Do not delete and re-import; GUIDs change and every "Send to Story" reference will break. Edit in place.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Setup Page shows empty dropdown after Discover projects | `jira_basic_auth` credential wrong or Jira domain wrong | Fix the Credential; set `jira_domain` on `soc_settings` |
| Sync stuck on `running` forever | A previous run crashed and left the sentinel | Manually set `soc_settings.last_sync_status = "idle"` in the Resource UI |
| Sync ends with `truncated` status | 10k issue cap hit | Narrow `soc_settings.date_range_days` or raise the cap inside `soc-jira-sync` |
| Tickets cache write fails with "too large" | Tenant Resource size limit exceeded | Enable sharded-write branch in `soc-jira-sync` (scaffold present, wire shard writer agents) |
| Home page shows zeros | Compute fan-out failed | Open `soc-compute-all-metrics` event log; check sub-story errors |
| A formula errors on a Page | Tenant formula runtime lacks a primitive | Apply the fallback from `docs/limitations.md` section 11 |
