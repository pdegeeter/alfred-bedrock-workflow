//! Profile credentials and the `aws sso login` retry, running a fake `aws` executable.

mod fixture;

use alfred_bedrock::client::AwsCliClient;
use alfred_bedrock::service::AwsProfileCredentialsSource;
use alfred_bedrock::types::CredentialsSource;
use fixture::FakeAwsCli;

fn source(aws: &FakeAwsCli, profile: &str) -> AwsProfileCredentialsSource {
    AwsProfileCredentialsSource::new(profile, AwsCliClient::locate(Some(&aws.path())))
}

#[test]
fn returns_the_profile_credentials_without_login_when_the_session_is_valid() {
    let aws = FakeAwsCli::new();

    let credentials = source(&aws, "my-profile").get_credentials().unwrap();

    assert_eq!(credentials.access_key_id, "ASIA");
    assert_eq!(
        aws.calls(),
        ["configure export-credentials --profile my-profile --format process"]
    );
}

#[test]
fn logs_in_and_retries_once_when_the_sso_session_expired() {
    let aws = FakeAwsCli::new();
    aws.set_mode("expired");

    let credentials = source(&aws, "my-profile").get_credentials().unwrap();

    assert_eq!(credentials.session_token.as_deref(), Some("ST"));
    assert_eq!(
        aws.calls(),
        [
            "configure export-credentials --profile my-profile --format process",
            "sso login --profile my-profile",
            "configure export-credentials --profile my-profile --format process",
        ]
    );
}

#[test]
fn does_not_log_in_for_unrelated_errors() {
    let aws = FakeAwsCli::new();
    aws.set_mode("missing-profile");

    let error = source(&aws, "my-sso-token-profile").get_credentials().unwrap_err();

    assert!(error.to_string().contains("could not be found"));
    assert_eq!(aws.calls().len(), 1);
}

#[test]
fn scopes_the_cache_to_the_profile() {
    let aws = FakeAwsCli::new();
    let source = source(&aws, "my-profile");

    assert_eq!(source.cache_scope(), "profile:my-profile");
    assert_eq!(source.key_prefix(), "my-profile");
}
