use std::error::Error;
use std::fmt::{self, Display, Formatter};

/// Raised when IAM Identity Center rejects the access token (expired or revoked).
#[derive(Debug)]
pub struct SsoUnauthorizedError {
    message: String,
}

impl SsoUnauthorizedError {
    pub fn new(message: &str) -> Self {
        Self {
            message: message.to_owned(),
        }
    }
}

impl Display for SsoUnauthorizedError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for SsoUnauthorizedError {}
