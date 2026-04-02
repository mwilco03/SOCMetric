# Domain Context

*Extracted from Design Document v1.1, Sections 1-4*

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
