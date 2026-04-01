use serde::{Deserialize, Serialize};
use regex::Regex;
use crate::constants::JIRA_DOMAIN_REGEX;
use crate::error::AppError;

#[derive(Clone, Serialize, Deserialize)]
pub struct Credential {
    pub domain: String,
    pub email: String,
    pub api_token: String,
}

impl std::fmt::Debug for Credential {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Credential")
            .field("domain", &self.domain)
            .field("email", &self.email)
            .field("api_token", &"[REDACTED]")
            .finish()
    }
}

/// Sanitize and validate a Jira domain — shared by client and commands
pub fn sanitize_domain(domain: &str) -> Result<String, AppError> {
    let clean = domain
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/')
        .to_string();

    let re = Regex::new(JIRA_DOMAIN_REGEX)
        .map_err(|e| AppError::General(e.to_string()))?;

    if !re.is_match(&clean) {
        return Err(AppError::Validation(format!(
            "Invalid Jira domain \"{}\" — must be yourorg.atlassian.net",
            clean
        )));
    }

    Ok(clean)
}
