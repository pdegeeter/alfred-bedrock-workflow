/// AWS region of a Bedrock model, from its inference profile prefix.
pub struct RegionDetector;

impl RegionDetector {
    pub fn detect(model_id: &str) -> &'static str {
        if model_id.starts_with("eu.") {
            return "eu-west-1";
        }

        "us-east-1"
    }
}

#[cfg(test)]
mod tests {
    use super::RegionDetector;

    #[test]
    fn maps_eu_profiles_to_ireland() {
        assert_eq!(RegionDetector::detect("eu.anthropic.claude-haiku-5-5"), "eu-west-1");
    }

    #[test]
    fn maps_us_global_and_unprefixed_models_to_virginia() {
        for model_id in [
            "us.anthropic.claude-haiku-5-5",
            "global.anthropic.claude-haiku-5-5",
            "amazon.nova-pro-v1:0",
        ] {
            assert_eq!(RegionDetector::detect(model_id), "us-east-1", "{model_id}");
        }
    }
}
