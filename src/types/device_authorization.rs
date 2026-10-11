use serde::{Deserialize, Serialize};

/// Pending OIDC device authorization awaiting user approval in the browser.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthorization {
    pub device_code: String,
    /// Epoch milliseconds.
    pub expires_at: i64,
    /// Polling interval in seconds.
    pub interval: u64,
    pub verification_uri_complete: String,
}
