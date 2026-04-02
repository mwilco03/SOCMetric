# Chapter Map & UI Layout

*Extracted from Design Document v1.1, Section 22*

---

## Top Bar (Always Visible)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SOC Dashboard    [SOC ▾] [IR ▾]    Oct 14-20 ▾    [Analyst|●Lead|Dir]  │
│  ──────────────────────────────────────────────────────────────────  │
│  [📋 Ledger] [👁 Watch] [●Flow] [⚡Speed] [📊 Capacity] [🔍 Patterns] [🚨 IR] [📈 Proj] [⚖ Compare] │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---|---|
| Project selector | Multi-select, shows selected project keys |
| Date range | Preset periods + custom range picker |
| View mode toggle | Three-state, persists in vault preferences |
| Chapter tabs | Horizontal, scrollable on mobile, icon + label |

---

## Chapter 0: Manager Context Ledger

**Visible to:** Lead, Director

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONTEXT LEDGER                                          [+ Event]  │
│                                                                     │
│  ┌─ October 2024 ──────────────────────────────────────────────┐   │
│  │  Mon   Tue   Wed   Thu   Fri   Sat   Sun                   │   │
│  │   7     8     9    10    11    12    13                     │   │
│  │  ███                                                        │   │  ← system event (orange)
│  │  14    15    16    17    18    19    20                     │   │
│  │                          ██████                             │   │  ← rule deployment (yellow)
│  │  21    22    23    24    25    26    27                     │   │
│  │  ███████████                                                │   │  ← analyst absence (red)
│  │  28    29    30    31     1     2     3                     │   │
│  │                    ████                                      │   │  ← holiday (blue)
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  UPCOMING EVENTS                                                    │
│  Nov 1   New hire starts (Day shift, +1 headcount, 90d ramp)      │
│  Nov 4-8 Analyst absence (IST shift, -2 headcount)                │
│                                                                     │
│  IMPORT                                                             │
│  [Paste CSV] [Upload .csv] [Quick entry: __________________ ]     │
│                                                                     │
│  IMPACT SUMMARY                                                     │
│  "Current team capacity: 8 analysts across 3 shifts.               │
│   Oct 21-23 absence reduced Day shift to 75%.                      │
│   Nov 4-8 absence will reduce IST to 33%. ⚠ Below 50%."          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 1: Watch Status

**Visible to:** All views

Purpose: the "is anything on fire" screen. Glanceable, no scrolling.

```
┌─────────────────────────────────────────────────────────────────────┐
│  WATCH STATUS                                                       │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │Queue     │  │TTFT P85  │  │Net       │  │Active IR │          │
│  │Depth     │  │          │  │Velocity  │  │          │          │
│  │  127 🟢  │  │ 4.3h 🟡  │  │ +2.1 🟢  │  │ 1 🔴    │          │
│  │→ stable  │  │↗ +1.2h   │  │→ draining│  │P1, 6h   │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                     │
│  ATTENTION ITEMS                                                    │
│  🔴 1 active P1 incident (IR-2847), open 6 working hours          │
│  🟡 TTFT rose 38% -- consistent with absence window Oct 21-23     │
│  🟡 3 stalled tickets (no activity > P95 cycle time)               │
│  🟢 Rapid recurrence: GuardDuty cluster still firing (47 in 24h)  │
│                                                                     │
│  AFTER-HOURS (Director view only)                                   │
│  "Analysts showing after-hours activity not explained by IR.       │
│   Leading burnout indicator."                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 2: Flow (Default Landing for Analyst and Lead)

**Visible to:** Analyst, Lead

```
┌─────────────────────────────────────────────────────────────────────┐
│  FLOW                                                               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │Lead Time P85 │  │Cycle Time P85│  │Flow          │             │
│  │  12.4h  🟢   │  │  8.1h  🟢    │  │Efficiency    │             │
│  │→ stable      │  │↘ -0.8h       │  │  68%  🟡     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  LEAD TIME DECOMPOSITION                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ "Post-active wait accounts for 24% of lead time,             │  │
│  │  up from 18% last period. Tickets are re-queuing             │  │
│  │  after first touch more frequently."                         │  │
│  │                                                               │  │
│  │  [Queue Wait ████████] [Active ████████████] [Post-Active ██]│  │
│  │   31% (3.8h)           45% (5.6h)           24% (3.0h)      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CYCLE TIME BY CATEGORY (top 5 by volume)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "Email Threat cycle time improved 15% while GuardDuty       │  │
│  │   cycle time rose 22%, driven by new detection rule."        │  │
│  │                                                               │  │
│  │  [Histogram: Email Threat | GuardDuty | DLP | Phishing | ..] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CUMULATIVE FLOW (toggle)                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Stacked area: Open | In Progress | Closed over time]       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CLOSURE INTEGRITY                                                  │
│  Instant close rate: 8.2%  |  Untouched close: 2.1%               │
│  Work churn rate: 11.4%    |  Burst close events: 3               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 3: Response Speed

**Visible to:** Analyst, Lead

```
┌─────────────────────────────────────────────────────────────────────┐
│  RESPONSE SPEED                                                     │
│                                                                     │
│  TTFT DISTRIBUTION                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "85% of tickets received first touch within 4.3 working     │  │
│  │   hours. The slowest 15% are concentrated in the DLP         │  │
│  │   category, which requires manual review."                   │  │
│  │                                                               │  │
│  │  [Histogram: TTFT distribution, P50/P85/P95 markers]        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  TTFT BY PRIORITY (gated on Priority Separation Index)             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Priority Separation Index: 0.31 (priority IS enforced) 🟢   │  │
│  │                                                               │  │
│  │  P1: 0.8h P85  |  P2: 2.1h P85  |  P3: 4.3h P85           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  OR                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Priority Separation Index: 0.87                              │  │
│  │  ⚠ Priority field exists but is not reflected in response     │  │
│  │    behavior. Priority-based metrics hidden.                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  TTFT TREND                                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Line chart: TTFT P85 over time, baseline band shaded]     │  │
│  │  Ledger annotations: [🏥 Oct 21-23] [⚙️ Oct 18]             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  IR ACKNOWLEDGMENT TARGET (if IR project selected)                 │
│  P1 target: 1h  |  Actual P85: 0.8h  🟢  |  Met: 94%            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 4: Capacity

**Visible to:** Lead, Director

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPACITY                                                           │
│                                                                     │
│  STAFFING VERDICT                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "Understaffed. Queue depth has grown 23% over the past 14   │  │
│  │   days while TTFT P85 has degraded from 3.1h to 4.3h.       │  │
│  │   Evening shift shows consistent rollover above 40%.         │  │
│  │   Consider adding coverage to the evening shift or           │  │
│  │   automating the Email Threat category."                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ROLLOVER HEATMAP                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "Evening shift rolled over 40% of WIP on 3 of 5 days."    │  │
│  │                                                               │  │
│  │        Mon  Tue  Wed  Thu  Fri                               │  │
│  │  Day    🟢   🟢   🟢   🟢   🟢                                │  │
│  │  Eve    🔴   🟡   🔴   🟡   🔴                                │  │
│  │  Night  🟢   🟢   🟢   🟡   🟢                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  VELOCITY UNDER LOAD                                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "Close rate holds steady up to queue depth of ~150, then    │  │
│  │   declines. Hard ceiling visible at 180 tickets."            │  │
│  │                                                               │  │
│  │  [Scatter: queue depth (x) vs close rate (y)]                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  TICKET AGING                                                       │
│  [< 4h: 34] [4-8h: 28] [8-24h: 19] [1-3d: 12] [3d+: 4]         │
│  Untouched: 2  |  Stalled: 3                                      │
│                                                                     │
│  SURGE ABSORPTION                                                   │
│  Score: 4 of 6 surge days absorbed  🟢                             │
│                                                                     │
│  INCIDENT COST TO QUEUE                                            │
│  "During the Oct 15 incident window, standard ticket close rate    │
│   dropped 34%. Estimated 12 tickets displaced."                    │
│                                                                     │
│  ANALYST LOAD (opt-in)                                             │
│  [Distribution chart: tickets per analyst, variance indicator]     │
│                                                                     │
│  AFTER-HOURS ACTIVITY                                              │
│  After-hours transitions: 47  |  IR-explained: 31  |  Unexpl: 16  │
│  Shift overrun events: 8 days                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 5: Patterns

**Visible to:** Analyst, Lead

```
┌─────────────────────────────────────────────────────────────────────┐
│  PATTERNS                                                           │
│                                                                     │
│  WASTED WORK                                                       │
│  ┌──────────┐                                                       │
│  │  42%     │  "42% of team working time is spent on recurring     │
│  │  🔴      │   patterns that have not reduced in volume."         │
│  └──────────┘                                                       │
│                                                                     │
│  CLUSTER RANKING (by total capacity consumed)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. GuardDuty:UnauthorizedAccess   847 tickets  423h  🔴CRIT │  │
│  │    62% rapid recurrence | intake persists after closures     │  │
│  │                                                               │  │
│  │ 2. Email Threat: Phishing         612 tickets  306h  🟡REQ  │  │
│  │    34% slow recurrence | automation recommended              │  │
│  │                                                               │  │
│  │ 3. DLP Alert: PII-SSN             234 tickets  187h  🟡REQ  │  │
│  │    28% slow recurrence | high per-ticket cycle time          │  │
│  │                                                               │  │
│  │ [+ 12 more clusters...]                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  CATEGORY SATURATION                                               │
│  [Ranked bar: net velocity per category, most negative first]      │
│                                                                     │
│  TRENDING CATEGORIES                                               │
│  [Sorted by intake growth rate: first half vs second half]         │
│                                                                     │
│  BACKLOG SUPPRESSION                                               │
│  "High-effort categories have 15% lower closure share than intake  │
│   share. Easy tickets may be prioritized over complex ones."       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 6: Incidents

**Visible to:** Lead (hidden in Analyst and Director by default)

```
┌─────────────────────────────────────────────────────────────────────┐
│  INCIDENTS (IR Project)                                             │
│                                                                     │
│  ACTIVE INCIDENTS                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  IR-2847  P1  "Ransomware indicator on endpoint cluster"     │  │
│  │  Open 6 working hours  |  Acknowledged in 0.4h              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  INCIDENT TIMELINE                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Gantt: horizontal bars per incident, colored by severity]  │  │
│  │  Concurrent incidents visible as overlapping bars            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  IR RESPONSE METRICS                                               │
│  Ack Target P1: 1h  |  Actual P85: 0.8h  🟢                      │
│  Ack Target P2: 4h  |  Actual P85: 2.3h  🟢                      │
│                                                                     │
│  INCIDENT FREQUENCY                                                │
│  [Line: incidents per week over selected period]                   │
│                                                                     │
│  QUEUE IMPACT                                                      │
│  "During incident windows, standard TTFT degrades an average of    │
│   41% and close rate drops 34%."                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 7: Projections

**Visible to:** Director (available on demand to Lead)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROJECTIONS                            Horizon: [30d|●60d|90d]    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  "At current intake trend and team capacity, the queue will  │  │
│  │   exceed sustainable depth by approximately Dec 15. This     │  │
│  │   accounts for the Nov 1 new hire (ramped to 50% by Dec 1)  │  │
│  │   and Q4 seasonal increase."                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  PROJECTION CHART                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Fan chart: intake band (P25-P75), capacity line,           │  │
│  │   staffing gap shaded area]                                  │  │
│  │                                                               │  │
│  │  Annotations:                                                 │  │
│  │  [🏥 Oct 21-23] [⚙️ Oct 18] [👤 Nov 1] [🏥 Nov 4-8]         │  │
│  │  [🏖️ Nov 28] [📈 Q4 seasonal]                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  SEASONAL PATTERN (if 6+ months history)                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Line: historical weekly intake with seasonal component     │  │
│  │   highlighted, current year overlay]                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  SCENARIO PLANNER (Director)                                       │
│  "What if we add 1 analyst in January?"                            │
│  [Adjusted projection with delta overlay]                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Chapter 8: Compare (Multi-Project)

**Visible to:** Director

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMPARE                                                            │
│                                                                     │
│  PROJECT COMPARISON TABLE                                           │
│  ┌────────┬──────────┬──────────┬──────────┬──────────┐            │
│  │        │ Queue    │ TTFT P85 │ Net Vel  │ Verdict  │            │
│  │ SOC    │ 127 🟢   │ 4.3h 🟡  │ +2.1 🟢  │ Healthy  │            │
│  │ IR     │ 1   🔴   │ 0.8h 🟢  │ -0.2 🟡  │ Active   │            │
│  └────────┴──────────┴──────────┴──────────┴──────────┘            │
│                                                                     │
│  CROSS-PROJECT SIGNALS                                              │
│  "IR incident activity correlates with SOC TTFT degradation.       │
│   During the 3 incident windows this period, SOC TTFT P85          │
│   averaged 6.1h vs 3.8h baseline."                                 │
│                                                                     │
│  SHARED DIMENSION ANALYSIS                                         │
│  [Categories that appear in both projects,                         │
│   volume and cycle time comparison]                                │
└─────────────────────────────────────────────────────────────────────┘
```
