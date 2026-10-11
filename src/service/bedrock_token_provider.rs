use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;

use anyhow::bail;
use time::OffsetDateTime;

use super::{AwsProfileCredentialsSource, SsoCredentialsSource};
use crate::client::AwsCliClient;
use crate::helper::{BedrockTokenGenerator, Clock, TokenCache};
use crate::types::{BedrockKey, CredentialsSource, HttpClient, SsoConfig, UrlOpener};

/// Resolves the Bedrock bearer token, by priority:
/// static token, AWS CLI profile, built-in IAM Identity Center login, fallback token.
/// Short-term keys are cached until they expire.
pub struct BedrockTokenProvider {
    fallback_token: Option<String>,
    source: Option<(Rc<TokenCache>, Box<dyn CredentialsSource>)>,
    static_token: Option<String>,
}

impl BedrockTokenProvider {
    const CACHE_FILE: &str = "auth.json";
    const DEFAULT_CACHE_DIR: &str = ".cache/alfred-bedrock-workflow";
    const DEFAULT_SSO_REGION: &str = "eu-west-1";
    const KEY_MARGIN_MS: i64 = 5 * 60 * 1000;

    /// Builds a provider from the Alfred workflow variables.
    ///
    /// # Errors
    /// When the SSO settings are incomplete.
    pub fn from_environment(
        variables: &HashMap<String, String>,
        http: Arc<dyn HttpClient>,
        opener: Rc<dyn UrlOpener>,
    ) -> anyhow::Result<Self> {
        let variable = |name: &str| variables.get(name).filter(|value| !value.is_empty()).cloned();
        let start_url = variable("sso_start_url");
        let role_name = variable("sso_role_name");

        if start_url.is_some() != role_name.is_some() {
            bail!("Incomplete SSO configuration: set both sso_start_url and sso_role_name");
        }

        let cache_path = variable("alfred_workflow_cache")
            .map_or_else(
                || env::home_dir().unwrap_or_default().join(Self::DEFAULT_CACHE_DIR),
                PathBuf::from,
            )
            .join(Self::CACHE_FILE);
        let source: Option<(Rc<TokenCache>, Box<dyn CredentialsSource>)> =
            match (variable("aws_profile"), start_url, role_name) {
                (Some(profile), _, _) => {
                    let cli = AwsCliClient::locate(variable("aws_cli_path").as_deref());
                    let credentials = AwsProfileCredentialsSource::new(&profile, cli);
                    let cache = Rc::new(TokenCache::new(cache_path, credentials.cache_scope()));

                    Some((cache, Box::new(credentials)))
                }
                (None, Some(start_url), Some(role_name)) => {
                    let config = SsoConfig {
                        account_id: variable("sso_account_id"),
                        region: variable("sso_region").unwrap_or_else(|| Self::DEFAULT_SSO_REGION.to_owned()),
                        role_name,
                        start_url,
                    };
                    let cache = Rc::new(TokenCache::new(cache_path, SsoCredentialsSource::scope_of(&config)));
                    let credentials = SsoCredentialsSource::new(config, Rc::clone(&cache), http, opener);

                    Some((cache, Box::new(credentials)))
                }
                _ => None,
            };

        Ok(Self {
            fallback_token: variable("AWS_BEARER_TOKEN_BEDROCK"),
            source,
            static_token: variable("token"),
        })
    }

    /// A bearer token valid for at least a few minutes. Short-term keys are bound to `region`.
    ///
    /// # Errors
    /// When nothing is configured or the credentials cannot be obtained.
    pub fn get_token(&self, region: &str) -> anyhow::Result<String> {
        if let Some(token) = &self.static_token {
            return Ok(token.clone());
        }

        let Some((cache, credentials)) = &self.source else {
            if let Some(token) = &self.fallback_token {
                return Ok(token.clone());
            }

            bail!("Bedrock token not configured: set token, aws_profile, or sso_start_url and sso_role_name");
        };

        let key_id = format!("{}:{region}", credentials.key_prefix());
        if let Some(cached) = cache.load().bedrock_keys.get(&key_id)
            && cached.expires_at - Self::KEY_MARGIN_MS > Clock::now_ms()
        {
            return Ok(cached.token.clone());
        }

        let aws_credentials = credentials.get_credentials()?;
        let token = BedrockTokenGenerator::new(region).generate(&aws_credentials, OffsetDateTime::now_utc());
        let max_expires_at = Clock::now_ms() + BedrockTokenGenerator::MAX_TTL_SECONDS * 1000;
        let expires_at = aws_credentials
            .expiration
            .map_or(max_expires_at, |expiration| expiration.min(max_expires_at));

        cache.update(|state| {
            let now = Clock::now_ms();
            state.bedrock_keys.retain(|_, key| key.expires_at > now);
            state.bedrock_keys.insert(
                key_id,
                BedrockKey {
                    expires_at,
                    token: token.clone(),
                },
            );
        })?;

        Ok(token)
    }
}
