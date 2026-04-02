use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::constants::*;
use crate::error::AppError;
use crate::models::credential::sanitize_domain;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraUser { pub display_name: String, pub email: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraProject { pub id: String, pub key: String, pub name: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraStatus { pub id: String, pub name: String, pub category_key: String, pub category_name: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult { pub issues: Vec<JiraIssueRaw>, pub next_page_token: Option<String>, pub is_last: Option<bool> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssueRaw { pub id: String, pub key: String, pub fields: serde_json::Value, #[serde(default)] pub changelog: Option<serde_json::Value> }

#[derive(Deserialize)] struct MyselfResponse { #[serde(rename = "displayName")] display_name: String, #[serde(rename = "emailAddress")] email_address: String }
#[derive(Deserialize)] struct ProjectSearchResponse { values: Vec<ProjectValue>, #[serde(default)] total: u32, #[serde(rename = "isLast")] is_last: Option<bool> }
#[derive(Deserialize)] struct ProjectValue { id: String, key: String, name: String }
#[derive(Deserialize)] struct StatusIssueType { statuses: Vec<StatusValue> }
#[derive(Deserialize)] struct StatusValue { id: String, name: String, #[serde(rename = "statusCategory")] status_category: StatusCat }
#[derive(Deserialize)] struct StatusCat { key: String, name: String }
#[derive(Deserialize)] struct JiraErrorResponse { #[serde(rename = "errorMessages", default)] error_messages: Vec<String> }

pub struct JiraClient { http: Client, base_url: String, auth_header: String }

impl JiraClient {
    pub fn new(domain: &str, email: &str, api_token: &str) -> Result<Self, AppError> {
        let clean = sanitize_domain(domain)?;
        let http = Client::builder().timeout(Duration::from_secs(HTTP_TIMEOUT_SECS)).build()?;
        use base64::Engine;
        let encoded = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", email, api_token));
        Ok(JiraClient {
            http,
            base_url: format!("https://{}/{}", clean, JIRA_API_BASE_PATH),
            auth_header: format!("{} {}", AUTH_SCHEME_BASIC, encoded),
        })
    }

    async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let resp = self.http.get(format!("{}{}", self.base_url, path))
            .header(HEADER_AUTHORIZATION, &self.auth_header)
            .header(HEADER_ACCEPT, MEDIA_TYPE_JSON)
            .send().await?;
        self.handle(resp).await
    }

    async fn post<T: serde::de::DeserializeOwned>(&self, path: &str, body: &serde_json::Value) -> Result<T, AppError> {
        let resp = self.http.post(format!("{}{}", self.base_url, path))
            .header(HEADER_AUTHORIZATION, &self.auth_header)
            .header(HEADER_ACCEPT, MEDIA_TYPE_JSON)
            .header(HEADER_CONTENT_TYPE, MEDIA_TYPE_JSON)
            .json(body).send().await?;
        self.handle(resp).await
    }

    async fn handle<T: serde::de::DeserializeOwned>(&self, resp: reqwest::Response) -> Result<T, AppError> {
        let status = resp.status().as_u16();
        if status == HTTP_STATUS_UNAUTHORIZED { return Err(AppError::JiraApi("Invalid Jira credentials".into())); }
        if status == HTTP_STATUS_FORBIDDEN { return Err(AppError::JiraApi("Insufficient permissions".into())); }
        if status == HTTP_STATUS_RATE_LIMITED { return Err(AppError::JiraApi("Rate limited by Jira — please wait".into())); }
        if status >= HTTP_STATUS_BAD_REQUEST {
            let body = resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<JiraErrorResponse>(&body)
                .ok().and_then(|e| e.error_messages.into_iter().next()).unwrap_or(body);
            return Err(AppError::JiraApi(format!("Jira API error {}: {}", status, detail)));
        }
        resp.json::<T>().await.map_err(|e| AppError::JiraApi(format!("Failed to parse response: {}", e)))
    }

    pub async fn test_connection(&self) -> Result<JiraUser, AppError> {
        let d: MyselfResponse = self.get(JIRA_ENDPOINT_MYSELF).await?;
        Ok(JiraUser { display_name: d.display_name, email: d.email_address })
    }

    pub async fn get_projects(&self) -> Result<Vec<JiraProject>, AppError> {
        let mut all = Vec::new();
        let mut start_at: u32 = 0;
        loop {
            let path = format!("{}?startAt={}&maxResults={}", JIRA_ENDPOINT_PROJECT_SEARCH, start_at, JIRA_PROJECTS_PAGE_SIZE);
            let d: ProjectSearchResponse = self.get(&path).await?;
            all.extend(d.values.into_iter().map(|p| JiraProject { id: p.id, key: p.key, name: p.name }));
            if d.is_last.unwrap_or(false) || all.len() as u32 >= d.total { break; }
            start_at += JIRA_PROJECTS_PAGE_SIZE;
        }
        all.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(all)
    }

    pub async fn get_project_statuses(&self, project_key: &str) -> Result<Vec<JiraStatus>, AppError> {
        let path = JIRA_ENDPOINT_PROJECT_STATUSES.replace("{key}", project_key);
        let data: Vec<StatusIssueType> = self.get(&path).await?;
        let mut statuses = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for it in data {
            for s in it.statuses {
                if seen.insert(s.id.clone()) {
                    statuses.push(JiraStatus { id: s.id, name: s.name, category_key: s.status_category.key, category_name: s.status_category.name });
                }
            }
        }
        Ok(statuses)
    }

    pub async fn search_issues(&self, jql: &str, next_page_token: Option<&str>, max_results: u32, expand: &str) -> Result<SearchResult, AppError> {
        let mut body = serde_json::json!({ "jql": jql, "maxResults": max_results, "fields": JIRA_SEARCH_FIELDS });
        if !expand.is_empty() { body["expand"] = serde_json::Value::String(expand.to_string()); }
        if let Some(token) = next_page_token { body["nextPageToken"] = serde_json::Value::String(token.to_string()); }
        self.post(JIRA_ENDPOINT_SEARCH, &body).await
    }
}
