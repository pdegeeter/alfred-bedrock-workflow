use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::bail;
use serde_json::{Value, json};

use crate::helper::{Clock, JsonField};
use crate::types::{DeviceAuthorization, HttpClient, HttpResponse, SsoClientRegistration, SsoToken};

/// Client of the IAM Identity Center OIDC API (device authorization grant).
pub struct SsoOidcClient {
    base_url: String,
    http: Arc<dyn HttpClient>,
}

impl SsoOidcClient {
    const CLIENT_NAME: &str = "alfred-bedrock-workflow";
    const DEFAULT_INTERVAL_SECONDS: u64 = 5;
    const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
    const SCOPES: [&str; 1] = ["sso:account:access"];
    /// Extra delay RFC 8628 asks for on a `slow_down` error.
    const SLOW_DOWN_SECONDS: u64 = 5;

    pub fn new(region: &str, http: Arc<dyn HttpClient>) -> Self {
        Self {
            base_url: format!("https://oidc.{region}.amazonaws.com"),
            http,
        }
    }

    /// Registers a public OIDC client. Requesting scopes makes `CreateToken` return a refresh token.
    ///
    /// # Errors
    /// When the API call fails.
    pub fn register(&self) -> anyhow::Result<SsoClientRegistration> {
        let data = self.post(
            "/client/register",
            &json!({ "clientName": Self::CLIENT_NAME, "clientType": "public", "scopes": Self::SCOPES }),
        )?;

        Ok(SsoClientRegistration {
            client_id: JsonField::string(&data, "clientId")?,
            client_secret: JsonField::string(&data, "clientSecret")?,
            expires_at: JsonField::integer(&data, "clientSecretExpiresAt")? * 1000,
        })
    }

    /// Starts a device authorization the user approves in the browser.
    ///
    /// # Errors
    /// When the API call fails.
    pub fn start_device_authorization(
        &self,
        registration: &SsoClientRegistration,
        start_url: &str,
    ) -> anyhow::Result<DeviceAuthorization> {
        let data = self.post(
            "/device_authorization",
            &json!({
                "clientId": registration.client_id,
                "clientSecret": registration.client_secret,
                "startUrl": start_url,
            }),
        )?;

        Ok(DeviceAuthorization {
            device_code: JsonField::string(&data, "deviceCode")?,
            expires_at: Clock::now_ms() + JsonField::integer(&data, "expiresIn")? * 1000,
            interval: data["interval"].as_u64().unwrap_or(Self::DEFAULT_INTERVAL_SECONDS),
            verification_uri_complete: JsonField::string(&data, "verificationUriComplete")?,
        })
    }

    /// Polls `CreateToken` until the user approves the device authorization.
    ///
    /// # Errors
    /// When the authorization is denied or expires.
    pub fn wait_for_device_token(
        &self,
        registration: &SsoClientRegistration,
        authorization: &DeviceAuthorization,
    ) -> anyhow::Result<SsoToken> {
        let mut interval = authorization.interval;
        let body = json!({
            "clientId": registration.client_id,
            "clientSecret": registration.client_secret,
            "deviceCode": authorization.device_code,
            "grantType": Self::DEVICE_GRANT,
        });

        while Clock::now_ms() < authorization.expires_at {
            let response = self.request("/token", &body)?;

            if response.is_success() {
                return Self::to_token(&response.json()?);
            }

            match Self::error_of(&response).as_str() {
                "authorization_pending" => {}
                "slow_down" => interval += Self::SLOW_DOWN_SECONDS,
                error => bail!("SSO login failed: {error}"),
            }
            thread::sleep(Duration::from_secs(interval));
        }

        bail!("SSO login timed out: authorization was not approved in time")
    }

    /// Exchanges a refresh token for a new access token.
    ///
    /// # Errors
    /// When the refresh token is expired or revoked.
    pub fn refresh(&self, registration: &SsoClientRegistration, refresh_token: &str) -> anyhow::Result<SsoToken> {
        let data = self.post(
            "/token",
            &json!({
                "clientId": registration.client_id,
                "clientSecret": registration.client_secret,
                "grantType": "refresh_token",
                "refreshToken": refresh_token,
            }),
        )?;

        Self::to_token(&data)
    }

    fn post(&self, path: &str, body: &Value) -> anyhow::Result<Value> {
        let response = self.request(path, body)?;

        if !response.is_success() {
            bail!("SSO OIDC error: {} {}", response.status, Self::error_of(&response));
        }

        response.json()
    }

    fn request(&self, path: &str, body: &Value) -> anyhow::Result<HttpResponse> {
        self.http.post(
            &format!("{}{path}", self.base_url),
            &[("Content-Type", "application/json")],
            &body.to_string(),
        )
    }

    fn error_of(response: &HttpResponse) -> String {
        response
            .json()
            .ok()
            .and_then(|data| JsonField::optional_string(&data, "error"))
            .unwrap_or_else(|| response.body.clone())
    }

    fn to_token(data: &Value) -> anyhow::Result<SsoToken> {
        Ok(SsoToken {
            access_token: JsonField::string(data, "accessToken")?,
            expires_at: Clock::now_ms() + JsonField::integer(data, "expiresIn")? * 1000,
            refresh_token: JsonField::optional_string(data, "refreshToken"),
        })
    }
}
