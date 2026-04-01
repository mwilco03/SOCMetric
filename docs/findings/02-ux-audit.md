# UX Audit Findings

## Setup Wizard
- Passphrase complexity unclear — no strength meter, "Cannot be recovered" creates anxiety
- Domain format confusion — users paste https:// from browser, gets rejected
- Project selection narrow — no Select All, no fuzzy search, max-h-48 too small for 100+ projects
- Vault creation silently succeeds — no confirmation, immediately asks for passphrase again
- No loading spinner during "Connecting..." — user clicks multiple times

## Dashboard — Daily Use
### KPI Cards
- "+0.0%" meaningless — no context for what's being compared
- Delta direction unintuitive — "+12.3%" on Queue Depth means BAD but looks positive
- "TTFT" undefined — acronym never spelled out, same for PSI, P85, P50
- Color system inverted per KPI — green/red mean different things for different cards
- "Compared to what?" — tooltip doesn't explain comparison is first-half vs second-half of range
- Two-layer tooltip only on some KPIs, not all

### Charts
- Headlines are data-heavy but lack insight — "Avg intake 8.4/day" doesn't answer "is this bad?"
- No visual warning when intake > close rate
- Stalled tickets alert shows badges, not actionable links
- No way to jump from stalled ticket to Jira or see context

### Status Mapping
- Hidden after initial setup — no UI to view or change status classifications
- If Queue Depth seems wrong, user can't troubleshoot
- Working hours configuration invisible — "4.2h" means working hours but user doesn't know their configured hours

### View Mode
- No explanation of what each mode shows differently
- Some chapters hidden per mode with no indication they exist
- "Director" label confusing — is it Executive or literal director?
- User might be both analyst AND lead — unclear which to choose

### Navigation
- Chapter names are jargon — "Watch Status", "Flow", "Capacity" unexplained
- No breadcrumbs — at Capacity page with no indication how I got here
- Sidebar collapses to icons that don't clearly represent their chapters
- No hover tooltips on collapsed sidebar icons (or they flash too fast)

### Data Loading
- No loading progress — spinner says "Loading..." with no ticket count or ETA
- Can't distinguish "loading" from "broken" after 10+ seconds
- No "last refreshed" context — "3m ago" means metrics computed 3m ago, not data freshness
- No manual refresh button
- React Query 5-min staleTime is invisible to user

### Empty States
- "No data. Select projects and date range." — same message for 4 different problems
- No CTA — user doesn't know if they should refresh, change settings, or wait
- Empty state height collapses layout (80px placeholder vs 280px chart)

## Settings
- "Settings" drawer doesn't contain all settings — status mappings, TTFT anchors, API token all missing
- Adding a project has no feedback, no auto-sync trigger
- Shift configuration has no validation (startHour > endHour allowed)
- No way to see total headcount across shifts
- Export button non-functional (data={[]} hardcoded)
- Vault reset has no undo, no backup option

## Z-Index Conflicts
- SlideOutPanel, BottomSheet, RightDrawer, DimensionFilterBar dropdown, Modal, Toast all compete at z-40/z-50
- No mutual exclusivity — all can open simultaneously
- No dismiss hierarchy — Escape closes "something" but which one?
- Toast behind panels (same z-level)

## Accessibility
- 15+ missing aria-labels on close buttons, interactive elements
- No role="dialog" on panels
- No focus trap in any modal/panel
- No keyboard navigation in dropdowns (no arrow key support)
- No skip-to-content link
- TicketTable rows clickable but no semantic button

## Design Spec vs Reality
- 47 gaps found between design docs (11 documents) and implementation
- 27 features completely missing, 19 partially implemented, 1 deviated
- Implementation approximately 30% complete relative to design specification
- Major missing systems: slide-out panels (built later), dimension filtering (built later), projection engine (built later)
