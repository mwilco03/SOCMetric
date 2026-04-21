# Metric Mapping: TS module to Tines formula

Source of truth: `../../soc-dashboard/src/metrics/*.ts`, `src/patterns/recurrenceEngine.ts`, `src/staffing/projectionEngine.ts`, `src/dimensions/dimensionEngine.ts`, `src/normalization/entityNormalizer.ts`, `src/hooks/useCalendarData.ts`.

All formulas below are written in Tines formula syntax (see `../tines-formulas-reference.md`). Every chain runs inside an Event Transformation agent in the corresponding `soc-compute-*` story. Input is always the concatenated `tickets` array from `soc_tickets_cache` plus the `soc_status_map` Resource.

Shared helpers referenced throughout:

```
# derive status class for a ticket
STATUS_CLASS(ticket) =
  <<RESOURCE.soc_status_map[ticket.project_key + ":" + ticket.status_name] || "queue">>

# parse changelog back to array (it is stored stringified in TicketRow.changelog_json)
CHANGELOG(ticket) = JSON_PARSE(ticket.changelog_json || "[]")

# first status-change timestamp after creation
FIRST_TRANSITION_AT(ticket) =
  FIRST(SORT(MAP_LAMBDA(CHANGELOG(ticket), h, h.created)))

# last transition timestamp
LAST_TRANSITION_AT(ticket) =
  LAST(SORT(MAP_LAMBDA(CHANGELOG(ticket), h, h.created)))

# ticket's TTFT in hours (null if never transitioned)
TTFT_HOURS(ticket) =
  IF(FIRST_TRANSITION_AT(ticket) == null, null,
     DATE_DIFF(FIRST_TRANSITION_AT(ticket), ticket.created_at, "hours"))
```

---

## headlineMetrics.ts -> soc-compute-headline

Inputs read: `fields.status`, `fields.created`, `fields.resolutiondate`, changelog status-transition entries.

```
# queue depth: tickets whose current status class is queue
queue_depth = COUNT(FILTER(tickets, t -> STATUS_CLASS(t) == "queue"))

# active incident count: tickets whose class is active
active_incident_count = COUNT(FILTER(tickets, t -> STATUS_CLASS(t) == "active"))

# net velocity: (closed last 7d) - (created last 7d) divided by 7
closed_7d = COUNT(FILTER(tickets, t ->
  t.resolved_at != null AND DATE_DIFF(NOW(), t.resolved_at, "days") <= 7))
opened_7d = COUNT(FILTER(tickets, t ->
  DATE_DIFF(NOW(), t.created_at, "days") <= 7))
net_velocity_7d = (closed_7d - opened_7d) / 7

# TTFT percentiles over tickets with a recorded first transition
ttft_array = FILTER(MAP_LAMBDA(tickets, t, TTFT_HOURS(t)), v -> v != null)
ttft_p50_hours = PERCENTILE(ttft_array, 50)
ttft_p85_hours = PERCENTILE(ttft_array, 85)
ttft_p95_hours = PERCENTILE(ttft_array, 95)
```

Output written as the `headline` slice of `soc_metrics_cache`.

---

## leadTimeDecomposition.ts -> soc-compute-flow-lead-time

Decomposes total lead time into three phases using transition timestamps and the status classification.

```
# For each closed ticket, reconstruct the state timeline:
timeline(ticket) =
  # build (timestamp, class) pairs
  start   = { ts: ticket.created_at, class: "queue" }
  changes = MAP_LAMBDA(CHANGELOG(ticket), h, {
    ts: h.created,
    class: <<RESOURCE.soc_status_map[ticket.project_key + ":" + h.items[0].toString] || "queue">>
  })
  end     = { ts: ticket.resolved_at, class: "done" }
  SORT_BY(CONCAT([start], changes, [end]), x -> x.ts)

# Sum hours in each class by pairing consecutive timestamps
phase_hours(ticket, target_class) =
  tl = timeline(ticket)
  REDUCE(tl, 0, (acc, entry, i) ->
    IF(i == 0, acc,
      acc + IF(tl[i-1].class == target_class,
               DATE_DIFF(entry.ts, tl[i-1].ts, "hours"),
               0)))

queue_wait_hours      = MAP_LAMBDA(closed_tickets, t -> phase_hours(t, "queue"))
active_work_hours     = MAP_LAMBDA(closed_tickets, t -> phase_hours(t, "active"))
post_active_wait_hours = MAP_LAMBDA(closed_tickets, t -> phase_hours(t, "blocked"))

lead_time.queue_wait       = { p50: PERCENTILE(queue_wait_hours, 50), p85: PERCENTILE(queue_wait_hours, 85), p95: PERCENTILE(queue_wait_hours, 95) }
lead_time.active_work      = { p50: PERCENTILE(active_work_hours, 50), ... }
lead_time.post_active_wait = { p50: PERCENTILE(post_active_wait_hours, 50), ... }
```

## ticketAging.ts (same story)

```
# open tickets only
open_tickets = FILTER(tickets, t -> t.resolved_at == null)

# time since last transition (or creation if never transitioned)
age_hours(ticket) =
  DATE_DIFF(NOW(), (LAST_TRANSITION_AT(ticket) || ticket.created_at), "hours")

# bucket
bucket(h) =
  CASE(true,
    h < 4,   "0-4h",
    h < 8,   "4-8h",
    h < 24,  "8-24h",
    h < 72,  "1-3d",
    true,    "3d+")

aging_buckets = GROUP_BY(open_tickets, t -> bucket(age_hours(t)))
  # then SIZE -> { label, count }

# stalled: open and no transition in 48h
stalled_tickets = COUNT(FILTER(open_tickets, t -> age_hours(t) > 48))
```

## closureIntegrity.ts (same story)

```
transition_count(ticket) = COUNT(CHANGELOG(ticket))

classify(ticket) =
  CASE(true,
    ticket.resolved_at == null,                "still_open",
    DATE_DIFF(ticket.resolved_at, ticket.created_at, "minutes") < 2,  "instant",
    transition_count(ticket) == 0,              "untouched",
    transition_count(ticket) > 5,               "churned",
    true,                                       "normal")

closure_integrity = GROUP_BY(tickets, t -> classify(t)) -> SIZE per group
```

---

## shiftMetrics.ts + afterHours.ts + staffingModel.ts -> soc-compute-capacity-shift

```
# shift attribution (user-configurable via soc_settings.business_hours)
shift_of(iso_ts) =
  hr = HOUR_OF_DAY(iso_ts, soc_settings.business_hours.timezone)
  CASE(true,
    hr >= soc_settings.business_hours.start_hour AND hr < soc_settings.business_hours.end_hour, "day",
    hr >= soc_settings.business_hours.end_hour OR hr < 1,                                        "evening",
    true,                                                                                         "overnight")

# daily rollover: tickets open at end of shift that were open at start
# expressed as per-day counts of unresolved tickets transitioning across shift boundaries
shift_rollover = GROUP_BY(tickets, t -> {
  date:  DATE_FORMAT(t.updated_at, "YYYY-MM-DD"),
  shift: shift_of(t.updated_at)
}) -> COUNT each group

# after-hours: transitions whose timestamp is outside business_hours
after_hours_transitions = COUNT(
  FILTER(
    FLATTEN(MAP_LAMBDA(tickets, t, CHANGELOG(t))),
    h -> NOT IN_BUSINESS_HOURS(h.created, soc_settings.business_hours)))

# staffing verdict (healthy | understaffed | routing_problem | surge_event | overstaffed)
staffing_verdict =
  CASE(true,
    queue_depth > 100 AND ttft_p85_hours > 8,  "understaffed",
    ttft_p85_hours > 8 AND queue_depth < 30,   "routing_problem",
    opened_7d > 2 * (avg_weekly_opens),         "surge_event",
    queue_depth < 10 AND active_incident_count < 3, "overstaffed",
    true, "healthy")

velocity_under_load = closed_7d / MAX(queue_depth, 1)
```

`IN_BUSINESS_HOURS` is a helper that combines `DAY_OF_WEEK`, `HOUR_OF_DAY`, and a list of federal-holiday dates from `soc-dashboard/src/ledger/holidays.ts` (ported to a Tines constant list inside the compute story).

---

## clusterAnalysis.ts + recurrenceEngine.ts + entityNormalizer.ts -> soc-compute-patterns-recurrence

```
# Entity normalization: replace IPs, hashes, URLs, emails, paths with tokens
normalize(summary) =
  s = REGEX_REPLACE(summary, "\\b\\d{1,3}(\\.\\d{1,3}){3}\\b", "<IP>")
  s = REGEX_REPLACE(s, "\\b[a-f0-9]{32,64}\\b", "<HASH>")
  s = REGEX_REPLACE(s, "https?://\\S+", "<URL>")
  s = REGEX_REPLACE(s, "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", "<EMAIL>")
  s = REGEX_REPLACE(s, "[A-Z]:\\\\[^\\s]+", "<PATH>")
  TRIM(LOWER(s))

# cluster by normalized summary
clusters = GROUP_BY(tickets, t -> normalize(t.summary))
  -> per group: {
       cluster_name: <the key>,
       count:       COUNT(group),
       first_seen:  MIN(MAP_LAMBDA(group, t, t.created_at)),
       last_seen:   MAX(MAP_LAMBDA(group, t, t.created_at)),
       automation_tier: CASE(true, count > 50, 3, count > 20, 2, count > 5, 1, true, 0)
     }
  -> SORT_BY(count DESC) -> TAKE(100)

# rapid recurrence: clusters where consecutive incidents are < 24h apart
rapid = COUNT(
  FILTER(clusters, c -> MIN_CONSECUTIVE_GAP(group.events) < 24))
slow  = COUNT(
  FILTER(clusters, c -> MIN_CONSECUTIVE_GAP(group.events) < 336 AND count >= 2))
```

---

## closureBurst.ts -> soc-compute-response-speed

```
resolved_events = SORT(
  FILTER(tickets, t -> t.resolved_at != null),
  t -> t.resolved_at)

# slide a 10-minute window; report any window with >= 5 closures
closure_bursts = REDUCE(resolved_events, [], (acc, e, i) -> {
  window = FILTER(resolved_events, r ->
    DATE_DIFF(r.resolved_at, e.resolved_at, "minutes") BETWEEN 0 AND 10)
  IF(COUNT(window) >= 5,
     APPEND(acc, { start: e.resolved_at, count: COUNT(window) }),
     acc)
}) -> DEDUPE_BY(start)

# TTFT percentile trend over last 14 days of creation date
ttft_trend = GROUP_BY(tickets, t -> DATE_FORMAT(t.created_at, "YYYY-MM-DD"))
  -> per bucket: { date, p85: PERCENTILE(MAP_LAMBDA(bucket, TTFT_HOURS), 85) }
```

---

## projectionEngine.ts -> soc-compute-projections

Seasonal decomposition (STL) is deferred. Linear regression ships:

```
# build time series of net queue depth per day
daily = GROUP_BY(tickets, t -> DATE_FORMAT(t.created_at, "YYYY-MM-DD"))
  -> per bucket: {
       date:   <the key>,
       opened: COUNT(bucket),
       closed: COUNT(FILTER(bucket, t -> DATE_FORMAT(t.resolved_at, "YYYY-MM-DD") == <the key>)),
       net:    opened - closed
     }

# compute cumulative queue
queue_series = REDUCE(daily, { acc: 0, out: [] }, (s, day) -> {
  acc: s.acc + day.net,
  out: APPEND(s.out, { date: day.date, queue: s.acc + day.net })
}).out

# linear regression: fit y = m*x + b using least squares
# x = day index, y = queue depth
x = RANGE(0, COUNT(queue_series))
y = MAP_LAMBDA(queue_series, q -> q.queue)
x_mean = AVG(x); y_mean = AVG(y)
m = SUM(MAP2(x, y, (xi, yi) -> (xi - x_mean) * (yi - y_mean))) /
    SUM(MAP_LAMBDA(x, xi -> POW(xi - x_mean, 2)))
b = y_mean - m * x_mean

# forecast next 60 days
forecast = MAP_LAMBDA(RANGE(0, 60), i -> {
  date: DATE_ADD(NOW(), i + 1, "days"),
  predicted_queue: ROUND(m * (COUNT(x) + i) + b)
})

# r^2
y_pred = MAP_LAMBDA(x, xi -> m * xi + b)
ss_res = SUM(MAP2(y, y_pred, (yi, ypi) -> POW(yi - ypi, 2)))
ss_tot = SUM(MAP_LAMBDA(y, yi -> POW(yi - y_mean, 2)))
r2 = 1 - ss_res / ss_tot
```

---

## useCalendarData.ts -> soc-compute-calendar-view

```
calendar_days = GROUP_BY(tickets, t -> DATE_FORMAT(t.created_at, "YYYY-MM-DD"))
  -> per bucket: {
       date:   <the key>,
       total:  COUNT(bucket),
       labels: (
         raw = GROUP_BY(FLATTEN(MAP_LAMBDA(bucket, t -> t.labels)), l -> l)
           -> per: { label: <key>, count: COUNT(group) }
           -> SORT_BY(count DESC)
         top5 = TAKE(raw, 5)
         other = { label: "other", count: SUM(MAP_LAMBDA(DROP(raw, 5), x -> x.count)) }
         CONCAT(top5, [other])
       )
     }
  -> SORT_BY(date ASC)
```

Label filtering: any label with `soc_label_config[label] == false` is excluded before the per-day rollup.

---

## Formula primitives used across stories (cross-check with tines-formulas-reference.md)

- Array: `FILTER`, `MAP_LAMBDA`, `REDUCE`, `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `PERCENTILE`, `SORT`, `SORT_BY`, `GROUP_BY`, `FLATTEN`, `CONCAT`, `APPEND`, `TAKE`, `DROP`, `FIRST`, `LAST`, `RANGE`, `UNIQUE`, `DEDUPE_BY`, `MAP2`
- Date: `DATE_DIFF`, `DATE_FORMAT`, `DATE_ADD`, `HOUR_OF_DAY`, `DAY_OF_WEEK`, `NOW`
- String/regex: `REGEX_REPLACE`, `LOWER`, `TRIM`
- Number: `POW`, `ROUND`
- Control: `IF`, `CASE`
- Data: `JSON_PARSE`

Every one of these is documented as Confirmed in `../tines-formulas-reference.md`. If the tenant's formula runtime reports any as unavailable, the fallback is documented in `limitations.md`.
