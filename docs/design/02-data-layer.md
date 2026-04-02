# Data Layer

*Extracted from Design Document v1.1, Sections 5-8*

---

## 5. Data Layer -- Jira API

### Authentication

```
Method: HTTP Basic Auth
Header: Authorization: Basic base64(email:api_token)
Base URL: https://{tenant}.atlassian.net
```

All API calls are made directly from the browser. Jira Cloud supports cross-origin requests with valid credentials. No backend proxy is required.

### Required Endpoints

| Purpose | Endpoint | Notes |
|---|---|---|
| List accessible projects | `GET /rest/api/3/project/search` | Paginated |
| Get project statuses | `GET /rest/api/3/project/{key}/statuses` | Per issue type |
| Search issues | `GET /rest/api/3/search` | JQL with `expand=changelog` |
| Get issue changelog | `GET /rest/api/3/issue/{key}/changelog` | Full transition history |
| Get project components | `GET /rest/api/3/project/{key}/components` | Optional dimension |

### Data Collected Per Ticket

```
Issue {
  key: string
  summary: string               // raw title -- normalized in pipeline
  created: ISO8601
  resolutiondate: ISO8601 | null
  status: { name: string }
  issuetype: { name: string }
  priority: { name: string }
  assignee: { displayName: string } | null
  labels: string[]
  components: [{ name: string }]
  changelog: {
    histories: [
      {
        created: ISO8601
        items: [
          {
            field: string       // look for "status", "assignee", "comment"
            fromString: string
            toString: string
          }
        ]
      }
    ]
  }
}
```

### JQL Strategy

```
// All tickets in scope
project IN ({projectKeys})
  AND created >= "{dateRangeStart}"
  AND created <= "{dateRangeEnd}"
  ORDER BY created ASC

// Active (open) tickets for queue depth
project IN ({projectKeys})
  AND statusCategory != Done
  ORDER BY created ASC
```

Pagination: 100 issues per request. Fetch until `total` is exhausted.

---

## 6. Dynamic Discovery Pipeline

Nothing about the Jira environment is assumed. Discovery runs on every project selection change.

### Project Discovery

```
On credentials entry:
  GET /rest/api/3/project/search (paginated)
  Filter to projects the API key has browse access to
  Present as multi-select tree in left drawer
  IR project is user-tagged ("this is the incident project")
  Tag stored in vault
```

### Status Discovery and Classification

```
For each selected project:
  GET /rest/api/3/project/{key}/statuses
  Deduplicate status names case-insensitively across all projects and types
  Produce unique status manifest for session

Classification UI:
  [ "In Progress"    ]  →  [ Queue  |  ● Active  |  Done ]
  [ "Backlog"        ]  →  [ ● Queue |  Active   |  Done ]
  [ "Awaiting Info"  ]  →  [ ● Queue |  Active   |  Done ]
  [ "Resolved"       ]  →  [ Queue  |  Active   |  ● Done ]
```

Smart defaults via fuzzy match against known vocabulary. User confirms all. Confirmed mappings stored per project key in vault. Subsequent sessions only re-classify novel statuses.

**Conflict resolution:** one status name = one classification, enforced globally within session.

### TTFT Anchor Discovery

During status classification, user identifies which transition marks first touch:

```
Options:
  (a) Any transition away from initial status
  (b) Transition into a specific named Active-class status
  (c) Assignee field populated (fallback when no status change occurs at pickup)

Validation: reject anchor configurations that produce zero or negative cycle time
Flag projects with inconsistent TTFT anchors in cross-project comparisons
```

Confirmed per project, stored in vault.

### Label Discovery

```
On project selection:
  Aggregate all unique labels across all tickets in selected projects
  Frequency-rank labels
  Present as Tier 1 filter dimension (not buried in settings)
  Labels with count < configurable threshold hidden by default
  User can pin any label as a permanent filter axis
```

Labels are the primary user-controlled semantic taxonomy. They are treated as authoritative and dynamic, not as a static configuration.

---

## 7. SIEM Title Normalization

SIEM-generated alert titles are structured strings, not natural language. Naive token frequency on raw titles produces garbage clusters because entity values (usernames, IPs, hostnames) are unique per alert instance while the alert rule name is the true cluster key.

### Entity Normalization

Every title passes through normalization before any clustering:

```
Entity pattern → replacement token

IPv4 address                    → <IP>
IPv6 address                    → <IPV6>
Hostname (regex pattern)        → <HOST>
Username patterns               → <USER>
Email address                   → <EMAIL>
File hash (MD5/SHA1/SHA256)     → <HASH>
File path                       → <PATH>
URL                             → <URL>
Embedded timestamp              → <TIMESTAMP>
Port number                     → <PORT>
Cloud resource ID               → <RESOURCE_ID>
CVE identifier                  → kept as-is (CVE-YYYY-NNNNN is signal)
```

**The normalized title after entity stripping is the cluster key.**

Entity values stripped during normalization are stored as secondary dimensions -- available for "how many distinct IPs triggered this rule" queries without polluting the cluster.

### SIEM Structural Pattern Detection

Different SIEM tools produce recognizable structural signatures:

```
Pattern 1: Severity prefix bracket
  "[CRITICAL] Unauthorized Access Attempt - Host: <HOST>"
  Extracted: severity=CRITICAL, rule="Unauthorized Access Attempt"
  Entity type=Host

Pattern 2: Vendor namespace
  "AWS GuardDuty: UnauthorizedAccess:IAMUser/MaliciousIPCaller"
  "Microsoft Defender: Ransomware behavior detected on <HOST>"
  Extracted: source_system=GuardDuty|Defender, rule=namespace:type/subtype

Pattern 3: Pipe-delimited key-value
  "DLP Alert | Policy: PII-SSN | Endpoint: <HOST> | Action: Block"
  Extracted: category=DLP, policy_name="PII-SSN", entity_type=Endpoint

Pattern 4: Plain rule name
  "Phishing Email Detected"
  "Impossible Travel Alert"
  Extracted: full normalized title is the rule name
```

Source system detected from title prefix or known label values. This populates the source system dimension automatically.

### Clustering Confidence

```
High confidence:   title matches a known SIEM structural pattern
Medium confidence: entity normalization succeeded, rule name extracted
Low confidence:    title is free-form or non-standard

Low-confidence clusters are flagged in the UI.
User can manually assign a label to a low-confidence cluster.
Manual assignment stored in vault as a title-pattern → cluster-name lookup.
This lookup grows across sessions -- discovery gets smarter over time.
```

---

## 8. Dimension Model

All metrics are filterable and segmentable by the following dimensions. Every dimension is discovered from data, never hardcoded.

### Tier 1: Labels (User-Controlled Taxonomy)

Jira labels as applied by the team. Aggregated and frequency-ranked on project load. Treated as the primary semantic layer because they represent the team's own classification decisions.

### Tier 2: Structural Dimensions (Discovered from API)

**Issue Type** -- discovered per project, not assumed
**Priority** -- discovered per project, validity gated by Priority Separation Index

### Tier 3: Derived Dimensions (Computed from Normalization)

**Alert Rule Name** -- entity-normalized title, the true cluster key for SIEM-sourced tickets

**Source System** -- which tool generated the alert
```
Examples: GuardDuty, Defender, Splunk ES, Proofpoint, CrowdStrike, DLP Engine, Manual
Detected from: title structural pattern, label, or component field
```

**Asset Class** -- class of asset involved, derived from entity types present in title
```
<HOST> present          → Endpoint
<IP> without <HOST>     → Network
<EMAIL> present         → Email / Identity
<RESOURCE_ID> present   → Cloud
<USER> only             → Identity
Multiple present        → Multi-class (flagged separately)
```

**Entity Type** -- what kind of entity is the subject
```
User | Host | IP | Email | File | Policy | Cloud Resource | Unknown
```

### Tier 4: Temporal Dimensions (Computed from Timestamps)

**Time-of-Day Band**
```
Business hours   = within configured primary shift
After-hours      = outside all configured shifts
Shift boundary   = within 30 minutes of any shift start or end
```

After-hours alerts with fast TTFT = on-call coverage signal
After-hours alerts with high TTFT = coverage gap signal
Shift-boundary tickets = rollover risk signal

**Day-of-Week**
Monday-Sunday. Weekly intake profile reveals structural patterns (Monday morning email surge, weekend baseline).

**Week-of-Year** (for projection)
Required for seasonal decomposition. Meaningful only with 6+ months of history.
