use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub project_key: String,
    pub newest_fetched: Option<String>,
    pub oldest_fetched: Option<String>,
    pub total_fetched: i64,
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusMapping {
    pub project_key: String,
    pub status_name: String,
    pub classification: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelConfig {
    pub label: String,
    pub included: bool,
}
