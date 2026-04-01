# Design Specification vs Implementation Gaps

## Summary
- 147 requirements identified across 11 design documents
- 10 implemented correctly (~30%)
- 19 partially implemented
- 27 completely missing
- 1 deviated from spec

## Missing Entire Modules (empty directories)
| Module | Spec Location | Purpose |
|---|---|---|
| src/dimensions/ | 06-infrastructure §17 | Cross-dimension filtering engine |
| src/discovery/ | 06-infrastructure §17 | Project/status/label/TTFT discovery pipeline |
| src/ledger/ | 05-context-ledger §3-7 | CSV import, validation, effective headcount |
| src/narrative/ | 06-infrastructure §17 | Template-based insight generation |
| src/staffing/ | 04-staffing-projections §13 | Projection engine, seasonal decomposition |

Note: All five were subsequently built during this conversation.

## Missing Metrics (never computed, per spec)
- Lead time 3-way decomposition → BUILT
- Cycle time per dimension cluster → partially built via clusterAnalysis
- Velocity under load → BUILT
- Rollover rate by shift → BUILT
- Ticket aging buckets (open queue) → BUILT
- Surge absorption score → BUILT
- Incident cost to queue → BUILT
- Weighted close rate → NOT BUILT
- Closure burst detection → BUILT
- Intake persistence rate (per-cluster) → NOT BUILT (byCluster map empty)
- Category net velocity → BUILT
- Stalled detection for open queue → BUILT

## Missing UI Systems (per spec)
- Slide-out panel → BUILT
- Bottom sheet (ticket detail) → BUILT then KILLED (wrong model)
- Right drawer (config) → BUILT
- Calendar view (ledger) → designed but not built as spec intended
- URL state for shareability → KILLED (desktop app, no web server)
- Two-layer tooltip → BUILT
- Responsive layout → BUILT (sidebar collapse, breakpoints)
- Gantt timeline for incidents → KILLED (replaced with timeline bars)

## Deviated Implementations
- Flow efficiency: wrong formula fixed
- PSI: wrong percentile + inverted reliability fixed
- Wasted work: count-based changed to hour-weighted
- Staffing verdict: 2-signal expanded to 4-signal
- KPI coloring: absolute delta changed to sigma-based
- Vault schema: missing fields (ledgerEvents, holidays, newHireRampDefaults, afterHoursConfig)
- LedgerEvent schema: field names differ from spec (startDate/endDate vs start/end)
- Status mapping type: `string` instead of `'queue' | 'active' | 'done'` union

## Features Explicitly Killed
- Gantt incident timeline → replaced with visual bars
- URL state/shareability → desktop app, no web server
- Per-ticket bottom sheet → aggregate drill-down instead
- IR Project concept → all projects are equal queues
- Analyst identity/opt-in → single user, no assignee tracking
- Seasonal STL → BUILT (simplified moving average approach)
- Mobile responsive → desktop only, sidebar collapse for narrow windows
