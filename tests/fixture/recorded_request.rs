use serde_json::Value;

#[derive(Clone, Debug)]
pub struct RecordedRequest {
    pub body: Option<String>,
    pub headers: Vec<(String, String)>,
    pub method: &'static str,
    pub url: String,
}

impl RecordedRequest {
    pub fn json(&self) -> Value {
        serde_json::from_str(self.body.as_deref().unwrap()).unwrap()
    }

    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_str())
    }
}
