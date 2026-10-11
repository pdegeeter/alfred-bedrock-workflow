//! Token resolution end to end: workflow variables, cache file on disk, fake IAM Identity Center
//! and fake `aws` executable. Expiry is simulated by editing `auth.json` rather than by moving the clock.

mod fixture;

use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;

use alfred_bedrock::helper::Clock;
use alfred_bedrock::service::BedrockTokenProvider;
use fixture::{CacheFile, FakeAwsCli, FakeIdentityCenter, RecordingOpener};
use tempfile::TempDir;

const HOUR_MS: i64 = 3_600_000;
const ALL_LOGIN_CALLS: [&str; 6] = [
    "/client/register",
    "/device_authorization",
    "/token",
    "/assignment/accounts",
    "/assignment/roles",
    "/federation/credentials",
];

struct Context {
    cache_dir: TempDir,
    idc: Arc<FakeIdentityCenter>,
    opener: Rc<RecordingOpener>,
}

impl Context {
    fn new() -> Self {
        Self {
            cache_dir: TempDir::new().unwrap(),
            idc: Arc::new(FakeIdentityCenter::new()),
            opener: Rc::default(),
        }
    }

    fn cache(&self) -> CacheFile {
        CacheFile::new(self.cache_dir.path())
    }

    /// Workflow variables with the cache directory, the IAM Identity Center settings and `extra`.
    fn sso_variables(&self, extra: &[(&str, &str)]) -> Vec<(String, String)> {
        let mut variables = self.variables(&[
            ("sso_role_name", "BedrockUser"),
            ("sso_start_url", "https://my-org.awsapps.com/start"),
        ]);
        variables.extend(
            extra
                .iter()
                .map(|(name, value)| ((*name).to_owned(), (*value).to_owned())),
        );

        variables
    }

    fn variables(&self, extra: &[(&str, &str)]) -> Vec<(String, String)> {
        let mut variables = vec![(
            "alfred_workflow_cache".to_owned(),
            self.cache_dir.path().display().to_string(),
        )];
        variables.extend(
            extra
                .iter()
                .map(|(name, value)| ((*name).to_owned(), (*value).to_owned())),
        );

        variables
    }

    fn provider(&self, variables: Vec<(String, String)>) -> anyhow::Result<BedrockTokenProvider> {
        let variables: HashMap<String, String> = variables.into_iter().collect();

        BedrockTokenProvider::from_environment(&variables, Arc::clone(&self.idc) as _, Rc::clone(&self.opener) as _)
    }

    fn token(&self, variables: Vec<(String, String)>, region: &str) -> String {
        self.provider(variables).unwrap().get_token(region).unwrap()
    }
}

mod from_environment {
    use super::*;

    #[test]
    fn prefers_the_static_token_without_calling_aws() {
        let context = Context::new();

        let token = context.token(context.sso_variables(&[("token", "static-token")]), "eu-west-1");

        assert_eq!(token, "static-token");
        assert_eq!(context.idc.calls(), Vec::<String>::new());
    }

    #[test]
    fn falls_back_to_aws_bearer_token_bedrock() {
        let context = Context::new();

        let token = context.token(
            context.variables(&[("AWS_BEARER_TOKEN_BEDROCK", "env-token")]),
            "eu-west-1",
        );

        assert_eq!(token, "env-token");
    }

    #[test]
    fn fails_when_nothing_is_configured() {
        let context = Context::new();

        let error = context
            .provider(context.variables(&[]))
            .unwrap()
            .get_token("eu-west-1")
            .unwrap_err();

        assert_eq!(
            error.to_string(),
            "Bedrock token not configured: set token, aws_profile, or sso_start_url and sso_role_name"
        );
    }

    #[test]
    fn prefers_iam_identity_center_over_aws_bearer_token_bedrock() {
        let context = Context::new();

        let token = context.token(
            context.sso_variables(&[("AWS_BEARER_TOKEN_BEDROCK", "expired-env-token")]),
            "eu-west-1",
        );

        assert!(token.starts_with("bedrock-api-key-"));
    }

    #[test]
    fn rejects_a_start_url_without_role_name() {
        let context = Context::new();

        let error = context
            .provider(context.variables(&[("sso_start_url", "https://my-org.awsapps.com/start")]))
            .err();

        assert_eq!(
            error.unwrap().to_string(),
            "Incomplete SSO configuration: set both sso_start_url and sso_role_name"
        );
    }
}

mod with_iam_identity_center {
    use super::*;

    #[test]
    fn logs_in_through_the_browser_and_returns_a_short_term_key() {
        let context = Context::new();

        let token = context.token(context.sso_variables(&[]), "eu-west-1");

        assert!(token.starts_with("bedrock-api-key-"));
        assert_eq!(context.opener.urls(), ["https://verify"]);
        assert_eq!(context.idc.calls(), ALL_LOGIN_CALLS);
    }

    #[test]
    fn reuses_the_cached_key_across_processes_while_it_is_valid() {
        let context = Context::new();
        let first = context.token(context.sso_variables(&[]), "eu-west-1");
        context.idc.clear_calls();

        let second = context.token(context.sso_variables(&[]), "eu-west-1");

        assert_eq!(second, first);
        assert_eq!(context.idc.calls(), Vec::<String>::new());
    }

    #[test]
    fn caps_the_key_lifetime_to_the_role_session_and_renews_it_without_browser() {
        let context = Context::new();
        let before = Clock::now_ms();
        context.token(context.sso_variables(&[]), "eu-west-1");

        // Role session is 1h: the key must not be served past it even though SigV4 allows 12h.
        let expires_at = context.cache().read().bedrock_keys["auto:BedrockUser:eu-west-1"].expires_at;
        assert!((before + HOUR_MS..=Clock::now_ms() + HOUR_MS).contains(&expires_at));

        context.cache().expire_bedrock_keys();
        context.idc.clear_calls();
        context.token(context.sso_variables(&[]), "eu-west-1");

        assert_eq!(context.idc.calls(), ["/federation/credentials"]);
        assert_eq!(context.opener.urls().len(), 1);
    }

    #[test]
    fn keeps_the_key_up_to_12_hours_and_refreshes_the_sso_token_silently() {
        let context = Context::new();
        context.idc.set_credentials_ttl_ms(13 * HOUR_MS);
        let before = Clock::now_ms();
        context.token(context.sso_variables(&[]), "eu-west-1");

        let expires_at = context.cache().read().bedrock_keys["auto:BedrockUser:eu-west-1"].expires_at;
        assert!((before + 12 * HOUR_MS..=Clock::now_ms() + 12 * HOUR_MS).contains(&expires_at));

        context.cache().expire_bedrock_keys();
        context.cache().expire_sso_token();
        context.idc.clear_calls();
        context.token(context.sso_variables(&[]), "eu-west-1");

        assert_eq!(context.idc.calls(), ["/token", "/federation/credentials"]);
        assert_eq!(context.opener.urls().len(), 1);
    }

    #[test]
    fn generates_one_key_per_region() {
        let context = Context::new();
        let eu = context.token(context.sso_variables(&[]), "eu-west-1");
        context.idc.clear_calls();

        let us = context.token(context.sso_variables(&[]), "us-east-1");

        assert_ne!(us, eu);
        assert_eq!(context.idc.calls(), ["/federation/credentials"]);
    }

    #[test]
    fn skips_account_discovery_when_the_account_id_is_configured() {
        let context = Context::new();

        context.token(
            context.sso_variables(&[("sso_account_id", "444455556666")]),
            "eu-west-1",
        );

        assert!(!context.idc.calls().contains(&"/assignment/accounts".to_owned()));
    }

    #[test]
    fn logs_in_again_when_the_sso_session_was_revoked() {
        let context = Context::new();
        context.token(context.sso_variables(&[]), "eu-west-1");
        context.cache().expire_bedrock_keys();
        context.idc.clear_calls();
        context.idc.fail_next_credentials(401);

        let token = context.token(context.sso_variables(&[]), "eu-west-1");

        assert!(token.starts_with("bedrock-api-key-"));
        assert_eq!(
            context.idc.calls(),
            [
                "/federation/credentials",
                "/device_authorization",
                "/token",
                "/federation/credentials"
            ]
        );
        assert_eq!(context.opener.urls().len(), 2);
    }

    #[test]
    fn resumes_a_pending_authorization_without_opening_another_tab() {
        let context = Context::new();
        context.token(context.sso_variables(&[]), "eu-west-1");
        let mut pending = None;
        context.cache().edit(|state| {
            state.bedrock_keys.clear();
            state.sso_token = None;
            pending = Some(alfred_bedrock::types::DeviceAuthorization {
                device_code: "device".to_owned(),
                expires_at: Clock::now_ms() + 600_000,
                interval: 0,
                verification_uri_complete: "https://verify".to_owned(),
            });
            state.pending_authorization.clone_from(&pending);
        });
        context.idc.clear_calls();

        context.token(context.sso_variables(&[]), "eu-west-1");

        assert_eq!(context.idc.calls(), ["/token", "/federation/credentials"]);
        assert_eq!(context.opener.urls().len(), 1);
        assert_eq!(context.cache().read().pending_authorization, None);
    }
}

mod with_an_aws_cli_profile {
    use super::*;

    fn profile_variables(context: &Context, aws: &FakeAwsCli, extra: &[(&str, &str)]) -> Vec<(String, String)> {
        let mut variables = context.variables(&[("aws_profile", "my-profile"), ("aws_cli_path", &aws.path())]);
        variables.extend(
            extra
                .iter()
                .map(|(name, value)| ((*name).to_owned(), (*value).to_owned())),
        );

        variables
    }

    #[test]
    fn signs_the_key_with_the_profile_credentials_and_caches_it() {
        let context = Context::new();
        let aws = FakeAwsCli::new();

        let first = context.token(profile_variables(&context, &aws, &[]), "eu-west-1");
        let second = context.token(profile_variables(&context, &aws, &[]), "eu-west-1");

        assert!(first.starts_with("bedrock-api-key-"));
        assert_eq!(second, first);
        assert_eq!(
            aws.calls(),
            ["configure export-credentials --profile my-profile --format process"]
        );
        assert_eq!(context.idc.calls(), Vec::<String>::new());
    }

    #[test]
    fn takes_precedence_over_the_iam_identity_center_settings() {
        let context = Context::new();
        let aws = FakeAwsCli::new();
        let variables = profile_variables(
            &context,
            &aws,
            &[
                ("sso_role_name", "BedrockUser"),
                ("sso_start_url", "https://my-org.awsapps.com/start"),
            ],
        );

        context.token(variables, "eu-west-1");

        assert_eq!(aws.calls().len(), 1);
        assert_eq!(context.idc.calls(), Vec::<String>::new());
        assert_eq!(context.opener.urls(), Vec::<String>::new());
    }

    #[test]
    fn caps_the_key_lifetime_to_the_profile_credentials_expiration() {
        let context = Context::new();
        let aws = FakeAwsCli::new();
        let soon = time::OffsetDateTime::now_utc() + time::Duration::minutes(30);
        aws.set_expiration(&soon.format(&time::format_description::well_known::Rfc3339).unwrap());
        context.token(profile_variables(&context, &aws, &[]), "eu-west-1");

        let expires_at = context.cache().read().bedrock_keys["my-profile:eu-west-1"].expires_at;
        assert_eq!(i128::from(expires_at), soon.unix_timestamp_nanos() / 1_000_000);
    }

    #[test]
    fn keeps_a_key_signed_with_long_term_credentials_for_12_hours() {
        let context = Context::new();
        let aws = FakeAwsCli::new();
        aws.set_mode("long-term");
        let before = Clock::now_ms();

        context.token(profile_variables(&context, &aws, &[]), "eu-west-1");

        let expires_at = context.cache().read().bedrock_keys["my-profile:eu-west-1"].expires_at;
        assert!((before + 12 * HOUR_MS..=Clock::now_ms() + 12 * HOUR_MS).contains(&expires_at));
    }
}
