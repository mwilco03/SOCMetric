use serde::{Deserialize, Serialize};
use crate::constants::*;
use crate::jira::client::JiraStatus;

const QUEUE_PATTERNS: &[&str] = &["waiting", "pending", "backlog", "to do", "open", "new"];
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
        let (classification, confidence, reason) = if status.category_key == JIRA_CATEGORY_DONE {
            (CLASS_DONE, CONFIDENCE_HIGH, format!("Jira category: {}", status.category_name))
        } else if status.category_key == JIRA_CATEGORY_IN_PROGRESS {
            if matches_any(&status.name, BLOCKED_PATTERNS) {
                (CLASS_BLOCKED, CONFIDENCE_MEDIUM, format!("Jira says in-progress but name suggests blocked (\"{}\")", status.name))
            } else if matches_any(&status.name, QUEUE_PATTERNS) {
                (CLASS_QUEUE, CONFIDENCE_MEDIUM, format!("Jira says in-progress but name suggests queue (\"{}\")", status.name))
            } else {
                (CLASS_ACTIVE, CONFIDENCE_HIGH, format!("Jira category: {}", status.category_name))
            }
        } else if matches_any(&status.name, ACTIVE_PATTERNS) {
            (CLASS_ACTIVE, CONFIDENCE_MEDIUM, format!("Name suggests active (\"{}\")", status.name))
        } else if matches_any(&status.name, DONE_PATTERNS) {
            (CLASS_DONE, CONFIDENCE_MEDIUM, format!("Name suggests done (\"{}\")", status.name))
        } else if matches_any(&status.name, BLOCKED_PATTERNS) {
            (CLASS_BLOCKED, CONFIDENCE_MEDIUM, format!("Name suggests blocked (\"{}\")", status.name))
        } else {
            (CLASS_QUEUE, CONFIDENCE_HIGH, format!("Jira category: {}", status.category_name))
        };

        DiscoveredMapping {
            status_name: status.name.clone(),
            suggested_classification: classification.to_string(),
            confidence: confidence.to_string(),
            reason,
        }
    }).collect()
}
