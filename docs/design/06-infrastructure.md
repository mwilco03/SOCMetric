# Infrastructure & Architecture

*Sources: Design Document v1.1 Sections 16-17 + Coverage Doc Sections 12-13*

---

## 16. Encrypted Storage Design

All configuration and derived data is stored client-side. The dashboard has no backend, no database, no server-side state. This produces two constraints: data must survive page refresh, and credentials must not leak to localStorage in plaintext.

### Security Model

```
Storage location:       browser localStorage
Encryption:             AES-256-GCM via Web Crypto API
Key derivation:         PBKDF2 from user-chosen passphrase
Salt:                   random, generated once, stored alongside vault
IV:                     random per encryption operation
Authentication:         GCM provides authenticated encryption

Data at rest in localStorage is ciphertext. Even if a browser profile is
exfiltrated, credentials are not recoverable without the passphrase.
```

### Key Derivation

```
On first use:
  User enters Jira base URL, email, API token
  User chooses a vault passphrase (min 8 characters, no rules beyond length)
  PBKDF2(passphrase, random_salt, 100_000 iterations) → AES-256 key
  All configuration encrypted with this key
  Salt stored in localStorage unencrypted (standard practice for PBKDF2 salts)

On return:
  User enters vault passphrase
  PBKDF2(passphrase, stored_salt) → key
  Attempt decrypt → if garbage, wrong passphrase
```

### Encryption Operation

```
encrypt(plaintext_json, key):
  iv = crypto.getRandomValues(12 bytes)
  ciphertext = AES-256-GCM(plaintext_json, key, iv)
  return { iv: base64(iv), data: base64(ciphertext) }

decrypt(encrypted_object, key):
  iv = base64decode(encrypted_object.iv)
  plaintext = AES-256-GCM-decrypt(encrypted_object.data, key, iv)
  return JSON.parse(plaintext)
```

### Vault Payload Schema

```json
{
  "version": 3,
  "salt": "base64...",
  "payload": {
    "iv": "base64...",
    "data": "base64..."
  }
}
```

Decrypted payload structure:

```json
{
  "credentials": {
    "baseUrl": "https://tenant.atlassian.net",
    "email": "REPLACE_ME",
    "apiToken": "REPLACE_ME"
  },
  "projects": {
    "selectedKeys": ["SOC", "IR"],
    "irProjectKey": "IR"
  },
  "statusMappings": {
    "SOC": {
      "To Do": "queue",
      "In Progress": "active",
      "Awaiting Info": "queue",
      "Done": "done"
    }
  },
  "ttftAnchors": {
    "SOC": { "method": "status_transition", "targetStatus": "In Progress" },
    "IR": { "method": "any_non_initial" }
  },
  "workSchedule": {
    "timezone": "America/New_York",
    "workDays": ["MON","TUE","WED","THU","FRI"],
    "shifts": [
      { "name": "Day", "startHour": 8, "endHour": 17 }
    ]
  },
  "ledgerEvents": [
    {
      "id": "uuid",
      "type": "absence",
      "shift": "Day",
      "start": "2024-10-21",
      "end": "2024-10-23",
      "delta": -1
    }
  ],
  "thresholds": {
    "instantCloseMinutes": 5,
    "rapidRecurrenceHours": 24,
    "slowRecurrenceDays": 14,
    "similarityThreshold": 0.6,
    "surgeMultiplier": 2.0,
    "stalledMultiplier": 1.5,
    "closureBurstCount": 5,
    "closureBurstWindowMinutes": 30
  },
  "titleOverrides": {
    "pattern_to_cluster_name": {}
  },
  "preferences": {
    "defaultView": "lead",
    "defaultChapter": 2,
    "assigneeOptIn": false
  },
  "holidays": {
    "calendars": [
      { "country": "US", "regions": [], "suppressions": ["Columbus Day"] },
      { "country": "IN", "regions": [], "suppressions": [] }
    ]
  },
  "newHireRampDefaults": {
    "rampDays": 90,
    "rampStages": [
      { "dayStart": 0, "dayEnd": 30, "factor": 0.25 },
      { "dayStart": 31, "dayEnd": 60, "factor": 0.50 },
      { "dayStart": 61, "dayEnd": 90, "factor": 0.75 }
    ]
  }
}
```

### Session Behavior

```
On page load:
  Check localStorage for vault
  If absent → onboarding flow
  If present → passphrase prompt

On successful decrypt:
  Vault contents loaded into memory
  API calls made with decrypted credentials
  No credentials touch any network endpoint except Jira's own API

On vault write:
  Re-encrypt entire payload with current key
  Atomic write to localStorage (write then swap key)

On explicit logout / clear:
  Remove vault from localStorage
  Clear in-memory state
```

---

## 17. Application Architecture

### Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18+ | SPA, client-side rendering only |
| Language | TypeScript | Strict mode, no `any` types |
| Build | Vite | Fast dev builds, optimized production builds |
| Styling | Tailwind CSS + component library | Utility-first with standardized components |
| Charts | Recharts or Victory | Composable, React-native charting |
| Encryption | Web Crypto API | Native browser, no library dependency |
| Date handling | date-fns + date-fns-tz | Working hours calculations, timezone support |
| State | Zustand or React Context | Minimal state management |
| Testing | Vitest + Testing Library | Unit and integration |
| Deployment | Static files (S3 / Pages / local) | No backend required |

### Module Structure

```
src/
├── api/
│   ├── jiraClient.ts         // HTTP layer, pagination, rate limiting
│   └── types.ts              // Jira API response types
├── discovery/
│   ├── projectDiscovery.ts   // Project enumeration
│   ├── statusDiscovery.ts    // Status classification engine
│   ├── labelDiscovery.ts     // Label aggregation
│   └── ttftAnchor.ts         // TTFT anchor configuration
├── normalization/
│   ├── entityNormalizer.ts   // Entity pattern detection and replacement
│   ├── siemPatterns.ts       // SIEM structural pattern library
│   └── clusterEngine.ts     // Title clustering with confidence scoring
├── dimensions/
│   ├── dimensionEngine.ts    // Cross-dimension filtering
│   ├── labelDimension.ts     // Tier 1: labels
│   ├── structuralDimension.ts // Tier 2: issue type, priority
│   ├── derivedDimension.ts   // Tier 3: alert rule, source system, asset class
│   └── temporalDimension.ts  // Tier 4: time-of-day, day-of-week
├── metrics/
│   ├── workingHours.ts       // Working hours accumulator
│   ├── closureIntegrity.ts   // Closure classification pipeline
│   ├── headlineMetrics.ts    // Tier 1: net velocity, TTFT, queue depth
│   ├── flowMetrics.ts        // Tier 2: lead time, cycle time, flow efficiency
│   ├── capacityMetrics.ts    // Tier 3: rollover, aging, stalled, surge
│   ├── incidentMetrics.ts    // Tier 4: IR-specific metrics
│   ├── recurrenceEngine.ts   // Rapid and slow recurrence
│   └── prioritySeparation.ts // Priority Separation Index
├── staffing/
│   ├── staffingModel.ts      // Four signals → verdict matrix
│   └── projectionEngine.ts   // Seasonal decomposition + capacity projection
├── patterns/
│   ├── clusterRanking.ts     // Volume-weighted capacity ranking
│   ├── automationTiers.ts    // Advisory / Required / Critical classification
│   ├── wastedWork.ts         // Wasted work ratio
│   └── trendDetection.ts     // Category saturation and trending
├── vault/
│   ├── encryption.ts         // AES-256-GCM encrypt/decrypt
│   ├── keyDerivation.ts      // PBKDF2 key derivation
│   └── vaultManager.ts       // Load, save, migrate vault versions
├── ledger/
│   ├── ledgerModel.ts        // Event CRUD, effective headcount calculation
│   ├── importParser.ts       // CSV parse pipeline
│   ├── validation.ts         // Overlap and coverage validation
│   └── impactPreview.ts      // Real-time capacity impact calculation
├── narrative/
│   ├── insightEngine.ts      // Template-based narrative generation
│   └── verdictFormatter.ts   // Staffing verdict prose output
├── components/
│   ├── shell/                // App shell, navigation, view mode toggle
│   ├── kpi/                  // KPI card, direction indicators
│   ├── charts/               // Chart wrappers with headline generation
│   ├── chapters/             // Chapter-specific layouts (0-8)
│   ├── ledger/               // Ledger UI, calendar, import preview
│   ├── discovery/            // Setup wizard, status classification UI
│   └── shared/               // Tooltips, filters, loading states
└── utils/
    ├── dateUtils.ts          // Working hours, shift boundary evaluation
    ├── statistics.ts         // Percentile, sigma, STL decomposition
    └── formatting.ts         // Number, duration, percentage formatters
```

---

## Search and Matching Technology Decisions (Coverage Doc §12)

This section records the technology decisions for functionality that requires fuzzy matching, approximate search, or text similarity within the client-side application.

### Use Case: Shift Name Matching in Import Parser

**What we evaluated:** Levenshtein distance libraries, Fuse.js, custom regex matchers, simple substring matching.

**Decision:** Substring matching with case-insensitive normalization.

**Why:** Shift names are a small, closed set (2-5 entries). The import parser needs to match user input like "day" to "Day EST". Substring matching is deterministic, zero-dependency, and handles every realistic input. Fuzzy matching libraries are overhead for a list this small and introduce unpredictable match scores that would require a threshold -- adding a tuning parameter for no benefit.

```typescript
function resolveShift(input: string, shifts: Shift[]): Shift | Shift[] | null {
  const normalized = input.trim().toLowerCase()
  if (normalized === 'all') return shifts
  const exact = shifts.find(s => s.name.toLowerCase() === normalized)
  if (exact) return exact
  const partial = shifts.filter(s => s.name.toLowerCase().includes(normalized))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) return partial  // ambiguous -- flag for user
  return null  // no match
}
```

### Use Case: SIEM Title Clustering (Existing, Section 7)

**Decision from v1.1:** Jaccard coefficient on token sets after entity normalization.

**Why this is not an NLP problem:** SIEM titles are structured strings, not natural language. Entity normalization strips the high-variance components (IPs, hostnames, users). What remains is the rule name -- often identical across instances. Token-set similarity on normalized titles catches minor template variations without requiring embedding models, vector stores, or any machine learning infrastructure.

**What was explicitly rejected:**
- Word embeddings / sentence transformers: requires model download, WASM runtime, or API call. Violates client-side-only constraint.
- TF-IDF: requires corpus statistics across all titles. Viable but adds complexity for marginal improvement over Jaccard on already-normalized titles.
- Edit distance (Levenshtein): character-level similarity is wrong for structured titles where tokens reorder across SIEM versions.

### Use Case: Holiday Name Matching

**Decision:** Exact string match on `date-holidays` output names.

**Why:** Holiday names come from a library with stable, known outputs. There is no user-typed input to fuzzy-match against holiday names. The suppression list stores exact holiday names from the library's own output. No fuzzy matching needed.

### Use Case: Cluster Label Override Lookup

**Decision:** Exact match on normalized title string, stored as a key-value map in the vault.

**Why:** The user manually assigns a label to a specific normalized title pattern. The normalized title is deterministic (same normalization pipeline produces the same output for the same input). Exact match on the normalized form is sufficient and predictable. Fuzzy matching would produce unexpected label assignments.

---

## Vault Schema Additions (Coverage Doc §13)

The following fields extend the vault schema defined in v1.1 Section 16.

### New Fields in Vault Payload

```json
{
  "workSchedule": {
    "shifts": [
      {
        "name": "Day EST",
        "timezone": "America/New_York",
        "startHour": 8,
        "endHour": 17,
        "workDays": ["MON","TUE","WED","THU","FRI"],
        "baseHeadcount": 4
      }
    ]
  },
  "holidays": {
    "calendars": [
      {
        "country": "US",
        "regions": [],
        "suppressions": ["Columbus Day", "Washington's Birthday"]
      },
      {
        "country": "IN",
        "regions": [],
        "suppressions": []
      }
    ]
  },
  "newHireRampDefaults": {
    "rampDays": 90,
    "rampStages": [
      { "dayStart": 0, "dayEnd": 30, "factor": 0.25 },
      { "dayStart": 31, "dayEnd": 60, "factor": 0.50 },
      { "dayStart": 61, "dayEnd": 90, "factor": 0.75 }
    ]
  },
  "afterHoursConfig": {
    "shiftOverrunWindowMinutes": 90,
    "assigneeOptIn": false
  }
}
```

### Schema Version Bump

The vault schema version bumps from 2 to 3. Migration logic:

```
Version 1 → 2 (v1.0 → v1.1):
  Added: thresholds, titleOverrides, preferences
  Backfill: defaults from v1.1 Section 16

Version 2 → 3 (v1.1 + Coverage):
  Added: shifts[].timezone, shifts[].baseHeadcount, holidays, newHireRampDefaults, afterHoursConfig
  Migration:
    shifts[].timezone = vault.workSchedule.timezone (copy global to per-shift)
    shifts[].baseHeadcount = 1 (conservative default, manager must confirm)
    holidays = { calendars: [{ country: "US", regions: [], suppressions: [] }] }
    newHireRampDefaults = { rampDays: 90, rampStages: [default 3-stage] }
    afterHoursConfig = { shiftOverrunWindowMinutes: 90, assigneeOptIn: false }
```
