# SOC Productivity Dashboard — UX & Workflow Design

**Version:** 1.0  
**Status:** Pre-Implementation  
**Companion to:** Design Document v1.1

---

## Table of Contents

1. [Persona Definitions](#1-persona-definitions)
2. [SPA Shell Architecture](#2-spa-shell-architecture)
3. [Navigation Model](#3-navigation-model)
4. [Analyst Workflow](#4-analyst-workflow)
5. [Team Lead Workflow](#5-team-lead-workflow)
6. [Director Workflow](#6-director-workflow)
7. [Shared Component Library](#7-shared-component-library)
8. [Slide-Out Panel System](#8-slide-out-panel-system)
9. [Drill-Down Stack](#9-drill-down-stack)
10. [Responsive Behavior](#10-responsive-behavior)
11. [State Transitions and Loading](#11-state-transitions-and-loading)
12. [Component Inventory](#12-component-inventory)

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

## 2. SPA Shell Architecture

The application is a single persistent shell. Content inside it changes. The shell never reloads.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                            │
│  Always visible. Operational state at a glance.                     │
├──────────┬──────────────────────────────────────────────┬──────────┤
│          │                                              │          │
│  LEFT    │  MAIN CONTENT AREA                           │  RIGHT   │
│  DRAWER  │  Chapter-driven. Scrollable.                 │  DRAWER  │
│          │  Charts + KPI cards + narrative.             │          │
│  Project │                                              │  Config  │
│  select  │                                              │  Vault   │
│  filter  │                                              │  Status  │
│  nav     │                                              │  mapping │
│          │                                              │          │
│          │                                              │          │
├──────────┴──────────────────────────────────────────────┴──────────┤
│  SLIDE-OUT PANEL (layered, stackable, breadcrumbed)                 │
│  Opens over main content from right. Drill-down lives here.        │
└─────────────────────────────────────────────────────────────────────┘
│  BOTTOM SHEET (ticket detail, cluster deep-dive)                    │
│  Slides up. Independent of slide-out panel state.                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Shell Dimensions

```
Top bar:         48px height, fixed, full width, highest z-index
Left drawer:     280px width, collapsible to 64px icon rail
Right drawer:    320px width, collapsible to 0 (hidden when not in use)
Main content:    Fluid, fills remaining space
Slide-out panel: 560px width, slides over main content from right
Bottom sheet:    Full width, 60vh max height, slides up from bottom
```

---

## 3. Navigation Model

### Chapter Navigation (Left Drawer)

Navigation is chapter-based, not page-based. Chapters are sections of a continuous analytical story.

```
LEFT DRAWER CONTENTS

[⊞] Dashboard                ← current chapter indicator

─── CHAPTERS ──────────────
[●] Watch Status             ← Chapter 1 (always first)
[◎] Flow                     ← Chapter 2
[⚡] Response Speed           ← Chapter 3
[⬡] Capacity                 ← Chapter 4
[◈] Patterns                 ← Chapter 5
[△] Incidents                ← Chapter 6 (IR project only)
[↗] Projections              ← Chapter 7
[⊞] Compare                  ← Chapter 8 (multi-project only)

─── MANAGER ────────────────
[📋] Context Ledger          ← Chapter 0

─── PROJECTS ───────────────
[☑] PROJ-SOC     ●●○ (health)
[☑] PROJ-IR      ●○○ (health)
[ ] PROJ-OTHER   (not selected)

─── FILTERS ────────────────
Date: [7d][14d][30d][⊡]
Source: [All ▾]
Label: [All ▾]
Asset Class: [All ▾]
```

Chapter links do not navigate to new pages. They smooth-scroll the main content area to the relevant section and expand it if collapsed. All chapters are always rendered -- navigation just moves focus.

### View Mode Toggle (Top Bar)

```
[Analyst ▾]  →  dropdown: Analyst | Team Lead | Director
```

Switching view mode does not reload. It toggles visibility classes on components. The data underneath is identical. A director can switch to Analyst mode in one tap to see raw detail.

### URL State

The URL reflects current state for shareability:

```
/dashboard?projects=PROJ-SOC,PROJ-IR&window=14d&chapter=capacity&view=lead
```

A link shared by a team lead opens in the same state the sender had. Vault unlock is still required for API calls.

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

---

## 7. Shared Component Library

Components used across all three views. Behavior adapts to view mode via props, not separate implementations.

### KPICard

```
Props:
  label: string
  value: number | string
  unit: string
  direction: "up" | "down" | "stable"
  status: "green" | "yellow" | "red" | "neutral"
  sentence: string
  tooltipL1: string
  tooltipL2: string
  onClick?: () => void   // opens drill-down slide-out

Behavior:
  All props render in all view modes
  Director mode: card is slightly larger, sentence is 2 lines max
  Analyst mode: card is compact, sentence is 1 line
```

### NarrativeBlock

```
Props:
  verdict: "understaffed" | "routing-problem" | "surge-event" | "healthy"
  headline: string
  body: string
  recommendedAction: string
  detailComponent?: ReactNode  // collapsed by default

Behavior:
  Director mode: headline + body + action, detail collapsed
  Lead mode: headline + body + action, detail available
  Analyst mode: headline only, detail available
```

### ClusterCard

```
Props:
  name: string
  normalizedTitle: string
  sourceSystem: string
  totalWorkHours: number
  ticketCount: number
  ttftP85: number
  cycleTimeP85: number
  ttftDelta: number          // vs project baseline
  automationTier: "critical" | "required" | "advisory" | null
  recurrenceType: "rapid" | "slow" | null
  onExpand: () => void       // opens cluster slide-out

Display:
  Tier badge (color coded)
  Hours consumed (primary sort field)
  Relative performance vs baseline
```

### RolloverHeatmap

```
Props:
  data: ShiftDay[][]
  showIncidentOverlay: boolean
  onCellClick: (day, shift) => void

Each cell: color by severity, tap opens ticket list for that day+shift
```

### ProjectionFanChart

```
Props:
  history: DataPoint[]
  projectedIntakeBand: { p25: number[], p75: number[] }
  capacityLine: number[]
  annotations: LedgerEvent[]
  scenarios: Scenario[]
  onAnnotationClick: (event) => void
```

### TicketRow

```
Props:
  ticket: Ticket
  showCluster: boolean
  showAnalyst: boolean
  closureClassification: ClosureClass
  onClick: () => void        // opens bottom sheet

Status icons:
  🔴 Untouched
  🟡 Stalled
  🟢 Active / closed
```

---

## 8. Slide-Out Panel System

Slide-outs are the primary drill-down mechanism. They stack.

### Behavior Rules

```
Open:      slides in from right, 560px wide, 100vh height
Backdrop:  semi-transparent overlay behind panel (not main content)
Close:     [✕] button, Escape key, or backdrop click
Stack:     panels stack left (second panel opens offset from first)
Max stack: 2 panels deep (third action replaces second)
Breadcrumb: top of panel shows navigation trail
```

### Panel Types

**ClusterDetailPanel**
- Triggered by: cluster row tap, "View cluster" links
- Contents: metrics strip, insight block, ticket list, intake timeline

**TicketListPanel**
- Triggered by: aging bucket taps, rollover heatmap cell taps, analyst row taps
- Contents: filtered ticket list with sort controls

**RebalancePanel**
- Triggered by: "Rebalance suggestions" in analyst load section
- Contents: current load state, suggested moves, one-tap Jira links

**LedgerEventPanel**
- Triggered by: "+ Add Event" in context ledger
- Contents: event entry form with real-time impact preview

**ScenarioPanel**
- Triggered by: "Scenarios" in projections chapter
- Contents: staffing and automation toggles, scenario result

**MetricDetailPanel**
- Triggered by: KPI card tap (when onClick provided)
- Contents: full chart for that metric, historical trend, contributing factors

### Breadcrumb Pattern

```
Dashboard > Patterns > "Phishing Email" cluster > SOC-1847

[← Dashboard]  [← Patterns]  [← Phishing Email]  SOC-1847
```

Each breadcrumb is a tap target that closes panels back to that level.

---

## 9. Drill-Down Stack

The full drill-down path from top bar to ticket detail.

```
LEVEL 0: Top Bar (always visible)
  Tap any metric → Level 2 (metric detail slide-out)

LEVEL 1: Main Content (chapters)
  Tap chart data point → Level 2
  Tap cluster row → Level 2 (cluster detail)
  Tap aging bucket → Level 2 (ticket list)
  Tap rollover cell → Level 2 (ticket list for that shift/day)

LEVEL 2: Slide-Out Panel (first)
  Tap ticket row → Level 3 (bottom sheet)
  Tap cluster link → Level 2b (second panel, cluster detail)
  Tap analyst row → Level 2b (analyst ticket list)

LEVEL 2b: Slide-Out Panel (second, stacked)
  Tap ticket row → Level 3 (bottom sheet)

LEVEL 3: Bottom Sheet (ticket detail)
  Tap "View cluster" → Level 2 (replaces or stacks)
  Tap "Open in Jira" → external navigation, new tab
```

The bottom sheet is always ticket detail. It is independent of the slide-out stack. Both can be open simultaneously.

---

## 10. Responsive Behavior

### Desktop (> 1280px)

Full shell as described. Left drawer expanded. Right drawer accessible. Slide-outs at 560px. Main content fluid.

### Tablet (768px - 1280px)

```
Left drawer: collapses to 64px icon rail, tap to expand as overlay
Right drawer: hidden by default, accessible via ⚙ button as overlay
Slide-outs: 80vw width instead of fixed 560px
Main content: full width minus icon rail
```

### Mobile (< 768px)

```
Top bar: condensed (project dots only, no metric strip)
         metric strip moves to Chapter 1 Watch Status
Left drawer: hidden, accessed via hamburger menu as full-screen overlay
Right drawer: hidden, accessed via ⚙ as full-screen overlay
Chapters: swipeable horizontal carousel (one chapter per "screen")
Slide-outs: full-screen (100vw, 100vh) with back button
Bottom sheet: 80vh, swipe down to dismiss
Charts: simplified (fewer data points, larger touch targets)
```

---

## 11. State Transitions and Loading

### Initial Load

```
1. Vault prompt → password entry bottom sheet
2. On unlock: decrypt vault, retrieve tenantUrl + apiKey
3. Fetch projects (spinner in left drawer)
4. Projects loaded: show project tree, user selects
5. Fetch statuses for selected projects
6. Status mapping UI if new statuses found
7. Fetch issues (progress bar in main content)
8. Normalize + compute: skeleton cards show, fill as computed
9. Dashboard ready
```

### Skeleton State

While data loads, every KPI card and chart renders a skeleton. Skeletons have the same dimensions as the final component. No layout shift on data arrival.

```
┌──────────────────┐
│  TTFT P85        │
│  ████████  ██    │
│  ██████████████  │
└──────────────────┘
```

### Error States

```
API auth failure:   vault drawer opens, error message, re-entry prompt
Rate limit:         toast notification, automatic retry with backoff
No data:            empty state illustration, "No tickets found for 
                    this period and project combination"
Partial data:       metrics computed on available data, banner noting
                    pagination incomplete if fetch was interrupted
```

### Refresh

Data does not auto-refresh (avoids unexpected rate limit hits). Refresh button in top bar. Last updated timestamp always visible.

---

## 12. Component Inventory

Complete list of every component in the application, organized by layer.

### Shell

| Component | Description |
|---|---|
| `AppShell` | Root layout: top bar, drawers, main content, slide-out host |
| `TopBar` | Fixed bar: project health, quick metrics, view toggle, vault |
| `LeftDrawer` | Chapter nav, project selector, filter controls |
| `RightDrawer` | Config: vault, schedule, status mapping, thresholds |
| `SlideOutHost` | Manages slide-out panel stack, backdrop, animations |
| `BottomSheet` | Ticket detail, dismissable, swipeable |
| `ViewToggle` | Analyst / Team Lead / Director mode switcher |
| `VaultPrompt` | Password entry for vault unlock |

### Navigation

| Component | Description |
|---|---|
| `ChapterNav` | Chapter list with health indicator dots |
| `ProjectTree` | Multi-select project list with health dots |
| `FilterBar` | Date range, source system, label, asset class filters |
| `QuickWindows` | 7d / 14d / 30d buttons |
| `DateRangePicker` | Arbitrary from/to date selection |
| `Breadcrumb` | Drill-down trail, tap to navigate back |

### Chapter Components

| Component | Chapter | Description |
|---|---|---|
| `WatchStatus` | 1 | Needs attention, rapid recurrence, KPI strip |
| `NeedsAttentionPanel` | 1 | Stalled + untouched ticket list |
| `RapidRecurrencePanel` | 1 | Active rapid recurrence alerts |
| `Flow` | 2 | Intake vs close, net velocity, category breakdown |
| `IntakeVsCloseChart` | 2 | Dual line with surge/rule markers |
| `NetVelocityChart` | 2 | Area chart, green/red above/below zero |
| `CategoryBreakdownTable` | 2 | Per-source, per-label intake/close/net |
| `DayOfWeekProfile` | 2 | Bar chart, avg intake by day |
| `ResponseSpeed` | 3 | TTFT, lead time decomposition, flow efficiency |
| `TTFTHistogram` | 3 | Per-cluster histogram with percentile callouts |
| `LeadTimeDecomposition` | 3 | Three-segment bar per cluster |
| `FlowEfficiencyCards` | 3 | Per-cluster percentage cards |
| `VelocityUnderLoad` | 3 | Scatter with trend line |
| `Capacity` | 4 | Verdict, rollover, aging, surge, incident cost |
| `StaffingVerdictCard` | 4 | Prose verdict, collapsible detail |
| `RolloverHeatmap` | 4 | Shift/day grid, incident overlay |
| `AgingBuckets` | 4 | Stacked bar: untouched/stalled/active |
| `SurgeAbsorptionCard` | 4 | Score card with per-day pass/fail list |
| `AnalystLoadChart` | 4 | Horizontal bar per analyst (opt-in) |
| `IncidentCostPanel` | 4 | Throughput delta during IR windows |
| `ShiftHandoffPanel` | 4 | Lead only: at-risk ticket count, countdown |
| `Patterns` | 5 | Clusters, recurrence, saturation, automation |
| `WastedWorkCard` | 5 | Percentage headline KPI |
| `AutomationCandidates` | 5 | Tiered ranked list |
| `ClusterGrid` | 5 | Sortable table of all clusters |
| `SlowRecurrencePanel` | 5 | Persistent patterns, intake persistence rate |
| `CategorySaturationChart` | 5 | Ranked net velocity bar chart |
| `TrendingCategories` | 5 | Intake growth rate ranked list |
| `BacklogSuppressionFlag` | 5 | Warning card if detected |
| `Incidents` | 6 | IR-specific metrics |
| `IncidentTimeline` | 6 | Gantt chart, open + recent incidents |
| `IRMetricsStrip` | 6 | TTFT + cycle time for IR tickets |
| `IncidentFrequencyChart` | 6 | Weekly incident count trend |
| `Projections` | 7 | Statements, fan chart, seasonal, ROI |
| `ProjectionStatements` | 7 | Three generated action statements |
| `ProjectionFanChart` | 7 | Intake band + capacity + gap |
| `SeasonalDecomposition` | 7 | Trend / seasonal / residual components |
| `AutomationROISummary` | 7 | Hours recovered, FTE equivalent |
| `Compare` | 8 | Multi-project side-by-side |
| `CompareTable` | 8 | Per-project metric table |
| `RadarChart` | 8 | Normalized pentagon per project |

### Slide-Out Panels

| Component | Trigger | Contents |
|---|---|---|
| `ClusterDetailPanel` | Cluster row tap | Metrics, insight, ticket list, timeline |
| `TicketListPanel` | Aging bucket, heatmap cell | Filtered sortable ticket list |
| `RebalancePanel` | Analyst load section | Load state, suggested reassignments |
| `LedgerEventPanel` | Add Event button | Event form + impact preview |
| `ScenarioPanel` | Projections scenarios | Staffing + automation toggles, result |
| `MetricDetailPanel` | KPI card tap | Full chart, historical trend |
| `ContextLedger` | Left nav / top bar | Calendar, event list, impact preview |

### Shared / Atomic

| Component | Description |
|---|---|
| `KPICard` | Number + arrow + color + sentence, two-layer tooltip |
| `Tooltip` | Two-layer: L1 implication, L2 methodology |
| `ClusterCard` | Cluster summary with tier badge |
| `TicketRow` | Single ticket row with closure classification icon |
| `NarrativeBlock` | Verdict prose with collapsible detail |
| `ChartHeadline` | Dynamic insight statement above every chart |
| `SurgeMarker` | Annotation pin on timeline charts |
| `LedgerAnnotation` | Event marker on projection/flow charts |
| `ClosureClassBadge` | VALID / INSTANT / UNTOUCHED / STALLED / CHURNED |
| `AutomationTierBadge` | CRITICAL / REQUIRED / ADVISORY |
| `RecurrenceTypeBadge` | RAPID (orange) / SLOW (yellow) |
| `PrioritySeparationGate` | Warning wrapper that suppresses gated metrics |
| `SkeletonCard` | Loading placeholder matching KPICard dimensions |
| `EmptyState` | No-data illustration with context-appropriate message |
| `ErrorBanner` | API / auth error with recovery action |
| `RefreshBar` | Last updated timestamp + refresh button |
| `ImpactPreview` | Real-time ledger event impact calculation |

---

*End of UX & Workflow Design Document v1.0*
