use anyhow::Context;
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct HttpResponse {
    pub body: String,
    pub status: u16,
}

impl HttpResponse {
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    /// # Errors
    /// When the body is not JSON.
    pub fn json(&self) -> anyhow::Result<Value> {
        serde_json::from_str(&self.body).with_context(|| format!("Invalid JSON response: {}", self.body))
    }
}
