# SOC Productivity Dashboard — Design Document

**Version:** 1.0  
**Status:** Pre-Implementation  
**Scope:** Single-page application, client-side only, Jira Cloud API

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Why Standard Metrics Fail SOC](#2-why-standard-metrics-fail-soc)
3. [Domain Assumptions and Constraints](#3-domain-assumptions-and-constraints)
4. [Working Hours Model](#4-working-hours-model)
5. [Data Layer — Jira API](#5-data-layer--jira-api)
6. [Dynamic Discovery Pipeline](#6-dynamic-discovery-pipeline)
7. [Unified Metric Stack](#7-unified-metric-stack)
8. [Staffing Assessment Model](#8-staffing-assessment-model)
9. [Pattern Intelligence](#9-pattern-intelligence)
10. [Encrypted Storage Design](#10-encrypted-storage-design)
11. [Application Architecture](#11-application-architecture)
12. [Chapter Map and UI Layout](#12-chapter-map-and-ui-layout)
13. [Narrative Generation](#13-narrative-generation)
14. [Open Configuration Decisions](#14-open-configuration-decisions)
15. [Metric Reference Table](#15-metric-reference-table)

---

## 1. Problem Statement

The team operates as a SOC and IR function using Jira Cloud as the system of record. Ticket work is fully reactive -- no sprint planning, no epics, no backlog grooming. Tickets arrive from multiple sources (email filtering, cloud asset ownership, DLP alerts, incidents), are worked, and are closed. The lifecycle is linear and non-repeating per ticket.

Leadership needs to answer two questions the existing Jira reporting cannot answer:

1. **Is the team adequately staffed** relative to current and projected alert volume?
2. **Where are the capacity and process bottlenecks** by ticket category?

This dashboard answers both questions using metrics that are correct for a reactive security operations context, derived from Jira data the team already produces.

---

## 2. Why Standard Metrics Fail SOC

### Mean Time to Close (MTTC) Is Misleading

Ticket resolution time distributions are right-skewed. A single multi-day incident drags the mean far above what most tickets actually take. MTTC is easily gamed (close easy tickets, defer hard ones), treats a spam filter alert identically to a P1 incident, and tells you nothing about where time was lost or why.

**Decision:** MTTC is demoted to a footnote detail. It is never a headline metric.

### Standard Engineering Metrics Do Not Apply

| Engineering Concept | Why It Fails for SOC |
|---|---|
| Story points / velocity | No estimation, no sprints, work is not chosen |
| Epic grouping | No epics exist in this workflow |
| Reopened rate | Tickets do not reopen -- each event is a new ticket |
| Predictability CV | Reactive queues are inherently high-variance -- this always reads "unpredictable" |
| Reporter as signal | Reporter field is always the same integration account |
| Sprint burndown | No sprints |
| Flow efficiency (complex) | Linear lifecycle means wait = queue time before first touch only |

### What the SOC Workflow Actually Looks Like

```
Alert / Email / Rule fires
        │
        ▼
Ticket created in Jira
        │
        ▼
Sits in queue (this wait time is the primary SLA gap)
        │
        ▼
Analyst picks it up (first touch -- TTFT ends here)
        │
        ▼
Analyst works it (Cycle Time begins)
        │
        ▼
Ticket closed (Cycle Time ends)
```

Two durations. One ticket. The split between them is where almost all process problems hide.

---

## 3. Domain Assumptions and Constraints

The following are treated as hard constraints, not configurable options:

- Tickets do not reopen. Each security event produces a new ticket.
- There are no epics. Grouping is semantic (type, label, keyword).
- The reporter field carries no analyst signal. It is excluded from all metrics.
- There are at minimum two Jira projects: one for standard SOC tickets, one for IR incidents. The dashboard must support both simultaneously with cross-project analysis.
- Standard SOC tickets span at least four functional categories: email threat, cloud asset identification, DLP, and incident-adjacent. These are discovered from data, not hardcoded.
- Incident tickets operate on a different time scale and SLA than standard tickets. They are analyzed in a dedicated chapter with separate thresholds.

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
2. At each interval, evaluate: is this moment within a defined shift on a defined workDay, in the configured timezone?
3. Accumulate only moments that pass the check
4. Return total accumulated working minutes, converted to working hours

This algorithm is the foundation of all downstream metrics. Any shortcut here propagates error into every calculation.

### Rollover Detection

A ticket **rolls over** when it is still open at the boundary of a shift end. Rollover is evaluated per shift boundary, not per calendar day. Incident-origin rollovers are flagged separately from standard ticket rollovers because they carry a different interpretation.

---

## 5. Data Layer — Jira API

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
| List accessible projects | `GET /rest/api/3/project/search` | Paginated, use `maxResults` + `startAt` |
| Get project statuses | `GET /rest/api/3/project/{key}/statuses` | Returns statuses per issue type |
| Search issues | `GET /rest/api/3/search` | JQL with `expand=changelog` |
| Get issue changelog | `GET /rest/api/3/issue/{key}/changelog` | Full transition history |
| Get project components | `GET /rest/api/3/project/{key}/components` | Optional grouping signal |

### Data Collected Per Ticket

```
Issue {
  key: string
  summary: string               // title -- used for keyword clustering
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
            field: string       // look for "status"
            fromString: string
            toString: string
          }
        ]
      }
    ]
  }
}
```

The `changelog` is the critical data structure. It enables TTFT, Cycle Time, Lead Time, Flow Efficiency, Rollover, and Category Saturation to be computed correctly.

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

This is a first-class feature, not a setup step. Nothing about the Jira environment is assumed.

### Project Discovery

On credentials entry:

```
GET /rest/api/3/project/search?maxResults=50&startAt=0
  → paginate until all projects returned
  → filter to projects the API key has browse access to
  → present as multi-select tree in left drawer
  → user selects one or more projects to analyze
```

### Status Discovery and Classification

On project selection:

```
For each selected project:
  GET /rest/api/3/project/{key}/statuses
    → returns statuses keyed by issue type
    → deduplicate status names case-insensitively across all projects and types
    → produce a unique status manifest for the session

Present classification UI (one row per unique status name):
  [ "In Progress"    ]  →  [ Queue  |  ● Active  |  Done ]
  [ "Backlog"        ]  →  [ ● Queue |  Active   |  Done ]
  [ "Awaiting Info"  ]  →  [ ● Queue |  Active   |  Done ]
  [ "Resolved"       ]  →  [ Queue  |  Active   |  ● Done ]
  [ "Closed"         ]  →  [ Queue  |  Active   |  ● Done ]
  ...
```

**Smart defaults:** fuzzy match status names against a known vocabulary list (e.g. names containing "progress", "working", "active" → suggest Active; names containing "done", "closed", "resolved", "complete" → suggest Done; everything else → suggest Queue). The user confirms or corrects all suggestions before proceeding.

**Conflict resolution:** if two projects share a status name but the user classifies them differently across sessions, flag the conflict and require explicit resolution. One status name = one classification, enforced globally within the session.

**Persistence:** confirmed mappings are stored per project key in the encrypted vault. On subsequent sessions, only novel statuses require re-classification.

### TTFT Anchor Discovery

During status classification, the user also identifies which transition marks "first touch":

```
Which status transition indicates an analyst has picked up the ticket?

  ○ Any transition away from the initial status
  ○ Transition into a specific status: [ dropdown of Active-classified statuses ]
  ○ Assignee field populated (if no status change occurs at pickup)
```

This is confirmed once per project and stored in the vault. It is the anchor for all TTFT calculations.

### Category Discovery

Categories are built bottom-up from the data in priority order:

```
Tier 1: Issue Type    (discovered from API per project)
Tier 2: Priority      (discovered from API per project)
Tier 3: Labels        (aggregated across all tickets, frequency-ranked)
Tier 4: Title Keywords (token frequency analysis -- see Section 9)
```

No category names are hardcoded. The vocabulary emerges from the data. User-assigned cluster labels are stored in the vault for subsequent sessions.

---

## 7. Unified Metric Stack

Metrics are organized in four tiers by visibility and analytical depth.

### Tier 1 — Headline (Always Visible)

**Net Velocity**
```
Net Velocity = Close Rate - Intake Rate

Where:
  Close Rate  = tickets closed per working hour (rolling window)
  Intake Rate = tickets created per working hour (rolling window)

Interpretation:
  Positive  → queue is draining
  Near zero → holding steady
  Negative  → queue is filling

This is the primary staffing signal. Trended over time it shows 
whether the team is keeping pace with alert volume.
```

**Time to First Touch P85 (TTFT P85)**
```
TTFT = T(first_touch_transition) - T(created)
Computed in working hours only using the schedule model.

P85 = 85th percentile of TTFT across all tickets in scope

Presented per priority tier with configurable SLA thresholds.
P85 is the de facto SLA: "we touch almost everything within X hours."

A rising P85 trend is an earlier warning signal than any throughput metric.
```

**Queue Depth**
```
Count of tickets in non-Done statuses at the current moment.
Broken down by category.
Trend indicator: growing / stable / draining (based on slope over last 4h).
```

**Active Incident Flag**
```
Binary: does the IR project have any open ticket in a non-Done status?
If yes: count, oldest open age, and link to Incidents chapter.
```

---

### Tier 2 — Flow Metrics

**Lead Time**
```
Lead Time = T(closed) - T(created)
Computed in working hours only.

Decomposed into:
  Queue Wait (TTFT) = T(first_touch) - T(created)
  Cycle Time        = T(closed) - T(first_touch)

The ratio of these two values per category is one of the most 
diagnostic signals in the dashboard.
```

**Cycle Time Distribution (P50 / P85 / P95)**
```
Computed per category, not globally.
Mixing email spam filtering tickets with P1 incidents in one 
distribution produces a meaningless number.

Presented as:
  - Percentile callout cards
  - Histogram (the shape is the insight -- bimodal distributions 
    indicate two distinct work types being conflated)

Trend: P85 this period vs prior period of equal length.
```

**Flow Efficiency**
```
Flow Efficiency = Cycle Time / Lead Time

High (> 70%): tickets are touched quickly and worked continuously
Low  (< 30%): most ticket lifetime is queue wait, not active work

SOC interpretation: low flow efficiency nearly always indicates 
either insufficient coverage or prioritization problems pulling 
analysts off lower-priority queues during surge events.
```

**Cumulative Flow Diagram**
```
Stacked area chart over time:
  Open (queue wait)  |  In Progress (active)  |  Closed

Widening open band  = queue growing
Parallel bands      = stable, healthy flow
Converging bands    = team is catching up

Available as a toggle on the Flow chapter.
```

**Velocity Under Load**
```
Scatter plot: queue depth (x) vs close rate (y)
Each data point = one working day

Slope reveals surge behavior:
  Flat or rising slope  → team is surge-capable
  Declining slope       → alert fatigue or context-switching ceiling
  Cliff pattern         → hard analyst capacity ceiling at a specific queue depth

This is the most direct quantitative evidence for headcount decisions.
```

**Intake Rate Trend**
```
Rolling intake rate: 7d, 14d, 30d
Category breakdown of intake
Surge event markers: days where intake > mean + 2 standard deviations
```

---

### Tier 3 — Capacity and Staffing

**Rollover Rate by Shift**
```
Rollover % = (open tickets at shift end / total WIP) * 100

Presented as:
  Heatmap: x=day, y=shift name, color=rollover severity
  Incident windows overlaid as a distinct color band

Incident-origin rollovers are excluded from the standard rollover 
signal because they represent a different operational mode, not a 
capacity failure in standard ticket processing.

Trend: is rollover rate increasing, stable, or decreasing over the period?
```

**Ticket Aging Buckets**
```
Currently open tickets grouped by working-hour age:
  < 4h  |  4-8h  |  8-24h  |  1-3 days  |  3+ days

Each bucket further split:
  Untouched (no status transition since creation) -- flagged in red
  Active (at least one status transition has occurred)

An untouched 3-day-old ticket is a missed alert.
A 3-day-old incident being actively managed is expected.
The distinction is critical.
```

**Surge Absorption Score**
```
On days where intake rate > mean + 2 standard deviations:
  TTFT P85 held within configured threshold → surge-capable    ✓
  TTFT degraded, close rate held           → surge-limited     ~
  Both degraded                            → surge-overwhelmed ✗

Rolling score over the selected period: X of Y surge days handled within SLA.
```

**Incident Cost to Queue**
```
During IR project open windows:
  Standard project close rate: incident window vs baseline
  Standard project TTFT: incident window vs baseline

Output:
  "Each P1 incident is associated with approximately N fewer 
   standard tickets closed and a TTFT increase of M working hours 
   over the incident window."

This is the quantitative staffing argument for incident surge capacity.
```

**Analyst Load Distribution**
```
Available only if assignee field is populated in Jira.

Per analyst:
  Ticket count (assigned)
  Ticket count (closed)
  Avg cycle time
  TTFT (how fast they pick up)

Distribution visualization: 
  Even distribution, all analysts near capacity → understaffed
  Uneven distribution, high variance           → routing problem
  Even distribution, all analysts well under   → potentially over-staffed
```

---

### Tier 4 — Incident Chapter (IR Project)

IR tickets are analyzed with separate SLA thresholds and their own metric instances. The metrics are structurally identical to standard tickets but interpreted on a different time scale and severity model.

**Incident-specific additions:**
```
Active Incident Timeline
  Gantt-style view of open and recently closed incidents
  Duration bars colored by severity tier
  Shows concurrency: how often are multiple incidents open simultaneously?

Incident Frequency Trend
  Incidents opened per week over the selected period
  Is incident volume increasing?

TTFT per Incident Priority
  P1 TTFT threshold should be minutes, not hours
  Separate SLA lines per priority tier, configurable in vault

Cross-Project Queue Impact
  See: Incident Cost to Queue above -- surfaced here as the incident view
```

---

## 8. Staffing Assessment Model

### The Four Signals

| Signal | Measurement | Healthy Range |
|---|---|---|
| Queue Pressure | Net velocity trend direction | Positive or near-zero, not persistently negative |
| Response Speed | TTFT P85 trend vs configured SLA | Stable or improving, within threshold |
| Surge Capacity | Surge absorption score | > 80% of surge days within SLA |
| Category Balance | Per-category net velocity | No single category persistently negative |

### Staffing Verdict Matrix

```
                        TTFT P85 Degrading?
                          YES                    NO
                    ┌──────────────────┬────────────────────┐
Queue Depth    YES  │  UNDERSTAFFED    │  ROUTING PROBLEM   │
Growing             │                  │                    │
                    │  Coverage gap.   │  Volume and speed  │
                    │  TTFT and queue  │  are fine but work │
                    │  both worsening. │  is not reaching   │
                    │  Add people or   │  the right people. │
                    │  reduce intake   │  Fix assignment    │
                    │  via automation. │  or prioritization.│
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

Each quadrant produces a generated narrative block with the verdict label, the signal values that produced it, and a recommended action class. The matrix updates dynamically as date range or project selection changes.

### Little's Law as a Coherence Check

```
Throughput = WIP / Cycle Time (P50)

If observed throughput diverges significantly from predicted throughput,
the team has a WIP management problem: either taking on more than 
can be completed in one shift, or tickets are sitting idle mid-work.

This is displayed as a supporting detail in the Capacity chapter,
not a headline metric.
```

---

## 9. Pattern Intelligence

### Cluster Discovery Hierarchy

```
Priority order, applied sequentially:

1. Issue Type       (exact, from Jira API per project)
2. Priority         (exact, from Jira API per project)  
3. Labels           (frequency-ranked, user selects threshold)
4. Title Keywords   (token analysis, configurable minimum occurrence)
```

### Title Keyword Clustering

```
Input: all ticket titles in scope

Pipeline:
  Lowercase all titles
  Strip punctuation and special characters
  Remove stopwords (configurable list, English default)
  Tokenize to unigrams and bigrams
  Count token frequency across corpus
  Surface tokens appearing in >= N tickets (default N=3, configurable)
  
For each qualifying token:
  Cluster = all tickets whose normalized title contains that token
  Compute per cluster:
    Intake rate
    Close rate
    TTFT P50 / P85
    Cycle Time P50 / P85
    Flow Efficiency
    Rollover Rate
    Recurrence Rate
    Delta vs project baseline (is this cluster faster or slower than average?)
  
Cluster label: the qualifying token (user can rename, stored in vault)
```

### Recurrence Detection

Replaces reopened rate as the quality signal for a SOC workflow.

```
Within a configurable rolling window (30 / 60 / 90 days):

For each closed ticket:
  Normalize title (lowercase, strip stopwords, stem or lemmatize)
  Compare normalized title against all other closed tickets in window
  Similarity metric: Jaccard coefficient on token sets
  Flag as recurring if similarity > threshold (default 0.6, configurable)

Output per recurrence pattern:
  Pattern label (dominant shared tokens)
  Count over period
  Trend: accelerating / stable / fading
  Average cycle time for this pattern vs category baseline
  Automation candidate flag:
    Triggered when count > N (configurable) AND avg cycle time < M (configurable)
    Interpretation: high-frequency, fast-to-close patterns are 
    automation opportunities, not staffing problems

Recurrence rate = recurring tickets / total tickets (per category)
```

### Category Saturation

```
For each discovered category:
  Category Net Velocity = category close rate - category intake rate

The most negative category is the current bottleneck.
Visualized as a ranked bar chart of per-category net velocity.

This answers: "which ticket type is most at risk of falling behind?"
```

### Trending Categories

```
Compare category intake rate: first half vs second half of selected period.
Categories sorted by intake growth rate.

Rising categories are early warning of emerging threat patterns 
or process failures in upstream tooling.
```

---

## 10. Encrypted Storage Design

### Security Model

- **No backend.** All secrets live in the browser.
- **WebCrypto API** -- browser-native, platform-agnostic, zero dependencies.
- **Password-derived encryption.** The password is never stored. The derived key lives only in memory for the session duration.
- **AES-GCM** -- authenticated encryption. A wrong password fails the MAC check without exposing any plaintext.

### Key Derivation

```
On vault creation:
  Generate random 16-byte salt (crypto.getRandomValues)
  Derive key: PBKDF2(password, salt, 310,000 iterations, SHA-256) → AES-256-GCM key

On subsequent unlocks:
  Load stored salt from localStorage
  Re-derive key using same PBKDF2 parameters
  Attempt AES-GCM decrypt
  If MAC verification fails → wrong password (no error oracle exposed)
```

### Encryption Operation

```
On each save:
  Generate fresh random 12-byte IV (crypto.getRandomValues)
  Encrypt payload with AES-GCM using derived key and fresh IV
  Store: { salt: base64, iv: base64, ciphertext: base64 } 
  Storage key in localStorage: "soc_vault"
```

### Vault Payload Schema

```json
{
  "tenantUrl": "string",
  "apiKey": "string",
  "statusMappings": {
    "{projectKey}": {
      "{statusName}": "queue | active | done"
    }
  },
  "ttftAnchors": {
    "{projectKey}": "first_transition | specific_status_name | assignee_populated"
  },
  "workSchedule": {
    "timezone": "string",
    "workDays": ["MON", "TUE", "WED", "THU", "FRI"],
    "shifts": [
      { "name": "string", "startHour": 0, "endHour": 23 }
    ]
  },
  "slaThresholds": {
    "{projectKey}": {
      "{priorityName}": { "ttftHours": 0, "cycleTimeHours": 0 }
    }
  },
  "clusterLabels": {
    "{projectKey}": {
      "{token}": "string"
    }
  },
  "savedFilters": []
}
```

### Session Behavior

- On tab open: prompt for vault password
- On successful decrypt: session is active, derived key held in memory
- On tab close or session timeout: derived key is garbage collected, plaintext never persisted
- Vault lock button available in config drawer at all times

---

## 11. Application Architecture

### Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React + Vite | Fast dev, zero backend, pure client-side |
| Styling | Tailwind CSS | Responsive utility classes, no runtime CSS-in-JS |
| Charts | Recharts | React-native, composable, accessible |
| Crypto | WebCrypto API | Browser-native, no dependency, platform-agnostic |
| State | React Context + useReducer | Avoids external state library dependency |
| Storage | localStorage (encrypted) | Persistent across sessions, no backend |

No backend. No server. No build-time secrets. The application is a static bundle that could be served from any web server or opened as a local file.

### Module Structure

```
src/
  constants/
    statuses.js          // known vocabulary for smart default suggestions
    stopwords.js         // tokenization stopword list
    metrics.js           // all threshold defaults, window sizes, etc.
    jira.js              // API endpoints, pagination sizes
  
  crypto/
    vault.js             // encrypt, decrypt, derive key, load, save
  
  api/
    jira.js              // all fetch wrappers, pagination, error handling
    projects.js          // project + status discovery
    issues.js            // issue search, changelog fetch
  
  compute/
    workingHours.js      // schedule-aware duration accumulator
    metrics/
      velocity.js        // net velocity, intake rate, close rate
      ttft.js            // time to first touch per ticket
      cycleTime.js       // cycle time, lead time, flow efficiency
      rollover.js        // rollover detection per shift boundary
      aging.js           // aging bucket assignment
      surge.js           // surge event detection, absorption score
      recurrence.js      // title similarity, recurrence flagging
      staffing.js        // verdict matrix computation
    clustering/
      keywords.js        // tokenize, frequency rank, cluster assignment
      categories.js      // issue type + label + component grouping
  
  components/
    layout/
      TopBar.jsx
      LeftDrawer.jsx       // project selection
      RightDrawer.jsx      // config, vault, status mapping
      BottomSheet.jsx      // ticket detail, drill-down
    chapters/
      WatchStatus.jsx      // Chapter 1
      Flow.jsx             // Chapter 2
      ResponseSpeed.jsx    // Chapter 3
      Capacity.jsx         // Chapter 4
      Patterns.jsx         // Chapter 5
      Incidents.jsx        // Chapter 6
      Compare.jsx          // Chapter 7
    charts/
      CycleTimeHistogram.jsx
      CumulativeFlowDiagram.jsx
      VelocityUnderLoad.jsx
      RolloverHeatmap.jsx
      AgingBuckets.jsx
      CategoryRadar.jsx
    shared/
      KPICard.jsx
      NarrativeBlock.jsx
      StaffingVerdict.jsx
      DateRangePicker.jsx
      QuickWindows.jsx      // 7d / 14d / 30d buttons
  
  hooks/
    useVault.js
    useJira.js
    useMetrics.js
    useSchedule.js
  
  context/
    AppContext.js          // selected projects, date range, schedule
    VaultContext.js        // decrypted vault contents for session
```

---

## 12. Chapter Map and UI Layout

### Top Bar (Always Visible)

```
┌─────────────────────────────────────────────────────────────────┐
│ [≡ Projects]   ● PROJ-A  ● PROJ-IR   [7d][14d][30d][Custom▼]  │
│                                        [⚙ Vault & Config]      │
│ Queue: 23 ↑  Net Velocity: -1.4/hr  Oldest Untouched: 6.2h    │
│ ⚠ Active Incident: INCIDENT-47 (open 3.1h)                     │
└─────────────────────────────────────────────────────────────────┘
```

The top bar never scrolls away. It represents the current operational state at all times.

---

### Chapter 1: Watch Status

Always-visible summary strip. Not a separate page -- lives in the top bar and a pinned summary card at the top of the main content area.

```
KPI Cards (row):
  Queue Depth  |  Net Velocity  |  TTFT P85  |  Surge Score
  
One sentence verdict per selected project.
Active incident alert if IR project has open tickets.
```

---

### Chapter 2: Flow (Default Landing View)

```
Main area:
  Intake Rate vs Close Rate (dual line chart, divergence highlighted)
  Net Velocity trend (area chart, green above zero, red below)
  Cumulative Flow Diagram (toggle)

Controls:
  Quick windows: [7d] [14d] [30d]
  Custom date picker: from / to
  Project toggle: [Combined] [Per Project]
  Category filter: multi-select from discovered categories

Below charts:
  Category intake/close breakdown (stacked bar per category)
  Surge event markers annotated on timeline
```

---

### Chapter 3: Response Speed (Right Slide-Out)

```
TTFT Distribution
  Histogram per category
  P50 / P85 / P95 callout cards
  SLA threshold line overlay (configurable per priority)
  
Lead Time vs Cycle Time Decomposition
  Horizontal bar per category: [ Queue Wait (TTFT) | Cycle Time ]
  Color coded: wait in amber, active in teal
  "The bar length is the alert. The color split is the diagnosis."

Flow Efficiency per category
  Simple percentage bar cards
  Red < 30%, amber 30-60%, green > 60%

Velocity Under Load
  Scatter: queue depth (x) vs close rate (y)
  Trend line overlay
  Annotation: capacity ceiling if cliff pattern detected

Cycle Time P50/P85/P95
  Per category, current period vs prior period
  Delta indicator: improving / stable / degrading
```

---

### Chapter 4: Capacity (Right Slide-Out, Stacked)

```
Staffing Verdict Panel (top of chapter)
  2x2 matrix visualization
  Active quadrant highlighted
  Generated narrative block with recommended action

Rollover Heatmap
  x=day, y=shift name, color=rollover severity
  Incident windows overlaid as distinct band
  Toggle: show/hide incident overlay

Ticket Aging Buckets
  Bar chart: count per age bucket
  Each bar split: untouched (red) vs active (blue)
  Clickable: drill into ticket list for any bucket

Surge Absorption Score
  Score card: X/Y surge days within SLA
  List of surge days with pass/fail per day

Analyst Load Distribution (if assignee data present)
  Horizontal bar per analyst: tickets assigned / closed / avg cycle time
  Variance indicator

Incident Cost to Queue
  Panel: visible only when IR project is selected
  Estimated throughput and TTFT impact per incident window
```

---

### Chapter 5: Patterns (Right Slide-Out, Stacked)

```
Category Cluster Cards (grid)
  Per cluster:
    Name (keyword / label / type)
    Ticket count
    Intake rate
    TTFT P85 vs project baseline (delta)
    Cycle Time P85 vs project baseline (delta)
    Recurrence Rate
    Automation candidate badge (if flagged)
  Clickable: drill into cluster → full ticket list with metrics

Recurrence Detection Panel
  Recurring pattern list ranked by frequency
  Per pattern: count, trend arrow, avg cycle time, automation flag
  Toggle: 30d / 60d / 90d recurrence window

Category Saturation Bar Chart
  Per-category net velocity, ranked most negative to most positive
  Most negative = current bottleneck, highlighted in red

Trending Categories
  Categories ranked by intake growth rate (this period vs prior)
  Rising categories flagged with trend arrow
```

---

### Chapter 6: Incidents (IR Project Dedicated View)

```
Visible only when IR project is selected.

TTFT by Incident Priority
  P85 per priority tier
  SLA threshold lines (configurable, separate from standard thresholds)
  
Incident Cycle Time Distribution
  Histogram (separate from standard tickets -- different time scale)
  P50 / P85 / P95 cards

Active Incident Timeline
  Gantt-style: each incident as a horizontal bar
  Duration colored by severity
  Concurrency visible: multiple incidents overlapping

Incident Frequency Trend
  Incidents opened per week over selected period
  Trend line

Cross-Project Queue Impact
  TTFT and throughput delta for standard project during incident windows
  Estimated cost per incident in standard ticket capacity
```

---

### Chapter 7: Compare (Multi-Project Only)

```
Visible when two or more projects are selected.

Side-by-Side KPI Table
  Per project: Net Velocity | TTFT P85 | Cycle Time P85 | Rollover Rate | Flow Efficiency

Normalized Radar Chart
  Each axis: one metric, normalized 0-1 across selected projects
  Each project = one polygon overlay
  Visual: "which project is healthiest / most at risk overall"

Summary verdict: healthiest project / most at risk project with reasoning
```

---

### Navigation and Interaction Patterns

**Left Drawer:** Project tree with multi-select checkboxes and search. Persistent, does not close on outside click. This is an analysis tool, not a modal flow.

**Right Drawer:** Vault access, schedule builder, status mapping, SLA threshold configuration. Also persistent.

**Bottom Sheet:** Ticket detail and cluster drill-down. Stackable -- breadcrumb trail: Dashboard > Patterns > "phishing" cluster > TICKET-123. Each level closeable independently.

**Responsive Behavior:**
- Desktop: drawers are sidebar panels, chapters are scrollable main content
- Tablet: drawers collapse to icon rail, expand on tap
- Mobile: chapters become a swipeable carousel, drawers become full-screen overlays

**Every chart** has a drill-in affordance (expand icon) that opens the full dimensional view in a bottom sheet or right drawer.

---

## 13. Narrative Generation

Every chapter produces one or more generated insight sentences computed from live metric values. These are not templates with blanks filled in -- they select different sentence structures based on the values and their relationships.

### Examples

**Chapter 2 Flow:**
> "This team is closing 6.2 tickets per working hour against an intake of 8.1. The queue has grown by approximately 42 tickets over the selected period. Email threat tickets account for 61% of intake but only 44% of closures."

**Chapter 3 Response Speed:**
> "P85 TTFT is 4.3 working hours, up from 2.1 hours in the prior equivalent period. Tickets spend 71% of their lead time waiting for first touch. DLP tickets show the worst flow efficiency at 18%, meaning 82% of their lifetime is queue wait."

**Chapter 4 Capacity Verdict:**
> "Verdict: ROUTING PROBLEM. Queue depth is growing but TTFT is stable, meaning tickets are arriving faster than they leave, yet response speed for touched tickets is healthy. Work is not being distributed evenly. This is an assignment or prioritization problem, not a headcount problem."

**Chapter 5 Patterns:**
> "22 tickets containing 'phishing' or 'credential' closed in the last 30 days, averaging 1.8 working hours each. This pattern has appeared consistently for 60 days and is flagged as an automation candidate. Cloud ownership tickets take 4.1x longer than the project median."

---

## 14. Open Configuration Decisions

The following require decisions that will determine configurable defaults in the vault schema:

| Decision | Options | Recommendation |
|---|---|---|
| Priority field format | P1-P4 vs Critical/High/Medium/Low vs custom | Discover from API, present mapping UI |
| TTFT SLA defaults | Per priority, in working hours | No default -- require explicit configuration on first use |
| Recurrence similarity threshold | 0.5 to 0.8 Jaccard | Default 0.6, configurable per project |
| Automation candidate thresholds | Count and cycle time cutoffs | Default: count > 5, cycle time < 2h, configurable |
| Keyword cluster minimum frequency | Minimum ticket count to form a cluster | Default 3, configurable |
| Surge detection sensitivity | Standard deviation multiplier | Default 2.0, configurable |
| IR project identification | How does the dashboard know which project is IR? | User-tagged in project selection, stored in vault |
| Velocity window for headline | Which rolling window drives the top-bar numbers | Default 7d, configurable |
| Analyst data opt-in | Assignee metrics are sensitive in some orgs | Explicit opt-in toggle in vault |

---

## 15. Metric Reference Table

| Metric | Formula | Unit | Chapter | SOC Adaptation |
|---|---|---|---|---|
| Net Velocity | Close Rate - Intake Rate | tickets/working hour | 1, 2 | Primary headline -- replaces Pressure Ratio |
| Intake Rate | tickets created / working hours | tickets/hr | 2 | Rolling window, per category |
| Close Rate | tickets closed / working hours | tickets/hr | 2 | Rolling window, per category |
| TTFT P85 | 85th pct of (first_touch - created) | working hours | 1, 3 | Primary SLA metric, per priority |
| Lead Time P85 | 85th pct of (closed - created) | working hours | 3 | Decomposed into TTFT + Cycle Time |
| Cycle Time P85 | 85th pct of (closed - first_touch) | working hours | 3 | Per category, not global |
| Flow Efficiency | Cycle Time / Lead Time | percentage | 3 | Low value = routing/coverage problem |
| Rollover Rate | open at shift end / WIP | percentage | 4 | Incident rollovers flagged separately |
| Queue Depth | open ticket count | count | 1, 4 | Live + trended |
| Aging Buckets | working hours since creation | buckets | 4 | Untouched vs active distinction |
| Surge Absorption | surge days within TTFT SLA / total surge days | percentage | 4 | SOC-specific capacity signal |
| Incident Cost to Queue | throughput delta during incident windows | tickets lost | 4, 6 | Cross-project, IR-specific |
| Category Net Velocity | category close rate - category intake rate | tickets/hr | 5 | Bottleneck identification |
| Recurrence Rate | recurring tickets / total tickets | percentage | 5 | Replaces reopened rate |
| Velocity Under Load | close rate vs queue depth slope | regression | 3 | Surge capacity ceiling detection |
| Analyst Load Variance | stddev of per-analyst ticket counts | coefficient | 4 | Optional, requires assignee data |
| MTTC | mean(closed - created) | working hours | footnote | Demoted -- context only |

---

*End of Design Document v1.0*
