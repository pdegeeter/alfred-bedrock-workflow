/// RFC 3986 percent-encoding, as `SigV4` requires: only unreserved characters are kept.
pub struct UriEncoder;

impl UriEncoder {
    pub fn encode(value: &str) -> String {
        value
            .bytes()
            .map(|byte| match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => char::from(byte).to_string(),
                _ => format!("%{byte:02X}"),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::UriEncoder;

    #[test]
    fn keeps_unreserved_characters() {
        assert_eq!(UriEncoder::encode("AZaz09-_.~"), "AZaz09-_.~");
    }

    #[test]
    fn encodes_reserved_and_non_ascii_characters_in_uppercase() {
        assert_eq!(
            UriEncoder::encode("a/b+c= !'()*é"),
            "a%2Fb%2Bc%3D%20%21%27%28%29%2A%C3%A9"
        );
    }
}
