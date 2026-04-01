# User Walkthrough Findings

## SOC Analyst Perspective

### First Launch
- Enter domain/email/token — works after domain normalization fix
- Project list loads — needs search filter for large orgs
- Select projects, set passphrase — passphrase step unnecessary (removed in v2 via keychain)
- Land on dashboard — no indication if data is loading or empty

### Daily Use
- Watch Status: KPI cards show but "+0.0%" badges are confusing
- "Your Queue" section was a stub ("would appear here") — replaced with real open-by-priority breakdown
- Stalled tickets alert is useful but ticket keys aren't actionable
- Individual ticket drill-down (BottomSheet) was wrong model — analysts care about aggregates, not single tickets
- Per-ticket bottom sheet killed, replaced with cluster drill-down

### What Analysts Actually Need
- Open tickets by priority (which ones need attention NOW)
- Stalled ticket list (what's stuck)
- Top clusters (what pattern keeps hitting us)
- Response time by priority (am I meeting targets)
- NOT: individual ticket changelog, Jira links, single-ticket decomposition

## SOC Manager Perspective

### Monday Morning Workflow
1. Open app → see calendar → see which days were heavy last week
2. Notice Thursday is red/dark → click → see 100+ C2 tickets clustered
3. That's a rule deployment → want to annotate "known noise" → no annotation feature existed
4. Check KPIs → Queue Depth ↑8% → want to know WHY (intake up? closures down?) → KPI doesn't decompose
5. Check Capacity → verdict "Healthy" → stalled list shows 3 tickets → SOC-2841 stuck 72h in "Awaiting Info"
6. "Awaiting Info" classified as queue but it's external block → need fourth status class "blocked"
7. Go to Projections → 90-day view → scenario "+1 analyst" → shows queue impact but NOT downstream effects (TTFT, stalled count, after-hours)
8. Want to send status update → Export button does nothing → need Copy Summary

### Friction Points + Solutions
1. **Can't annotate days** → right-click → tag as rule deployment/campaign/noise → feeds baseline
2. **KPI delta doesn't explain WHY** → tooltip decomposes into intake vs close rate drivers
3. **"Awaiting Info" shows as stalled** → fourth status class: blocked/external
4. **Projection only shows queue depth** → scenario summary includes TTFT, stalled, after-hours projections
5. **Can't export status** → Copy Summary button: markdown for Slack/email

### What Managers Actually Need
- Calendar view of daily activity by label (overview)
- Click-to-drill into cluster breakdown (why was Thursday bad?)
- Staffing verdict with evidence (not just "healthy" but why)
- Projection scenarios with full impact (not just queue depth)
- One-click status summary for Slack/email
- Shift/headcount management that actually works

## Key Design Insights

### Aggregate, Not Individual
- Single tickets are meaningless in an analytics dashboard
- The value is patterns, trends, clusters, projections
- Drill-down should go: calendar → day → clusters, not calendar → day → ticket → changelog
- Stalled tickets are the exception — those are actionable individual items

### The IR Project Concept Was Wrong
- Design assumed separate Jira project for incidents
- Real SOC teams work multiple queues that are all the same type of work
- "IR Project" dropdown confused every user
- Replaced with: all selected projects are equal queues. No primary/secondary/IR distinction.
- Incidents chapter hidden until reworked to detect by issue type/priority, not project key

### "Response Time" Not "TTFT"
- TTFT is internal jargon that means nothing to leadership
- Response Time is universally understood
- Tooltip can mention "Time to First Touch" once for power users

### Settings Must Cascade
- Adding a project should: save selection → fetch statuses → auto-classify → trigger data pull
- Current: adding a project is a dead toggle (saves key, does nothing else)
- Settings must be reactive, not passive
