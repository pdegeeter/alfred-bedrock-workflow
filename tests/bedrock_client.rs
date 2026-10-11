//! Converse request and response handling, against a stub transport.

mod fixture;

use std::sync::Arc;

use alfred_bedrock::client::BedrockClient;
use alfred_bedrock::types::{BedrockConfig, EffortLevel};
use fixture::StubHttpClient;
use serde_json::{Value, json};

fn client(http: &Arc<StubHttpClient>, model_id: &str, effort: Option<EffortLevel>) -> BedrockClient {
    let config = BedrockConfig {
        effort,
        model_id: model_id.to_owned(),
        system_prompt: None,
        token: "test-token".to_owned(),
    };

    BedrockClient::new(config, Arc::clone(http) as _)
}

fn answering(content: &Value, stop_reason: &str) -> Arc<StubHttpClient> {
    Arc::new(StubHttpClient::always(
        200,
        &json!({ "output": { "message": { "content": content } }, "stopReason": stop_reason }).to_string(),
    ))
}

#[test]
fn sends_the_message_with_the_bearer_token_to_the_region_of_the_model() {
    let http = answering(&json!([{ "text": "Hello from Bedrock!" }]), "end_turn");

    let result = client(&http, "eu.anthropic.claude-haiku-5-5", None)
        .chat("Hello")
        .unwrap();

    let request = &http.requests()[0];
    assert_eq!(result, "Hello from Bedrock!");
    assert_eq!(
        request.url,
        "https://bedrock-runtime.eu-west-1.amazonaws.com/model/eu.anthropic.claude-haiku-5-5/converse"
    );
    assert_eq!(request.header("Authorization"), Some("Bearer test-token"));
    assert_eq!(
        request.json()["messages"],
        json!([{ "content": [{ "text": "Hello" }], "role": "user" }])
    );
}

#[test]
fn sends_the_system_prompt_when_set() {
    let http = answering(&json!([{ "text": "OK" }]), "end_turn");
    let config = BedrockConfig {
        effort: None,
        model_id: "eu.anthropic.claude-haiku-5-5".to_owned(),
        system_prompt: Some("Be terse".to_owned()),
        token: "t".to_owned(),
    };

    BedrockClient::new(config, Arc::clone(&http) as _).chat("Hi").unwrap();

    assert_eq!(http.requests()[0].json()["system"], json!([{ "text": "Be terse" }]));
}

#[test]
fn sends_the_effort_level_without_temperature_to_claude_5_models() {
    let http = answering(&json!([{ "text": "OK" }]), "end_turn");

    client(&http, "eu.anthropic.claude-haiku-5-5", Some(EffortLevel::Low))
        .chat("Hi")
        .unwrap();

    let body = http.requests()[0].json();
    assert_eq!(
        body["additionalModelRequestFields"],
        json!({ "output_config": { "effort": "low" } })
    );
    assert_eq!(body["inferenceConfig"], json!({ "maxTokens": 128_000 }));
}

#[test]
fn lets_claude_5_models_use_their_default_effort_when_no_level_is_set() {
    let http = answering(&json!([{ "text": "OK" }]), "end_turn");

    client(&http, "eu.anthropic.claude-haiku-5-5", None).chat("Hi").unwrap();

    assert!(http.requests()[0].json().get("additionalModelRequestFields").is_none());
}

#[test]
fn sends_temperature_without_effort_to_older_models() {
    let http = answering(&json!([{ "text": "OK" }]), "end_turn");

    client(
        &http,
        "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        Some(EffortLevel::High),
    )
    .chat("Hi")
    .unwrap();

    let body = http.requests()[0].json();
    assert!(body.get("additionalModelRequestFields").is_none());
    assert_eq!(
        body["inferenceConfig"],
        json!({ "maxTokens": 64_000, "temperature": 0.7 })
    );
}

#[test]
fn skips_reasoning_blocks_and_joins_the_text_blocks() {
    let http = answering(
        &json!([{ "reasoningContent": { "reasoningText": { "text": "" } } }, { "text": "Hello " }, { "text": "world" }]),
        "end_turn",
    );

    let result = client(&http, "eu.anthropic.claude-haiku-5-5", None).chat("Hi").unwrap();

    assert_eq!(result, "Hello world");
}

#[test]
fn returns_an_empty_string_without_output() {
    let http = Arc::new(StubHttpClient::always(200, "{}"));

    let result = client(&http, "eu.anthropic.claude-haiku-5-5", None).chat("Hi").unwrap();

    assert_eq!(result, "");
}

#[test]
fn fails_with_the_status_and_body_on_api_errors() {
    let http = Arc::new(StubHttpClient::always(401, "Unauthorized"));

    let error = client(&http, "eu.anthropic.claude-haiku-5-5", None)
        .chat("Hi")
        .unwrap_err();

    assert_eq!(error.to_string(), "Bedrock API error: 401 Unauthorized");
}

#[test]
fn fails_when_the_model_declines_the_request() {
    for stop_reason in ["refusal", "content_filtered", "guardrail_intervened"] {
        let http = answering(&json!([]), stop_reason);

        let error = client(&http, "eu.anthropic.claude-haiku-5-5", None)
            .chat("Hi")
            .unwrap_err();

        assert_eq!(
            error.to_string(),
            format!("Bedrock declined the request ({stop_reason})")
        );
    }
}

#[test]
fn flags_a_response_cut_at_the_output_limit() {
    let http = answering(&json!([{ "text": "Partial" }]), "max_tokens");

    let result = client(&http, "eu.anthropic.claude-haiku-5-5", None).chat("Hi").unwrap();

    assert_eq!(result, "Partial\n\n_[Response truncated: output limit reached]_");
}
