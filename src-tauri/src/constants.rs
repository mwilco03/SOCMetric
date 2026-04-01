/// Shared application constants — no magic numbers, no hardcoded literals

// HTTP
pub const HTTP_TIMEOUT_SECS: u64 = 30;

// HTTP status codes
pub const HTTP_STATUS_BAD_REQUEST: u16 = 400;
pub const HTTP_STATUS_UNAUTHORIZED: u16 = 401;
pub const HTTP_STATUS_FORBIDDEN: u16 = 403;
pub const HTTP_STATUS_RATE_LIMITED: u16 = 429;

// HTTP headers
pub const HEADER_AUTHORIZATION: &str = "Authorization";
pub const HEADER_ACCEPT: &str = "Accept";
pub const HEADER_CONTENT_TYPE: &str = "Content-Type";
pub const MEDIA_TYPE_JSON: &str = "application/json";
pub const AUTH_SCHEME_BASIC: &str = "Basic";

// Jira API
pub const JIRA_API_BASE_PATH: &str = "rest/api/3";
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

// Jira status category keys
pub const JIRA_CATEGORY_DONE: &str = "done";
pub const JIRA_CATEGORY_IN_PROGRESS: &str = "indeterminate";

// Status classifications
pub const CLASS_QUEUE: &str = "queue";
pub const CLASS_ACTIVE: &str = "active";
pub const CLASS_DONE: &str = "done";
pub const CLASS_BLOCKED: &str = "blocked";

// Confidence levels
pub const CONFIDENCE_HIGH: &str = "high";
pub const CONFIDENCE_MEDIUM: &str = "medium";

// Domain validation
pub const JIRA_DOMAIN_REGEX: &str = r"^[\w-]+\.atlassian\.net$";

// Reset tiers
pub const RESET_TIER_SETTINGS: &str = "settings";
pub const RESET_TIER_EVERYTHING: &str = "everything";

// Keyring
pub const KEYRING_SERVICE: &str = "com.soc.dashboard";
pub const KEYRING_ACCOUNT: &str = "jira_credentials";

// Database
pub const DB_FILENAME: &str = "soc_dashboard.db";
pub const CURRENT_SCHEMA_VERSION: i32 = 1;
