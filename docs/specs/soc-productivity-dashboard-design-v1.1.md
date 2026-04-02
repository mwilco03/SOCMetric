# SOC Productivity Dashboard — Design Document

**Version:** 1.1  
**Status:** Pre-Implementation  
**Scope:** Single-page application, client-side only, Jira Cloud API  
**Supersedes:** v1.0

---

## Changelog: v1.0 to v1.1

- Added Manager Context Ledger (Chapter 0) as a first-class screen
- Added SIEM-aware title normalization and entity extraction pipeline
- Added source system, asset class, entity type, and temporal dimensions
- Promoted labels to Tier 1 categorization
- Added clustering confidence scoring
- Added full projection framework with seasonal decomposition
- Replaced binary automation flag with three-tier escalation
- Added post-active wait decomposition to cycle time model
- Split recurrence engine into rapid (source signal) and slow (automation signal) modes
- Added stalled ticket detection, instant closure surfacing, closure burst detection
- Added volume-weighted cluster ranking and wasted work ratio
- Added intake persistence rate per cluster
- Added priority separation index
- Replaced SLA language throughout with operational tempo / baseline deviation model
- Defined three view modes: Analyst, Lead, Executive -- same data, different density
- Defined universal KPI card pattern: number + direction arrow + color + sentence
- Defined two-layer tooltip standard
- Defined chart headline as insight statement standard

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Why Standard Metrics Fail SOC](#2-why-standard-metrics-fail-soc)
3. [Domain Assumptions and Constraints](#3-domain-assumptions-and-constraints)
4. [Working Hours Model](#4-working-hours-model)
5. [Data Layer -- Jira API](#5-data-layer--jira-api)
6. [Dynamic Discovery Pipeline](#6-dynamic-discovery-pipeline)
7. [SIEM Title Normalization](#7-siem-title-normalization)
8. [Dimension Model](#8-dimension-model)
9. [Unified Metric Stack](#9-unified-metric-stack)
10. [Closure Integrity Layer](#10-closure-integrity-layer)
11. [Recurrence Engine](#11-recurrence-engine)
12. [Staffing Assessment Model](#12-staffing-assessment-model)
13. [Projection Framework](#13-projection-framework)
14. [Manager Context Ledger](#14-manager-context-ledger)
15. [Pattern Intelligence](#15-pattern-intelligence)
16. [Encrypted Storage Design](#16-encrypted-storage-design)
17. [Application Architecture](#17-application-architecture)
18. [View Modes](#18-view-modes)
19. [Universal KPI Card Standard](#19-universal-kpi-card-standard)
20. [Tooltip Standard](#20-tooltip-standard)
21. [Chart Headline Standard](#21-chart-headline-standard)
22. [Chapter Map and UI Layout](#22-chapter-map-and-ui-layout)
23. [Narrative Generation](#23-narrative-generation)
24. [Open Configuration Decisions](#24-open-configuration-decisions)
25. [Metric Reference Table](#25-metric-reference-table)

---

## 1. Problem Statement

The team operates as a SOC and IR function using Jira Cloud as the system of record. Ticket work is fully reactive -- no sprint planning, no epics, no backlog grooming. Tickets arrive from multiple sources (SIEM tools, email filtering, cloud asset ownership, DLP engines, manual escalations), are worked, and are closed. The lifecycle is linear and non-repeating per ticket.

Leadership needs to answer three questions the existing Jira reporting cannot answer:

1. **Is the team adequately staffed** relative to current and projected alert volume?
2. **Where are the capacity and process bottlenecks** by ticket category?
3. **What will staffing requirements look like** given seasonal patterns, team changes, and known upcoming events?

This dashboard answers all three using metrics correct for a reactive security operations context, derived from Jira data the team already produces and team context the manager provides.

---

## 2. Why Standard Metrics Fail SOC

### Mean Time to Close Is Misleading

Ticket resolution time distributions are right-skewed. A single multi-day incident drags the mean far above what most tickets actually take. MTTC is easily gamed, treats a spam filter alert identically to a P1 incident, and tells you nothing about where time was lost or why.

**Decision:** MTTC is demoted to a footnote detail. It is never a headline metric.

### SLA Language Does Not Apply

SOC is not a support function. There is no customer waiting on a ticket. There is no external contract defining breach. Applying SLA framing to SOC metrics produces two problems:

First, it implies an obligation that does not exist, which distorts how findings are communicated to leadership. Second, it requires externally defined thresholds that are meaningless for a team that has never had them -- a threshold set arbitrarily is noise, not signal.

**Decision:** All threshold language is replaced with operational tempo language. Color coding is driven by deviation from the team's own historical baseline, not breach of an external target. When a metric turns red it means the team's own normal behavior has shifted and warrants investigation -- not that anyone failed a commitment.

The single exception is TTFT for P1 incidents in the IR project, where an "acknowledgment target" (team-set, not externally imposed) is appropriate given genuine operational consequence of a missed detection.

### Standard Engineering Metrics Do Not Apply

| Engineering Concept | Why It Fails for SOC |
|---|---|
| Story points / velocity | No estimation, no sprints, work is not chosen |
| Epic grouping | No epics exist in this workflow |
| Reopened rate | Tickets do not reopen -- each event is a new ticket |
| Predictability CV | Reactive queues are inherently high-variance |
| Reporter as signal | Reporter field is always the same integration account |
| Sprint burndown | No sprints |
| Flow efficiency (complex multi-state) | Linear lifecycle means wait = queue time before first touch |

### What the SOC Workflow Actually Looks Like

```
Alert / Email / Rule fires
        │
        ▼
Ticket created in Jira  ← Lead Time starts
        │
        ▼
Sits in queue ← TTFT accumulating (working hours only)
        │
        ▼
Analyst picks it up ← TTFT ends, Cycle Time starts
        │
        ▼
Active work (may include post-active wait if ticket re-queues)
        │
        ▼
Ticket closed ← Cycle Time ends, Lead Time ends
```

Two primary durations. One ticket. The split between them is where almost all process problems hide.

---

## 3. Domain Assumptions and Constraints

The following are treated as hard constraints, not configurable options:

- Tickets do not reopen. Each security event produces a new ticket.
- There are no epics. Grouping is semantic: source system, asset class, entity type, label, keyword.
- The reporter field carries no analyst signal. It is excluded from all metrics and dimensions.
- There are at minimum two Jira projects: one for standard SOC tickets, one for IR incidents. The dashboard supports both simultaneously with cross-project analysis.
- Standard SOC tickets are generated primarily by SIEM and security tooling. Titles follow structured, machine-generated patterns rather than natural language.
- Priority fields exist but are not operationally enforced. The Priority Separation Index validates whether priority-gated metrics are reliable before displaying them.
- Incident tickets operate on a different time scale than standard tickets. They are analyzed in a dedicated chapter with separate acknowledgment targets.
- No externally imposed SLAs. Thresholds are derived from the team's own historical baseline. Red means "outside your normal" not "you breached a commitment."

---

## 4. Working Hours Model

Every duration in every metric is computed in **working hours only**. Wall-clock time is never used as a metric input.

### Schedule Definition

```
WorkSchedule {
  timezone: string          // IANA tz identifier e.g. "America/New_York"
  workDays: DayOfWeek[]    // e.g. ["MON", "TUE", "WED", "THU", "FRI"]
  shifts: Shift[]
}

Shift {
  name: string             // "Day", "Evening", "Night", "On-Call"
  startHour: number        // 0-23, local timezone
  endHour: number          // 0-23, local timezone
}
```

Multiple shifts per day are supported for follow-the-sun or 24/7 coverage models.

### Duration Accumulation Algorithm

Given two timestamps `T_start` and `T_end`:

1. Walk from `T_start` toward `T_end` in configurable intervals (1-minute default)
2. At each interval evaluate: is this moment within a defined shift on a defined workDay in the configured timezone?
3. Accumulate only moments that pass the check
4. Return total accumulated working minutes converted to working hours

Context ledger events (analyst absence, system downtime, holidays) are applied as exclusion windows within this algorithm. Duration accumulated during a ledger-excluded window is flagged, not discarded -- the raw duration and the adjusted duration are both stored.

### Rollover Detection

A ticket rolls over when it is still open at the boundary of a shift end. Rollover is evaluated per shift boundary, not per calendar day. Incident-origin rollovers are flagged separately from standard ticket rollovers.

---

## 5. Data Layer -- Jira API

### Authentication

```
Method: HTTP Basic Auth
Header: Authorization: Basic base64(email:api_token)
Base URL: https://{tenant}.atlassian.net
```

All API calls are made directly from the browser. Jira Cloud supports cross-origin requests with valid credentials. No backend proxy is required.

### Required Endpoints

| Purpose | Endpoint | Notes |
|---|---|---|
| List accessible projects | `GET /rest/api/3/project/search` | Paginated |
| Get project statuses | `GET /rest/api/3/project/{key}/statuses` | Per issue type |
| Search issues | `GET /rest/api/3/search` | JQL with `expand=changelog` |
| Get issue changelog | `GET /rest/api/3/issue/{key}/changelog` | Full transition history |
| Get project components | `GET /rest/api/3/project/{key}/components` | Optional dimension |

### Data Collected Per Ticket

```
Issue {
  key: string
  summary: string               // raw title -- normalized in pipeline
  created: ISO8601
  resolutiondate: ISO8601 | null
  status: { name: string }
  issuetype: { name: string }
  priority: { name: string }
  assignee: { displayName: string } | null
  labels: string[]
  components: [{ name: string }]
  changelog: {
    histories: [
      {
        created: ISO8601
        items: [
          {
            field: string       // look for "status", "assignee", "comment"
            fromString: string
            toString: string
          }
        ]
      }
    ]
  }
}
```

### JQL Strategy

```
// All tickets in scope
project IN ({projectKeys})
  AND created >= "{dateRangeStart}"
  AND created <= "{dateRangeEnd}"
  ORDER BY created ASC

// Active (open) tickets for queue depth
project IN ({projectKeys})
  AND statusCategory != Done
  ORDER BY created ASC
```

Pagination: 100 issues per request. Fetch until `total` is exhausted.

---

## 6. Dynamic Discovery Pipeline

Nothing about the Jira environment is assumed. Discovery runs on every project selection change.

### Project Discovery

```
On credentials entry:
  GET /rest/api/3/project/search (paginated)
  Filter to projects the API key has browse access to
  Present as multi-select tree in left drawer
  IR project is user-tagged ("this is the incident project")
  Tag stored in vault
```

### Status Discovery and Classification

```
For each selected project:
  GET /rest/api/3/project/{key}/statuses
  Deduplicate status names case-insensitively across all projects and types
  Produce unique status manifest for session

Classification UI:
  [ "In Progress"    ]  →  [ Queue  |  ● Active  |  Done ]
  [ "Backlog"        ]  →  [ ● Queue |  Active   |  Done ]
  [ "Awaiting Info"  ]  →  [ ● Queue |  Active   |  Done ]
  [ "Resolved"       ]  →  [ Queue  |  Active   |  ● Done ]
```

Smart defaults via fuzzy match against known vocabulary. User confirms all. Confirmed mappings stored per project key in vault. Subsequent sessions only re-classify novel statuses.

**Conflict resolution:** one status name = one classification, enforced globally within session.

### TTFT Anchor Discovery

During status classification, user identifies which transition marks first touch:

```
Options:
  (a) Any transition away from initial status
  (b) Transition into a specific named Active-class status
  (c) Assignee field populated (fallback when no status change occurs at pickup)

Validation: reject anchor configurations that produce zero or negative cycle time
Flag projects with inconsistent TTFT anchors in cross-project comparisons
```

Confirmed per project, stored in vault.

### Label Discovery

```
On project selection:
  Aggregate all unique labels across all tickets in selected projects
  Frequency-rank labels
  Present as Tier 1 filter dimension (not buried in settings)
  Labels with count < configurable threshold hidden by default
  User can pin any label as a permanent filter axis
```

Labels are the primary user-controlled semantic taxonomy. They are treated as authoritative and dynamic, not as a static configuration.

---

## 7. SIEM Title Normalization

SIEM-generated alert titles are structured strings, not natural language. Naive token frequency on raw titles produces garbage clusters because entity values (usernames, IPs, hostnames) are unique per alert instance while the alert rule name is the true cluster key.

### Entity Normalization

Every title passes through normalization before any clustering:

```
Entity pattern → replacement token

IPv4 address                    → <IP>
IPv6 address                    → <IPV6>
Hostname (regex pattern)        → <HOST>
Username patterns               → <USER>
Email address                   → <EMAIL>
File hash (MD5/SHA1/SHA256)     → <HASH>
File path                       → <PATH>
URL                             → <URL>
Embedded timestamp              → <TIMESTAMP>
Port number                     → <PORT>
Cloud resource ID               → <RESOURCE_ID>
CVE identifier                  → kept as-is (CVE-YYYY-NNNNN is signal)
```

**The normalized title after entity stripping is the cluster key.**

Entity values stripped during normalization are stored as secondary dimensions -- available for "how many distinct IPs triggered this rule" queries without polluting the cluster.

### SIEM Structural Pattern Detection

Different SIEM tools produce recognizable structural signatures:

```
Pattern 1: Severity prefix bracket
  "[CRITICAL] Unauthorized Access Attempt - Host: <HOST>"
  Extracted: severity=CRITICAL, rule="Unauthorized Access Attempt"
  Entity type=Host

Pattern 2: Vendor namespace
  "AWS GuardDuty: UnauthorizedAccess:IAMUser/MaliciousIPCaller"
  "Microsoft Defender: Ransomware behavior detected on <HOST>"
  Extracted: source_system=GuardDuty|Defender, rule=namespace:type/subtype

Pattern 3: Pipe-delimited key-value
  "DLP Alert | Policy: PII-SSN | Endpoint: <HOST> | Action: Block"
  Extracted: category=DLP, policy_name="PII-SSN", entity_type=Endpoint

Pattern 4: Plain rule name
  "Phishing Email Detected"
  "Impossible Travel Alert"
  Extracted: full normalized title is the rule name
```

Source system detected from title prefix or known label values. This populates the source system dimension automatically.

### Clustering Confidence

```
High confidence:   title matches a known SIEM structural pattern
Medium confidence: entity normalization succeeded, rule name extracted
Low confidence:    title is free-form or non-standard

Low-confidence clusters are flagged in the UI.
User can manually assign a label to a low-confidence cluster.
Manual assignment stored in vault as a title-pattern → cluster-name lookup.
This lookup grows across sessions -- discovery gets smarter over time.
```

---

## 8. Dimension Model

All metrics are filterable and segmentable by the following dimensions. Every dimension is discovered from data, never hardcoded.

### Tier 1: Labels (User-Controlled Taxonomy)

Jira labels as applied by the team. Aggregated and frequency-ranked on project load. Treated as the primary semantic layer because they represent the team's own classification decisions.

### Tier 2: Structural Dimensions (Discovered from API)

**Issue Type** -- discovered per project, not assumed  
**Priority** -- discovered per project, validity gated by Priority Separation Index

### Tier 3: Derived Dimensions (Computed from Normalization)

**Alert Rule Name** -- entity-normalized title, the true cluster key for SIEM-sourced tickets

**Source System** -- which tool generated the alert  
```
Examples: GuardDuty, Defender, Splunk ES, Proofpoint, CrowdStrike, DLP Engine, Manual
Detected from: title structural pattern, label, or component field
```

**Asset Class** -- class of asset involved, derived from entity types present in title
```
<HOST> present          → Endpoint
<IP> without <HOST>     → Network
<EMAIL> present         → Email / Identity
<RESOURCE_ID> present   → Cloud
<USER> only             → Identity
Multiple present        → Multi-class (flagged separately)
```

**Entity Type** -- what kind of entity is the subject  
```
User | Host | IP | Email | File | Policy | Cloud Resource | Unknown
```

### Tier 4: Temporal Dimensions (Computed from Timestamps)

**Time-of-Day Band**
```
Business hours   = within configured primary shift
After-hours      = outside all configured shifts
Shift boundary   = within 30 minutes of any shift start or end
```

After-hours alerts with fast TTFT = on-call coverage signal  
After-hours alerts with high TTFT = coverage gap signal  
Shift-boundary tickets = rollover risk signal

**Day-of-Week**  
Monday-Sunday. Weekly intake profile reveals structural patterns (Monday morning email surge, weekend baseline).

**Week-of-Year** (for projection)  
Required for seasonal decomposition. Meaningful only with 6+ months of history.

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

---

## 12. Staffing Assessment Model

### Priority Separation Index

Run before any priority-gated metric is displayed:

```
Priority Separation Index = TTFT_P85(highest_priority) / TTFT_P85(lowest_priority)

Expected if priority is enforced: ratio << 1 (high priority touched much faster)
If ratio ≈ 1: priority is not operationally enforced

Gate:
  If Priority Separation Index < threshold (default 0.5):
    Suppress priority-weighted metrics
    Display: "Priority field exists but is not reflected in response behavior.
              Priority-based metrics are hidden to avoid false precision."
  If >= threshold:
    Enable priority-weighted metrics with index score visible
```

### The Four Staffing Signals

**Signal 1: Queue Pressure**
```
Net velocity trend direction over the selected period
Combined with: TTFT P85 trend direction
Both signals together determine which quadrant of the verdict matrix applies
```

**Signal 2: Surge Capacity**
```
Surge absorption score
Velocity under load slope
```

**Signal 3: Category Balance**
```
Per-category net velocity
Most-negative category = active bottleneck
```

**Signal 4: Incident Cost**
```
Standard ticket throughput and TTFT degradation during IR open windows
Quantifies the capacity tax of incident response on standard operations
```

### Staffing Verdict Matrix

```
                        TTFT P85 Degrading?
                          YES                    NO
                    ┌──────────────────┬────────────────────┐
Queue Depth    YES  │  UNDERSTAFFED    │  ROUTING PROBLEM   │
Growing             │                  │                    │
                    │  Coverage gap.   │  Volume and speed  │
                    │  TTFT and queue  │  are both moving   │
                    │  both worsening. │  but work isn't    │
                    │  Add coverage    │  reaching the      │
                    │  or reduce       │  right people.     │
                    │  intake via      │  Fix assignment    │
                    │  automation.     │  or prioritization.│
                    ├──────────────────┼────────────────────┤
Queue Depth    NO   │  SURGE EVENT     │  HEALTHY /         │
Stable or           │                  │  OVER-STAFFED      │
Shrinking           │  Check IR        │                    │
                    │  correlation.    │  Monitor for trend │
                    │  Likely incident │  change. Consider  │
                    │  is suppressing  │  automation        │
                    │  standard work.  │  investment.       │
                    └──────────────────┴────────────────────┘
```

Leadership sees the verdict as prose. The matrix is the internal model. See Section 23 for the narrative output format.

---

## 13. Projection Framework

Projection requires two inputs: historical Jira data (available) and team context (entered via Manager Context Ledger, Section 14). Projection without team capacity input produces numbers that look precise but are meaningless.

### Inferrable Signals From Jira Data

**Time-of-day intake profile**
```
Avg intake rate per hour of day across full history
Reveals: which hours are high-load vs low-load
Use: shift staffing recommendations, coverage gap identification
```

**Day-of-week intake profile**
```
Avg intake rate per day of week across full history
Reveals: Monday spikes, weekend baseline, Friday drops
Use: schedule optimization input
```

**Seasonal decomposition** (requires 6+ months of history)
```
Method: STL decomposition on weekly intake rate
Components:
  Trend     → is overall volume growing or shrinking over months?
  Seasonal  → predictable annual patterns (Q4 phishing, tax season, etc.)
  Residual  → unexplained variance (campaigns, rule changes, incidents)

If < 6 months history:
  Seasonal component suppressed
  Projection uses trend + residual only
  UI note: "Seasonal patterns require more history -- projection is trend-only"
```

**Rule deployment detection** (auto-flagged)
```
Intake spike that is:
  Concentrated in one normalized alert rule name cluster
  Sudden onset (single day or less)
  Not correlated with other cluster volume changes

→ Flag as "Possible rule deployment event"
→ Annotate on projection timeline
→ Prevent projection model from treating this spike as sustained demand growth
```

**Campaign detection** (auto-flagged)
```
Rapid recurrence spike + concentration in time window + new entity values

→ Flag as "Active campaign detected"
→ Annotate on projection timeline
→ Campaigns are time-bounded -- projection accounts for normalization
```

### Team Capacity Model

Entered via Manager Context Ledger (Section 14). Required for projection.

```
Inputs:
  Current headcount: N analysts
  Coverage by shift: [shift name → analyst count]
  Historical throughput per analyst: derived from (total close rate / headcount)
    (system calculates this -- manager just confirms headcount)

Derived:
  Team Capacity Score = effective_analysts × avg_throughput_per_analyst
  
When headcount changes are logged in the ledger:
  Capacity line adjusts at the logged date
  Delta between projected demand and projected capacity = staffing gap forecast
```

### Projection Output

```
Three curves over configurable forward window (30 / 60 / 90 days):

1. Projected Intake Band
   Based on: historical trend + seasonal component + campaign/rule signals
   Displayed as P25-P75 range -- not a single line
   Uncertainty band visibly widens with time horizon (honest about precision limits)

2. Current Capacity Line
   Based on: team capacity score
   Adjusted at ledger event dates: absence windows drop line, new hires raise it
   Known future events shown as projected line changes

3. Staffing Gap Area
   Gap = Projected Intake Band - Capacity Line
   Positive gap = projected demand exceeds capacity
   Displayed as shaded area between the curves, colored by severity
```

### Projection Annotations

Every ledger event and auto-detected signal annotates the projection timeline:

```
Past annotations (anchors the model):
  [🏥] Analyst absence window
  [⚙️] Rule deployment detected
  [⚠️] Incident window
  [🔴] Campaign detected
  [🏖️] Holiday

Future annotations (shapes the projection):
  [👤] Planned new hire
  [🏥] Planned absence
  [🏖️] Holiday
  [📋] Planned audit / non-ticket work period
```

Each annotation has a tap target that shows: what it is, what its estimated impact on intake or capacity was/will be, and how the model accounts for it.

---

## 14. Manager Context Ledger

This is a first-class chapter, not a settings screen. It is the mechanism by which the manager tells the system about things that happened to the team that Jira cannot see. Every entry modifies how metrics are interpreted and projected.

### Event Types

```
PEOPLE EVENTS
  Analyst absence (sick, leave, training, conference, termination)
  New analyst starts
  Analyst shift change
  Partial coverage (on-call only, reduced hours)

SYSTEM EVENTS
  Tool downtime (SIEM offline, Jira unavailable, integration failure)
  New detection rule deployed (suppresses that cluster's novelty signal)
  Detection rule disabled or tuned (suppresses expected intake drop)

CALENDAR EVENTS
  Holiday (by region -- affects both intake patterns and capacity)
  Incident window (auto-populated from IR project, manually addable)
  Audit or compliance period (analysts pulled from ticket work)
  Planned maintenance window
```

### Event Entry

```
Each event requires:
  Type (from above taxonomy)
  Date range (start datetime, end datetime)
  Description (free text, brief)
  Scope: All shifts | Specific shift | Specific analyst (opt-in if assignee data enabled)
  
Optional:
  Estimated capacity impact % (pre-filled by system based on scope)
```

### Impact Preview

As events are entered or edited, an impact preview updates in real time:

```
"This absence reduces team capacity by 20% for 5 working days.
 Based on current volume, expect approximately 34 additional 
 tickets to accumulate across this window."

"This holiday reduces expected email threat intake by ~35% 
 based on historical holiday patterns, while automated alert 
 intake remains near baseline."
```

The impact preview makes the ledger feel consequential rather than administrative.

### Calendar View

Month grid with color-coded event bands:

```
Red band    = analyst absence
Orange band = system downtime
Blue band   = holiday
Yellow band = rule deployment
Grey band   = incident window (auto from IR project)
Purple band = audit / non-ticket period
```

### How Ledger Events Modify Metrics

**Analyst absence:**
Team capacity denominator decreases for that window. Throughput per remaining analyst recalculated. Net velocity adjusted for reduced capacity. Metrics during absence are displayed with a ledger annotation marker.

**Tool downtime:**
Intake rate during downtime flagged as suppressed (not genuine low volume). TTFT during downtime excluded from baseline calculations. Post-downtime intake spike not treated as surge.

**Rule deployment:**
That cluster's intake spike flagged as deployment artifact. Cycle times for that cluster in the first N days marked as calibration period. Projection baseline not adjusted upward from deployment spike.

**Holiday:**
Capacity line drops (analysts out). Intake pattern adjusted independently by category (email threats drop on holidays, automated alerts do not). Both adjustments applied separately because they affect different things.

---

## 15. Pattern Intelligence

### Volume-Weighted Cluster Ranking

Clusters are ranked by **total capacity consumed**, not by count or cycle time alone:

```
Total Work Hours per cluster = ticket_count × avg_cycle_time

This is the primary sort axis for the cluster view.
A cluster with 100 tickets at 0.5h each consumes 50 analyst-hours.
A cluster with 10 tickets at 8h each consumes 80 analyst-hours.
The second cluster demands priority attention regardless of lower count.
```

### Automation Escalation Tiers

```
ADVISORY (visible pattern)
  Conditions: slow_recurrence_rate > threshold_1
  Label: "Recurring pattern -- worth reviewing"
  
REQUIRED (exceeds work threshold)  
  Conditions: cluster_total_work_hours > H AND slow_recurrence_rate > threshold_2
  Label: "Automation recommended -- significant capacity consumed"

CRITICAL (capacity impact)
  Conditions: cluster in top X% of capacity consumers 
              AND intake_persistence_rate > threshold (closures not reducing intake)
  Label: "Automation-critical -- closing tickets is not resolving the source"
```

Thresholds H, X, and rate values are configurable in vault per project.

### Wasted Work Ratio

```
Wasted Work Ratio = total_hours_on_recurring_patterns / total_hours_all_tickets

Displayed as a headline KPI card in the Patterns chapter.
This is the leadership-facing number that converts pattern intelligence 
into a capacity argument:

"42% of your team's working time is spent on recurring patterns 
 that have not reduced in volume. This is the automation opportunity."
```

### Backlog Suppression Detection

```
Compare closure distribution vs intake distribution by category.

If high-volume-low-effort categories dominate closures 
while high-effort categories have lower closure share than intake share:
  → Backlog suppression detected
  
Interpretation:
  Easy tickets are being cleared preferentially.
  Hard tickets are aging silently.
  Cycle time for complex work rises without an obvious cause.
```

### Category Saturation

```
Per-category net velocity = category close rate - category intake rate
Ranked bar chart, most negative to most positive.
Most negative = current active bottleneck, highlighted in red.
```

### Trending Categories

```
Compare category intake rate: first half vs second half of selected period.
Categories sorted by intake growth rate.
Rising categories are early warning of emerging threat patterns 
or process failures in upstream tooling.
```

---

## 16. Encrypted Storage Design

### Security Model

- No backend. All secrets live in the browser.
- WebCrypto API -- browser-native, platform-agnostic, zero dependencies.
- Password-derived encryption. The password is never stored. The derived key lives only in memory for the session duration.
- AES-GCM -- authenticated encryption. A wrong password fails the MAC check without exposing plaintext.

### Key Derivation

```
On vault creation:
  Generate random 16-byte salt (crypto.getRandomValues)
  Derive key: PBKDF2(password, salt, 310,000 iterations, SHA-256) → AES-256-GCM key

On subsequent unlocks:
  Load stored salt from localStorage
  Re-derive key using same PBKDF2 parameters
  Attempt AES-GCM decrypt
  If MAC verification fails → wrong password, no oracle exposed
```

### Encryption Operation

```
On each save:
  Generate fresh random 12-byte IV (crypto.getRandomValues)
  Encrypt payload with AES-GCM using derived key and fresh IV
  Store: { salt: base64, iv: base64, ciphertext: base64 }
  localStorage key: "soc_vault"
```

### Vault Payload Schema

```json
{
  "tenantUrl": "string",
  "apiKey": "string",
  "irProjectKey": "string",
  "statusMappings": {
    "{projectKey}": {
      "{statusName}": "queue | active | done"
    }
  },
  "ttftAnchors": {
    "{projectKey}": "first_transition | {status_name} | assignee_populated"
  },
  "workSchedule": {
    "timezone": "string",
    "workDays": ["MON", "TUE", "WED", "THU", "FRI"],
    "shifts": [
      { "name": "string", "startHour": 0, "endHour": 23 }
    ]
  },
  "teamCapacity": {
    "headcount": 0,
    "coverageByShift": { "{shiftName}": 0 }
  },
  "acknowledgmentTargets": {
    "{priorityName}": { "ttftMinutes": 0 }
  },
  "clusterLabels": {
    "{projectKey}": { "{normalizedTitle}": "string" }
  },
  "automationThresholds": {
    "{projectKey}": {
      "advisoryRecurrenceRate": 0,
      "requiredWorkHours": 0,
      "criticalCapacityPercent": 0
    }
  },
  "sensitivityLevel": "conservative | standard | sensitive",
  "pinnedLabels": [],
  "contextLedger": [],
  "savedFilters": []
}
```

### Session Behavior

On tab open: prompt for vault password. On successful decrypt: session active, derived key in memory only. On tab close: derived key garbage collected, plaintext never persisted. Vault lock button available in config drawer at all times.

---

## 17. Application Architecture

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React + Vite | Fast, zero backend, pure client-side |
| Styling | Tailwind CSS | Responsive utility classes |
| Charts | Recharts | React-native, composable, accessible |
| Crypto | WebCrypto API | Browser-native, platform-agnostic, zero dependencies |
| State | React Context + useReducer | No external state library needed |
| Storage | localStorage (encrypted) | Persistent across sessions, no backend |

No backend. No server. No build-time secrets. Static bundle, deployable anywhere.

### Module Structure

```
src/
  constants/
    entities.js          // SIEM entity regex patterns
    siemPatterns.js      // known SIEM structural signatures
    stopwords.js         // tokenization stopword list
    thresholds.js        // default metric sensitivity values
    jira.js              // API endpoint strings, pagination sizes

  crypto/
    vault.js             // encrypt, decrypt, key derive, load, save

  api/
    jira.js              // fetch wrappers, pagination, error handling
    projects.js          // project + status discovery
    issues.js            // issue search, changelog fetch

  normalize/
    entities.js          // entity extraction and replacement
    titles.js            // SIEM structural pattern parsing
    clustering.js        // confidence scoring, cluster key generation

  compute/
    workingHours.js      // schedule-aware duration accumulator
    ledger.js            // ledger event application to metric windows
    closure/
      integrity.js       // instant, untouched, valid, stalled, churn classification
    metrics/
      velocity.js        // net velocity, intake rate, close rate
      ttft.js            // time to first touch per ticket
      cycleTime.js       // cycle time, lead time, three-way decomposition
      flowEfficiency.js  // active work time / lead time
      rollover.js        // rollover detection per shift boundary
      aging.js           // aging bucket + stall detection
      surge.js           // surge event detection, absorption score
      prioritySeparation.js  // priority separation index
      staffingVerdict.js     // four-signal matrix evaluation
    projection/
      seasonal.js        // STL decomposition
      capacity.js        // team capacity model
      forecast.js        // intake projection + gap calculation
      events.js          // rule deployment and campaign detection
    clustering/
      recurrence.js      // rapid vs slow recurrence engine
      keywords.js        // token frequency, cluster assignment
      categories.js      // label + issue type + component grouping
      volumeWeight.js    // total work hours per cluster

  components/
    layout/
      TopBar.jsx
      LeftDrawer.jsx
      RightDrawer.jsx
      BottomSheet.jsx
    chapters/
      WatchStatus.jsx       // Chapter 1
      Flow.jsx              // Chapter 2
      ResponseSpeed.jsx     // Chapter 3
      Capacity.jsx          // Chapter 4
      Patterns.jsx          // Chapter 5
      Incidents.jsx         // Chapter 6
      Projections.jsx       // Chapter 7
      Compare.jsx           // Chapter 8
      ManagerLedger.jsx     // Chapter 0
    charts/
      CycleTimeHistogram.jsx
      LeadTimeDecomposition.jsx
      CumulativeFlowDiagram.jsx
      VelocityUnderLoad.jsx
      RolloverHeatmap.jsx
      AgingBuckets.jsx
      ProjectionFanChart.jsx
      CategoryRadar.jsx
      ClusterGrid.jsx
    shared/
      KPICard.jsx           // universal number+arrow+color+sentence component
      NarrativeBlock.jsx    // generated insight prose
      StaffingVerdict.jsx   // verdict card (prose for leaders, matrix behind tap)
      DateRangePicker.jsx
      QuickWindows.jsx      // 7d / 14d / 30d buttons
      Tooltip.jsx           // two-layer tooltip component
      ViewToggle.jsx        // Analyst / Lead / Executive mode switcher
      LedgerEventForm.jsx
      ImpactPreview.jsx

  hooks/
    useVault.js
    useJira.js
    useMetrics.js
    useSchedule.js
    useLedger.js
    useProjection.js
    useViewMode.js

  context/
    AppContext.js           // selected projects, date range, schedule, view mode
    VaultContext.js         // decrypted vault contents for session
```

---

## 18. View Modes

Three view modes share the same data layer and the same KPI cards. What changes is the depth of supporting detail visible without a tap. The number, color, and direction arrow are present in all three modes on all metrics.

```
ANALYST MODE
  All chapters accessible
  All charts expanded by default
  Drill-down to ticket list always visible
  Raw vs clean metric overlay available
  Config drawer accessible

LEAD MODE
  All chapters accessible
  Charts visible but collapsed supporting tables
  Ticket list behind one tap
  Cluster detail expanded
  Manager ledger accessible
  Staffing verdict shown as prose + supporting data one tap away

EXECUTIVE MODE
  Watch Status and Projections prominent
  Staffing verdict shown as prose only (matrix behind "see detail")
  Charts collapsed by default (one tap to expand)
  Ticket list hidden
  Projection statements shown above projection chart
  No raw metric overlays
  No config drawer (vault accessible via separate auth)
```

View mode toggle is always visible in the top bar. A leader can flip to Analyst mode at any time. An analyst can flip to Executive mode to see what their manager sees.

---

## 19. Universal KPI Card Standard

Every metric in the application renders as a single unit. Elements never rendered separately.

```
┌──────────────────────────────┐
│  METRIC LABEL                │
│                              │
│  17  ↗  🟡                  │
│                              │
│  "Slowing -- up from 9       │
│   last period"               │
└──────────────────────────────┘
```

**The number:** exact, readable precision (4.3h not 4.31247h, 17 not 16.8)

**The direction arrow:** movement since the prior equivalent period
```
↗  Rising
↘  Falling
→  Stable (within ±5% of prior period)
```

**The color:** deviation from the team's own rolling baseline
```
🟢  Within 1σ of historical baseline for this metric
🟡  1-2σ outside baseline
🔴  > 2σ outside baseline OR sustained directional trend over N days
⚪  Insufficient data (< 7 days of history for this metric)
```

**Color and direction are independent signals.** Throughput rising is 🟢↗. TTFT rising is 🔴↗. A metric can be 🔴→ (already bad, not getting worse yet). These combinations mean different things and both must be visible.

**The sentence:** one line, what is happening and why it matters. Not a definition. Not a label. Changes with data.

---

## 20. Tooltip Standard

Every metric has a "?" icon. One tap or hover reveals Layer 1. A second tap or "learn more" link reveals Layer 2.

**Layer 1 (always the first thing seen):**
What is happening and why it matters right now. For this team. In plain language.

```
Example for TTFT P85:
  "Your team takes up to 4.3 working hours to first look 
   at a ticket. This is twice as slow as your recent normal."
```

**Layer 2 (on demand):**
How it is calculated. What moves it up or down. What the healthy direction looks like.

```
Example for TTFT P85:
  "Time to First Touch P85 is the working-hour duration 
   from when a ticket was created to when an analyst first 
   changed its status, measured at the 85th percentile.
   
   It rises when: queue depth grows, analysts are absent, 
   or high-priority work pulls attention from new tickets.
   
   It falls when: coverage improves, volume drops, 
   or routing becomes more efficient.
   
   85th percentile means 85% of your tickets were touched 
   faster than this number."
```

Layer 2 is for analysts and curious leaders. Layer 1 is for everyone. Neither layer uses the word "SLA."

---

## 21. Chart Headline Standard

Chart titles are insight statements, not chart names. The headline changes dynamically as data changes.

```
WRONG:  "Intake Rate vs Close Rate"
RIGHT:  "Your team is falling behind -- intake has exceeded 
         closures for 11 of the last 14 days"

WRONG:  "Cycle Time Distribution"
RIGHT:  "Most tickets resolve in under 2 hours, 
         but 15% take over a day"

WRONG:  "Rollover Heatmap"
RIGHT:  "Thursday night shift consistently carries 
         unfinished work into the next day"

WRONG:  "Ticket Aging"
RIGHT:  "6 tickets have not been touched in over 24 hours"

WRONG:  "Cluster View"
RIGHT:  "Phishing alerts consume 38% of your team's time 
         and are flagged for automation"
```

The chart is supporting evidence for the headline statement. The headline is the finding. Both are always present together.

---

## 22. Chapter Map and UI Layout

### Top Bar (Always Visible)

```
┌──────────────────────────────────────────────────────────────────┐
│ [≡ Projects]  ● PROJ-SOC  ● PROJ-IR   [7d][14d][30d][Custom▼]  │
│ [Analyst ▾]                                    [⚙ Vault]        │
│                                                                  │
│ Queue: 23 ↗ 🟡   Net Velocity: -1.4/hr ↘ 🔴                    │
│ Oldest Untouched: 6.2h 🔴   Stalled: 3 tickets 🟡               │
│ ⚠ Active Incident: INCIDENT-47 (open 3.1 working hours)          │
└──────────────────────────────────────────────────────────────────┘
```

### Chapter 0: Manager Context Ledger

Accessible from top bar. Persistent across sessions.

```
LEFT:   Calendar month grid, color-coded event bands
RIGHT:  Event ledger (reverse chronological), [+ Add Event] button
BOTTOM: Impact preview (real-time update as events are added/edited)
```

### Chapter 1: Watch Status

Pinned summary at top of main content area.

```
KPI Cards (row):
  Queue Depth  |  Net Velocity  |  TTFT P85  |  Surge Score
  Instant Closure Rate  |  Stalled Count  |  Rapid Recurrence Rate
  
Verdict sentence per selected project.
Active incident alert with working-hour age.
Rapid recurrence alerts if any cluster in URGENT escalation tier.
```

### Chapter 2: Flow (Default Landing)

```
Headline: "[Generated insight about intake vs closure trend]"

Intake Rate vs Close Rate (dual line, divergence highlighted)
Net Velocity trend (area, green above zero / red below)
CFD toggle
Surge event markers on timeline
Rule deployment markers on timeline

Controls:
  Quick windows: [7d] [14d] [30d]
  Custom date picker
  Project toggle: [Combined] [Per Project]
  Dimension filter: source system, asset class, label, day-of-week

Category intake/close breakdown (stacked bar)
```

### Chapter 3: Response Speed (Right Slide-Out)

```
TTFT Distribution
  Histogram per dimension cluster
  P50 / P85 / P95 callout cards
  Baseline deviation coloring (no fixed threshold lines)
  
Lead Time Three-Way Decomposition
  Horizontal bar per cluster:
    [ Queue Wait (TTFT) | Active Work Time | Post-Active Wait ]
  Color: wait=amber, active=teal, post-active=orange
  
Flow Efficiency per cluster
  Bar cards: 🟢 > 70% / 🟡 30-70% / 🔴 < 30%

Velocity Under Load scatter
  Queue depth (x) vs close rate (y)
  Trend line, cliff detection annotation if present

Cycle Time P50/P85/P95
  Per cluster, current vs prior period delta
```

### Chapter 4: Capacity (Right Slide-Out)

```
Staffing Verdict (top)
  Prose statement + verdict label
  Supporting data collapsed by default (one tap)

Rollover Heatmap
  x=day, y=shift, color=severity
  Incident windows overlaid, toggle to show/hide

Ticket Aging Buckets
  Untouched / Active-then-cold / Being Worked split per bucket
  Tap any bucket → ticket list

Surge Absorption Score card

Analyst Load Distribution (opt-in)
  Per-analyst bar chart

Incident Cost to Queue (IR project selected)
  Throughput and TTFT delta per incident window
```

### Chapter 5: Patterns (Right Slide-Out)

```
Wasted Work Ratio KPI card (top)

Cluster Grid (ranked by total work hours)
  Per cluster:
    Name | Count | Total Work Hours | TTFT P85 delta | Cycle Time P85 delta
    Recurrence type | Automation escalation tier badge
  Tap → cluster drill-down

Rapid Recurrence Panel
  Clusters with active rapid recurrence
  Source still firing flag, recommended action

Slow Recurrence Panel
  Clusters with persistent slow recurrence
  Automation escalation tier, intake persistence rate

Category Saturation chart
  Per-category net velocity ranked bar

Trending Categories
  Intake growth rate ranked
  
Backlog Suppression flag (if detected)
```

### Chapter 6: Incidents (IR Project)

```
TTFT by Priority with acknowledgment target lines
Incident Cycle Time Distribution (separate scale)
Active Incident Timeline (Gantt)
Incident Frequency Trend
Cross-Project Queue Impact
```

### Chapter 7: Projections

```
TOP: Three action statements (the actual output)
  "At current volume and staffing, demand will exceed 
   capacity in approximately 3 weeks."
  "Adding one analyst to day shift pushes that to ~9 weeks."
  "Q4 historical pattern suggests a 40% intake increase 
   starting late November."

Projection Fan Chart (collapsed by default in Executive mode)
  Three curves: projected intake band, capacity line, gap area
  Annotation markers for all ledger events

Controls:
  Forward window: [30d] [60d] [90d]
  Scenario: [Current staffing] [+1 analyst] [+1 shift]

Supporting charts:
  Time-of-day intake profile
  Day-of-week intake profile
  Seasonal decomposition components (if sufficient history)
```

### Chapter 8: Compare (Multi-Project)

```
Side-by-side KPI table per project
Normalized radar chart
  Axes: TTFT P85 | Flow Efficiency | Net Velocity | Rollover Rate | Surge Score
Summary: healthiest / most at risk project with reasoning
```

---

## 23. Narrative Generation

Every chapter generates one or more insight statements computed from live metric values. These select different sentence structures based on values and their relationships.

### Staffing Verdict (Leadership Output)

```
┌──────────────────────────────────────────────────────┐
│  ASSESSMENT: ROUTING PROBLEM                         │
│                                                      │
│  Volume is manageable and analysts are closing       │
│  tickets at a healthy rate. However, response time   │
│  to high-priority tickets is not meaningfully        │
│  faster than low-priority ones. Work is not          │
│  reaching the right people fast enough.              │
│                                                      │
│  This is not a headcount problem.                    │
│  Recommended action: review assignment rules.        │
│                                                      │
│  [See supporting data ▼]                            │
└──────────────────────────────────────────────────────┘
```

### Pattern Intelligence Output

```
"Phishing-related alerts (34 tickets) are your largest 
 capacity consumer at 41 working hours this period. 
 The pattern has recurred consistently for 45 days 
 with no reduction in intake after closures. 
 This is an automation-critical finding."
```

### Projection Output

```
"Based on your current team of 6 analysts and the historical 
 intake trend, your queue will begin growing in approximately 
 3 weeks if volume follows seasonal patterns.
 
 Last Q4 saw a 40% intake increase over 6 weeks. If that repeats, 
 you would need coverage equivalent to 1.5 additional analysts 
 starting mid-November.
 
 The planned absence of 2 analysts in October reduces your 
 buffer window by approximately 8 days."
```

---

## 24. Open Configuration Decisions

| Decision | Options | Recommendation |
|---|---|---|
| Instant closure threshold | Working minutes after creation | Default 5 min, configurable |
| Rapid recurrence window | Working hours | Default 24h, configurable per project |
| Slow recurrence window | Calendar days | Default 14d, configurable per project |
| Recurrence similarity threshold | Jaccard 0.5-0.8 | Default 0.6, configurable |
| Surge detection sensitivity | Standard deviation multiplier | Default 2.0 (1.5 = sensitive, 2.5 = conservative) |
| Automation tier thresholds | Work hours, recurrence rate | Require explicit setup on first use |
| Acknowledgment target for IR | Minutes per priority | Require explicit setup -- no default |
| Stall detection multiplier | K × P95 cycle time | Default 1.5, configurable |
| Analyst data opt-in | Assignee metrics | Explicit toggle, off by default |
| Seasonal projection threshold | Months of history required | Default 6 months, suppress below |
| IR project identification | Which project is incident response | User-tagged at project selection |
| View mode default | Analyst / Lead / Executive | Default Analyst, remembered per session |
| Cluster minimum frequency | Min tickets to form keyword cluster | Default 3, configurable |
| Baseline deviation window | Rolling window for green/yellow/red | Default 30d, configurable |

---

## 25. Metric Reference Table

| Metric | Formula | Unit | Chapter | Notes |
|---|---|---|---|---|
| Net Velocity | Close Rate - Intake Rate | tickets/working hr | 1, 2 | Primary operational signal |
| Intake Rate | tickets created / working hours | tickets/hr | 2 | Per dimension, rolling window |
| Close Rate | tickets closed / working hours | tickets/hr | 2 | Valid tickets only (default) |
| TTFT P85 | 85th pct of (first_touch - created) | working hours | 1, 3 | Per dimension cluster |
| Lead Time P85 | 85th pct of (closed - created) | working hours | 3 | Three-way decomposed |
| Queue Wait | T(first_touch) - T(created) | working hours | 3 | = TTFT |
| Active Work Time | Sum of Active-class status durations | working hours | 3 | Post-normalization |
| Post-Active Wait | Queue-class time after first touch | working hours | 3 | Requeue signal |
| Cycle Time P85 | 85th pct of (closed - first_touch) | working hours | 3 | Per cluster, not global |
| Flow Efficiency | Active Work Time / Lead Time | percentage | 3 | Valid tickets only |
| Velocity Under Load | Close rate vs queue depth slope | regression | 3 | Surge ceiling detection |
| Rollover Rate | Open at shift end / WIP | percentage | 4 | Incidents excluded from standard rate |
| Stalled Count | Tickets active-then-cold > P95 × 1.5 | count | 1, 4 | Distinct from untouched |
| Surge Absorption Score | Surge days within baseline / total | percentage | 4 | Per configurable window |
| Incident Cost to Queue | Throughput delta during IR windows | tickets/hr | 4, 6 | Cross-project |
| Priority Separation Index | TTFT_P85(P1) / TTFT_P85(lowest) | ratio | 4 | Gates priority metrics |
| Instant Closure Rate | Instant closes / total tickets | percentage | 1, 10 | Data quality signal |
| Untouched Closure Rate | Untouched closes / total tickets | percentage | 10 | Automation artifact signal |
| Work Churn Rate | Tickets with Active→Queue→Active / total | percentage | 10 | Intra-ticket instability |
| Rapid Recurrence Rate | Rapid recurrences / total tickets | percentage | 1, 5 | Source still active signal |
| Slow Recurrence Rate | Slow recurrences / total tickets | percentage | 5 | Automation opportunity signal |
| Intake Persistence Rate | Post-closure intake / pre-closure intake | ratio | 5 | Non-resolving work flag |
| Total Work Hours | ticket_count × avg_cycle_time per cluster | hours | 5 | Primary cluster sort axis |
| Wasted Work Ratio | Hours on recurring patterns / total hours | percentage | 5 | Leadership automation argument |
| Category Net Velocity | Category close rate - category intake rate | tickets/hr | 5 | Bottleneck identification |
| Closure Burst Rate | Burst events / total close events | percentage | 4 | End-of-shift gaming detection |
| MTTC | mean(closed - created) | working hours | footnote | Demoted -- context only |

---

*End of Design Document v1.1*
