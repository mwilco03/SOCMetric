use crate::error::AppError;
use crate::jira::client::{JiraClient, JiraUser, JiraProject, JiraStatus, SearchResult};
use crate::jira::discovery::{DiscoveredMapping, discover_status_mappings};
use crate::storage::keyring_store;

fn build_client() -> Result<JiraClient, AppError> {
    let cred = keyring_store::get_credentials()?
        .ok_or_else(|| AppError::Validation("No credentials configured".into()))?;
    JiraClient::new(&cred.domain, &cred.email, &cred.api_token)
}

#[tauri::command]
pub async fn test_connection(domain: String, email: String, api_token: String) -> Result<JiraUser, AppError> {
    let client = JiraClient::new(&domain, &email, &api_token)?;
    client.test_connection().await
}

#[tauri::command]
pub async fn get_projects() -> Result<Vec<JiraProject>, AppError> {
    let client = build_client()?;
    client.get_projects().await
}

#[tauri::command]
pub async fn get_project_statuses(project_key: String) -> Result<Vec<JiraStatus>, AppError> {
    let client = build_client()?;
    client.get_project_statuses(&project_key).await
}

#[tauri::command]
pub async fn search_issues(
    jql: String,
    next_page_token: Option<String>,
    max_results: Option<u32>,
    expand: Option<String>,
) -> Result<SearchResult, AppError> {
    let client = build_client()?;
    client.search_issues(
        &jql,
        next_page_token.as_deref(),
        max_results.unwrap_or(crate::constants::JIRA_PAGE_SIZE),
        &expand.unwrap_or_else(|| crate::constants::JIRA_EXPAND_CHANGELOG.to_string()),
    ).await
}

#[tauri::command]
pub async fn discover_statuses(project_key: String) -> Result<Vec<DiscoveredMapping>, AppError> {
    let client = build_client()?;
    let statuses = client.get_project_statuses(&project_key).await?;
    Ok(discover_status_mappings(&statuses))
}
