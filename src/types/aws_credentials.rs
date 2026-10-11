/// AWS credentials used to sign Bedrock short-term keys.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AwsCredentials {
    pub access_key_id: String,
    /// Epoch milliseconds; `None` for long-term credentials.
    pub expiration: Option<i64>,
    pub secret_access_key: String,
    /// `None` for long-term credentials.
    pub session_token: Option<String>,
}
