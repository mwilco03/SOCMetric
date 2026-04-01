use std::collections::HashMap;
use rusqlite::{params, Connection};
use crate::error::AppError;
use crate::models::ticket::TicketRow;
use crate::models::settings::{SyncState, StatusMapping, LabelConfig};

// --- Tickets ---

pub fn upsert_ticket(conn: &Connection, t: &TicketRow) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO tickets (id, key, project_key, summary, status_name, status_category_key, issue_type, priority, assignee, reporter, labels, components, created_at, updated_at, resolved_at, changelog_json, fetched_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            t.id, t.key, t.project_key, t.summary, t.status_name, t.status_category_key,
            t.issue_type, t.priority, t.assignee, t.reporter,
            serde_json::to_string(&t.labels).unwrap_or_default(),
            serde_json::to_string(&t.components).unwrap_or_default(),
            t.created_at, t.updated_at, t.resolved_at, t.changelog_json, t.fetched_at,
        ],
    )?;
    Ok(())
}

pub fn get_tickets_in_range(
    conn: &Connection,
    project_key: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<TicketRow>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, key, project_key, summary, status_name, status_category_key, issue_type, priority, assignee, reporter, labels, components, created_at, updated_at, resolved_at, changelog_json, fetched_at
         FROM tickets
         WHERE project_key = ?1 AND created_at >= ?2 AND created_at <= ?3
         ORDER BY created_at DESC"
    )?;

    let rows = stmt.query_map(params![project_key, start_date, end_date], |row| {
        Ok(TicketRow {
            id: row.get(0)?,
            key: row.get(1)?,
            project_key: row.get(2)?,
            summary: row.get(3)?,
            status_name: row.get(4)?,
            status_category_key: row.get(5)?,
            issue_type: row.get(6)?,
            priority: row.get(7)?,
            assignee: row.get(8)?,
            reporter: row.get(9)?,
            labels: serde_json::from_str(&row.get::<_, String>(10)?).unwrap_or_default(),
            components: serde_json::from_str(&row.get::<_, String>(11)?).unwrap_or_default(),
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
            resolved_at: row.get(14)?,
            changelog_json: row.get(15)?,
            fetched_at: row.get(16)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn get_open_tickets(conn: &Connection, project_key: &str) -> Result<Vec<TicketRow>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, key, project_key, summary, status_name, status_category_key, issue_type, priority, assignee, reporter, labels, components, created_at, updated_at, resolved_at, changelog_json, fetched_at
         FROM tickets
         WHERE project_key = ?1 AND resolved_at IS NULL
         ORDER BY created_at DESC"
    )?;

    let rows = stmt.query_map(params![project_key], |row| {
        Ok(TicketRow {
            id: row.get(0)?,
            key: row.get(1)?,
            project_key: row.get(2)?,
            summary: row.get(3)?,
            status_name: row.get(4)?,
            status_category_key: row.get(5)?,
            issue_type: row.get(6)?,
            priority: row.get(7)?,
            assignee: row.get(8)?,
            reporter: row.get(9)?,
            labels: serde_json::from_str(&row.get::<_, String>(10)?).unwrap_or_default(),
            components: serde_json::from_str(&row.get::<_, String>(11)?).unwrap_or_default(),
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
            resolved_at: row.get(14)?,
            changelog_json: row.get(15)?,
            fetched_at: row.get(16)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(rows)
}

pub fn count_tickets(conn: &Connection, project_key: &str) -> Result<i64, AppError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tickets WHERE project_key = ?1",
        params![project_key],
        |row| row.get(0),
    )?;
    Ok(count)
}

pub fn delete_project_data(conn: &Connection, project_key: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM tickets WHERE project_key = ?1", params![project_key])?;
    conn.execute("DELETE FROM sync_state WHERE project_key = ?1", params![project_key])?;
    conn.execute("DELETE FROM status_map WHERE project_key = ?1", params![project_key])?;
    Ok(())
}

// --- Sync State ---

pub fn get_sync_state(conn: &Connection, project_key: &str) -> Result<Option<SyncState>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT project_key, newest_fetched, oldest_fetched, total_fetched, last_sync_at FROM sync_state WHERE project_key = ?1"
    )?;

    let result = stmt.query_row(params![project_key], |row| {
        Ok(SyncState {
            project_key: row.get(0)?,
            newest_fetched: row.get(1)?,
            oldest_fetched: row.get(2)?,
            total_fetched: row.get(3)?,
            last_sync_at: row.get(4)?,
        })
    });

    match result {
        Ok(state) => Ok(Some(state)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn upsert_sync_state(conn: &Connection, state: &SyncState) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO sync_state (project_key, newest_fetched, oldest_fetched, total_fetched, last_sync_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![state.project_key, state.newest_fetched, state.oldest_fetched, state.total_fetched, state.last_sync_at],
    )?;
    Ok(())
}

// --- Settings ---

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> Result<HashMap<String, String>, AppError> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?.collect::<Result<HashMap<_, _>, _>>()?;
    Ok(rows)
}

pub fn delete_all_settings(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("DELETE FROM settings; DELETE FROM status_map; DELETE FROM label_config; DELETE FROM day_annotations;")?;
    Ok(())
}

// --- Status Mappings ---

pub fn get_status_mappings(conn: &Connection, project_key: &str) -> Result<HashMap<String, String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT status_name, classification FROM status_map WHERE project_key = ?1"
    )?;
    let rows = stmt.query_map(params![project_key], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?.collect::<Result<HashMap<_, _>, _>>()?;
    Ok(rows)
}

pub fn set_status_mapping(conn: &Connection, project_key: &str, status_name: &str, classification: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO status_map (project_key, status_name, classification) VALUES (?1, ?2, ?3)",
        params![project_key, status_name, classification],
    )?;
    Ok(())
}

pub fn bulk_set_status_mappings(conn: &Connection, project_key: &str, mappings: &HashMap<String, String>) -> Result<(), AppError> {
    conn.execute("DELETE FROM status_map WHERE project_key = ?1", params![project_key])?;
    for (status_name, classification) in mappings {
        conn.execute(
            "INSERT INTO status_map (project_key, status_name, classification) VALUES (?1, ?2, ?3)",
            params![project_key, status_name, classification],
        )?;
    }
    Ok(())
}

// --- Label Config ---

pub fn get_label_config(conn: &Connection) -> Result<Vec<LabelConfig>, AppError> {
    let mut stmt = conn.prepare("SELECT label, included FROM label_config")?;
    let rows = stmt.query_map([], |row| {
        Ok(LabelConfig {
            label: row.get(0)?,
            included: row.get::<_, i32>(1)? != 0,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn set_label_included(conn: &Connection, label: &str, included: bool) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO label_config (label, included) VALUES (?1, ?2)",
        params![label, included as i32],
    )?;
    Ok(())
}

// --- Day Annotations ---

pub fn set_day_annotation(conn: &Connection, date: &str, annotation: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT OR REPLACE INTO day_annotations (date, annotation) VALUES (?1, ?2)",
        params![date, annotation],
    )?;
    Ok(())
}

pub fn get_day_annotations(conn: &Connection) -> Result<HashMap<String, String>, AppError> {
    let mut stmt = conn.prepare("SELECT date, annotation FROM day_annotations")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?.collect::<Result<HashMap<_, _>, _>>()?;
    Ok(rows)
}

pub fn delete_day_annotation(conn: &Connection, date: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM day_annotations WHERE date = ?1", params![date])?;
    Ok(())
}

// --- Reset ---

pub fn reset_everything(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "DELETE FROM tickets;
         DELETE FROM sync_state;
         DELETE FROM settings;
         DELETE FROM status_map;
         DELETE FROM label_config;
         DELETE FROM day_annotations;"
    )?;
    Ok(())
}
