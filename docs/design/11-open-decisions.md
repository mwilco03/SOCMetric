# Open Decisions & Metric Reference

*Extracted from Design Document v1.1, Sections 24-25*

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
