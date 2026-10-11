use super::EffortLevel;

/// Configuration of a `BedrockClient`.
#[derive(Clone, Debug)]
pub struct BedrockConfig {
    /// Ignored by models that do not support effort.
    pub effort: Option<EffortLevel>,
    pub model_id: String,
    pub system_prompt: Option<String>,
    pub token: String,
}
