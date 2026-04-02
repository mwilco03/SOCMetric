# Personas & Workflows

*Extracted from UX & Workflow Design v1.0, Sections 1, 4-6*

---

## 1. Persona Definitions

### Analyst

**Who they are:** Working the queue every day. Triaging alerts, closing tickets, managing their own workload.

**Primary questions:**
- What should I work next?
- Am I falling behind?
- Are there patterns in what I'm seeing?
- What tickets have been sitting too long?
- Which alert types should we be automating?

**Key behaviors:**
- High-frequency use (open all shift)
- Needs operational detail -- raw numbers, ticket lists, drill-down
- Cares about their own workload vs team workload
- Will act on automation candidates if surfaced clearly

**What they must NOT have to hunt for:**
- Stalled tickets
- Automation candidates
- Their current queue state

---

### Team Lead

**Who they are:** Running the team day-to-day. Responsible for coverage, shift handoffs, routing, and escalation decisions.

**Primary questions:**
- Is the team keeping up with volume?
- Who is overloaded? Who has slack?
- Where are the bottlenecks right now?
- What events do I need to log that will affect this week's metrics?
- Do I need to escalate a capacity problem to my director?

**Key behaviors:**
- Moderate-frequency use (multiple times per day, not all-shift)
- Needs capacity signals and analyst-level visibility
- Manages the context ledger (absences, system events)
- Bridges analyst detail and director summary

**What they must NOT have to hunt for:**
- Capacity verdict
- Which analyst is overloaded
- What events to log today

---

### Director

**Who they are:** Accountable for the SOC function. Makes headcount, tooling, and program decisions. Presents to leadership above them.

**Primary questions:**
- Are we adequately staffed for current and future volume?
- Where is the team under pressure?
- What does the next 60-90 days look like?
- What is consuming the most capacity that automation could address?
- How does this compare to last quarter?

**Key behaviors:**
- Low-frequency use (once or twice a day, or pulled up for meetings)
- Does not want to dig -- findings should surface themselves
- Needs trend lines and forward-looking projections
- Will share screens or export findings for executive presentations

**What they must NOT have to hunt for:**
- The staffing verdict in plain language
- Projected capacity gap
- Top automation opportunities by hours consumed

---

## 4. Analyst Workflow

### What the Analyst Sees on Load

The analyst's primary landing state prioritizes **what needs attention right now**, not historical analysis.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡]  PROJ-SOC  PROJ-IR   [7d][14d][30d][⊡]   [Analyst ▾]  [⚙]   │
│                                                                     │
│ Queue: 23 ↗🟡  Net Vel: -1.4/hr ↘🔴  Oldest Untouched: 6.2h 🔴   │
│ Stalled: 3 🟡   Rapid Recurrence: 2 clusters 🟡                    │
└─────────────────────────────────────────────────────────────────────┘
```

The top bar tells the analyst the operational state of the queue in one scan. Red means act. Yellow means watch.

---

### Chapter 1: Watch Status (Analyst View)

```
┌─── WATCH STATUS ────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Queue    │ │Net Vel   │ │TTFT P85  │ │Stalled   │             │
│  │  23  ↗🟡 │ │-1.4 ↘🔴 │ │ 4.3h ↗🔴│ │  3   →🟡│             │
│  │"Growing" │ │"Behind"  │ │"Slowing" │ │"Watch"   │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                     │
│  ┌── NEEDS ATTENTION ────────────────────────────────────────────┐ │
│  │  🔴 SOC-1847  DLP Alert | Policy: PII-SSN          6.2h old  │ │
│  │     Untouched. Assigned to no one.              [Assign ▶]   │ │
│  │                                                               │ │
│  │  🟡 SOC-1831  Brute Force Detected               4.1h old    │ │
│  │     Stalled. Last transition 3.8h ago.          [View ▶]    │ │
│  │                                                               │ │
│  │  🟡 SOC-1829  Impossible Travel Alert             3.9h old   │ │
│  │     Stalled. Last transition 3.5h ago.          [View ▶]    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌── RAPID RECURRENCE ───────────────────────────────────────────┐ │
│  │  ⚡ "Brute Force Detected" fired 7 times in last 4h           │ │
│  │     Source still active. Same IP range across alerts.         │ │
│  │     [View cluster ▶]    [Create IR ticket ▶]                 │ │
│  │                                                               │ │
│  │  ⚡ "DLP Alert | Policy: PII-SSN" fired 4 times in last 6h   │ │
│  │     Source still active.                    [View cluster ▶]  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Analyst-specific elements:**
- Needs Attention panel is the very first thing. Not buried.
- Stalled tickets are named and linkable directly.
- Rapid recurrence flags are actionable -- link to view cluster AND create IR ticket.
- Untouched tickets show "Assigned to no one" not just a duration.

---

### Chapter 2: Flow (Analyst View)

```
┌─── FLOW ────────────────────────────────────────────────────────────┐
│  "Your team is falling behind -- intake has exceeded closures       │
│   for 9 of the last 14 days"                                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Intake vs Close Rate (dual line)                           │   │
│  │  [surge markers]  [rule deployment markers]                 │   │
│  │  ↕ expand  ⊡ drill in                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── BY SOURCE SYSTEM ─────────────────────────────────────────┐  │
│  │                         Intake/day  Close/day  Net           │  │
│  │  GuardDuty                  12.3       14.1    +1.8 🟢       │  │
│  │  Proofpoint                  8.7        6.2    -2.5 🔴       │  │
│  │  DLP Engine                  4.1        3.8    -0.3 🟡       │  │
│  │  Manual                      1.2        1.4    +0.2 🟢       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── BY DAY OF WEEK ─────── last 30d average ──────────────────┐  │
│  │  Mon ████████████ 18.4/day                                   │  │
│  │  Tue ████████ 12.1/day                                       │  │
│  │  Wed ████████ 11.8/day                                       │  │
│  │  Thu █████████ 13.2/day                                      │  │
│  │  Fri ██████ 9.4/day                                          │  │
│  │  Sat ███ 4.1/day                                             │  │
│  │  Sun ███ 3.8/day                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Analyst-specific elements:**
- Source system breakdown tells analysts which tool is generating backlog.
- Day-of-week profile is operationally useful: the analyst knows Monday is heaviest.
- Surge markers are labeled with what caused them (if ledger event exists).

---

### Chapter 5: Patterns (Analyst View) -- Primary Differentiator

This chapter is where the analyst gets the most unique value.

```
┌─── PATTERNS ────────────────────────────────────────────────────────┐
│  "42% of your team's time is spent on recurring patterns.           │
│   3 clusters are flagged for automation."                           │
│                                                                     │
│  ┌─── AUTOMATION CANDIDATES ────────────────────────────────────┐  │
│  │  Ranked by total analyst hours consumed                      │  │
│  │                                                              │  │
│  │  🔴 CRITICAL  Phishing Email Detected                        │  │
│  │     34 tickets · 41.2h consumed · URGENT recurrence active   │  │
│  │     Intake unchanged after closure (non-resolving work)      │  │
│  │     [View cluster ▶]                                         │  │
│  │                                                              │  │
│  │  🟠 REQUIRED  DLP Alert | Policy: PII-SSN                   │  │
│  │     22 tickets · 28.6h consumed · Recurring 45 days         │  │
│  │     [View cluster ▶]                                         │  │
│  │                                                              │  │
│  │  🟡 ADVISORY  Brute Force Detected                          │  │
│  │     18 tickets · 9.1h consumed · Recurring 12 days          │  │
│  │     [View cluster ▶]                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── ALL CLUSTERS ─── sorted by: [Hours ▾] ───────────────────┐  │
│  │                                                              │  │
│  │  Cluster                Hours   Count  TTFT P85  Trend      │  │
│  │  ─────────────────────────────────────────────────────────  │  │
│  │  Phishing Email          41.2h    34    2.1h     ↗🔴        │  │
│  │  DLP PII-SSN             28.6h    22    4.8h     →🟡        │  │
│  │  Cloud Owner ID          24.1h     8   11.2h     ↗🟡        │  │
│  │  Brute Force              9.1h    18    1.4h     ↘🟢        │  │
│  │  Impossible Travel        6.8h     6    3.2h     →🟢        │  │
│  │  GuardDuty IAM            4.2h     4    2.8h     ↘🟢        │  │
│  │  [tap any row → cluster detail slide-out]                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─── SLOW RECURRENCE (automation opportunities) ───────────────┐  │
│  │  Cluster                  Recurs every   Last seen   Action  │  │
│  │  DLP PII-SSN              ~3 days        2h ago      🟠      │  │
│  │  Cloud Owner ID           ~8 days        yesterday   🟡      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this works for analysts:**
- They see automation candidates ranked by hours -- not just count. This is the argument they need when talking to a team lead about tuning a rule.
- "Non-resolving work" label is plain language for "closing these tickets doesn't stop them from coming back."
- CRITICAL / REQUIRED / ADVISORY tiers give a clear vocabulary.

---

### Analyst Slide-Out: Cluster Detail

Triggered by tapping any cluster row or "View cluster" link.

```
┌─── CLUSTER DETAIL ──────────────────────────────── [✕] ───────────┐
│  Phishing Email Detected                                           │
│  Normalized: "Phishing Email Detected"   Source: Proofpoint       │
│  Asset Class: Email / Identity   Label: phishing, email           │
│                                                                    │
│  ┌── METRICS ────────────────────────────────────────────────┐   │
│  │  34 tickets  ·  41.2 analyst hours  ·  🔴 CRITICAL        │   │
│  │  TTFT P85: 2.1h  ↗🔴  vs baseline 0.8h                   │   │
│  │  Cycle Time P85: 1.2h  →🟢                                │   │
│  │  Flow Efficiency: 68% 🟢                                  │   │
│  │  Rapid Recurrence: ACTIVE (7 in last 4h)                  │   │
│  │  Slow Recurrence: every ~3 days for 45 days               │   │
│  │  Intake Persistence: 94% (closures not reducing intake)   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── INSIGHT ────────────────────────────────────────────────┐   │
│  │  "This alert fires consistently regardless of how many    │   │
│  │   tickets are closed. The source is not being addressed   │   │
│  │   by ticket closure alone. This is a rule tuning or       │   │
│  │   upstream block candidate."                              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── TICKET LIST ────────────────── [Sort: Oldest ▾] ────────┐   │
│  │  SOC-1847  6.2h old  Untouched  🔴  [Open ▶]             │   │
│  │  SOC-1841  4.8h old  Active     🟡  [Open ▶]             │   │
│  │  SOC-1839  4.1h old  Active     🟡  [Open ▶]             │   │
│  │  SOC-1821  closed 2h ago  1.1h cycle  ✓                  │   │
│  │  SOC-1818  closed 3h ago  0.9h cycle  ✓                  │   │
│  │  [Show all 34 ▾]                                          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── TIMELINE ───────────────────────────────────────────────┐   │
│  │  Intake rate for this cluster (last 7d)                   │   │
│  │  ▁▂▃▅▆▇██ ← still rising                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

### Analyst Bottom Sheet: Ticket Detail

Triggered by tapping any ticket row. Slides up from bottom.

```
┌─── TICKET DETAIL ───────────────────────── [─] [✕] ───────────────┐
│  SOC-1847 · Phishing Email Detected                                │
│  Created: 2h 14m ago (working hours)  ·  Status: Open             │
│  Assignee: Unassigned  ·  Priority: P2  ·  Label: phishing, email │
│                                                                    │
│  ┌── TIMELINE ────────────────────────────────────────────────┐   │
│  │  09:14  Created (Proofpoint integration)                   │   │
│  │  ────── [no transitions] ──────────────────────────────── │   │
│  │  11:28  Now (6.2 working hours, UNTOUCHED)                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── CLOSURE INTEGRITY ──────────────────────────────────────┐   │
│  │  Classification: UNTOUCHED                                │   │
│  │  No status transition has occurred since creation.        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌── CLUSTER CONTEXT ────────────────────────────────────────┐   │
│  │  Part of: Phishing Email Detected (34 tickets)            │   │
│  │  Automation status: CRITICAL                              │   │
│  │  This cluster has active rapid recurrence.                │   │
│  │  [View cluster ▶]                                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
│  [Open in Jira ↗]                                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Team Lead Workflow

### What the Team Lead Sees on Load

The team lead's landing state prioritizes **team health and capacity signals**, not individual ticket triage.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡]  PROJ-SOC  PROJ-IR   [7d][14d][30d][⊡]  [Team Lead ▾]  [⚙]  │
│                                                                     │
│ Queue: 23 ↗🟡   Net Vel: -1.4/hr ↘🔴   TTFT P85: 4.3h ↗🔴        │
│ Surge Score: 3/5 🟡   Stalled: 3 🟡   ⚠ Active Incident: IR-47    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Chapter 1: Watch Status (Team Lead View)

```
┌─── WATCH STATUS ────────────────────────────────────────────────────┐
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  ASSESSMENT: UNDERSTAFFED                                  │    │
│  │                                                            │    │
│  │  Queue depth is growing and response time is slowing.      │    │
│  │  The team is falling behind the current alert volume.      │    │
│  │  Three tickets have been open without any action for       │    │
│  │  over 4 working hours.                                     │    │
│  │                                                            │    │
│  │  Recommended: review current WIP and analyst assignment.   │    │
│  │  [See supporting data ▼]                                   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── KPI STRIP ───────────────────────────────────────────────┐    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │    │
│  │  │Queue 23│ │-1.4/hr │ │4.3h   │ │3 stall │ │Surge  │  │    │
│  │  │↗🟡    │ │↘🔴     │ │↗🔴    │ │→🟡     │ │3/5🟡  │  │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── ANALYST LOAD (opt-in) ───────────────────────────────────┐    │
│  │  Smith, J    ████████████  14 open  3.2h avg  →🟢          │    │
│  │  Parker, A   ████████████████  18 open  5.1h avg  ↗🔴      │    │
│  │  Williams, M ████████  10 open  2.8h avg  ↘🟢              │    │
│  │  Chen, L     ██████████████  16 open  4.4h avg  ↗🟡        │    │
│  │                                   ↑ Parker is overloaded   │    │
│  │  [Rebalance suggestions ▶]                                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── SHIFT HANDOFF ───────────────────────────────────────────┐    │
│  │  Day shift ends in: 2h 14m                                 │    │
│  │  Open tickets: 23   Stalled: 3   At risk of rollover: 11   │    │
│  │  "11 tickets are unlikely to close before shift end        │    │
│  │   based on current cycle time."                            │    │
│  │  [View at-risk tickets ▶]                                  │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Team-lead-specific elements:**
- Staffing verdict in prose at the top. No matrix shown by default.
- Analyst load distribution with the outlier called out explicitly.
- Shift handoff panel: how many tickets are at risk of rolling over before end of shift. This is a team lead's most time-sensitive operational concern.
- "Rebalance suggestions" slide-out.

---

### Chapter 4: Capacity (Team Lead View)

```
┌─── CAPACITY ────────────────────────────────────────────────────────┐
│  "Thursday night shift is your most consistent rollover point.      │
│   Proofpoint tickets account for 60% of overnight carryover."       │
│                                                                     │
│  ┌── ROLLOVER HEATMAP ────────────────────────────────────────┐    │
│  │        Mon  Tue  Wed  Thu  Fri  Sat  Sun                   │    │
│  │  Day    🟢   🟢   🟡   🔴   🟡   🟢   🟢                  │    │
│  │  Eve    🟡   🟢   🟡   🔴   🔴   🟡   🟢                  │    │
│  │  Night  🟢   🟢   🟢   🔴   🔴   🟢   🟢                  │    │
│  │                                                            │    │
│  │  [▲ Show incident overlay]                                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── TICKET AGING ────────────────────────────────────────────┐    │
│  │  < 4h     ████████████████████  17  (12 active, 5 untouched│    │
│  │  4-8h     ████  4   (2 active, 1 stalled, 1 untouched)     │    │
│  │  8-24h    ██  2   (1 active, 1 stalled)                    │    │
│  │  1-3d     0                                                │    │
│  │  3d+      0                                                │    │
│  │  [tap any bar → ticket list]                               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── SURGE ABSORPTION ────────────────────────────────────────┐    │
│  │  Last 14 days: 5 surge days detected                       │    │
│  │  Handled within normal operating parameters: 3 of 5        │    │
│  │                                                            │    │
│  │  ✓ Oct 14  Handled  intake +240%  TTFT held               │    │
│  │  ✗ Oct 16  Degraded  intake +310%  TTFT +180%             │    │
│  │  ✓ Oct 18  Handled  intake +190%  TTFT held               │    │
│  │  ✗ Oct 21  Degraded  intake +280%  TTFT +220%             │    │
│  │  ✓ Oct 22  Handled  intake +170%  TTFT held               │    │
│  │                                                            │    │
│  │  "Your team handles surges up to ~240% above baseline.     │    │
│  │   Above that threshold, response time degrades."           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── INCIDENT COST TO QUEUE ──────────────────────────────────┐    │
│  │  IR-47 (active, 3.1h open)                                 │    │
│  │  Standard queue close rate: -38% vs baseline               │    │
│  │  Standard TTFT: +2.1h vs baseline                          │    │
│  │  Estimated ticket carryover: ~12 tickets                   │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Team Lead Slide-Out: Context Ledger

Primary unique feature for team leads. Accessible from left drawer nav or top bar shortcut.

```
┌─── CONTEXT LEDGER ──────────────────────────────── [✕] ───────────┐
│                                                                    │
│  ┌── CALENDAR ─── October 2024 ──────── [◀][▶] ──────────────┐  │
│  │  Mo  Tu  We  Th  Fr  Sa  Su                                │  │
│  │   1   2   3   4   5   6   7                                │  │
│  │   8   9  10  11  12  13  14                                │  │
│  │  15  16  17  18  19  20  21   ← [🏥] Parker out 21-23     │  │
│  │  22 [🔴]23 [🔴]24  25  26  27  28                         │  │
│  │  29  30  31                                                │  │
│  │  [🏖️] = Holiday  [🏥] = Absence  [⚙️] = System event     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── UPCOMING ────────────────────────────────────────────────┐  │
│  │  Oct 21-23  🏥 Parker, A · Sick leave · Day shift          │  │
│  │  Oct 31     🏖️ Holiday · All shifts                        │  │
│  │  Nov 1      👤 New hire starts · Chen, B · Day shift        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── IMPACT PREVIEW ──────────────────────────────────────────┐  │
│  │  Parker absence (21-23):                                   │  │
│  │  "Day shift capacity drops 25% for 3 working days.         │  │
│  │   Based on current volume, expect ~31 additional           │  │
│  │   tickets to accumulate across this window."               │  │
│  │                                                            │  │
│  │  New hire Nov 1:                                           │  │
│  │  "Adds approximately 8.2 tickets/day to day shift          │  │
│  │   capacity based on team average throughput."              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [+ Add Event]                                                    │
│                                                                    │
│  ┌── RECENT EVENTS ────────────────────────────────────────────┐  │
│  │  Oct 18  ⚙️ New GuardDuty rule deployed (IAM scope)         │  │
│  │          "Intake spike Oct 18-19 attributed to this."      │  │
│  │                                                            │  │
│  │  Oct 10  🏥 Williams, M · Training · 3 days · Day shift    │  │
│  │  Oct 07  ⚙️ Proofpoint integration disruption · 4h         │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

### Team Lead Slide-Out: Add Event Form

```
┌─── ADD CONTEXT EVENT ───────────────────────────── [✕] ───────────┐
│                                                                    │
│  Event type                                                        │
│  ○ People (absence, new hire, shift change)                       │
│  ○ System (downtime, rule deployment, integration)                │
│  ● Calendar (holiday, audit, maintenance)                         │
│                                                                    │
│  Description                                                       │
│  [________________________________]                               │
│                                                                    │
│  Date range                                                        │
│  From: [Oct 21, 2024]   To: [Oct 23, 2024]                       │
│                                                                    │
│  Scope                                                             │
│  ● All shifts   ○ Day shift   ○ Evening   ○ Night                │
│                                                                    │
│  Analyst (optional, if People event)                               │
│  [Parker, A          ▾]                                           │
│                                                                    │
│  ┌── IMPACT PREVIEW ──────────────────────────────────────────┐  │
│  │  (updates as you type)                                     │  │
│  │  "This event reduces team capacity by 25% for 3 working    │  │
│  │   days. At current volume, expect approximately 31         │  │
│  │   additional tickets to accumulate."                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Cancel]                              [Save Event]               │
└────────────────────────────────────────────────────────────────────┘
```

---

### Team Lead Slide-Out: Rebalance Suggestions

```
┌─── WORKLOAD REBALANCE ──────────────────────────── [✕] ───────────┐
│                                                                    │
│  "Parker, A has 18 open tickets with an average cycle time        │
│   significantly above the team mean. Williams, M has capacity."   │
│                                                                    │
│  ┌── CURRENT STATE ────────────────────────────────────────────┐ │
│  │  Parker, A    18 open  5.1h avg cycle  ↗🔴  OVERLOADED      │ │
│  │  Chen, L      16 open  4.4h avg cycle  ↗🟡  WATCH          │ │
│  │  Smith, J     14 open  3.2h avg cycle  →🟢  NORMAL         │ │
│  │  Williams, M  10 open  2.8h avg cycle  ↘🟢  CAPACITY       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌── SUGGESTION ───────────────────────────────────────────────┐ │
│  │  Reassign 4 unstarted tickets from Parker → Williams         │ │
│  │  Brings Parker to ~14 open, Williams to ~14 open             │ │
│  │  Estimated impact: Parker avg cycle -0.8h                   │ │
│  │                                                              │ │
│  │  Tickets suggested for reassignment:                         │ │
│  │  SOC-1841  Brute Force Detected  Unstarted  [Reassign ▶]   │ │
│  │  SOC-1838  DLP PII-SSN           Unstarted  [Reassign ▶]   │ │
│  │  SOC-1835  Impossible Travel     Unstarted  [Reassign ▶]   │ │
│  │  SOC-1833  Phishing Email        Unstarted  [Reassign ▶]   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Note: Reassignment opens the ticket in Jira. The dashboard       │
│  does not write to Jira directly.                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Director Workflow

### What the Director Sees on Load

Directors land on a summary-first view. Everything is statement-led. Detail is one tap away but not the default.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [≡]  PROJ-SOC  PROJ-IR   [30d][⊡]          [Director ▾]   [⚙]   │
│                                                                     │
│ ● PROJ-SOC: 🔴 Understaffed   ● PROJ-IR: 🟡 Healthy               │
└─────────────────────────────────────────────────────────────────────┘
```

The top bar in Director mode shows project-level health dots and verdict labels, not raw operational metrics.

---

### Chapter 1: Watch Status (Director View)

```
┌─── WATCH STATUS ────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─── PROJ-SOC ────────────────────────────────────────────────┐   │
│  │  🔴 UNDERSTAFFED                                            │   │
│  │                                                             │   │
│  │  Queue depth has grown 34% in the last 14 days. Response   │   │
│  │  time is rising. The team is not keeping pace with alert   │   │
│  │  volume from Proofpoint specifically, which has increased   │   │
│  │  intake by 2.4 tickets per hour over baseline.             │   │
│  │                                                             │   │
│  │  42% of analyst time is spent on recurring alert patterns   │   │
│  │  flagged for automation. Addressing the top three clusters  │   │
│  │  would recover approximately 70 analyst-hours per week.    │   │
│  │                                                             │   │
│  │  [See detail ▼]                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── PROJ-IR ─────────────────────────────────────────────────┐   │
│  │  🟡 STABLE WITH WATCH ITEM                                  │   │
│  │                                                             │   │
│  │  IR-47 active (3.1 working hours). Incident rate is        │   │
│  │  stable. Standard SOC throughput is reduced 38% during     │   │
│  │  active incidents -- this is your current cost model       │   │
│  │  for incident response.                                     │   │
│  │                                                             │   │
│  │  [See detail ▼]                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── KPI STRIP ───────────────────────────────────────────────┐    │
│  │  23  ↗🟡    -1.4/hr ↘🔴    4.3h ↗🔴    42% 🟡   3/5 🟡   │    │
│  │  Queue      Net Vel        TTFT P85    Wasted   Surge      │    │
│  └────────────────────────────────────────────────────────────┘    │
│  [tap any card for detail slide-out]                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Director-specific design choices:**
- Project verdict is a prose paragraph, not a matrix or set of numbers.
- The automation insight ("70 analyst-hours per week recoverable") is surfaced at the top -- this is a budget/ROI number that directors care about.
- Incident cost to queue expressed as a percentage, not raw numbers.
- KPI strip is present but secondary -- the numbers support the verdict, not the other way around.

---

### Chapter 7: Projections (Director View) -- Primary Chapter

The projections chapter is the most important chapter for directors.

```
┌─── PROJECTIONS ─────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─── FORWARD OUTLOOK ─── 30/60/90d ──────────────────────────┐    │
│  │                                                             │    │
│  │  "At current staffing and alert volume trajectory,         │    │
│  │   queue depth will exceed 2x current size in               │    │
│  │   approximately 3 weeks."                                  │    │
│  │                                                             │    │
│  │  "Adding one analyst to the day shift extends that         │    │
│  │   window to approximately 9 weeks."                        │    │
│  │                                                             │    │
│  │  "Automating the top three recurring clusters would        │    │
│  │   recover 70 analyst-hours per week -- equivalent to       │    │
│  │   approximately 0.9 FTE. This would push the crossover     │    │
│  │   point beyond the 90-day projection window."              │    │
│  │                                                             │    │
│  │  "Historical Q4 patterns show a 40% intake increase.       │    │
│  │   Without intervention, Q4 will require the equivalent     │    │
│  │   of 1.5 additional FTEs beginning mid-November."          │    │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌── PROJECTION CHART ────── [30d][60d][90d] ─── [Scenarios ▾]─┐  │
│  │  [fan chart: intake band / capacity line / gap area]          │  │
│  │                                                               │  │
│  │  Past ─────────────────────────────────── Future             │  │
│  │       [🏥Oct21][⚙️Oct18]  [🏖️Oct31][👤Nov1]                 │  │
│  │                                                               │  │
│  │  Scenario: [Current staffing ▾]                              │  │
│  │  Alt:      [+ 1 day shift analyst]  [Automate top 3 clusters]│  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌── SEASONAL CONTEXT ────────────────────────────────────────┐    │
│  │  Based on 14 months of history:                            │    │
│  │                                                            │    │
│  │  Trend: Alert volume growing at +3.2% per month           │    │
│  │  Q4 seasonal spike: historically +38-44% (Nov-Dec)        │    │
│  │  Post-holiday drop: historically -25% (Jan)               │    │
│  │                                                            │    │
│  │  [View seasonal decomposition chart ▶]                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── AUTOMATION ROI SUMMARY ──────────────────────────────────┐    │
│  │  Top 3 automation candidates:                              │    │
│  │                                                            │    │
│  │  Phishing Email Detected   41.2h/period  🔴 CRITICAL      │    │
│  │  DLP Alert PII-SSN         28.6h/period  🟠 REQUIRED      │    │
│  │  Cloud Owner ID            24.1h/period  🟠 REQUIRED      │    │
│  │                                          ─────────────    │    │
│  │  Total recoverable:        93.9h/period  ≈ 0.9 FTE/period │    │
│  │                                                            │    │
│  │  [Full automation report ▶]                               │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Chapter 8: Compare (Director View, Multi-Project)

```
┌─── COMPARE ─────────────────────────────────────────────────────────┐
│  "PROJ-IR is performing within healthy parameters.                  │
│   PROJ-SOC is the current operational risk."                        │
│                                                                     │
│  ┌── SIDE BY SIDE ────────────────────────────────────────────┐    │
│  │                         PROJ-SOC      PROJ-IR              │    │
│  │  Verdict                🔴 UNDER      🟢 HEALTHY           │    │
│  │  Net Velocity           -1.4/hr ↘🔴   +0.2/hr →🟢         │    │
│  │  TTFT P85               4.3h ↗🔴      0.8h →🟢            │    │
│  │  Flow Efficiency        34% 🟡         72% 🟢              │    │
│  │  Rollover Rate          41% ↗🔴        18% →🟢             │    │
│  │  Surge Score            3/5 🟡         5/5 🟢              │    │
│  │  Wasted Work Ratio      42% 🔴         11% 🟢              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌── RADAR CHART ─────────────────────────────────────────────┐    │
│  │  [normalized pentagon: one polygon per project]             │    │
│  │  Axes: TTFT | Flow Eff | Net Vel | Rollover | Surge        │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Director Slide-Out: Scenario Planner

Triggered from Projections chapter Scenarios button.

```
┌─── SCENARIO PLANNER ────────────────────────────── [✕] ───────────┐
│                                                                    │
│  Adjust the scenario to see projected impact on the queue          │
│  crossover point.                                                  │
│                                                                    │
│  ┌── STAFFING CHANGES ─────────────────────────────────────────┐ │
│  │  Additional analysts:  [─]  0  [+]                          │ │
│  │  Start date:  [Nov 1, 2024]                                  │ │
│  │  Shift:  [Day ▾]                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌── AUTOMATION ACTIONS ──────────────────────────────────────┐  │
│  │  [☑] Automate: Phishing Email Detected  (-41.2h/period)    │  │
│  │  [☑] Automate: DLP Alert PII-SSN        (-28.6h/period)    │  │
│  │  [ ] Automate: Cloud Owner ID           (-24.1h/period)    │  │
│  │  Effective date: [Nov 15, 2024]                             │  │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌── SCENARIO RESULT ──────────────────────────────────────────┐ │
│  │  With selected changes:                                     │ │
│  │                                                             │ │
│  │  "Queue crossover pushed beyond 90-day window."            │ │
│  │  "Q4 spike absorbed within capacity."                      │ │
│  │  "Estimated annual FTE-equivalent recovered: 1.8 FTEs."   │ │
│  │                                                             │ │
│  │  [View in projection chart ▶]                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```
