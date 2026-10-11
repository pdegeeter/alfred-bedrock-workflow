use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::{BedrockKey, DeviceAuthorization, SsoClientRegistration, SsoToken};

/// Persisted authentication state, scoped to one credentials source. Same layout as the v1 `auth.json`.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenCacheState {
    /// Keyed by `<source key prefix>:<region>`.
    #[serde(default)]
    pub bedrock_keys: BTreeMap<String, BedrockKey>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_authorization: Option<DeviceAuthorization>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub registration: Option<SsoClientRegistration>,
    /// Keyed by role name.
    #[serde(default)]
    pub resolved_account_ids: BTreeMap<String, String>,
    /// Credentials source the entries belong to.
    pub scope: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sso_token: Option<SsoToken>,
}
