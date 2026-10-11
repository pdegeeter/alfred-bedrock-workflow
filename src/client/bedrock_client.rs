use std::sync::Arc;

use anyhow::bail;
use serde_json::{Value, json};

use crate::helper::{ModelFeatures, RegionDetector};
use crate::types::{BedrockConfig, HttpClient};

/// Client of the Amazon Bedrock Runtime Converse API.
pub struct BedrockClient {
    config: BedrockConfig,
    features: ModelFeatures,
    http: Arc<dyn HttpClient>,
    region: &'static str,
}

impl BedrockClient {
    /// Stop reasons for which the model or a guardrail declined to answer.
    const DECLINED: [&str; 3] = ["content_filtered", "guardrail_intervened", "refusal"];
    const TEMPERATURE: f64 = 0.7;
    const TRUNCATED: &str = "\n\n_[Response truncated: output limit reached]_";

    pub fn new(config: BedrockConfig, http: Arc<dyn HttpClient>) -> Self {
        Self {
            features: ModelFeatures::new(&config.model_id),
            region: RegionDetector::detect(&config.model_id),
            config,
            http,
        }
    }

    /// Sends a single user message and returns the text of the answer.
    ///
    /// # Errors
    /// When the API call fails or the model declines the request.
    pub fn chat(&self, message: &str) -> anyhow::Result<String> {
        let url = format!(
            "https://bedrock-runtime.{}.amazonaws.com/model/{}/converse",
            self.region, self.config.model_id
        );
        let authorization = format!("Bearer {}", self.config.token);
        let response = self.http.post(
            &url,
            &[("Authorization", &authorization), ("Content-Type", "application/json")],
            &self.request_body(message).to_string(),
        )?;

        if !response.is_success() {
            bail!("Bedrock API error: {} {}", response.status, response.body);
        }

        let data = response.json()?;
        // Reasoning blocks have no text and may precede the answer.
        let text: String = data["output"]["message"]["content"]
            .as_array()
            .map(|blocks| blocks.iter().filter_map(|block| block["text"].as_str()).collect())
            .unwrap_or_default();

        match data["stopReason"].as_str() {
            Some(reason) if Self::DECLINED.contains(&reason) => bail!("Bedrock declined the request ({reason})"),
            Some("max_tokens") => Ok(format!("{text}{}", Self::TRUNCATED)),
            _ => Ok(text),
        }
    }

    fn request_body(&self, message: &str) -> Value {
        let mut body = json!({
            "inferenceConfig": { "maxTokens": self.features.max_output_tokens },
            "messages": [{ "content": [{ "text": message }], "role": "user" }],
        });

        if !self.features.uses_effort {
            body["inferenceConfig"]["temperature"] = json!(Self::TEMPERATURE);
        } else if let Some(effort) = self.config.effort {
            body["additionalModelRequestFields"] = json!({ "output_config": { "effort": effort.as_str() } });
        }
        if let Some(system_prompt) = &self.config.system_prompt {
            body["system"] = json!([{ "text": system_prompt }]);
        }

        body
    }
}
