# SPA Shell, Navigation & Component Library

*Extracted from UX & Workflow Design v1.0, Sections 2-3, 7-12*

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
