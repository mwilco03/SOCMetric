# Context Ledger, Coverage & Scheduling

*Sources: Design Document v1.1 Section 14 + Coverage, Scheduling & Import Design v1.0 (full document)*

---

## Manager Context Ledger (v1.1 §14)

This is a first-class chapter, not a settings screen. It is the mechanism by which the manager tells the system about things that happened to the team that Jira cannot see. Every entry modifies how metrics are interpreted and projected.

### Event Types

```
PEOPLE EVENTS
  Analyst absence (sick, leave, training, conference, termination)
  New analyst starts
  Analyst shift change
  Partial coverage (on-call only, reduced hours)

SYSTEM EVENTS
  Tool downtime (SIEM offline, Jira unavailable, integration failure)
  New detection rule deployed (suppresses that cluster's novelty signal)
  Detection rule disabled or tuned (suppresses expected intake drop)

CALENDAR EVENTS
  Holiday (by region -- affects both intake patterns and capacity)
  Incident window (auto-populated from IR project, manually addable)
  Audit or compliance period (analysts pulled from ticket work)
  Planned maintenance window
```

### Event Entry

```
Each event requires:
  Type (from above taxonomy)
  Date range (start datetime, end datetime)
  Description (free text, brief)
  Scope: All shifts | Specific shift | Specific analyst (opt-in if assignee data enabled)

Optional:
  Estimated capacity impact % (pre-filled by system based on scope)
```

### Impact Preview

As events are entered or edited, an impact preview updates in real time:

```
"This absence reduces team capacity by 20% for 5 working days.
 Based on current volume, expect approximately 34 additional
 tickets to accumulate across this window."

"This holiday reduces expected email threat intake by ~35%
 based on historical holiday patterns, while automated alert
 intake remains near baseline."
```

The impact preview makes the ledger feel consequential rather than administrative.

### Calendar View

Month grid with color-coded event bands:

```
Red band    = analyst absence
Orange band = system downtime
Blue band   = holiday
Yellow band = rule deployment
Grey band   = incident window (auto from IR project)
Purple band = audit / non-ticket period
```

### How Ledger Events Modify Metrics

**Analyst absence:**
Team capacity denominator decreases for that window. Throughput per remaining analyst recalculated. Net velocity adjusted for reduced capacity. Metrics during absence are displayed with a ledger annotation marker.

**Tool downtime:**
Intake rate during downtime flagged as suppressed (not genuine low volume). TTFT during downtime excluded from baseline calculations. Post-downtime intake spike not treated as surge.

**Rule deployment:**
That cluster's intake spike flagged as deployment artifact. Cycle times for that cluster in the first N days marked as calibration period. Projection baseline not adjusted upward from deployment spike.

**Holiday:**
Capacity line drops (analysts out). Intake pattern adjusted independently by category (email threats drop on holidays, automated alerts do not). Both adjustments applied separately because they affect different things.

---

## Design Principles (Coverage Doc §1)

**The ledger is about coverage numbers, not people.**

The capacity model has one question: on shift X on date Y, how many analysts are available? Names are irrelevant to that question and do not belong in the ledger.

**Notes do not belong in the ledger.**

The ledger is operational capacity arithmetic. It records coverage deltas, system events, and rule changes. Free-text notes are not structured data and do not live here.

**The only things that belong in a ledger row:**

```
What kind of event (type)
Which shift it affects (shift)
When it starts (start)
When it ends (end)
How it changes headcount (delta -- people events only)
```

That is the complete model. Everything else is either derivable or does not belong.

**Overlap detection is mandatory, not optional.**

The system checks coverage arithmetic on every import and every manual edit before saving. A manager must be explicitly warned before saving a configuration that leaves a shift under 50% coverage or at zero coverage. The system does not prevent saving -- it requires acknowledgment.

---

## Shift Configuration Model (Coverage Doc §2)

Shifts are the foundational unit of the coverage model. Every metric, every rollover calculation, every capacity projection is anchored to the shift configuration.

### Shift Schema

```
Shift {
  name:          string        // "Day EST", "IST", "On-Call"
  timezone:      string        // IANA tz e.g. "America/New_York", "Asia/Kolkata"
  startHour:     number        // 0-23, local time in THIS shift's timezone
  endHour:       number        // 0-23, local time in THIS shift's timezone
  workDays:      DayOfWeek[]  // ["MON","TUE","WED","THU","FRI"] -- can differ per shift
  baseHeadcount: number        // nominal full-strength analyst count for this shift
}
```

### Example Configuration

```json
{
  "shifts": [
    {
      "name": "Day EST",
      "timezone": "America/New_York",
      "startHour": 8,
      "endHour": 17,
      "workDays": ["MON","TUE","WED","THU","FRI"],
      "baseHeadcount": 4
    },
    {
      "name": "IST",
      "timezone": "Asia/Kolkata",
      "startHour": 9,
      "endHour": 18,
      "workDays": ["MON","TUE","WED","THU","FRI"],
      "baseHeadcount": 3
    },
    {
      "name": "On-Call EST",
      "timezone": "America/New_York",
      "startHour": 17,
      "endHour": 23,
      "workDays": ["MON","TUE","WED","THU","FRI","SAT","SUN"],
      "baseHeadcount": 1
    }
  ]
}
```

### Shift Overlap Handling

When shifts overlap in UTC (EST afternoon and IST morning may share a UTC window), a changelog transition is attributed to the shift whose local time window it falls within. If a transition timestamp falls within two shift windows simultaneously, it is attributed to the shift with the higher baseHeadcount (primary shift). The secondary attribution is flagged as ambiguous in per-shift rollover calculations and excluded from those calculations only -- it is still included in all aggregate metrics.

### Working Hours Accumulator Behavior

The working hours accumulator evaluates every minute against all configured shifts. A minute is counted as a working minute if it falls within at least one shift's active window on an active workday for that shift, in that shift's timezone, and is not excluded by a ledger event for that shift on that date.

Minutes excluded by ledger events (downtime, holidays, absence-driven capacity reductions) are flagged, not discarded. Both raw duration and adjusted duration are stored per ticket so that pre/post adjustment comparisons are always available.

---

## Coverage Ledger Model (Coverage Doc §3)

### Ledger Event Schema

```
LedgerEvent {
  id:     string        // generated UUID, used for edit/delete
  type:   EventType     // see below
  shift:  string        // shift name from config | "all"
  start:  date          // ISO date string YYYY-MM-DD
  end:    date | null   // null = open-ended (new hire ongoing, rule still active)
  delta:  number | null // headcount change: -1, -2, +1, +0.5 etc.
                        // null for non-people events (system, rule, holiday)
}
```

### Event Types

```
EventType:
  "absence"   -- analyst(s) unavailable, delta required (negative integer)
  "new-hire"  -- capacity added, delta required (positive, may be fractional for ramp)
  "system"    -- tool downtime or integration failure, delta null
  "rule"      -- detection rule deployed or disabled, delta null
  "holiday"   -- calendar event affecting intake patterns and/or capacity, delta null
```

### Effective Headcount Calculation

For any shift on any given date:

```
effectiveHeadcount(shift, date) =
  shift.baseHeadcount
  + sum of all delta values for events where:
      event.shift == shift.name OR event.shift == "all"
      AND event.start <= date
      AND (event.end == null OR event.end >= date)
      AND event.type IN ["absence", "new-hire"]
```

This is the only number the capacity model consumes from the ledger. All other event types (system, rule, holiday) are metadata that modify metric interpretation and projection annotations, not the headcount arithmetic.

### System and Rule Events

System and rule events do not affect headcount. They affect metric interpretation:

```
system event during window:
  Intake rate flagged as suppressed (not genuine low volume)
  TTFT during window excluded from baseline recalculation
  Post-downtime intake spike not treated as surge

rule event on date:
  Intake spike for the affected cluster flagged as deployment artifact
  Cluster cycle times in first N days marked as calibration period
  Projection baseline not adjusted upward from deployment spike
```

---

## Overlap and Coverage Validation (Coverage Doc §4)

Validation runs on every import preview and every manual save. It does not block saving -- it requires acknowledgment of warnings before proceeding.

### Validation Rules

```
Rule 1: ZERO COVERAGE (ERROR -- must acknowledge)
  effectiveHeadcount(shift, date) <= 0
  Message: "{shift} has zero coverage on {date range}."

Rule 2: BELOW 50% (WARN -- must acknowledge)
  effectiveHeadcount(shift, date) < shift.baseHeadcount * 0.5
  Message: "{shift} drops to {n} of {baseHeadcount} analysts on {date range}.
            Below 50% coverage."

Rule 3: REDUCED COVERAGE (INFO -- no acknowledgment required)
  effectiveHeadcount(shift, date) < shift.baseHeadcount
  Message: "{shift} reduced coverage on {date range}.
            Capacity model adjusted."

Rule 4: OVERLAPPING ABSENCE EVENTS (INFO)
  Two or more absence events on the same shift overlap in date range
  Does not indicate an error -- multiple people can be out simultaneously
  Message: "Multiple absence events overlap on {shift} {date range}.
            Combined reduction: -{n} analysts."
  This is the "hey, you have more than one person out" signal.

Rule 5: NEW HIRE ON DATE WITH ABSENCE (INFO)
  New hire event starts on same day/shift as an absence event
  Message: "New hire starts while {shift} is reduced on {date}.
            Net coverage on that date: {n}."
```

### Validation Display

Validation results appear inline in the import preview and in the ledger calendar view. In the calendar view, cells where coverage drops below 50% are colored distinctly from normal reduced-coverage cells.

---

## Bulk Import Format (Coverage Doc §5)

### Format

Plain CSV. No headers required but headers are accepted and ignored. Column order is fixed.

```
type, shift, start, end, delta
```

### Column Specification

**type** (required)
```
absence   -- analyst(s) unavailable
new-hire  -- capacity added
system    -- tool/integration event
rule      -- detection rule change
holiday   -- calendar event
```

**shift** (required)
```
Exact shift name from config (case insensitive) OR "all"
Partial match accepted: "day" matches "Day EST", "ist" matches "IST"
If ambiguous (partial matches multiple shifts), flag for user clarification
```

**start** (required)
```
Accepted formats:
  YYYY-MM-DD          (preferred)
  MM/DD/YYYY
  MM/DD/YY
  MM-DD-YYYY
  "Oct 21 2024"
  "Oct 21"            (year assumed current)
  "10/21"             (year assumed current)
```

**end** (optional)
```
Same formats as start.
If blank:
  absence  → same day as start (single-day event)
  new-hire → null (open-ended, ongoing)
  system   → same day as start
  rule     → null (open-ended, rule still active)
  holiday  → same day as start
```

**delta** (required for absence and new-hire, ignored for others)
```
absence:  negative integer  (-1, -2, -3)
new-hire: positive number   (+1, +0.5 for ramp)
Defaults:
  absence  → -1 if blank
  new-hire → +1 if blank
```

### Example File

```csv
type,shift,start,end,delta
absence,day,2024-10-21,2024-10-23,-1
absence,IST,2024-11-04,2024-11-08,-2
new-hire,day,2024-11-01,,,
system,all,2024-10-07,2024-10-07,
rule,day,2024-10-18,,
holiday,all,2024-10-31,,
absence,day,2024-10-21,,
```

### Input Methods

The manager has three input paths, all feeding the same parser:

**Path 1: Paste CSV text**
A textarea in the import panel. Manager copies from Excel or a text editor and pastes. Parse button triggers preview.

**Path 2: Upload .csv file**
File input. Same parser as Path 1. Useful when the import is maintained as a living spreadsheet that gets re-exported each period.

**Path 3: Single-line quick entry** (for one-off events without opening a form)
```
Format: [type] [shift] [start] [end] [delta]
Example: "absence day oct 21-23"
         "new-hire IST nov 1"
         "system all oct 7"

Parser applies same logic as CSV parser on each whitespace-delimited line.
Shown as a small input bar in the Context Ledger chapter.
Always shows inline preview of what was parsed before committing.
```

---

## Import Parser Specification (Coverage Doc §6)

### Parse Pipeline

```
1. Ingest
   Accept: raw string (paste), File object (upload), single line (quick entry)
   Normalize line endings, strip BOM if present
   Split on newlines
   Detect and skip header row if present (first row where type field is "type")

2. Per-row parse
   Split on comma (handle quoted fields if CSV escaping present)
   Trim whitespace from all fields
   Apply column mapping: index 0=type, 1=shift, 2=start, 3=end, 4=delta

3. Type normalization
   Lowercase, strip whitespace
   Accept aliases:
     "out" → "absence"
     "leave" → "absence"
     "hire" → "new-hire"
     "onboard" → "new-hire"
     "outage" → "system"
     "down" → "system"
     "deploy" → "rule"
     "tuning" → "rule"

4. Shift resolution
   Lowercase input, strip whitespace
   Exact match against configured shift names (case insensitive)
   If no exact match: partial match (input is substring of shift name)
   If multiple partial matches: flag as AMBIGUOUS, require user selection
   "all" always resolves to all configured shifts

5. Date parse
   Try formats in order: YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY,
     natural language (month name + day + optional year)
   If year absent: use current year
   If parse fails: flag row as PARSE_ERROR

6. Delta parse
   Strip leading + if present
   Parse as float
   If type is absence and delta is positive: negate automatically, flag INFO
   If type is absence/new-hire and delta is blank: apply default (-1 or +1)
   If type is system/rule/holiday and delta is present: ignore it, flag INFO

7. End date handling
   If end is blank: apply type-specific default (see Section 5)
   If end < start: flag as PARSE_ERROR

8. Overlap validation (Section 4)
   Run against existing ledger events + all parsed rows
   Collect all validation results

9. Produce ParseResult[]
   Each row: { status, event, warnings, errors }
   Status: "ok" | "warn" | "error" | "ambiguous"
```

### Error Handling

Rows with PARSE_ERROR are shown in the preview with a red indicator and a specific error message. They are excluded from the save operation. All other rows save regardless of warnings. The manager cannot save a row with an error -- they must either fix it or delete that row from the import.

---

## Import Preview UI (Coverage Doc §7)

The preview is shown after every parse operation before any data is saved. It cannot be bypassed.

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPORT PREVIEW                                                 │
│  7 rows parsed · 1 warning · 0 errors                          │
│                                                                 │
│  ✓  absence   Day EST   Oct 21-23    -1 analyst                │
│  ⚠  absence   IST       Nov 4-8      -2 analysts               │
│     └─ IST drops to 1 of 3 (below 50% coverage)               │
│  ✓  new-hire  Day EST   Nov 1+       +1 analyst                │
│  ✓  system    All       Oct 7        (metadata only)           │
│  ✓  rule      Day EST   Oct 18+      (metadata only)           │
│  ✓  holiday   All       Oct 31       (metadata only)           │
│  ✓  absence   Day EST   Oct 21       -1 analyst                │
│     └─ Overlaps with row 1 on Day EST Oct 21-23.               │
│        Combined: -2 analysts on Oct 21. Day drops to 2 of 4.  │
│                                                                 │
│  [Cancel]                          [Save 7 events]             │
└─────────────────────────────────────────────────────────────────┘
```

Individual rows can be deleted from the preview before saving. Rows cannot be edited in the preview -- if a row needs fixing, the manager cancels, fixes the source, and re-imports.

The [Save] button label shows the count of rows being saved, not a generic "Save". This makes it clear how many events are being committed.

---

## Holiday Calendar Integration (Coverage Doc §8)

### Library

`date-holidays` npm package. Client-side, zero backend, 150+ countries, regional subdivisions.

```javascript
import Holidays from 'date-holidays'

const hd = new Holidays('US')          // US federal holidays
hd.getHolidays(2024)
// [{ date: '2024-11-28', name: 'Thanksgiving Day', type: 'public' }, ...]

const hdIN = new Holidays('IN')        // India national holidays
const hdINMH = new Holidays('IN', 'MH') // Maharashtra state holidays
```

### Default Configuration

On first vault setup, two holiday sets are pre-loaded:

```
USA federal holidays (country-level, all years forward from current)
India national holidays (country-level, all years forward from current)
```

These appear in the ledger calendar automatically as blue bands. They are visually distinct from manually entered events.

### Manager Controls

In the ledger configuration panel:

```
ACTIVE HOLIDAY CALENDARS

  [☑] United States (federal)
      Optional regions: [+ Add state]
      Active states: none

  [☑] India (national)
      Optional regions: [+ Add state]
      Active states: none

  [+ Add country]

  SUPPRESSIONS
  Holidays the team does not observe:
  [ ] Columbus Day (US, Oct 14)   [Suppress]
  [ ] Washington's Birthday (US, Feb 17)  [Suppress]
```

Suppressed holidays are still shown in the calendar (greyed out) so the manager can see what was suppressed, but they do not affect capacity or intake pattern calculations.

### Holiday Effect on Metrics

Holidays affect two things independently:

```
Capacity effect:
  Applies if the holiday falls on a workday for a configured shift
  Reduces effective headcount by the shift's full baseHeadcount for that day
  (unless the manager logs an explicit override -- e.g. on-call shift still works)

Intake pattern effect:
  Applied per cluster category (not uniformly)
  Business-hours alert types (email threats, phishing) drop on holidays
  Automated detection rules (GuardDuty, DLP) do not drop on holidays
  The split is learned from historical data:
    For each cluster: compare avg intake on holiday dates vs adjacent non-holiday dates
    Derived holiday intake factor = holiday_avg / normal_avg
    Stored per cluster, used in projection seasonal adjustment
```

---

## After-Hours and Weekend Work Detection (Coverage Doc §9)

Fully inferrable from Jira changelog timestamps. No extra input from the manager. Opt-in toggle (requires assignee data to be enabled for per-identifier breakdown).

### Detection Logic

For each changelog transition on each ticket:

```
transition_time = transition.created (UTC, converted to relevant shift timezone)

AFTER-HOURS:
  Is transition_time outside ALL configured shift windows for that day?
  If yes → after_hours = true

WEEKEND WORK:
  Is the day-of-week not in ANY shift's workDays?
  If yes → weekend = true
  Exception: On-Call shift covers weekends → weekend transitions during
             On-Call window are NOT flagged as unexpected weekend work

SHIFT OVERRUN:
  Is transition_time within 0-90 minutes AFTER a shift end boundary?
  (Configurable window, default 90 minutes)
  If yes → shift_overrun = true
  This is "not getting done during the day" -- analyst extended their shift

IR-CORRELATED:
  Is there an open IR project ticket at transition_time?
  If yes for after-hours or weekend flag → ir_correlated = true
  IR-correlated after-hours is expected and does not feed the burnout signal
```

### Team-Level Metrics (no individual attribution required)

```
After-hours pressure score:
  after_hours_transitions (non-IR-correlated) / total_transitions
  Trend: rising without IR correlation → analysts extending shifts to clear backlog

Weekend activity rate:
  weekend_transitions (non-on-call, non-IR-correlated) / total_transitions
  Rising without IR correlation → structural understaffing signal

Shift overrun rate:
  days_with_overrun_activity / total_shift_days
  Rising → consistent pattern of work not completing within shift
```

### Surfaces In UI

**Chapter 4 Capacity -- After-Hours Panel (Team Lead and Director):**

```
┌── AFTER-HOURS ACTIVITY ──────────────────────────────────────────┐
│  Last 14 days                                                    │
│                                                                  │
│  After-hours transitions:   47  ↗🟡                             │
│  IR-correlated:             31  (66% explained)                 │
│  Unexplained:               16  ↗🔴                             │
│                                                                  │
│  "16 after-hours transitions in the last 14 days are not        │
│   associated with active incidents. Analysts may be             │
│   extending shifts to manage queue load."                       │
│                                                                  │
│  Shift overrun events: 8 days where last recorded activity      │
│  was more than 45 minutes past shift end.                       │
└──────────────────────────────────────────────────────────────────┘
```

**Chapter 1 Watch Status -- Director view one-liner:**

```
"Analysts are showing after-hours activity not explained by
 incident response. This is a leading burnout risk indicator."
```

**Chapter 7 Projections -- annotated on timeline:**
Periods of sustained after-hours activity are marked as an annotation on the projection chart. Rising after-hours work is a leading indicator that the capacity model should account for -- the team is currently extending shifts to compensate for a coverage gap that the headcount numbers alone do not reveal.

---

## Analyst Identity Model (Coverage Doc §10)

### Core Principle

Analyst names do not live in the ledger, the vault, or any persistent store. The coverage model operates on headcount numbers only.

### Discovery From Jira (Session-Only, Opt-In)

When assignee data is enabled:

```
On data load:
  Aggregate all unique assignee account IDs across selected projects
  Filter to identifiers who closed at least 1 ticket in the selected period
  → "active analyst set" for this session

These identifiers are:
  Used for load distribution calculations (tickets per identifier)
  Used for after-hours detection (transitions per identifier)
  Used for shift overrun detection
  Never stored in the vault
  Regenerated fresh on every load
  Displayed anonymized by default ("Analyst A", "Analyst B") in UI
  Manager can enable name display per session (not persisted)
```

### The New Hire Gap

A new hire has no Jira activity yet. The ledger event fills the gap:

```
new-hire event: shift=day, start=2024-11-01, delta=+1

Before Nov 1:
  Jira shows no tickets from this identifier (correct)
  Capacity model uses baseHeadcount only

After Nov 1:
  Capacity model uses baseHeadcount + 1
  Jira data will begin showing a new assignee identifier
  The model trusts the ledger event, does not wait for Jira to confirm

As the new hire produces tickets:
  Their identifier appears in the active analyst set on next load
  Load distribution chart now shows their ticket volume
  This is the natural onboarding signal -- no explicit "link new hire to identifier" step needed
```

### Departure Gap

Symmetric with new hire:

```
When an analyst leaves:
  Manager logs: absence, shift, start=departure_date, end=null, delta=-1
  Capacity model drops headcount from departure date forward
  Jira will stop showing that identifier closing tickets
  The model trusts the ledger event for the capacity calculation
```

---

## New Hire Ramp Model (Coverage Doc §11)

New hires rarely operate at full capacity immediately. The ramp model is optional but supported.

### Fractional Delta

```
Ramp using multiple ledger events:

  new-hire, day, 2024-11-01, 2024-11-30, +0.25   (first month: 25% capacity)
  new-hire, day, 2024-12-01, 2024-12-31, +0.50   (second month: 50% capacity)
  new-hire, day, 2025-01-01, ,           +0.75   (ongoing from month 3: 75% capacity)

Or using a single event with auto-ramp:
  new-hire, day, 2024-11-01, , +1, ramp=90d
  System generates the ramp curve internally:
    days 1-30:   +0.25 effective capacity
    days 31-60:  +0.50 effective capacity
    days 61-90:  +0.75 effective capacity
    day 91+:     +1.0  full capacity

ramp= parameter is optional. If absent: immediate full capacity.
Default ramp profile is configurable in vault.
```

### Projection Impact

The ramp model matters most for projections. Adding a headcount of +1 on Nov 1 with a 90-day ramp does not add full capacity for Q4 surge planning. The projection model uses the ramp curve when calculating the capacity line, not the nominal +1.
