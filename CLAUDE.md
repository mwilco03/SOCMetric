# SOCMetric

SOC Productivity Dashboard — Tauri v2 desktop app (Rust backend, React frontend).

## Commands

```bash
# Frontend
npm run build          # tsc + vite build
npm run dev            # vite dev server
npm run test           # vitest
npx tsc --noEmit       # type check only

# Tauri (requires GTK/Pango system deps)
npm run tauri:dev      # dev mode
npm run tauri:build    # production binary

# Rust only (from src-tauri/)
cargo check            # type check (fails without GTK deps on some hosts)
```

## Project Layout

```
├── src/                  # React frontend
│   ├── components/       # UI components (shell, chapters, calendar, panels, shared)
│   ├── hooks/            # React Query + Tauri invoke hooks
│   ├── metrics/          # 11 metric computation modules
│   ├── store/            # Zustand persisted state
│   ├── types.ts          # Shared types (TicketRow, StatusClassification, etc.)
│   └── constants.ts      # All magic numbers extracted here
├── src-tauri/            # Rust backend
│   └── src/
│       ├── storage/      # SQLite + OS keychain
│       ├── jira/         # Jira REST client
│       └── sync/         # Two-pass sync engine with SyncGuard
├── docs/
│   ├── design/           # 11 design documents
│   ├── specs/            # 4 product spec docs
│   └── findings/         # Code audit, UX audit, architecture decisions
└── tests/                # Vitest test suite
```

## Rules

- Constants over literals, enums over hardcodes — everything in `constants.ts`
- No secrets in code or git — credentials in OS keychain via `keyring` crate
- Conventional commits: `type(scope): description`
- `StatusClassification` = `'queue' | 'active' | 'done' | 'blocked'` — use the type, don't inline
- All Tauri invoke arg keys use camelCase (Tauri v2 `#[tauri::command]` applies `serde(rename_all = "camelCase")` to the generated args struct)
- Date formatting: use `toISODate()` from `utils/dateUtils.ts`, never inline `.toISOString().slice(0,10)`
- React paint only — all data ops in Rust, zero HTTP from webview
