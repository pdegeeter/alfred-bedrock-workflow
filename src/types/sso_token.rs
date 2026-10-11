use serde::{Deserialize, Serialize};

/// IAM Identity Center access token.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoToken {
    pub access_token: String,
    /// Epoch milliseconds.
    pub expires_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
}
