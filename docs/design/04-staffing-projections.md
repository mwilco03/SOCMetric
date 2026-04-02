# Staffing, Projections & Pattern Intelligence

*Extracted from Design Document v1.1, Sections 12, 13, 15*

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
