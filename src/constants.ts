/** Shared application constants */

// HTTP
export const HTTP_TIMEOUT_MS = 30_000;

// Jira API
export const JIRA_PAGE_SIZE = 100;
export const JIRA_MAX_ISSUES = 10_000;
export const JIRA_RATE_LIMIT_DELAY_MS = 200;

// Working hours
export const MAX_WORKING_DAYS_CAP = 400;

// Date defaults
export const DEFAULT_DATE_RANGE_DAYS = 14;

// Vault
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 12;

// Domain validation
export const JIRA_DOMAIN_PATTERN = /^[\w-]+\.atlassian\.net$/;

// Staffing signal thresholds
export const QUEUE_PRESSURE_GROWTH_FACTOR = 1.2;
export const QUEUE_PRESSURE_SHRINK_FACTOR = 0.8;
export const TTFT_TREND_GROWTH_FACTOR = 1.2;
export const TTFT_TREND_SHRINK_FACTOR = 0.8;
export const SURGE_CAPACITY_MULTIPLIER = 1.5;
export const INCIDENT_COST_DROP_THRESHOLD = 0.7;

// Closure burst detection
export const BURST_THRESHOLD_COUNT = 5;
export const BURST_WINDOW_MINUTES = 30;

// Surge detection
export const SURGE_INTAKE_MULTIPLIER = 2.0;
export const SURGE_ABSORPTION_CLOSE_RATIO = 0.7;
export const MIN_SURGE_DETECTION_DAYS = 5;

// Stalled ticket detection
export const STALLED_THRESHOLD_HOURS = 48;

// Cluster analysis
export const CLUSTER_RECURRENCE_CRITICAL_RATE = 0.5;
export const CLUSTER_RECURRENCE_REQUIRED_RATE = 0.3;

// KPI thresholds
export const TTFT_RED_HOURS = 8;
export const TTFT_YELLOW_HOURS = 4;
export const VELOCITY_RED_THRESHOLD = -5;

// Projection
export const SEASONAL_MIN_DAYS = 180;
export const PROJECTION_HORIZONS = [30, 60, 90] as const;

// After-hours
export const AFTER_HOURS_BURNOUT_THRESHOLD = 0.15;

// Chart heights
export const CHART_HEIGHT_DEFAULT = 280;
export const CHART_HEIGHT_TALL = 320;

// Responsive breakpoints (desktop only — no mobile)
export const BREAKPOINT_NARROW = 1024;
export const BREAKPOINT_WIDE = 1280;
export const SIDEBAR_WIDTH = 288;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
