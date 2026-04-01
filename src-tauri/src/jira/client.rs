use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use regex::Regex;

use crate::constants::*;
use crate::error::AppError;

// --- Public types returned to frontend ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraUser {
    pub display_name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraProject {
    pub id: String,
    pub key: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraStatus {
    pub id: String,
    pub name: String,
    pub category_key: String,
    pub category_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub issues: Vec<JiraIssueRaw>,
    pub next_page_token: Option<String>,
    pub is_last: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssueRaw {
    pub id: String,
    pub key: String,
    pub fields: serde_json::Value,
    #[serde(default)]
    pub changelog: Option<serde_json::Value>,
}

// --- Internal Jira API response types ---

#[derive(Deserialize)]
struct MyselfResponse {
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "emailAddress")]
    email_address: String,
}

#[derive(Deserialize)]
struct ProjectSearchResponse {
    values: Vec<ProjectValue>,
    #[serde(default)]
    total: u32,
    #[serde(rename = "isLast")]
    is_last: Option<bool>,
}

#[derive(Deserialize)]
struct ProjectValue {
    id: String,
    key: String,
    name: String,
}

#[derive(Deserialize)]
struct StatusIssueType {
    statuses: Vec<StatusValue>,
}

#[derive(Deserialize)]
struct StatusValue {
    id: String,
    name: String,
    #[serde(rename = "statusCategory")]
    status_category: StatusCategory,
}

#[derive(Deserialize)]
struct StatusCategory {
    key: String,
    name: String,
}

#[derive(Deserialize)]
struct JiraErrorResponse {
    #[serde(rename = "errorMessages", default)]
    error_messages: Vec<String>,
}

// --- Client ---

pub struct JiraClient {
    http: Client,
    base_url: String,
    auth_header: String,
}

impl JiraClient {
    pub fn new(domain: &str, email: &str, api_token: &str) -> Result<Self, AppError> {
        let clean_domain = domain
            .trim()
            .replace("https://", "")
            .replace("http://", "")
            .trim_end_matches('/')
            .to_string();

        let re = Regex::new(JIRA_DOMAIN_REGEX)
            .map_err(|e| AppError::General(e.to_string()))?;
        if !re.is_match(&clean_domain) {
            return Err(AppError::Validation(format!(
                "Invalid Jira domain \"{}\" — must be yourorg.atlassian.net",
                clean_domain
            )));
        }

        let http = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()?;

        use base64::Engine;
        let auth = base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", email, api_token));

        Ok(JiraClient {
            http,
            base_url: format!("https://{}/rest/api/3", clean_domain),
            auth_header: format!("Basic {}", auth),
        })
    }

    async fn request_get<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, AppError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.http
            .get(&url)
            .header("Authorization", &self.auth_header)
            .header("Accept", "application/json")
            .send()
            .await?;

        let status = resp.status().as_u16();
        if status == HTTP_STATUS_UNAUTHORIZED { return Err(AppError::JiraApi("Invalid Jira credentials".into())); }
        if status == HTTP_STATUS_FORBIDDEN { return Err(AppError::JiraApi("Insufficient permissions".into())); }
        if status == HTTP_STATUS_RATE_LIMITED { return Err(AppError::JiraApi("Rate limited by Jira — please wait".into())); }
        if status >= HTTP_STATUS_BAD_REQUEST {
            let body = resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<JiraErrorResponse>(&body)
                .ok()
                .and_then(|e| e.error_messages.into_iter().next())
                .unwrap_or(body);
            return Err(AppError::JiraApi(format!("Jira API error {}: {}", status, detail)));
        }

        resp.json::<T>().await.map_err(|e| AppError::JiraApi(format!("Failed to parse response: {}", e)))
    }

    async fn request_post<T: serde::de::DeserializeOwned>(&self, path: &str, body: &serde_json::Value) -> Result<T, AppError> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.http
            .post(&url)
            .header("Authorization", &self.auth_header)
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await?;

        let status = resp.status().as_u16();
        if status == HTTP_STATUS_UNAUTHORIZED { return Err(AppError::JiraApi("Invalid Jira credentials".into())); }
        if status == HTTP_STATUS_FORBIDDEN { return Err(AppError::JiraApi("Insufficient permissions".into())); }
        if status == HTTP_STATUS_RATE_LIMITED { return Err(AppError::JiraApi("Rate limited by Jira — please wait".into())); }
        if status >= HTTP_STATUS_BAD_REQUEST {
            let body_text = resp.text().await.unwrap_or_default();
            let detail = serde_json::from_str::<JiraErrorResponse>(&body_text)
                .ok()
                .and_then(|e| e.error_messages.into_iter().next())
                .unwrap_or(body_text);
            return Err(AppError::JiraApi(format!("Jira API error {}: {}", status, detail)));
        }

        resp.json::<T>().await.map_err(|e| AppError::JiraApi(format!("Failed to parse response: {}", e)))
    }

    pub async fn test_connection(&self) -> Result<JiraUser, AppError> {
        let data: MyselfResponse = self.request_get(JIRA_ENDPOINT_MYSELF).await?;
        Ok(JiraUser {
            display_name: data.display_name,
            email: data.email_address,
        })
    }

    pub async fn get_projects(&self) -> Result<Vec<JiraProject>, AppError> {
        let mut all_projects = Vec::new();
        let mut start_at: u32 = 0;

        loop {
            let path = format!("{}?startAt={}&maxResults={}", JIRA_ENDPOINT_PROJECT_SEARCH, start_at, JIRA_PROJECTS_PAGE_SIZE);
            let data: ProjectSearchResponse = self.request_get(&path).await?;

            all_projects.extend(data.values.into_iter().map(|p| JiraProject {
                id: p.id,
                key: p.key,
                name: p.name,
            }));

            if data.is_last.unwrap_or(false) || all_projects.len() as u32 >= data.total {
                break;
            }
            start_at += JIRA_PROJECTS_PAGE_SIZE;
        }

        all_projects.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(all_projects)
    }

    pub async fn get_project_statuses(&self, project_key: &str) -> Result<Vec<JiraStatus>, AppError> {
        let path = JIRA_ENDPOINT_PROJECT_STATUSES.replace("{key}", project_key);
        let data: Vec<StatusIssueType> = self.request_get(&path).await?;

        let mut statuses = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        for issue_type in data {
            for status in issue_type.statuses {
                if seen_ids.insert(status.id.clone()) {
                    statuses.push(JiraStatus {
                        id: status.id,
                        name: status.name,
                        category_key: status.status_category.key,
                        category_name: status.status_category.name,
                    });
                }
            }
        }

        Ok(statuses)
    }

    pub async fn search_issues(
        &self,
        jql: &str,
        next_page_token: Option<&str>,
        max_results: u32,
        expand: &str,
    ) -> Result<SearchResult, AppError> {
        let mut body = serde_json::json!({
            "jql": jql,
            "maxResults": max_results,
            "expand": expand,
            "fields": JIRA_SEARCH_FIELDS,
        });

        if let Some(token) = next_page_token {
            body["nextPageToken"] = serde_json::Value::String(token.to_string());
        }

        let data: SearchResult = self.request_post(JIRA_ENDPOINT_SEARCH, &body).await?;
        Ok(data)
    }
}
