use serde::{Deserialize, Serialize};

/// Cached Bedrock short-term API key.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BedrockKey {
    /// Epoch milliseconds: min(generation + 12h, credentials expiration).
    pub expires_at: i64,
    pub token: String,
}
