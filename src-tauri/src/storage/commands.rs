use std::collections::HashMap;
use tauri::State;
use crate::constants::{RESET_TIER_SETTINGS, RESET_TIER_EVERYTHING, VALID_CLASSIFICATIONS};
use crate::error::AppError;
use crate::models::credential::{Credential, sanitize_domain};
use crate::models::settings::LabelConfig;
use crate::storage::db::Database;
use crate::storage::keyring_store;
use crate::storage::queries;

// --- Credentials (OS Keychain) ---

#[tauri::command]
pub async fn get_credentials() -> Result<Option<Credential>, AppError> {
    keyring_store::get_credentials()
}

#[tauri::command]
pub async fn set_credentials(domain: String, email: String, api_token: String) -> Result<(), AppError> {
    let domain = sanitize_domain(&domain)?;
    let cred = Credential { domain, email, api_token };
    keyring_store::store_credentials(&cred)
}

#[tauri::command]
pub async fn delete_credentials() -> Result<(), AppError> {
    keyring_store::delete_credentials()
}

// --- Settings (SQLite) ---

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<HashMap<String, String>, AppError> {
    db.with_conn(|conn| queries::get_all_settings(conn))
}

#[tauri::command]
pub async fn get_setting(db: State<'_, Database>, key: String) -> Result<Option<String>, AppError> {
    db.with_conn(|conn| queries::get_setting(conn, &key))
}

#[tauri::command]
pub async fn set_setting(db: State<'_, Database>, key: String, value: String) -> Result<(), AppError> {
    db.with_conn(|conn| queries::set_setting(conn, &key, &value))
}

// --- Status Mappings ---

#[tauri::command]
pub async fn get_status_mappings(db: State<'_, Database>, project_key: String) -> Result<HashMap<String, String>, AppError> {
    db.with_conn(|conn| queries::get_status_mappings(conn, &project_key))
}

#[tauri::command]
pub async fn set_status_mapping(db: State<'_, Database>, project_key: String, status_name: String, classification: String) -> Result<(), AppError> {
    if !VALID_CLASSIFICATIONS.contains(&classification.as_str()) {
        return Err(AppError::Validation(format!("Invalid classification \"{}\". Must be one of: {}", classification, VALID_CLASSIFICATIONS.join(", "))));
    }
    db.with_conn(|conn| queries::set_status_mapping(conn, &project_key, &status_name, &classification))
}

#[tauri::command]
pub async fn bulk_set_status_mappings(db: State<'_, Database>, project_key: String, mappings: HashMap<String, String>) -> Result<(), AppError> {
    db.with_conn(|conn| queries::bulk_set_status_mappings(conn, &project_key, &mappings))
}

// --- Label Config ---

#[tauri::command]
pub async fn get_label_config(db: State<'_, Database>) -> Result<Vec<LabelConfig>, AppError> {
    db.with_conn(|conn| queries::get_label_config(conn))
}

#[tauri::command]
pub async fn set_label_included(db: State<'_, Database>, label: String, included: bool) -> Result<(), AppError> {
    db.with_conn(|conn| queries::set_label_included(conn, &label, included))
}

// --- Day Annotations ---

#[tauri::command]
pub async fn set_day_annotation(db: State<'_, Database>, date: String, annotation: String) -> Result<(), AppError> {
    db.with_conn(|conn| queries::set_day_annotation(conn, &date, &annotation))
}

#[tauri::command]
pub async fn get_day_annotations(db: State<'_, Database>) -> Result<HashMap<String, String>, AppError> {
    db.with_conn(|conn| queries::get_day_annotations(conn))
}

#[tauri::command]
pub async fn delete_day_annotation(db: State<'_, Database>, date: String) -> Result<(), AppError> {
    db.with_conn(|conn| queries::delete_day_annotation(conn, &date))
}

// --- Reset ---

#[tauri::command]
pub async fn reset_app(db: State<'_, Database>, tier: String) -> Result<(), AppError> {
    match tier.as_str() {
        RESET_TIER_SETTINGS => {
            db.with_conn(|conn| queries::delete_all_settings(conn))?;
        }
        RESET_TIER_EVERYTHING => {
            db.with_conn(|conn| queries::reset_everything(conn))?;
            keyring_store::delete_credentials()?;
        }
        _ => return Err(AppError::Validation(format!("Unknown reset tier: {}", tier))),
    }
    Ok(())
}

// --- Tickets (read from SQLite) ---

#[tauri::command]
pub async fn get_tickets(
    db: State<'_, Database>,
    project_key: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<crate::models::ticket::TicketRow>, AppError> {
    db.with_conn(|conn| queries::get_tickets_in_range(conn, &project_key, &start_date, &end_date))
}

#[tauri::command]
pub async fn get_open_tickets(
    db: State<'_, Database>,
    project_key: String,
) -> Result<Vec<crate::models::ticket::TicketRow>, AppError> {
    db.with_conn(|conn| queries::get_open_tickets(conn, &project_key))
}

#[tauri::command]
pub async fn get_ticket_count(
    db: State<'_, Database>,
    project_key: String,
) -> Result<i64, AppError> {
    db.with_conn(|conn| queries::count_tickets(conn, &project_key))
}
