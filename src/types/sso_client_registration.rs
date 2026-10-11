use serde::{Deserialize, Serialize};

/// OIDC public client registered with IAM Identity Center.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoClientRegistration {
    pub client_id: String,
    pub client_secret: String,
    /// Epoch milliseconds.
    pub expires_at: i64,
}
