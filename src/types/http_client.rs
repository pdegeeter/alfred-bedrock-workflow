use super::HttpResponse;

/// Outbound HTTPS port. Non-2xx statuses are returned as responses, not errors.
pub trait HttpClient: Send + Sync {
    /// # Errors
    /// On a transport failure (DNS, TLS, connection).
    fn get(&self, url: &str, headers: &[(&str, &str)]) -> anyhow::Result<HttpResponse>;

    /// # Errors
    /// On a transport failure (DNS, TLS, connection).
    fn post(&self, url: &str, headers: &[(&str, &str)], body: &str) -> anyhow::Result<HttpResponse>;
}
