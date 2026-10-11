use super::AwsCredentials;

/// Provides the AWS credentials used to sign Bedrock short-term keys.
pub trait CredentialsSource {
    /// Identifies the cached state owned by this source; state from another scope is discarded.
    fn cache_scope(&self) -> String;

    /// Prefix of the cached key identifiers, completed with the region.
    fn key_prefix(&self) -> String;

    fn get_credentials(&self) -> anyhow::Result<AwsCredentials>;
}
