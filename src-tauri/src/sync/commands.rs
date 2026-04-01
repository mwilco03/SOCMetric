use tauri::State;
use crate::error::AppError;
use crate::jira::client::JiraClient;
use crate::models::settings::SyncState;
use crate::storage::db::Database;
use crate::storage::keyring_store;
use crate::storage::queries;
use crate::sync::engine;

fn build_client() -> Result<JiraClient, AppError> {
    let cred = keyring_store::get_credentials()?
        .ok_or_else(|| AppError::Validation("No credentials configured".into()))?;
    JiraClient::new(&cred.domain, &cred.email, &cred.api_token)
}

#[tauri::command]
pub async fn sync_project(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    project_key: String,
    start_date: String,
    end_date: String,
) -> Result<engine::SyncComplete, AppError> {
    let client = build_client()?;
    engine::sync_project(&app_handle, &db, &client, &project_key, &start_date, &end_date).await
}

#[tauri::command]
pub async fn get_sync_state(
    db: State<'_, Database>,
    project_key: String,
) -> Result<Option<SyncState>, AppError> {
    db.with_conn(|conn| queries::get_sync_state(conn, &project_key))
}
