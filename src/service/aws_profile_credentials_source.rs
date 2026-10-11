use crate::client::AwsCliClient;
use crate::types::{AwsCredentials, CredentialsSource};

/// Credentials from an AWS CLI profile. Login is delegated to the profile's own tooling
/// (`credential_process` such as Granted, or `aws sso login` for native SSO profiles).
pub struct AwsProfileCredentialsSource {
    cli: AwsCliClient,
    profile: String,
}

impl AwsProfileCredentialsSource {
    /// AWS CLI messages for an expired IAM Identity Center session, the only case `aws sso login` fixes.
    const EXPIRED_SSO_SESSION: [&str; 2] = [
        "token has expired and refresh failed",
        "sso session associated with this profile has expired",
    ];

    pub fn new(profile: &str, cli: AwsCliClient) -> Self {
        Self {
            cli,
            profile: profile.to_owned(),
        }
    }

    fn is_expired_sso_session(error: &anyhow::Error) -> bool {
        let message = error.to_string().to_lowercase();

        Self::EXPIRED_SSO_SESSION
            .iter()
            .any(|pattern| message.contains(pattern))
    }
}

impl CredentialsSource for AwsProfileCredentialsSource {
    fn cache_scope(&self) -> String {
        format!("profile:{}", self.profile)
    }

    fn key_prefix(&self) -> String {
        self.profile.clone()
    }

    fn get_credentials(&self) -> anyhow::Result<AwsCredentials> {
        match self.cli.export_credentials(&self.profile) {
            Err(error) if Self::is_expired_sso_session(&error) => {
                self.cli.sso_login(&self.profile)?;

                self.cli.export_credentials(&self.profile)
            }
            result => result,
        }
    }
}
