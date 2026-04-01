use serde::Serialize;
use std::sync::Arc;
use tauri::Emitter;
use tokio::time::{sleep, Duration};

use crate::constants::*;
use crate::error::AppError;
use crate::jira::client::{JiraClient, JiraIssueRaw};
use crate::models::ticket::TicketRow;
use crate::storage::db::Database;
use crate::storage::queries;

#[derive(Clone, Serialize)]
pub struct SyncProgress {
    pub project_key: String,
    pub fetched: u32,
    pub direction: String,
    pub phase: String,
}

#[derive(Clone, Serialize)]
pub struct SyncComplete {
    pub project_key: String,
    pub total_stored: i64,
}

fn extract_ticket(raw: &JiraIssueRaw, project_key: &str) -> TicketRow {
    let fields = &raw.fields;

    let labels: Vec<String> = fields.get("labels")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    let components: Vec<String> = fields.get("components")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|c| c.get("name").and_then(|n| n.as_str()).map(String::from)).collect())
        .unwrap_or_default();

    // Extract only status-change items from changelog
    let changelog_json = raw.changelog.as_ref().map(|cl| {
        let histories = cl.get("histories").and_then(|h| h.as_array());
        match histories {
            Some(entries) => {
                let status_changes: Vec<serde_json::Value> = entries.iter().filter_map(|entry| {
                    let items = entry.get("items").and_then(|i| i.as_array())?;
                    let status_items: Vec<&serde_json::Value> = items.iter()
                        .filter(|item| item.get("field").and_then(|f| f.as_str()) == Some("status"))
                        .collect();
                    if status_items.is_empty() { return None; }
                    Some(serde_json::json!({
                        "created": entry.get("created"),
                        "items": status_items,
                    }))
                }).collect();
                serde_json::to_string(&status_changes).unwrap_or_default()
            }
            None => "[]".to_string(),
        }
    });

    TicketRow {
        id: raw.id.clone(),
        key: raw.key.clone(),
        project_key: project_key.to_string(),
        summary: fields.get("summary").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        status_name: fields.get("status").and_then(|v| v.get("name")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
        status_category_key: fields.get("status").and_then(|v| v.get("statusCategory")).and_then(|v| v.get("key")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
        issue_type: fields.get("issuetype").and_then(|v| v.get("name")).and_then(|v| v.as_str()).unwrap_or("").to_string(),
        priority: fields.get("priority").and_then(|v| v.get("name")).and_then(|v| v.as_str()).map(String::from),
        assignee: fields.get("assignee").and_then(|v| v.get("displayName")).and_then(|v| v.as_str()).map(String::from),
        reporter: fields.get("reporter").and_then(|v| v.get("displayName")).and_then(|v| v.as_str()).map(String::from),
        labels,
        components,
        created_at: fields.get("created").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        updated_at: fields.get("updated").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        resolved_at: fields.get("resolutiondate").and_then(|v| v.as_str()).map(String::from),
        changelog_json,
        fetched_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub async fn sync_project(
    app_handle: &tauri::AppHandle,
    db: &Database,
    client: &JiraClient,
    project_key: &str,
    start_date: &str,
    end_date: &str,
) -> Result<SyncComplete, AppError> {
    // Phase 1: Fetch fields only (fast) — ascending
    let jql_asc = format!(
        "project = {} AND updated >= \"{}\" AND updated <= \"{}\" ORDER BY updated ASC",
        project_key, start_date, end_date
    );

    let mut total_fetched: u32 = 0;
    let mut next_token: Option<String> = None;

    loop {
        let result = client.search_issues(
            &jql_asc,
            next_token.as_deref(),
            JIRA_PAGE_SIZE,
            "", // No changelog expand for phase 1
        ).await?;

        for raw in &result.issues {
            let ticket = extract_ticket(raw, project_key);
            db.with_conn(|conn| queries::upsert_ticket(conn, &ticket))?;
        }

        total_fetched += result.issues.len() as u32;

        let _ = app_handle.emit("sync:progress", &SyncProgress {
            project_key: project_key.to_string(),
            fetched: total_fetched,
            direction: "asc".to_string(),
            phase: "fields".to_string(),
        });

        if result.is_last.unwrap_or(false) || result.next_page_token.is_none() || total_fetched as usize >= JIRA_MAX_ISSUES {
            break;
        }

        next_token = result.next_page_token;
        sleep(Duration::from_millis(JIRA_RATE_LIMIT_DELAY_MS)).await;
    }

    // Phase 2: Backfill changelogs for tickets that don't have them
    let jql_changelog = format!(
        "project = {} AND updated >= \"{}\" AND updated <= \"{}\" ORDER BY updated ASC",
        project_key, start_date, end_date
    );

    let mut changelog_token: Option<String> = None;
    let mut changelog_count: u32 = 0;

    loop {
        let result = client.search_issues(
            &jql_changelog,
            changelog_token.as_deref(),
            JIRA_PAGE_SIZE,
            JIRA_EXPAND_CHANGELOG,
        ).await?;

        for raw in &result.issues {
            if raw.changelog.is_some() {
                let ticket = extract_ticket(raw, project_key);
                db.with_conn(|conn| queries::upsert_ticket(conn, &ticket))?;
                changelog_count += 1;
            }
        }

        let _ = app_handle.emit("sync:progress", &SyncProgress {
            project_key: project_key.to_string(),
            fetched: changelog_count,
            direction: "asc".to_string(),
            phase: "changelog".to_string(),
        });

        if result.is_last.unwrap_or(false) || result.next_page_token.is_none() {
            break;
        }

        changelog_token = result.next_page_token;
        sleep(Duration::from_millis(JIRA_RATE_LIMIT_DELAY_MS)).await;
    }

    // Update sync state
    let total_stored = db.with_conn(|conn| queries::count_tickets(conn, project_key))?;

    let state = crate::models::settings::SyncState {
        project_key: project_key.to_string(),
        newest_fetched: Some(end_date.to_string()),
        oldest_fetched: Some(start_date.to_string()),
        total_fetched: total_stored,
        last_sync_at: Some(chrono::Utc::now().to_rfc3339()),
    };
    db.with_conn(|conn| queries::upsert_sync_state(conn, &state))?;

    let complete = SyncComplete {
        project_key: project_key.to_string(),
        total_stored,
    };
    let _ = app_handle.emit("sync:complete", &complete);

    Ok(complete)
}
