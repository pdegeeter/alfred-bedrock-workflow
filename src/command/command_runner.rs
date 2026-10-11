use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;

use crate::client::BedrockClient;
use crate::helper::RegionDetector;
use crate::service::BedrockTokenProvider;
use crate::types::{BedrockConfig, EffortLevel, HttpClient, UrlOpener};

/// Sends a prompt to the model selected in the workflow variables.
pub struct CommandRunner {
    http: Arc<dyn HttpClient>,
    opener: Rc<dyn UrlOpener>,
    variables: HashMap<String, String>,
}

impl CommandRunner {
    const DEFAULT_MODEL: &str = "eu.anthropic.claude-haiku-5-5";
    /// Closest to Claude Haiku 4.5, which ran without thinking.
    const DEFAULT_LEVEL: &str = "low";

    pub fn new(variables: HashMap<String, String>, http: Arc<dyn HttpClient>, opener: Rc<dyn UrlOpener>) -> Self {
        Self {
            http,
            opener,
            variables,
        }
    }

    /// Workflow variable, `None` when unset or empty.
    pub fn variable(&self, name: &str) -> Option<&str> {
        self.variables
            .get(name)
            .map(String::as_str)
            .filter(|value| !value.is_empty())
    }

    /// # Errors
    /// When the configuration is invalid, no token can be obtained or the model call fails.
    pub fn ask(&self, system_prompt: Option<&str>, message: &str) -> anyhow::Result<String> {
        let model = self.variable("model").unwrap_or(Self::DEFAULT_MODEL);
        let effort = EffortLevel::parse(self.variable("level").unwrap_or(Self::DEFAULT_LEVEL))?;
        let token =
            BedrockTokenProvider::from_environment(&self.variables, Arc::clone(&self.http), Rc::clone(&self.opener))?
                .get_token(RegionDetector::detect(model))?;
        let config = BedrockConfig {
            effort: Some(effort),
            model_id: model.to_owned(),
            system_prompt: system_prompt.map(str::to_owned),
            token,
        };

        BedrockClient::new(config, Arc::clone(&self.http)).chat(message)
    }
}
