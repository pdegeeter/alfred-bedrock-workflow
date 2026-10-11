//! IAM Identity Center OIDC calls, against a stub transport.

mod fixture;

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use alfred_bedrock::client::SsoOidcClient;
use alfred_bedrock::helper::Clock;
use alfred_bedrock::types::{DeviceAuthorization, SsoClientRegistration};
use fixture::StubHttpClient;
use serde_json::json;

fn registration() -> SsoClientRegistration {
    SsoClientRegistration {
        client_id: "id".to_owned(),
        client_secret: "secret".to_owned(),
        expires_at: i64::MAX,
    }
}

fn authorization(expires_at: i64) -> DeviceAuthorization {
    DeviceAuthorization {
        device_code: "device".to_owned(),
        expires_at,
        interval: 0,
        verification_uri_complete: "https://verify".to_owned(),
    }
}

#[test]
fn registers_a_public_client_with_the_account_access_scope() {
    let http = Arc::new(StubHttpClient::always(
        200,
        &json!({ "clientId": "id", "clientSecret": "secret", "clientSecretExpiresAt": 1_800_000_000 }).to_string(),
    ));

    let result = SsoOidcClient::new("eu-west-1", Arc::clone(&http) as _)
        .register()
        .unwrap();

    let request = &http.requests()[0];
    assert_eq!(
        result,
        SsoClientRegistration {
            expires_at: 1_800_000_000_000,
            ..registration()
        }
    );
    assert_eq!(request.url, "https://oidc.eu-west-1.amazonaws.com/client/register");
    assert_eq!(
        request.json(),
        json!({ "clientName": "alfred-bedrock-workflow", "clientType": "public", "scopes": ["sso:account:access"] })
    );
}

#[test]
fn reports_the_oidc_error_code() {
    let http = Arc::new(StubHttpClient::always(
        400,
        &json!({ "error": "invalid_request" }).to_string(),
    ));

    let error = SsoOidcClient::new("eu-west-1", http).register().unwrap_err();

    assert_eq!(error.to_string(), "SSO OIDC error: 400 invalid_request");
}

#[test]
fn returns_the_verification_url_and_absolute_expiry() {
    let http = Arc::new(StubHttpClient::always(
        200,
        &json!({ "deviceCode": "device", "expiresIn": 600, "interval": 1, "verificationUriComplete": "https://verify" })
            .to_string(),
    ));
    let before = Clock::now_ms();

    let result = SsoOidcClient::new("eu-west-1", Arc::clone(&http) as _)
        .start_device_authorization(&registration(), "https://my-org.awsapps.com/start")
        .unwrap();

    assert_eq!(result.device_code, "device");
    assert_eq!(result.interval, 1);
    assert_eq!(result.verification_uri_complete, "https://verify");
    assert!(result.expires_at >= before + 600_000);
    assert_eq!(
        http.requests()[0].json()["startUrl"],
        "https://my-org.awsapps.com/start"
    );
}

#[test]
fn polls_until_the_user_approves() {
    let polls = AtomicUsize::new(0);
    let http = Arc::new(StubHttpClient::new(move |_| {
        if polls.fetch_add(1, Ordering::SeqCst) == 0 {
            return (400, json!({ "error": "authorization_pending" }).to_string());
        }

        (
            200,
            json!({ "accessToken": "access", "expiresIn": 28_800, "refreshToken": "refresh" }).to_string(),
        )
    }));

    let token = SsoOidcClient::new("eu-west-1", Arc::clone(&http) as _)
        .wait_for_device_token(&registration(), &authorization(Clock::now_ms() + 60_000))
        .unwrap();

    assert_eq!(token.access_token, "access");
    assert_eq!(token.refresh_token.as_deref(), Some("refresh"));
    assert_eq!(http.requests().len(), 2);
    assert_eq!(
        http.requests()[0].json()["grantType"],
        "urn:ietf:params:oauth:grant-type:device_code"
    );
}

#[test]
fn fails_when_the_user_denies_the_login() {
    let http = Arc::new(StubHttpClient::always(
        400,
        &json!({ "error": "access_denied" }).to_string(),
    ));

    let error = SsoOidcClient::new("eu-west-1", http)
        .wait_for_device_token(&registration(), &authorization(Clock::now_ms() + 60_000))
        .unwrap_err();

    assert_eq!(error.to_string(), "SSO login failed: access_denied");
}

#[test]
fn fails_when_the_authorization_already_expired() {
    let http = Arc::new(StubHttpClient::always(
        400,
        &json!({ "error": "authorization_pending" }).to_string(),
    ));

    let error = SsoOidcClient::new("eu-west-1", Arc::clone(&http) as _)
        .wait_for_device_token(&registration(), &authorization(Clock::now_ms() - 1))
        .unwrap_err();

    assert_eq!(
        error.to_string(),
        "SSO login timed out: authorization was not approved in time"
    );
    assert!(http.requests().is_empty());
}

#[test]
fn exchanges_the_refresh_token() {
    let http = Arc::new(StubHttpClient::always(
        200,
        &json!({ "accessToken": "new-access", "expiresIn": 28_800 }).to_string(),
    ));

    let token = SsoOidcClient::new("eu-west-1", Arc::clone(&http) as _)
        .refresh(&registration(), "refresh")
        .unwrap();

    assert_eq!(token.access_token, "new-access");
    assert_eq!(token.refresh_token, None);
    assert_eq!(
        http.requests()[0].json(),
        json!({ "clientId": "id", "clientSecret": "secret", "grantType": "refresh_token", "refreshToken": "refresh" })
    );
}
