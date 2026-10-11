use anyhow::Context;
use serde_json::Value;

/// Typed reads of AWS JSON response fields.
pub struct JsonField;

impl JsonField {
    /// # Errors
    /// When the field is missing or not a string.
    pub fn string(value: &Value, key: &str) -> anyhow::Result<String> {
        Self::optional_string(value, key).with_context(|| format!("Missing field \"{key}\" in AWS response"))
    }

    /// # Errors
    /// When the field is missing or not an integer.
    pub fn integer(value: &Value, key: &str) -> anyhow::Result<i64> {
        value
            .get(key)
            .and_then(Value::as_i64)
            .with_context(|| format!("Missing field \"{key}\" in AWS response"))
    }

    pub fn optional_string(value: &Value, key: &str) -> Option<String> {
        value.get(key).and_then(Value::as_str).map(str::to_owned)
    }
}
