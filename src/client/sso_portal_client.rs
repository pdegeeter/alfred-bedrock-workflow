use std::sync::Arc;
use std::thread;

use anyhow::{anyhow, bail};
use serde_json::Value;

use crate::error::SsoUnauthorizedError;
use crate::helper::{JsonField, UriEncoder};
use crate::types::{AwsCredentials, HttpClient};

/// Client of the IAM Identity Center portal API (accounts, roles, role credentials).
pub struct SsoPortalClient {
    access_token: String,
    base_url: String,
    http: Arc<dyn HttpClient>,
}

impl SsoPortalClient {
    const PAGE_SIZE: &str = "100";

    pub fn new(region: &str, access_token: String, http: Arc<dyn HttpClient>) -> Self {
        Self {
            access_token,
            base_url: format!("https://portal.sso.{region}.amazonaws.com"),
            http,
        }
    }

    /// Temporary credentials of a role the user is assigned to.
    ///
    /// # Errors
    /// `SsoUnauthorizedError` when the access token is rejected, a generic error otherwise.
    pub fn get_role_credentials(&self, account_id: &str, role_name: &str) -> anyhow::Result<AwsCredentials> {
        let data = self.get(
            "/federation/credentials",
            &[("account_id", account_id), ("role_name", role_name)],
        )?;
        let credentials = &data["roleCredentials"];

        Ok(AwsCredentials {
            access_key_id: JsonField::string(credentials, "accessKeyId")?,
            expiration: Some(JsonField::integer(credentials, "expiration")?),
            secret_access_key: JsonField::string(credentials, "secretAccessKey")?,
            session_token: Some(JsonField::string(credentials, "sessionToken")?),
        })
    }

    /// Finds the only account in which the user is assigned the role.
    ///
    /// # Errors
    /// When no account or several accounts expose the role.
    pub fn find_account_id_for_role(&self, role_name: &str) -> anyhow::Result<String> {
        let account_ids = self.list_account_ids()?;
        let lookups: Vec<anyhow::Result<bool>> = thread::scope(|scope| {
            let handles: Vec<_> = account_ids
                .iter()
                .map(|account_id| scope.spawn(move || self.exposes_role(account_id, role_name)))
                .collect();

            handles
                .into_iter()
                .map(|handle| handle.join().unwrap_or_else(|_| Err(anyhow!("Role lookup failed"))))
                .collect()
        });
        let mut matches = Vec::new();
        for (account_id, exposes_role) in account_ids.into_iter().zip(lookups) {
            if exposes_role? {
                matches.push(account_id);
            }
        }

        match matches.len() {
            0 => bail!("No account exposes the SSO role \"{role_name}\""),
            1 => Ok(matches.remove(0)),
            _ => bail!("Several accounts expose the SSO role \"{role_name}\": set sso_account_id"),
        }
    }

    fn exposes_role(&self, account_id: &str, role_name: &str) -> anyhow::Result<bool> {
        let roles = self.paginate("/assignment/roles", "roleList", &[("account_id", account_id)])?;

        Ok(roles.iter().any(|role| role["roleName"].as_str() == Some(role_name)))
    }

    fn list_account_ids(&self) -> anyhow::Result<Vec<String>> {
        self.paginate("/assignment/accounts", "accountList", &[])?
            .iter()
            .map(|account| JsonField::string(account, "accountId"))
            .collect()
    }

    fn paginate(&self, path: &str, list_key: &str, params: &[(&str, &str)]) -> anyhow::Result<Vec<Value>> {
        let mut items = Vec::new();
        let mut next_token: Option<String> = None;

        loop {
            let mut page_params = params.to_vec();
            page_params.push(("max_result", Self::PAGE_SIZE));
            if let Some(token) = &next_token {
                page_params.push(("next_token", token));
            }

            let mut data = self.get(path, &page_params)?;
            if let Value::Array(page) = data[list_key].take() {
                items.extend(page);
            }
            next_token = JsonField::optional_string(&data, "nextToken");

            if next_token.is_none() {
                return Ok(items);
            }
        }
    }

    fn get(&self, path: &str, params: &[(&str, &str)]) -> anyhow::Result<Value> {
        let query: Vec<String> = params
            .iter()
            .map(|(key, value)| format!("{}={}", UriEncoder::encode(key), UriEncoder::encode(value)))
            .collect();
        let url = format!("{}{path}?{}", self.base_url, query.join("&"));
        let response = self.http.get(&url, &[("x-amz-sso_bearer_token", &self.access_token)])?;

        if response.status == 401 {
            return Err(SsoUnauthorizedError::new("SSO session expired or revoked").into());
        }
        if !response.is_success() {
            bail!("SSO portal error: {} {}", response.status, response.body);
        }

        response.json()
    }
}
