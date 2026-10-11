use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};
use time::OffsetDateTime;
use time::UtcOffset;
use time::macros::format_description;

use super::UriEncoder;
use crate::types::AwsCredentials;

/// Generates Bedrock short-term API keys from AWS credentials.
/// Byte-for-byte equivalent to `@aws/bedrock-token-generator`: a `SigV4` presigned
/// `CallWithBearerToken` URL, base64-encoded and prefixed.
pub struct BedrockTokenGenerator {
    region: String,
}

impl BedrockTokenGenerator {
    pub const MAX_TTL_SECONDS: i64 = 43200;

    const ALGORITHM: &str = "AWS4-HMAC-SHA256";
    const HOST: &str = "bedrock.amazonaws.com";
    const PREFIX: &str = "bedrock-api-key-";
    const SERVICE: &str = "bedrock";
    const VERSION: &str = "&Version=1";

    /// `region`: AWS region the keys will be used in.
    pub fn new(region: &str) -> Self {
        Self {
            region: region.to_owned(),
        }
    }

    /// Generates a short-term API key bound to the region, signed at `now`.
    pub fn generate(&self, credentials: &AwsCredentials, now: OffsetDateTime) -> String {
        let amz_date = now
            .to_offset(UtcOffset::UTC)
            .format(format_description!("[year][month][day]T[hour][minute][second]Z"))
            .expect("a UTC date always formats");
        let date_stamp = &amz_date[..8];
        let scope = format!("{date_stamp}/{}/{}/aws4_request", self.region, Self::SERVICE);

        let mut params = BTreeMap::from([
            ("Action", "CallWithBearerToken".to_owned()),
            ("X-Amz-Algorithm", Self::ALGORITHM.to_owned()),
            ("X-Amz-Credential", format!("{}/{scope}", credentials.access_key_id)),
            ("X-Amz-Date", amz_date.clone()),
            ("X-Amz-Expires", Self::MAX_TTL_SECONDS.to_string()),
            ("X-Amz-SignedHeaders", "host".to_owned()),
        ]);
        if let Some(session_token) = &credentials.session_token {
            params.insert("X-Amz-Security-Token", session_token.clone());
        }

        let canonical_request = [
            "POST",
            "/",
            &Self::build_query(&params),
            &format!("host:{}", Self::HOST),
            "",
            "host",
            &Self::sha256(""),
        ]
        .join("\n");
        let string_to_sign = [Self::ALGORITHM, &amz_date, &scope, &Self::sha256(&canonical_request)].join("\n");

        let signing_key = [date_stamp, self.region.as_str(), Self::SERVICE, "aws4_request"]
            .iter()
            .fold(
                format!("AWS4{}", credentials.secret_access_key).into_bytes(),
                |key, part| Self::hmac(&key, part),
            );
        params.insert(
            "X-Amz-Signature",
            hex::encode(Self::hmac(&signing_key, &string_to_sign)),
        );

        let url = format!("{}/?{}{}", Self::HOST, Self::build_query(&params), Self::VERSION);

        format!("{}{}", Self::PREFIX, STANDARD.encode(url))
    }

    fn build_query(params: &BTreeMap<&str, String>) -> String {
        params
            .iter()
            .map(|(key, value)| format!("{}={}", UriEncoder::encode(key), UriEncoder::encode(value)))
            .collect::<Vec<_>>()
            .join("&")
    }

    fn hmac(key: &[u8], data: &str) -> Vec<u8> {
        let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts keys of any length");
        mac.update(data.as_bytes());

        mac.finalize().into_bytes().to_vec()
    }

    fn sha256(data: &str) -> String {
        hex::encode(Sha256::digest(data.as_bytes()))
    }
}

#[cfg(test)]
mod tests {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;
    use time::macros::datetime;

    use super::BedrockTokenGenerator;
    use crate::types::AwsCredentials;

    fn session_credentials() -> AwsCredentials {
        AwsCredentials {
            access_key_id: "ASIAEXAMPLEKEY123".to_owned(),
            expiration: Some(1_768_476_600_000),
            secret_access_key: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY".to_owned(),
            session_token: Some("session/token+value==".to_owned()),
        }
    }

    fn decode(token: &str) -> String {
        let encoded = token.strip_prefix("bedrock-api-key-").unwrap();

        String::from_utf8(STANDARD.decode(encoded).unwrap()).unwrap()
    }

    #[test]
    fn matches_the_token_produced_by_the_aws_generator() {
        // Reference generated with @aws/bedrock-token-generator 1.1.0 for the same inputs.
        let expected = "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFTSUFFWEFNUExFS0VZMTIzJTJGMjAyNjAxMTUlMkZldS13ZXN0LTElMkZiZWRyb2NrJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjAxMTVUMTAzMDAwWiZYLUFtei1FeHBpcmVzPTQzMjAwJlgtQW16LVNlY3VyaXR5LVRva2VuPXNlc3Npb24lMkZ0b2tlbiUyQnZhbHVlJTNEJTNEJlgtQW16LVNpZ25hdHVyZT0wYTJmZWMzZGQ4NGU2MDU0YzlmNWQzODQ5NmQ5OGUxZjhmNDEzNWI1MDlhZDJjZWFlNGUyNmJkZjBiMGMzZDY4JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZWZXJzaW9uPTE=";

        let token = BedrockTokenGenerator::new("eu-west-1")
            .generate(&session_credentials(), datetime!(2026-01-15 10:30:00 UTC));

        assert_eq!(token, expected);
    }

    #[test]
    fn binds_the_key_to_the_requested_region() {
        let token = BedrockTokenGenerator::new("us-east-1")
            .generate(&session_credentials(), datetime!(2026-01-15 10:30:00 UTC));
        let url = decode(&token);

        assert!(url.starts_with("bedrock.amazonaws.com/?Action=CallWithBearerToken&"));
        assert!(url.contains("X-Amz-Credential=ASIAEXAMPLEKEY123%2F20260115%2Fus-east-1%2Fbedrock%2Faws4_request"));
        assert!(url.contains("X-Amz-Expires=43200"));
        assert!(url.ends_with("&Version=1"));
    }

    #[test]
    fn omits_the_security_token_for_long_term_credentials() {
        let credentials = AwsCredentials {
            access_key_id: "AKIALONGTERM".to_owned(),
            expiration: None,
            secret_access_key: "secret".to_owned(),
            session_token: None,
        };

        let url =
            decode(&BedrockTokenGenerator::new("eu-west-1").generate(&credentials, datetime!(2026-01-15 10:30:00 UTC)));

        assert!(!url.contains("X-Amz-Security-Token"));
        assert!(url.contains("X-Amz-Credential=AKIALONGTERM%2F"));
    }
}
