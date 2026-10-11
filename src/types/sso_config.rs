/// IAM Identity Center settings used to generate Bedrock keys.
#[derive(Clone, Debug)]
pub struct SsoConfig {
    /// Resolved from the role name when `None`.
    pub account_id: Option<String>,
    pub region: String,
    pub role_name: String,
    pub start_url: String,
}
