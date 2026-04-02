#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod constants;
mod error;
mod models;
mod storage;
mod jira;
mod sync;

use storage::db::Database;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join(constants::DB_FILENAME);
            let db = Database::open(&db_path)?;
            db.migrate()?;
            app.manage(db);
            app.manage(sync::commands::SyncGuard::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Credentials (OS keychain)
            storage::commands::get_credentials,
            storage::commands::set_credentials,
            storage::commands::delete_credentials,
            // Settings (SQLite)
            storage::commands::get_settings,
            storage::commands::get_setting,
            storage::commands::set_setting,
            // Status mappings
            storage::commands::get_status_mappings,
            storage::commands::set_status_mapping,
            storage::commands::bulk_set_status_mappings,
            // Label config
            storage::commands::get_label_config,
            storage::commands::set_label_included,
            // Day annotations
            storage::commands::set_day_annotation,
            storage::commands::get_day_annotations,
            storage::commands::delete_day_annotation,
            // Tickets (read)
            storage::commands::get_tickets,
            storage::commands::get_open_tickets,
            storage::commands::get_ticket_count,
            // Reset
            storage::commands::reset_app,
            // Jira API
            jira::commands::test_connection,
            jira::commands::get_projects,
            jira::commands::get_project_statuses,
            jira::commands::search_issues,
            jira::commands::discover_statuses,
            // Sync
            sync::commands::sync_project,
            sync::commands::get_sync_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
