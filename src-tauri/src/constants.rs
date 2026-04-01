/// Shared application constants — no magic numbers, no hardcoded literals

// HTTP
pub const HTTP_TIMEOUT_SECS: u64 = 30;

// HTTP status codes
pub const HTTP_STATUS_BAD_REQUEST: u16 = 400;
pub const HTTP_STATUS_UNAUTHORIZED: u16 = 401;
pub const HTTP_STATUS_FORBIDDEN: u16 = 403;
pub const HTTP_STATUS_RATE_LIMITED: u16 = 429;

// Jira API
pub const JIRA_PAGE_SIZE: u32 = 100;
pub const JIRA_PROJECTS_PAGE_SIZE: u32 = 50;
pub const JIRA_MAX_ISSUES: usize = 10_000;
pub const JIRA_RATE_LIMIT_DELAY_MS: u64 = 200;

// Jira endpoints
pub const JIRA_ENDPOINT_MYSELF: &str = "/myself";
pub const JIRA_ENDPOINT_PROJECT_SEARCH: &str = "/project/search";
pub const JIRA_ENDPOINT_PROJECT_STATUSES: &str = "/project/{key}/statuses";
pub const JIRA_ENDPOINT_SEARCH: &str = "/search/jql";

// Jira search fields
pub const JIRA_SEARCH_FIELDS: &[&str] = &[
    "summary", "created", "updated", "resolutiondate",
    "status", "issuetype", "priority", "assignee",
    "reporter", "labels", "components",
];

// Jira expand options
pub const JIRA_EXPAND_CHANGELOG: &str = "changelog";

// Domain validation
pub const JIRA_DOMAIN_REGEX: &str = r"^[\w-]+\.atlassian\.net$";

// Keyring
pub const KEYRING_SERVICE: &str = "com.soc.dashboard";
pub const KEYRING_ACCOUNT: &str = "jira_credentials";

// Database
pub const DB_FILENAME: &str = "soc_dashboard.db";
pub const CURRENT_SCHEMA_VERSION: i32 = 1;
