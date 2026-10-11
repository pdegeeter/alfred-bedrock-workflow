use std::sync::Mutex;

use alfred_bedrock::types::{HttpClient, HttpResponse};

use super::RecordedRequest;

type Handler = dyn Fn(&RecordedRequest) -> (u16, String) + Send + Sync;

/// Answers each request with the handler and records it.
pub struct StubHttpClient {
    handler: Box<Handler>,
    requests: Mutex<Vec<RecordedRequest>>,
}

impl StubHttpClient {
    pub fn new(handler: impl Fn(&RecordedRequest) -> (u16, String) + Send + Sync + 'static) -> Self {
        Self {
            handler: Box::new(handler),
            requests: Mutex::new(Vec::new()),
        }
    }

    /// Same response to every request.
    pub fn always(status: u16, body: &str) -> Self {
        let body = body.to_owned();

        Self::new(move |_| (status, body.clone()))
    }

    pub fn requests(&self) -> Vec<RecordedRequest> {
        self.requests.lock().unwrap().clone()
    }

    fn handle(&self, request: RecordedRequest) -> HttpResponse {
        let (status, body) = (self.handler)(&request);
        self.requests.lock().unwrap().push(request);

        HttpResponse { body, status }
    }

    fn headers_of(headers: &[(&str, &str)]) -> Vec<(String, String)> {
        headers
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect()
    }
}

impl HttpClient for StubHttpClient {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> anyhow::Result<HttpResponse> {
        Ok(self.handle(RecordedRequest {
            body: None,
            headers: Self::headers_of(headers),
            method: "GET",
            url: url.to_owned(),
        }))
    }

    fn post(&self, url: &str, headers: &[(&str, &str)], body: &str) -> anyhow::Result<HttpResponse> {
        Ok(self.handle(RecordedRequest {
            body: Some(body.to_owned()),
            headers: Self::headers_of(headers),
            method: "POST",
            url: url.to_owned(),
        }))
    }
}
