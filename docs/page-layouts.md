# Page Layouts

Ten Tines Pages compose the "web app." Each Page is a single JSON export under `../pages/`. Every component binds to `RESOURCE.soc_metrics_cache.<slice>` (for read-only visuals) or triggers a story (for writes).

Common pattern: a top banner reads `RESOURCE.soc_settings.last_sync_completed_at` and shows `"Last sync: <relative time>"`. If `first_sync_completed_at` is null, every Page except Setup renders a banner that says "Complete setup to see metrics" and hides the body.

Every Page has a left-side nav strip with links to all other Pages (implemented as text-block components with URL links to sibling Page slugs).

## Page: SOC Dashboard Home

Purpose: overview. Five KPI cards + a 14-day headline trend.

- KPI: Queue Depth -> `soc_metrics_cache.headline.queue_depth`
- KPI: Active Incidents -> `soc_metrics_cache.headline.active_incident_count`
- KPI: TTFT P85 -> `soc_metrics_cache.headline.ttft_p85_hours` formatted hours
- KPI: Net Velocity (7d) -> `soc_metrics_cache.headline.net_velocity_7d`
- KPI: Last Sync -> `RESOURCE.soc_settings.last_sync_completed_at`
- Line chart: TTFT P85 trend -> `soc_metrics_cache.speed.response_time_trend` with `date` on X, `p85` on Y.

## Page: Calendar

Purpose: daily volume + label breakdown + annotation layer.

- Month selector: two buttons "prev" and "next" that post to `soc-settings-crud` with `calendar_view_month`.
- Grid: custom HTML component rendered via text-block + templated formula that walks `soc_metrics_cache.calendar.days` for the selected month. Each cell shows: day number, total count, top-3 label color bars, annotation preview.
- Annotation panel: below the grid, an editable text input bound to `RESOURCE.soc_day_annotations[selected_date]`. "Save" posts to `soc-annotations-crud`.

Because Tines Pages do not natively render a calendar grid, the month-view HTML is generated in-Page via a Markdown/HTML text component whose template uses formula `<for>` loops to iterate 42 day cells (six weeks) and a `<if>` to dim out-of-month cells.

## Page: Watch Status

Purpose: queue and active state detail.

- Table: open tickets, each row showing key, summary, status, assignee, age. Bound to a derived `RESOURCE.soc_metrics_cache` slice or a dedicated `soc-compute-watch-list` output (consider adding). For v1 this pulls straight from `soc_tickets_cache.tickets` via Page table component filtered to `resolved_at == null`.
- KPI bar: queue by status class: count in queue / active / blocked. Sourced from `soc_metrics_cache.flow.aging_buckets` and by class counts.

## Page: Flow

Purpose: lead-time decomposition and aging.

- Stacked bar chart: lead time phases (queue wait, active work, post-active wait) at P50/P85/P95. Bound to `soc_metrics_cache.flow.lead_time`.
- Histogram: `soc_metrics_cache.flow.aging_buckets`.
- Big number: stalled tickets count.
- Donut: closure-integrity groups. Bound to `soc_metrics_cache.flow.closure_integrity`.

## Page: Response Speed

Purpose: TTFT percentiles and burst detection.

- KPI triple: P50 / P85 / P95. Bound to `soc_metrics_cache.speed.ttft_percentiles`.
- Line chart: P85 trend. Bound to `soc_metrics_cache.speed.response_time_trend`.
- Table: closure bursts with start time and count. Bound to `soc_metrics_cache.speed.closure_bursts`.

## Page: Capacity

Purpose: shift rollover, after-hours load, staffing verdict.

- Heat-strip: rollover per shift per day. Bound to `soc_metrics_cache.capacity.shift_rollover`.
- KPI: After-hours transitions -> `soc_metrics_cache.capacity.after_hours_transitions`.
- Verdict banner: colored by `soc_metrics_cache.capacity.staffing_verdict` (green for healthy, yellow for surge_event, red for understaffed, orange for routing_problem, blue for overstaffed).
- KPI: Velocity under load.

## Page: Patterns

Purpose: recurrence clusters and automation tier.

- Table: top clusters with name, count, first seen, last seen, automation tier. Bound to `soc_metrics_cache.patterns.clusters`.
- KPI pair: rapid recurrence count, slow recurrence count.

## Page: Projections

Purpose: forecast.

- Line chart: actual queue + predicted queue over time. Bound to `soc_metrics_cache.projections.forecast` plus historical daily from the same slice (the compute story emits both).
- KPI: forecast method label (`linear` in v1).
- KPI: R squared.
- Banner: "Seasonal decomposition deferred; see limitations.md."

## Page: Context Ledger

Purpose: full list of day annotations.

- Table: date, note, with edit and delete actions per row. Bound to `RESOURCE.soc_day_annotations`.
- Form: add-new annotation (date picker + text input + save button). Posts to `soc-annotations-crud`.

## Page: Setup

Purpose: one-time and ongoing admin configuration. Unlike other Pages, this one triggers stories.

Sections:

1. **Status**: reads `RESOURCE.soc_settings.{project_key, first_sync_completed_at, last_sync_status, last_sync_error}`. Shows a traffic-light.
2. **Project selection**: button "Discover projects" triggers `soc-jira-discover-projects`. Dropdown populated from the story's latest result. Save button posts to `soc-settings-crud` with `project_key`.
3. **Status classification**: button "Discover statuses" triggers `soc-jira-discover-statuses`. Table rows show status name, category, suggested classification, and four radio buttons (queue / active / done / blocked). Save triggers `soc-status-map-crud`.
4. **Business hours**: form fields for start_hour, end_hour, timezone, work_days (multi-select). Save posts to `soc-settings-crud`.
5. **Label filters**: list of every label seen in `soc_tickets_cache`; checkbox per label. Posts to `soc-labels-crud`.
6. **Sync controls**: "Run sync now" button triggers `soc-jira-sync`. "Change sync interval" form posts to `soc-settings-crud`. Status banner shows `last_sync_status`.
7. **Reset**: two buttons, "Reset settings (keep tickets)" and "Reset everything (keep credentials)". Each triggers `soc-reset` with the appropriate tier. Confirmation dialog required.

## Component inventory

Tines Pages provide these component types (Confirmed from existing tenant features): Markdown/Text, Metric Card, Line Chart, Bar Chart, Table, Form Input, Button, Dropdown, Date Picker.

Any layout that a component type does not cover (the calendar grid, the heat-strip) is rendered via a Markdown component whose body is a formula-template that emits the HTML. Pages in modern Tines render embedded HTML safely.

## Binding conventions

- Numbers: component `value` formula is `<<RESOURCE.soc_metrics_cache.<path>>>`.
- Arrays for charts: component `data` formula is the array directly; axis formulas pick fields by name.
- Table: `rows` formula is the array; `columns` metadata lists field names and optional formatters.
- Triggers (Setup page buttons): the button's action is a Send to Story that posts to the CRUD story's webhook entry point. Response handling uses the Page's built-in "refresh this component on success" option.
