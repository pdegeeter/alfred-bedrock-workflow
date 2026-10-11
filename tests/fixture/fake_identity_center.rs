use std::sync::Mutex;

use alfred_bedrock::helper::Clock;
use alfred_bedrock::types::{HttpClient, HttpResponse};
use serde_json::{Value, json};

/// IAM Identity Center OIDC and portal APIs, recording the paths called.
pub struct FakeIdentityCenter {
    calls: Mutex<Vec<String>>,
    credentials_ttl_ms: Mutex<i64>,
    /// Status returned by the next `GetRoleCredentials` call, then reset to 200.
    next_credentials_status: Mutex<u16>,
}

impl FakeIdentityCenter {
    pub fn new() -> Self {
        Self {
            calls: Mutex::new(Vec::new()),
            credentials_ttl_ms: Mutex::new(3_600_000),
            next_credentials_status: Mutex::new(200),
        }
    }

    pub fn calls(&self) -> Vec<String> {
        self.calls.lock().unwrap().clone()
    }

    pub fn clear_calls(&self) {
        self.calls.lock().unwrap().clear();
    }

    pub fn set_credentials_ttl_ms(&self, ttl_ms: i64) {
        *self.credentials_ttl_ms.lock().unwrap() = ttl_ms;
    }

    pub fn fail_next_credentials(&self, status: u16) {
        *self.next_credentials_status.lock().unwrap() = status;
    }

    fn respond(&self, url: &str) -> HttpResponse {
        let path = url
            .split('?')
            .next()
            .unwrap()
            .splitn(4, '/')
            .nth(3)
            .map(|path| format!("/{path}"))
            .unwrap();
        let mut calls = self.calls.lock().unwrap();
        calls.push(path.clone());
        let now = Clock::now_ms();

        let (status, body): (u16, Value) = match path.as_str() {
            "/client/register" => (
                200,
                json!({ "clientId": "client", "clientSecret": "secret", "clientSecretExpiresAt": now / 1000 + 7_776_000 }),
            ),
            "/device_authorization" => (
                200,
                json!({ "deviceCode": "device", "expiresIn": 600, "interval": 0, "verificationUriComplete": "https://verify" }),
            ),
            "/token" => (
                200,
                json!({ "accessToken": format!("access-{}", calls.len()), "expiresIn": 28_800, "refreshToken": "refresh" }),
            ),
            "/assignment/accounts" => (200, json!({ "accountList": [{ "accountId": "111122223333" }] })),
            "/assignment/roles" => (200, json!({ "roleList": [{ "roleName": "BedrockUser" }] })),
            "/federation/credentials" => {
                let status = std::mem::replace(&mut *self.next_credentials_status.lock().unwrap(), 200);
                let expiration = now + *self.credentials_ttl_ms.lock().unwrap();

                if status == 200 {
                    (
                        200,
                        json!({ "roleCredentials": {
                            "accessKeyId": "AK", "expiration": expiration, "secretAccessKey": "SK", "sessionToken": "ST",
                        } }),
                    )
                } else {
                    (status, json!({ "message": "expired" }))
                }
            }
            other => panic!("Unexpected call {other}"),
        };

        HttpResponse {
            body: body.to_string(),
            status,
        }
    }
}

impl HttpClient for FakeIdentityCenter {
    fn get(&self, url: &str, _headers: &[(&str, &str)]) -> anyhow::Result<HttpResponse> {
        Ok(self.respond(url))
    }

    fn post(&self, url: &str, _headers: &[(&str, &str)], _body: &str) -> anyhow::Result<HttpResponse> {
        Ok(self.respond(url))
    }
}
