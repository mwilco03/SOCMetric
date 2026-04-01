use rusqlite::Connection;
use crate::constants::CURRENT_SCHEMA_VERSION;
use crate::error::AppError;

const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    project_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    status_name TEXT NOT NULL,
    status_category_key TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    priority TEXT,
    assignee TEXT,
    reporter TEXT,
    labels TEXT NOT NULL DEFAULT '[]',
    components TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    changelog_json TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_key);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON tickets(updated_at);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status_name);

CREATE TABLE IF NOT EXISTS sync_state (
    project_key TEXT PRIMARY KEY,
    newest_fetched TEXT,
    oldest_fetched TEXT,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_map (
    project_key TEXT NOT NULL,
    status_name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK(classification IN ('queue','active','done','blocked')),
    PRIMARY KEY (project_key, status_name)
);

CREATE TABLE IF NOT EXISTS label_config (
    label TEXT PRIMARY KEY,
    included INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS day_annotations (
    date TEXT PRIMARY KEY,
    annotation TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);
"#;

pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    let current_version: i32 = conn
        .query_row(
            "SELECT version FROM schema_version LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < CURRENT_SCHEMA_VERSION {
        conn.execute_batch(SCHEMA_V1)?;

        conn.execute(
            "INSERT OR REPLACE INTO schema_version (version) VALUES (?1)",
            [CURRENT_SCHEMA_VERSION],
        )?;
    }

    Ok(())
}
