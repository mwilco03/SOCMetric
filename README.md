# SOC Productivity Dashboard v1.1

A comprehensive single-page application for Security Operations Center (SOC) productivity metrics and analysis using Jira Cloud data.

## Features

### Core Metrics
- **Working Hours Calculation** - All metrics computed in working hours (not wall-clock), with multi-shift support
- **Closure Integrity** - Classifies closures as valid, instant, untouched, stalled, or churned
- **TTFT Analysis** - Time-to-First-Touch with P85/P50 percentiles
- **Lead Time Decomposition** - Queue wait, active work, post-active wait
- **Net Velocity** - Intake vs close rate differential
- **Priority Separation Index** - Validates priority field enforcement

### Advanced Analytics
- **SIEM Title Normalization** - Entity extraction (IPs, emails, hashes) and pattern detection
- **Recurrence Engine** - Rapid (24h) and slow (14d) recurrence detection using Jaccard similarity
- **Staffing Assessment** - Four-signal model with verdict generation
- **Projection Framework** - Seasonal decomposition, capacity gap forecasting
- **Pattern Intelligence** - Volume-weighted cluster ranking with automation tiers

### UI/UX
- **Three View Modes** - Analyst, Lead, Director with density-appropriate layouts
- **9 Chapters** - Watch Status, Flow, Response Speed, Capacity, Patterns, Incidents, Projections, Compare, Context Ledger
- **Universal KPI Cards** - Number + direction arrow + color + insight sentence
- **Two-Layer Tooltips** - Quick context + extended formula detail
- **Responsive Charts** - Line, Bar, Area, Scatter, Heatmap via Recharts

### Security & Data
- **Client-Side Encryption** - AES-256-GCM with PBKDF2 key derivation (Web Crypto API)
- **Encrypted Vault** - Credentials and config stored in localStorage as ciphertext
- **No Backend Required** - Direct Jira Cloud API calls from browser

## Project Structure

```
soc-dashboard/
├── src/
│   ├── api/              # Jira API client and types
│   ├── components/       # React components
│   │   ├── shell/        # AppShell, navigation
│   │   ├── kpi/          # KPI cards
│   │   ├── chapters/     # 9 chapter views
│   │   ├── charts/       # Recharts wrappers
│   │   ├── discovery-ui/ # Setup wizard, status classifier
│   │   └── shared/       # Error boundary, loading states, etc.
│   ├── hooks/            # React Query hooks
│   ├── metrics/          # Calculation engines
│   ├── normalization/    # SIEM title processing
│   ├── patterns/         # Recurrence detection
│   ├── store/            # Zustand store
│   ├── utils/            # Statistics, formatting, dates
│   └── vault/            # Encryption layer
├── tests/                # Vitest tests
└── docs/                 # Design documentation
```

## Tech Stack

- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** Vite
- **Styling:** Tailwind CSS
- **State:** Zustand + React Query
- **Charts:** Recharts
- **Encryption:** Web Crypto API (AES-256-GCM)
- **Testing:** Vitest + Testing Library
- **Icons:** Lucide React

## Installation

```bash
cd soc-dashboard
npm install
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest tests |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |

## Configuration

1. Launch the app - setup wizard will guide you
2. Enter Jira Cloud credentials:
   - Domain (e.g., `your-domain.atlassian.net`)
   - Email
   - API Token (from id.atlassian.com)
3. Create vault passphrase (min 8 chars, used for encryption)
4. Select projects to analyze
5. Classify statuses (Queue / Active / Done)
6. Configure work schedule (shifts, timezone)

## Design Documentation

Full specification available in `/mnt/project/docs/design/`:

| Document | Contents |
|----------|----------|
| `01-domain-context.md` | Problem statement, constraints, working hours |
| `02-data-layer.md` | Jira API, discovery pipeline, SIEM normalization |
| `03-metrics-formulas.md` | All metric definitions, closure integrity, recurrence |
| `04-staffing-projections.md` | Staffing model, seasonal decomposition |
| `05-context-ledger.md` | Manager ledger, coverage scheduling |
| `06-infrastructure.md` | Encryption, architecture, module tree |
| `07-ui-standards.md` | View modes, KPI cards, tooltips |
| `08-chapter-layout.md` | All chapter wireframes |
| `09-workflows.md` | Personas, user workflows |
| `10-components.md` | Component library spec |
| `11-open-decisions.md` | Configuration decisions, metric reference |

## Key Architectural Decisions

### Client-Side Only
- No backend server required
- Direct Jira API calls from browser (CORS supported)
- All data encrypted at rest in localStorage

### Working Hours vs Wall-Clock
- All duration metrics use working hours only
- Configurable shifts and holidays
- Rollover detection per shift boundary

### No SLA Language
- Operational tempo model (deviation from baseline)
- Color coding: green (within 1σ), yellow (1-2σ), red (>2σ)
- Acknowledgment targets (team-set, not external SLAs)

### SIEM Title Normalization
- Entity patterns replaced with tokens (`<IP>`, `<EMAIL>`, etc.)
- Jaccard similarity for clustering (not NLP/ML)
- Confidence scoring (high/medium/low)

## Testing

```bash
npm run test
```

Tests cover:
- Working hours calculations
- Statistical functions (mean, median, percentile)
- Closure integrity classification
- Recurrence detection

## File Count

- 55 TypeScript source files
- 1 test file (expandable)
- 11 documentation files

## License

Internal use only - proprietary SOC tooling.

## Version

v1.1.0 - Fully Implemented per Design Specification

