use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketRow {
    pub id: String,
    pub key: String,
    pub project_key: String,
    pub summary: String,
    pub status_name: String,
    pub status_category_key: String,
    pub issue_type: String,
    pub priority: Option<String>,
    pub assignee: Option<String>,
    pub reporter: Option<String>,
    pub labels: Vec<String>,
    pub components: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub resolved_at: Option<String>,
    pub changelog_json: Option<String>,
    pub fetched_at: String,
}
