use std::rc::Rc;
use std::sync::Arc;

use super::SsoAuthService;
use crate::client::SsoPortalClient;
use crate::error::SsoUnauthorizedError;
use crate::helper::TokenCache;
use crate::types::{AwsCredentials, CredentialsSource, HttpClient, SsoConfig, UrlOpener};

/// Role credentials from IAM Identity Center, with the built-in browser login.
pub struct SsoCredentialsSource {
    auth: SsoAuthService,
    cache: Rc<TokenCache>,
    config: SsoConfig,
    http: Arc<dyn HttpClient>,
}

impl SsoCredentialsSource {
    pub fn new(config: SsoConfig, cache: Rc<TokenCache>, http: Arc<dyn HttpClient>, opener: Rc<dyn UrlOpener>) -> Self {
        Self {
            auth: SsoAuthService::new(&config, Rc::clone(&cache), Arc::clone(&http), opener),
            cache,
            config,
            http,
        }
    }

    /// Cache scope of an SSO configuration, needed to build its cache before the source.
    pub fn scope_of(config: &SsoConfig) -> String {
        format!("sso:{}|{}", config.start_url, config.region)
    }

    fn fetch_credentials(&self) -> anyhow::Result<AwsCredentials> {
        let role_name = &self.config.role_name;
        let portal = SsoPortalClient::new(
            &self.config.region,
            self.auth.get_access_token()?,
            Arc::clone(&self.http),
        );
        let cached_account_id = self.cache.load().resolved_account_ids.get(role_name).cloned();
        let account_id = match self.config.account_id.clone().or(cached_account_id) {
            Some(account_id) => account_id,
            None => portal.find_account_id_for_role(role_name)?,
        };

        self.cache.update(|state| {
            state.resolved_account_ids.insert(role_name.clone(), account_id.clone());
        })?;

        portal.get_role_credentials(&account_id, role_name)
    }
}

impl CredentialsSource for SsoCredentialsSource {
    fn cache_scope(&self) -> String {
        Self::scope_of(&self.config)
    }

    fn key_prefix(&self) -> String {
        format!(
            "{}:{}",
            self.config.account_id.as_deref().unwrap_or("auto"),
            self.config.role_name
        )
    }

    fn get_credentials(&self) -> anyhow::Result<AwsCredentials> {
        match self.fetch_credentials() {
            Err(error) if error.is::<SsoUnauthorizedError>() => {
                self.auth.invalidate()?;

                self.fetch_credentials()
            }
            result => result,
        }
    }
}
