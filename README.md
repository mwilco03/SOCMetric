# SOCMetric on Tines

SOC productivity dashboard, rebuilt inside a Tines tenant. No Node, no npm, no React build. Everything ships as importable Tines JSON: stories, pages, and resource seeds.

## Contents

```
tines-webapp/
├── README.md                       (this file)
├── ARCHITECTURE.md                 overall design, data flow, formula patterns
├── DEPLOYMENT.md                   operator runbook: import order, credential setup, first sync
├── docs/
│   ├── metric-mapping.md           TS metric module -> Tines story + formulas, line-for-line
│   ├── page-layouts.md             component-by-component Page spec
│   ├── resource-schemas.md         field definitions and size budgets
│   └── limitations.md              STL deferral, resource caps, rate limits, open questions
├── resources/                      seed JSON for each Tines Resource (7 Resources)
├── stories/                        3 story exports (soc-data, soc-compute, soc-reset), schema 28
└── pages/                          10 Page exports (the dashboard UI)
```

## Quick start for operators

See `DEPLOYMENT.md`. In short:

1. Create the `jira_basic_auth` and `tines_api_token` Credentials in your Tines tenant.
2. Import the seven resource seed JSONs from `resources/`.
3. Import the three story JSONs from `stories/` (`soc-data`, `soc-compute`, `soc-reset`) in that order.
4. Import every Page JSON from `pages/`.
5. Attach a cron schedule to the "Scheduled start" action inside `soc-data`.
6. Open the Setup Page, discover projects, pick one, classify statuses, run first sync.
7. Open the Dashboard Home Page.

## What this replaces

The Tauri desktop app under `../soc-dashboard/`. That tree is read-only reference for this build: metric logic was ported from its TypeScript modules, and the flat `TicketRow` shape the sync story emits matches what the Rust backend produced so the mapping from "chart X shows field Y" is one-to-one.

## Design constraints, user-enforced

- Tines only. Nothing else runs anywhere.
- Purely additive. Nothing outside this directory is modified.
- No em dashes anywhere (global style rule).

## Status

Scaffolding and documentation in place. Story and Page JSON exports are populated as authoring proceeds; see task state and the Progress section in `ARCHITECTURE.md` for what is live vs pending.
