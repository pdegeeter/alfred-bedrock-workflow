use std::time::Duration;

use ureq::http::Response;
use ureq::{Agent, Body};

use crate::types::{HttpClient, HttpResponse};

/// Blocking HTTPS client, with TLS and root certificates built into the binary.
pub struct UreqHttpClient {
    agent: Agent,
}

impl UreqHttpClient {
    const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
    const USER_AGENT: &str = concat!("alfred-bedrock-workflow/", env!("CARGO_PKG_VERSION"));

    pub fn new() -> Self {
        let agent = Agent::config_builder()
            .http_status_as_error(false)
            .timeout_connect(Some(Self::CONNECT_TIMEOUT))
            .user_agent(Self::USER_AGENT)
            .build()
            .into();

        Self { agent }
    }

    fn read(mut response: Response<Body>) -> anyhow::Result<HttpResponse> {
        let status = response.status().as_u16();
        let body = response.body_mut().read_to_string()?;

        Ok(HttpResponse { body, status })
    }
}

impl Default for UreqHttpClient {
    fn default() -> Self {
        Self::new()
    }
}

impl HttpClient for UreqHttpClient {
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> anyhow::Result<HttpResponse> {
        let mut request = self.agent.get(url);
        for (name, value) in headers {
            request = request.header(*name, *value);
        }

        Self::read(request.call()?)
    }

    fn post(&self, url: &str, headers: &[(&str, &str)], body: &str) -> anyhow::Result<HttpResponse> {
        let mut request = self.agent.post(url);
        for (name, value) in headers {
            request = request.header(*name, *value);
        }

        Self::read(request.send(body)?)
    }
}
