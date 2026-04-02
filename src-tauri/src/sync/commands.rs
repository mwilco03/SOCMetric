use std::sync::atomic::{AtomicBool, Ordering};
use tauri::State;
use crate::error::AppError;
use crate::jira::client::JiraClient;
use crate::models::settings::SyncState;
use crate::storage::db::Database;
use crate::storage::keyring_store;
use crate::storage::queries;
use crate::sync::engine;

/// Guard to prevent concurrent sync_project invocations.
pub struct SyncGuard(AtomicBool);

impl SyncGuard {
    pub fn new() -> Self {
        Self(AtomicBool::new(false))
    }
}

fn build_client() -> Result<JiraClient, AppError> {
    let cred = keyring_store::get_credentials()?
        .ok_or_else(|| AppError::Validation("No credentials configured".into()))?;
    JiraClient::new(&cred.domain, &cred.email, &cred.api_token)
}

#[tauri::command]
pub async fn sync_project(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    guard: State<'_, SyncGuard>,
    project_key: String,
    start_date: String,
    end_date: String,
) -> Result<engine::SyncComplete, AppError> {
    if guard.0.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err(AppError::Validation("Sync already in progress".into()));
    }
    let result = async {
        let client = build_client()?;
        engine::sync_project(&app_handle, &db, &client, &project_key, &start_date, &end_date).await
    }.await;
    guard.0.store(false, Ordering::SeqCst);
    result
}

#[tauri::command]
pub async fn get_sync_state(
    db: State<'_, Database>,
    project_key: String,
) -> Result<Option<SyncState>, AppError> {
    db.with_conn(|conn| queries::get_sync_state(conn, &project_key))
}
