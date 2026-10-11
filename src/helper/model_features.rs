/// Request features supported by a Bedrock Claude model.
/// Claude 5 models take an effort level and reject sampling parameters; older models the reverse.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ModelFeatures {
    /// Largest `maxTokens` the model accepts; it only caps the output, it is not reserved.
    pub max_output_tokens: u32,
    pub uses_effort: bool,
}

impl ModelFeatures {
    /// Output limit of models this type does not know.
    const DEFAULT_MAX_OUTPUT_TOKENS: u32 = 4096;
    const FAMILIES: [&str; 5] = ["fable", "haiku", "mythos", "opus", "sonnet"];
    const MARKER: &str = "claude-";

    pub fn new(model_id: &str) -> Self {
        let (family, major, minor) = Self::version_of(model_id).unwrap_or(("", 0, 0));

        Self {
            max_output_tokens: Self::max_output_tokens_of(family, major, minor),
            uses_effort: major >= 5,
        }
    }

    /// Family, major and single-digit minor version following `claude-`, as in
    /// `claude-opus-4-1-20250805` (minor 1) or `claude-sonnet-4-20250514` (no minor).
    fn version_of(model_id: &str) -> Option<(&'static str, u32, u32)> {
        model_id
            .match_indices(Self::MARKER)
            .find_map(|(index, _)| Self::version_after_marker(&model_id[index + Self::MARKER.len()..]))
    }

    fn version_after_marker(rest: &str) -> Option<(&'static str, u32, u32)> {
        let family = Self::FAMILIES
            .into_iter()
            .find(|family| rest.strip_prefix(family).is_some_and(|after| after.starts_with('-')))?;
        let rest = &rest[family.len() + 1..];
        let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
        let major = rest[..digits].parse().ok()?;

        let minor = match rest.as_bytes()[digits..] {
            [b'-', minor, next, ..] if minor.is_ascii_digit() && !next.is_ascii_digit() => u32::from(minor - b'0'),
            [b'-', minor] if minor.is_ascii_digit() => u32::from(minor - b'0'),
            _ => 0,
        };

        Some((family, major, minor))
    }

    fn max_output_tokens_of(family: &str, major: u32, minor: u32) -> u32 {
        if major >= 5 {
            return 128_000;
        }
        if major == 4 && family == "opus" && minor < 5 {
            return 32_000;
        }
        if major == 4 {
            return 64_000;
        }

        Self::DEFAULT_MAX_OUTPUT_TOKENS
    }
}

#[cfg(test)]
mod tests {
    use super::ModelFeatures;

    #[test]
    fn uses_effort_for_claude_5_models() {
        for model_id in [
            "eu.anthropic.claude-haiku-5-5",
            "us.anthropic.claude-haiku-5-5",
            "global.anthropic.claude-haiku-5-5",
            "eu.anthropic.claude-sonnet-5-5",
            "us.anthropic.claude-sonnet-5",
            "anthropic.claude-opus-5",
        ] {
            assert!(ModelFeatures::new(model_id).uses_effort, "{model_id}");
        }
    }

    #[test]
    fn does_not_use_effort_for_older_models() {
        for model_id in [
            "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
            "us.anthropic.claude-sonnet-4-20250514-v1:0",
            "eu.anthropic.claude-3-haiku-20240307-v1:0",
            "amazon.nova-pro-v1:0",
        ] {
            assert!(!ModelFeatures::new(model_id).uses_effort, "{model_id}");
        }
    }

    #[test]
    fn max_output_tokens_follows_the_model_generation() {
        for (model_id, expected) in [
            ("eu.anthropic.claude-haiku-5-5", 128_000),
            ("global.anthropic.claude-sonnet-5-5", 128_000),
            ("eu.anthropic.claude-sonnet-5", 128_000),
            ("global.anthropic.claude-opus-5-5", 128_000),
            ("eu.anthropic.claude-haiku-4-5-20251001-v1:0", 64_000),
            ("us.anthropic.claude-sonnet-4-20250514-v1:0", 64_000),
            ("us.anthropic.claude-opus-4-1-20250805-v1:0", 32_000),
            ("us.anthropic.claude-opus-4-5-20251101-v1:0", 64_000),
            ("eu.anthropic.claude-3-haiku-20240307-v1:0", 4096),
            ("amazon.nova-pro-v1:0", 4096),
        ] {
            assert_eq!(ModelFeatures::new(model_id).max_output_tokens, expected, "{model_id}");
        }
    }
}
