use std::rc::Rc;
use std::sync::Arc;

use crate::client::SsoOidcClient;
use crate::helper::{Clock, TokenCache};
use crate::types::{HttpClient, SsoClientRegistration, SsoConfig, SsoToken, UrlOpener};

/// Maintains an IAM Identity Center access token: cache, then refresh token, then browser login.
pub struct SsoAuthService {
    cache: Rc<TokenCache>,
    oidc: SsoOidcClient,
    opener: Rc<dyn UrlOpener>,
    start_url: String,
}

impl SsoAuthService {
    const REGISTRATION_MARGIN_MS: i64 = 24 * 60 * 60 * 1000;
    const TOKEN_MARGIN_MS: i64 = 60 * 1000;

    pub fn new(
        config: &SsoConfig,
        cache: Rc<TokenCache>,
        http: Arc<dyn HttpClient>,
        opener: Rc<dyn UrlOpener>,
    ) -> Self {
        Self {
            cache,
            oidc: SsoOidcClient::new(&config.region, http),
            opener,
            start_url: config.start_url.clone(),
        }
    }

    /// A valid access token. May open the browser and wait for the user to approve the login.
    ///
    /// # Errors
    /// When the login fails or is not approved in time.
    pub fn get_access_token(&self) -> anyhow::Result<String> {
        if let Some(token) = self.cache.load().sso_token
            && token.expires_at - Self::TOKEN_MARGIN_MS > Clock::now_ms()
        {
            return Ok(token.access_token);
        }

        let registration = self.get_registration()?;
        // Re-read: a new registration drops the tokens issued to the previous client.
        let refresh_token = self.cache.load().sso_token.and_then(|token| token.refresh_token);

        // A failed refresh means the SSO session ended: fall back to an interactive login.
        if let Some(refreshed) = refresh_token.and_then(|refresh_token| {
            self.oidc
                .refresh(&registration, &refresh_token)
                .ok()
                .map(|token| SsoToken {
                    refresh_token: token.refresh_token.clone().or(Some(refresh_token)),
                    ..token
                })
        }) {
            let access_token = refreshed.access_token.clone();
            self.cache.update(|state| state.sso_token = Some(refreshed))?;

            return Ok(access_token);
        }

        self.login(&registration)
    }

    /// Drops the cached access token so the next call logs in again.
    ///
    /// # Errors
    /// When the cache cannot be written.
    pub fn invalidate(&self) -> anyhow::Result<()> {
        self.cache.update(|state| state.sso_token = None)
    }

    fn login(&self, registration: &SsoClientRegistration) -> anyhow::Result<String> {
        // A pending authorization survives Alfred killing the process while the user approves in the browser.
        let pending = self
            .cache
            .load()
            .pending_authorization
            .filter(|authorization| authorization.expires_at > Clock::now_ms());
        let authorization = if let Some(authorization) = pending {
            authorization
        } else {
            let authorization = self.oidc.start_device_authorization(registration, &self.start_url)?;
            self.cache
                .update(|state| state.pending_authorization = Some(authorization.clone()))?;
            self.opener.open(&authorization.verification_uri_complete)?;

            authorization
        };

        match self.oidc.wait_for_device_token(registration, &authorization) {
            Ok(token) => {
                let access_token = token.access_token.clone();
                self.cache.update(|state| {
                    state.sso_token = Some(token);
                    state.pending_authorization = None;
                })?;

                Ok(access_token)
            }
            Err(error) => {
                self.cache.update(|state| state.pending_authorization = None)?;

                Err(error)
            }
        }
    }

    fn get_registration(&self) -> anyhow::Result<SsoClientRegistration> {
        if let Some(registration) = self.cache.load().registration
            && registration.expires_at - Self::REGISTRATION_MARGIN_MS > Clock::now_ms()
        {
            return Ok(registration);
        }

        let registration = self.oidc.register()?;
        self.cache.update(|state| {
            state.registration = Some(registration.clone());
            // Tokens and authorizations are bound to the previous client.
            state.pending_authorization = None;
            state.sso_token = None;
        })?;

        Ok(registration)
    }
}
