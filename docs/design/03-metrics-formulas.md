# Metrics & Formulas

*Extracted from Design Document v1.1, Sections 9-11*

---

## 9. Unified Metric Stack

### Tier 1 -- Headline (Always Visible, All Views)

**Net Velocity**
```
Net Velocity = Close Rate - Intake Rate (per working hour, rolling window)

Positive  → queue is draining
Near zero → holding steady
Negative  → queue is filling

Baseline deviation coloring:
  Green  → within 1σ of rolling historical net velocity
  Yellow → 1-2σ outside historical baseline
  Red    → > 2σ outside historical baseline OR sustained negative > N days

This is the primary operational signal. Trending over time shows whether
the team is keeping pace with alert volume.
```

**Time to First Touch P85 (TTFT P85)**
```
TTFT = T(first_touch_transition) - T(created)
Computed in working hours only.

P85 = 85th percentile of TTFT across all tickets in scope

Presented per priority tier.
Priority gating: only shown with priority breakdown if Priority Separation
Index confirms priority is behaviorally enforced (see Section 12).

Coloring: deviation from team's own rolling TTFT baseline, not a fixed target.
"4.3h" turning yellow means it was 2.1h last period -- not that 4h is inherently wrong.
```

**Queue Depth**
```
Count of tickets in non-Done statuses at current moment.
Breakdown by asset class and source system.
Trend indicator: growing / stable / draining based on slope over configurable window.
```

**Active Incident Flag**
```
Binary: IR project has open ticket in non-Done status.
If yes: count, oldest open age in working hours, link to Incidents chapter.
```

---

### Tier 2 -- Flow Metrics

**Lead Time Decomposition**
```
Lead Time = T(closed) - T(created)

Decomposed into three segments:
  Queue Wait        = T(first_touch) - T(created)         [= TTFT]
  Active Work Time  = sum of time in Active-class statuses after first touch
  Post-Active Wait  = time in Queue-class statuses AFTER first touch

Lead Time = Queue Wait + Active Work Time + Post-Active Wait

The three-way split is the most diagnostic view available.
  High Queue Wait       → coverage or routing problem
  High Post-Active Wait → tickets re-queue after being picked up
                          (awaiting info, deprioritized, forgotten)
  High Active Work Time → ticket complexity or skill gap

Post-active wait metrics:
  Post-Active Wait %   = post-active wait / lead time
  Requeue Count        = number of Active → Queue transitions after first touch
```

**Cycle Time Distribution (P50 / P85 / P95)**
```
Cycle Time = T(closed) - T(first_touch)
Computed per dimension cluster, not globally.
Mixing email spam filtering with P1 incidents in one distribution is noise.

Presented as:
  Percentile callout cards per cluster
  Histogram per cluster (the shape is the insight -- bimodal = two work types conflated)

Trend: P85 this period vs prior equivalent period, expressed as delta and direction.
```

**Flow Efficiency**
```
Flow Efficiency = Active Work Time / Lead Time
(Uses three-way decomposition -- post-active wait is idle time, not active)

High (> 70%): work is touched quickly and worked continuously
Low  (< 30%): most ticket lifetime is waiting

Computed on valid tickets only (see Section 10).
Raw vs clean comparison available as overlay.
```

**Velocity Under Load**
```
Scatter plot: queue depth (x) vs close rate (y)
Each point = one working day

Slope reveals surge behavior:
  Flat or rising slope  → surge-capable
  Declining slope       → alert fatigue or context-switching ceiling
  Cliff pattern         → hard capacity ceiling at a specific queue depth

This is the most direct quantitative evidence for headcount decisions.
```

**Intake Rate Breakdown**
```
Rolling intake rate: 7d / 14d / 30d
Breakdown by: source system, asset class, label, day-of-week, time-of-day band
Surge event markers: days where intake > mean + 2σ
Rule deployment markers: intake spike concentrated in single cluster (see Section 14)
```

**Cumulative Flow Diagram** (toggle)
```
Stacked area over time: Open | In Progress | Closed
Widening open band = queue growing
Parallel bands = stable flow
```

---

### Tier 3 -- Capacity and Staffing

**Rollover Rate by Shift**
```
Rollover % = (open tickets at shift end / total WIP) * 100

Heatmap: x=day, y=shift name, color=rollover severity
Incident windows overlaid as distinct band
Incident-origin rollovers excluded from standard rollover rate
```

**Ticket Aging Buckets**
```
Currently open tickets grouped by working-hour age:
  < 4h  |  4-8h  |  8-24h  |  1-3 days  |  3+ days

Each bucket split:
  Untouched: no status transition since creation (flagged -- possible missed alert)
  Active-then-cold: had a transition but no activity in > P85 cycle time (flagged)
  Being worked: recent transition

Active-then-cold tickets are stalled tickets. Distinct from untouched.
```

**Stalled Ticket Detection**
```
A stalled ticket has been touched but has gone cold:

If:
  current_time - last_transition > P95_cycle_time * 1.5
  AND status != Done

→ flag as stalled

Metrics:
  Stalled ticket count
  Stalled % of active WIP
  Age of oldest stalled ticket

These are surfaced in Watch Status (Chapter 1) not just Capacity (Chapter 4).
Stalled tickets are operational blind spots -- they look active but are not moving.
```

**Surge Absorption Score**
```
On days where intake > mean + 2σ:
  TTFT P85 held within team baseline → surge-capable
  TTFT degraded, close rate held     → surge-limited
  Both degraded                      → surge-overwhelmed

Rolling score: X of Y surge days absorbed within normal operating parameters.
```

**Incident Cost to Queue**
```
During IR project open windows:
  Standard project close rate: incident window vs baseline
  Standard project TTFT: incident window vs baseline

Output: estimated tickets displaced and TTFT degradation per incident hour.
This is the quantitative staffing argument for incident surge capacity.
```

**Analyst Load Distribution** (opt-in, requires assignee data)
```
Per analyst:
  Tickets assigned
  Tickets closed
  Avg cycle time
  TTFT by assigned ticket

Distribution interpretation:
  Even, all near capacity  → understaffed
  Uneven, high variance    → routing or assignment problem
  Even, all well under     → potentially over-staffed
```

**Weighted Close Rate** (gated on Priority Separation Index)
```
Available only if Priority Separation Index confirms priority is enforced.
If not enforced, metric is suppressed with explanation.

Weighted Close Rate = Σ(priority_weight × tickets closed) / working hours
Weights derived from historical cycle time medians per priority tier,
not hardcoded numbers.
```

**Closure Burst Detection**
```
If N tickets closed within M working minutes (configurable defaults: N=5, M=30):
  → flag as closure burst event

Metrics:
  Burst close rate
  Adjusted close rate excluding burst events
  Burst events by time-of-day (end-of-shift pattern detection)
```

---

### Tier 4 -- Incident Chapter (IR Project)

Structurally identical metrics to standard tickets, separate instances, different time scale.

**Acknowledgment Target** (not SLA)
```
Team-set target for time-to-first-touch on incidents by priority.
Named "acknowledgment target" not "SLA" throughout the UI.
Coloring driven by deviation from this target AND from historical IR TTFT baseline.
```

**Additional IR-specific metrics:**
```
Active Incident Timeline
  Gantt-style: each incident as horizontal bar, colored by severity
  Concurrency visible: how often are multiple incidents open simultaneously?

Incident Frequency Trend
  Incidents opened per week over selected period

Cross-Project Queue Impact
  TTFT and throughput delta for standard project during incident windows
```

---

## 10. Closure Integrity Layer

Before any metric is computed, every ticket passes through a closure classification pipeline. This does not exclude tickets from the dataset -- it annotates them so metrics can be presented raw and clean simultaneously.

### Classification Rules

```
For each closed ticket, assign:

INSTANT_CLOSE
  resolutiondate - created < configurable_threshold (default 5 working minutes)
  Likely: automation artifact, noise ticket, ingestion test

UNTOUCHED_CLOSE
  No status transition ever occurred before closure
  Likely: auto-close rule, bulk administrative close, system artifact

VALID_CLOSE
  At least one Active-class status duration > configurable_minimum
  AND is not instant_close
  AND is not untouched_close

STALLED_THEN_CLOSED
  Was flagged as stalled at some point (active-then-cold)
  Then closed without further intermediate transitions
  Likely: dormant-then-close pattern (analyst picked up, did nothing, closed)

CHURNED
  Status transitioned Active → Queue → Active one or more times after first touch
  work_churn_count = number of such round-trips stored per ticket
```

### Metric Display Rules

```
Default view: clean metrics (VALID_CLOSE tickets only)
Overlay: raw metrics including all classification types
Any metric computed on unvalidated set labeled explicitly

Instant closure rate = instant_close / total tickets (shown as a KPI card)
Untouched closure rate = untouched_close / total tickets
Stalled-then-closed rate = stalled_then_closed / total tickets
Work churn rate = tickets with churn_count > 0 / total tickets
```

This surfaces gaming patterns and automation artifacts without silently corrupting performance metrics.

---

## 11. Recurrence Engine

Recurrence replaces reopened rate as the quality and intelligence signal. The engine operates in two distinct modes because rapid and slow recurrence are fundamentally different phenomena.

### Mode 1: Rapid Recurrence (Source Signal)

```
Definition:
  Similar ticket appears within rapid_threshold working hours of a closure
  Default: 24 working hours (configurable)

Interpretation:
  NOT a failed closure. The analyst did their job.
  The SOURCE is still active -- rule still firing, block didn't hold,
  campaign still running.

Metric: Rapid Recurrence Rate = rapid_recurrences / total tickets (per cluster)
Classification: "Source still active"

Dashboard placement: surfaced in Chapter 1 Watch Status
Recommended action language: "Review upstream rule or block -- source still firing"
Automation escalation: URGENT tier (pattern is active right now)
```

### Mode 2: Slow Recurrence (Automation Signal)

```
Definition:
  Similar ticket appears within slow_threshold days of a prior similar ticket
  Default: 14 days (configurable)
  Must be outside the rapid_recurrence window

Interpretation:
  Persistent pattern -- same alert type keeps appearing over time
  Candidate for automation, tuning, or policy change

Metric: Slow Recurrence Rate = slow_recurrences / total tickets (per cluster)
Classification: "Persistent pattern"

Dashboard placement: Chapter 5 Patterns
Recommended action language: "Evaluate automation or detection tuning"
Automation escalation: STANDARD or ADVISORY tier
```

### Similarity Detection

```
For each closed ticket:
  Normalize title (entity normalization from Section 7)
  Compare normalized title against closed tickets in rolling window
  Similarity metric: Jaccard coefficient on token sets (configurable threshold, default 0.6)

If similarity > threshold AND time delta < rapid_threshold → Rapid Recurrence
If similarity > threshold AND time delta < slow_threshold → Slow Recurrence
```

### Intake Persistence Rate

```
For each cluster:
  Compare intake rate in the 14 days after a period of heavy closures
  vs intake rate in the 14 days before

If no reduction in intake rate after closures:
  → classify cluster as "non-resolving work"
  → flag: "Closing these tickets has no effect on how many arrive"
  → implication: root cause is not addressed by ticket closure alone
```
