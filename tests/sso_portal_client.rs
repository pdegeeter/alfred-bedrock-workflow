//! IAM Identity Center portal calls, against a stub transport.

mod fixture;

use std::sync::Arc;

use alfred_bedrock::client::SsoPortalClient;
use alfred_bedrock::error::SsoUnauthorizedError;
use alfred_bedrock::types::AwsCredentials;
use fixture::StubHttpClient;
use serde_json::json;

fn portal(http: &Arc<StubHttpClient>) -> SsoPortalClient {
    SsoPortalClient::new("eu-west-1", "access".to_owned(), Arc::clone(http) as _)
}

/// Accounts `111111111111` to `333333333333` over two pages; `roles_of` lists the roles of an account.
fn organization(roles_of: fn(&str) -> Vec<&'static str>) -> Arc<StubHttpClient> {
    Arc::new(StubHttpClient::new(move |request| {
        let body = if request.url.contains("/assignment/accounts") && request.url.contains("next_token=page-2") {
            json!({ "accountList": [{ "accountId": "333333333333" }] })
        } else if request.url.contains("/assignment/accounts") {
            json!({ "accountList": [{ "accountId": "111111111111" }, { "accountId": "222222222222" }], "nextToken": "page-2" })
        } else {
            let account_id = request
                .url
                .split("account_id=")
                .nth(1)
                .unwrap()
                .split('&')
                .next()
                .unwrap();
            let roles: Vec<_> = roles_of(account_id)
                .into_iter()
                .map(|name| json!({ "roleName": name }))
                .collect();

            json!({ "roleList": roles })
        };

        (200, body.to_string())
    }))
}

#[test]
fn requests_credentials_with_the_bearer_token_header() {
    let http = Arc::new(StubHttpClient::always(
        200,
        &json!({ "roleCredentials": {
            "accessKeyId": "AK", "expiration": 1_768_476_600_000_i64, "secretAccessKey": "SK", "sessionToken": "ST",
        } })
        .to_string(),
    ));

    let credentials = portal(&http)
        .get_role_credentials("111122223333", "BedrockUser")
        .unwrap();

    let request = &http.requests()[0];
    assert_eq!(
        credentials,
        AwsCredentials {
            access_key_id: "AK".to_owned(),
            expiration: Some(1_768_476_600_000),
            secret_access_key: "SK".to_owned(),
            session_token: Some("ST".to_owned()),
        }
    );
    assert_eq!(
        request.url,
        "https://portal.sso.eu-west-1.amazonaws.com/federation/credentials?account_id=111122223333&role_name=BedrockUser"
    );
    assert_eq!(request.header("x-amz-sso_bearer_token"), Some("access"));
}

#[test]
fn raises_sso_unauthorized_error_on_401() {
    let http = Arc::new(StubHttpClient::always(401, "{}"));

    let error = portal(&http)
        .get_role_credentials("111122223333", "BedrockUser")
        .unwrap_err();

    assert!(error.is::<SsoUnauthorizedError>());
}

#[test]
fn raises_a_generic_error_on_other_failures() {
    let http = Arc::new(StubHttpClient::always(500, "boom"));

    let error = portal(&http)
        .get_role_credentials("111122223333", "BedrockUser")
        .unwrap_err();

    assert!(!error.is::<SsoUnauthorizedError>());
    assert_eq!(error.to_string(), "SSO portal error: 500 boom");
}

#[test]
fn returns_the_single_account_exposing_the_role() {
    let http = organization(|account_id| {
        if account_id == "222222222222" {
            vec!["BedrockUser"]
        } else {
            vec!["Other"]
        }
    });

    assert_eq!(
        portal(&http).find_account_id_for_role("BedrockUser").unwrap(),
        "222222222222"
    );
}

#[test]
fn searches_accounts_beyond_the_first_page() {
    let http = organization(|account_id| {
        if account_id == "333333333333" {
            vec!["BedrockUser"]
        } else {
            vec![]
        }
    });

    assert_eq!(
        portal(&http).find_account_id_for_role("BedrockUser").unwrap(),
        "333333333333"
    );
}

#[test]
fn fails_when_several_accounts_expose_the_role() {
    let http = organization(|_| vec!["BedrockUser"]);

    let error = portal(&http).find_account_id_for_role("BedrockUser").unwrap_err();

    assert_eq!(
        error.to_string(),
        "Several accounts expose the SSO role \"BedrockUser\": set sso_account_id"
    );
}

#[test]
fn fails_when_no_account_exposes_the_role() {
    let http = organization(|_| vec!["Other"]);

    let error = portal(&http).find_account_id_for_role("BedrockUser").unwrap_err();

    assert_eq!(error.to_string(), "No account exposes the SSO role \"BedrockUser\"");
}
