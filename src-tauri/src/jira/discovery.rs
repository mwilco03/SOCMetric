use serde::{Deserialize, Serialize};
use crate::jira::client::JiraStatus;

const QUEUE_PATTERNS: &[&str] = &["waiting", "pending", "blocked", "on hold", "backlog", "to do", "open", "new"];
const ACTIVE_PATTERNS: &[&str] = &["in progress", "in review", "investigating", "working", "active", "assigned"];
const DONE_PATTERNS: &[&str] = &["done", "closed", "resolved", "complete", "cancelled", "won't do"];
const BLOCKED_PATTERNS: &[&str] = &["blocked", "on hold", "waiting for", "external", "pending customer", "awaiting"];

fn matches_any(name: &str, patterns: &[&str]) -> bool {
    let lower = name.to_lowercase();
    patterns.iter().any(|p| lower.contains(p))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredMapping {
    pub status_name: String,
    pub suggested_classification: String,
    pub confidence: String,
    pub reason: String,
}

pub fn discover_status_mappings(statuses: &[JiraStatus]) -> Vec<DiscoveredMapping> {
    statuses.iter().map(|status| {
        let category_key = &status.category_key;
        let name = &status.name;

        let (classification, confidence, reason) = if category_key == "done" {
            ("done", "high", format!("Jira category: {}", status.category_name))
        } else if category_key == "indeterminate" {
            if matches_any(name, BLOCKED_PATTERNS) {
                ("blocked", "medium", format!("Jira says in-progress but name suggests blocked (\"{}\")", name))
            } else if matches_any(name, QUEUE_PATTERNS) {
                ("queue", "medium", format!("Jira says in-progress but name suggests queue (\"{}\")", name))
            } else {
                ("active", "high", format!("Jira category: {}", status.category_name))
            }
        } else {
            // 'new' or other category
            if matches_any(name, ACTIVE_PATTERNS) {
                ("active", "medium", format!("Jira says new/todo but name suggests active (\"{}\")", name))
            } else if matches_any(name, DONE_PATTERNS) {
                ("done", "medium", format!("Jira says new/todo but name suggests done (\"{}\")", name))
            } else if matches_any(name, BLOCKED_PATTERNS) {
                ("blocked", "medium", format!("Jira says new/todo but name suggests blocked (\"{}\")", name))
            } else {
                ("queue", "high", format!("Jira category: {}", status.category_name))
            }
        };

        DiscoveredMapping {
            status_name: name.clone(),
            suggested_classification: classification.to_string(),
            confidence: confidence.to_string(),
            reason,
        }
    }).collect()
}
