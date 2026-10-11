use serde_json::Value;

use super::CommandRunner;
use crate::helper::AlfredOutput;

/// `bedrock`: free-form question.
pub struct BedrockCommand;

impl BedrockCommand {
    /// # Errors
    /// When the model cannot be called.
    pub fn run(runner: &CommandRunner, query: &str) -> anyhow::Result<Value> {
        if query.is_empty() {
            return Ok(AlfredOutput::error("Please enter a message"));
        }

        Ok(AlfredOutput::response(&runner.ask(None, query)?))
    }
}
