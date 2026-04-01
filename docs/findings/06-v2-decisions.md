# v2 Architecture Decisions

## Why Rebuild
The v1 TypeScript-only architecture has fundamental limitations:
- No persistent storage — re-fetches all data on every launch
- UI blocks during API calls — no background processing
- Sequential fetching — one page at a time, one project at a time
- Metrics computed in render path — slow with large datasets
- Vault passphrase UX friction — unnecessary password for a local app
- Settings don't cascade — adding a project is a dead toggle

## Single Binary Constraint
Must ship as one executable. No sidecar processes, no external services, no containers. This eliminates Quickwit (search engine), external databases, and any service that runs alongside the app.

### What fits in a single binary:
- SQLite (rusqlite with `bundled` feature compiles SQLite into the binary)
- OS Keychain (keyring crate wraps DPAPI/Keychain/libsecret — all OS-native)
- reqwest HTTP client (compiles in, no external deps)
- Tauri (already the binary framework)

## Technology Choices

### SQLite over IndexedDB
- IndexedDB is trapped in the WebView — Rust can't access it without IPC round-trips
- SQLite is a single file, accessible from Rust directly
- SQL is better for analytical queries (WHERE, GROUP BY, ORDER BY on timestamps)
- rusqlite `bundled` feature compiles SQLite into the binary — no external dependency
- WAL mode allows concurrent reads while syncing writes

### OS Keychain over Vault Encryption
- DPAPI (Windows), Keychain (macOS), libsecret (Linux) are OS-provided credential stores
- Eliminates the passphrase step entirely
- Credentials survive app reinstall (keychain persists)
- Standard platform behavior — same as Chrome, VS Code, etc.
- No custom encryption code to maintain

### reqwest over Tauri HTTP Plugin
- reqwest runs in Rust process — no CSP restrictions, no WebView limitations
- Direct control over connection pooling, timeouts, retry logic
- Can run in tokio tasks — truly parallel, non-blocking
- The Tauri HTTP plugin had body serialization issues with POST requests

### Rust Metrics over TypeScript Metrics (eventual)
- tokio async + rayon data parallelism = metrics across 50k tickets in milliseconds
- No IPC overhead — data stays in Rust memory, never serialized to JS until display
- BUT: TS metrics work today and are tested. Port incrementally, not all at once.

## Data Model Decisions

### Store ~200 bytes per ticket, discard raw JSON
- Full Jira issue with changelog: ~10KB
- What we need: id, key, summary, status, priority, labels, dates, filtered changelog
- 98% reduction in storage
- 50k tickets = ~10MB instead of ~500MB

### Two-pass fetch: fields first, changelog backfill
- Changelog is 90% of the response size but only needed for Response Time and closure integrity
- First pass: get all tickets with fields only — dashboard renders immediately
- Second pass: backfill changelog for closed tickets — metrics refine in background
- User sees data in 2-3 seconds instead of 60

### Bi-directional parallel pagination
- Worker 1: ASC from newest_fetched (catches recent tickets)
- Worker 2: DESC from oldest_fetched (backfills history)
- Both run concurrently via tokio::join!
- For historical mining: split by month, fire all chunks in parallel
- 36 parallel workers for 3 years of data — done in ~10 seconds

### Fourth status class: blocked/external
- Original spec had queue/active/done
- Real SOC workflows have "Awaiting Info", "Blocked", "Pending Customer"
- These aren't stalled — they're externally blocked
- Blocked tickets: excluded from stalled detection, tracked separately in lead time
- Transition from queue to blocked does NOT count as first response

## UX Decisions

### Calendar is the landing page
- First thing a SOC manager wants: "what happened this week?"
- Month grid with label-colored day cards answers this instantly
- Visual heat map — dark = heavy, light = quiet
- Click day → slide-out with cluster breakdown (WHY was Thursday bad?)

### Labels, not clusters, as primary grouping
- Jira labels are how SOC teams categorize work (Phishing, Endpoint, DLP, etc.)
- Clusters (normalized titles) are the explanation for WHY a day was heavy
- Calendar shows labels, day drill-down shows clusters
- Labels configurable: checkbox include/exclude per label

### No individual ticket drill-down
- Single tickets are noise in an analytics dashboard
- The value is aggregates: patterns, trends, groups
- Exception: stalled tickets list (those are actionable individuals)
- Click a cluster group → see tickets in that cluster, NOT click a ticket → see its changelog

### Response Time, not TTFT
- "TTFT" means nothing to leadership
- "Response Time" is universally understood
- Tooltip mentions "Time to First Touch" once for power users

### KPI delta hidden until meaningful
- Need 4+ weeks of data for week-over-week comparison
- Until then: show the number, no arrow, no percentage
- Avoids "+0.0%" confusion on first launch

### Copy Summary for status updates
- SOC managers paste status into Slack/email daily
- One-click generates markdown summary: KPIs, verdict, notable events
- Not a sharing feature — it's a clipboard tool

### Idle sync, not periodic
- Periodic refresh while user is reading = disruption
- Idle sync: after X minutes of no mouse/keyboard, background sync
- Stops on user focus return
- Covers previous year of data

## What Was Explicitly Killed
- Gantt incident timeline — replaced with simpler timeline bars
- URL state/shareability — desktop app, not a web app
- Per-ticket bottom sheet — wrong abstraction for analytics
- IR Project concept — all projects are equal queues
- Analyst identity/opt-in — single user, no multi-analyst features
- Mobile responsive — desktop only, but sidebar collapses for narrow windows
- Notes/sharing in-app — "not social media"
