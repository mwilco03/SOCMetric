use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub domain: String,
    pub email: String,
    pub api_token: String,
}
