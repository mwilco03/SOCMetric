# UI Standards & Narrative Generation

*Extracted from Design Document v1.1, Sections 18-21, 23*

---

## 18. View Modes

Three modes, same data, different density:

### Analyst View
```
Purpose: my queue, my tickets, my patterns
Default chapter: Chapter 2 (Flow)
Visible chapters: 1, 2, 3, 5
Hidden: Context Ledger (Chapter 0), Capacity (Chapter 4), Projections (Chapter 7)
Detail level: individual ticket drill-down, per-cluster stats
Narrative tone: "Here's what's happening in your queue"
```

### Lead View (Default)
```
Purpose: team performance, staffing signals, context management
Default chapter: Chapter 2 (Flow)
Visible chapters: 0, 1, 2, 3, 4, 5, 6
Hidden: Projections (Chapter 7) -- available on demand
Detail level: team aggregates, per-analyst load (opt-in), shift coverage
Narrative tone: "Here's what your team needs"
```

### Director / Executive View
```
Purpose: strategic signals only
Default chapter: Chapter 1 (Watch Status)
Visible chapters: 1, 4, 7, 8
Hidden: Flow (Chapter 2), Response Speed (Chapter 3), Patterns (Chapter 5), Incidents (Chapter 6)
Detail level: headline KPIs, verdicts, projections
Narrative tone: "Here's what requires your attention"
```

---

## 19. Universal KPI Card Standard

Every headline metric follows this pattern:

```
┌────────────────────────────┐
│  Metric Name               │
│  4.3h  ↗ 🟡               │
│  +1.2h from prior period   │
│                            │
│  "TTFT rose from 3.1h to  │
│   4.3h. Consistent with   │
│   the absence window       │
│   logged Oct 21-23."       │
└────────────────────────────┘
```

**Required elements:**

| Element | Rule |
|---|---|
| Number | Primary value, largest font |
| Direction arrow | ↗ ↘ → based on delta vs prior period |
| Color dot | Green / Yellow / Red based on baseline deviation, not absolute thresholds |
| Delta | "+1.2h from prior period" -- explicit magnitude and direction |
| Insight sentence | Plain language, 1-2 sentences, explains the WHY not just the WHAT |

**Color derivation:**
```
Green:  within 1σ of rolling baseline (computed from prior 30/60/90 day equivalent)
Yellow: 1-2σ outside baseline
Red:    > 2σ outside baseline

Baseline period matches the selected time range:
  Viewing last 7 days → compare to prior 7 days
  Viewing last 30 days → compare to prior 30 days
  Custom range → compare to equivalent preceding range
```

No hardcoded thresholds. All color coding is relative to the team's own historical behavior.

---

## 20. Tooltip Standard

Every data point has a two-layer tooltip:

### Layer 1 (hover / focus)
```
Quick context: value, date range, sample size

Example:
  "TTFT P85: 4.3 working hours
   Period: Oct 14-20, 2024
   Based on 127 tickets"
```

### Layer 2 (click / tap)
```
Extended detail: full formula, inputs, and any adjustments

Example:
  "TTFT P85: 4.3 working hours
   Calculation: 85th percentile of time-to-first-touch
   Valid tickets: 127 of 142 (15 instant-close excluded)
   Working hours only: 8am-5pm ET, weekdays
   Ledger adjustments: Oct 21-23 excluded (analyst absence)
   Prior period P85: 3.1h
   Direction: ↗ +1.2h (+38.7%)
   Baseline σ: 0.8h → this value is 1.5σ above baseline (yellow)"
```

This turns every number into a self-documenting data point. No metric exists without an explanation of how it was derived.

---

## 21. Chart Headline Standard

Every chart has a generated headline -- a plain-language sentence placed above the chart that tells the viewer what the chart says before they read the axes.

### Correct Headlines

```
WRONG: "Cycle Time Distribution"
RIGHT: "Cycle time P85 improved 22% since last period, driven by
        faster resolution in the Email Threat category."

WRONG: "Intake Rate Over Time"
RIGHT: "Intake rate is 15% above seasonal baseline. The spike is
        concentrated in GuardDuty alerts, consistent with the new
        detection rule deployed Oct 18."

WRONG: "Rollover Heatmap"
RIGHT: "Evening shift rolled over 40% of WIP on 3 of 5 days last week.
        Day shift rollover is within normal range."
```

### Headline Generation Rules

```
1. Lead with the finding, not the chart type
2. Include magnitude (%, hours, count) not just direction
3. Reference the driver -- which dimension, cluster, or event explains the pattern
4. If a ledger event explains the pattern, reference it explicitly
5. If no meaningful pattern exists: "Cycle time is stable at 2.1h P85,
   within normal operating range."
```

---

## 23. Narrative Generation

### Staffing Verdict (Chapter 4 Capacity)

```
Template:
  "{verdict_label}. {signal_1_statement}. {signal_2_statement}.
   {recommended_action}."

Example output:
  "Understaffed. Queue depth has grown 23% over the past 14 days while
   TTFT P85 has degraded from 3.1h to 4.3h. Evening shift shows
   consistent rollover above 40%. Consider adding coverage to the
   evening shift or automating the Email Threat category, which
   consumes 31% of team capacity on recurring patterns."
```

### Pattern Intelligence (Chapter 5 Patterns)

```
Per cluster card:
  "{cluster_name}: {ticket_count} tickets, {total_hours}h total capacity.
   {recurrence_statement}. {automation_tier_label}.
   {intake_persistence_statement}."

Example:
  "GuardDuty: UnauthorizedAccess: 847 tickets, 423h total capacity.
   62% rapid recurrence rate -- source is persistently active.
   Automation-critical: closing tickets has not reduced intake rate.
   This cluster alone represents 18% of team working time."
```

### Projection Output (Chapter 7 Projections)

```
"At current intake trend and team capacity, the queue will exceed
 sustainable depth by approximately {date}. This projection accounts
 for the planned new hire starting Nov 1 (ramped to 50% by Dec 1)
 and the seasonal intake increase historically observed in Q4.
 Without the new hire, the projected breach date moves forward to {earlier_date}."
```
