//! AWS CLI wrapper, running a fake `aws` executable.

mod fixture;

use alfred_bedrock::client::AwsCliClient;
use alfred_bedrock::types::AwsCredentials;
use fixture::FakeAwsCli;

#[test]
fn parses_temporary_credentials() {
    let aws = FakeAwsCli::new();
    aws.set_expiration("2026-01-15T11:00:00+00:00");

    let credentials = AwsCliClient::locate(Some(&aws.path()))
        .export_credentials("my-profile")
        .unwrap();

    assert_eq!(
        credentials,
        AwsCredentials {
            access_key_id: "ASIA".to_owned(),
            expiration: Some(1_768_474_800_000),
            secret_access_key: "SK".to_owned(),
            session_token: Some("ST".to_owned()),
        }
    );
    assert_eq!(
        aws.calls(),
        ["configure export-credentials --profile my-profile --format process"]
    );
}

#[test]
fn parses_long_term_credentials() {
    let aws = FakeAwsCli::new();
    aws.set_mode("long-term");

    let credentials = AwsCliClient::locate(Some(&aws.path()))
        .export_credentials("my-profile")
        .unwrap();

    assert_eq!(
        credentials,
        AwsCredentials {
            access_key_id: "AKIALONGTERM".to_owned(),
            expiration: None,
            secret_access_key: "SK".to_owned(),
            session_token: None,
        }
    );
}

#[test]
fn surfaces_the_aws_cli_error_message() {
    let aws = FakeAwsCli::new();
    aws.set_mode("missing-profile");

    let error = AwsCliClient::locate(Some(&aws.path()))
        .export_credentials("unknown")
        .unwrap_err();

    assert_eq!(
        error.to_string(),
        "aws configure export-credentials failed: The config profile (unknown) could not be found"
    );
}

#[test]
fn reports_a_missing_aws_cli() {
    let error = AwsCliClient::locate(Some("/nonexistent/aws"))
        .export_credentials("my-profile")
        .unwrap_err();

    assert_eq!(
        error.to_string(),
        "AWS CLI not found at /nonexistent/aws: install it or set aws_cli_path"
    );
}

#[test]
fn runs_aws_sso_login_for_the_profile() {
    let aws = FakeAwsCli::new();

    AwsCliClient::locate(Some(&aws.path())).sso_login("my-profile").unwrap();

    assert_eq!(aws.calls(), ["sso login --profile my-profile"]);
}

#[test]
fn puts_its_own_and_homebrew_directories_first_on_the_path_of_credential_helpers() {
    let aws = FakeAwsCli::new();

    AwsCliClient::locate(Some(&aws.path()))
        .export_credentials("my-profile")
        .unwrap();

    let expected_prefix = format!("{}:/opt/homebrew/bin:/usr/local/bin:", aws.dir().display());
    assert!(aws.last_path().starts_with(&expected_prefix), "{}", aws.last_path());
}
