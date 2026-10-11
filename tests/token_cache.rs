//! Authentication cache persisted on disk.

use std::fs;
use std::os::unix::fs::PermissionsExt;

use alfred_bedrock::helper::TokenCache;
use alfred_bedrock::types::TokenCacheState;
use tempfile::TempDir;

#[test]
fn returns_an_empty_state_when_the_file_is_missing() {
    let dir = TempDir::new().unwrap();

    let state = TokenCache::new(dir.path().join("auth.json"), "scope-a".to_owned()).load();

    assert_eq!(
        state,
        TokenCacheState {
            scope: "scope-a".to_owned(),
            ..TokenCacheState::default()
        }
    );
}

#[test]
fn persists_updates_readable_only_by_the_owner() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("nested").join("auth.json");

    TokenCache::new(path.clone(), "scope-a".to_owned())
        .update(|state| {
            state
                .resolved_account_ids
                .insert("Role".to_owned(), "111122223333".to_owned());
        })
        .unwrap();

    let state = TokenCache::new(path.clone(), "scope-a".to_owned()).load();
    assert_eq!(state.resolved_account_ids["Role"], "111122223333");
    assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
    assert_eq!(
        fs::metadata(dir.path().join("nested")).unwrap().permissions().mode() & 0o777,
        0o700
    );
}

#[test]
fn discards_state_from_another_scope() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("auth.json");
    TokenCache::new(path.clone(), "scope-a".to_owned())
        .update(|state| {
            state
                .resolved_account_ids
                .insert("Role".to_owned(), "111122223333".to_owned());
        })
        .unwrap();

    let state = TokenCache::new(path, "scope-b".to_owned()).load();

    assert!(state.resolved_account_ids.is_empty());
}

#[test]
fn treats_a_corrupt_file_as_empty() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("auth.json");
    fs::write(&path, "{not json").unwrap();

    let state = TokenCache::new(path, "scope-a".to_owned()).load();

    assert!(state.bedrock_keys.is_empty());
}

#[test]
fn reads_the_cache_written_by_the_typescript_workflow() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("auth.json");
    fs::write(
        &path,
        r#"{"bedrockKeys":{"auto:BedrockUser:eu-west-1":{"expiresAt":1768476600000,"token":"bedrock-api-key-x"}},"resolvedAccountIds":{"BedrockUser":"111122223333"},"scope":"sso:https://my-org.awsapps.com/start|eu-west-1","ssoToken":{"accessToken":"access","expiresAt":1768476600000,"refreshToken":"refresh"},"registration":{"clientId":"id","clientSecret":"secret","expiresAt":1776252600000}}"#,
    )
    .unwrap();

    let state = TokenCache::new(path, "sso:https://my-org.awsapps.com/start|eu-west-1".to_owned()).load();

    assert_eq!(
        state.bedrock_keys["auto:BedrockUser:eu-west-1"].token,
        "bedrock-api-key-x"
    );
    assert_eq!(state.sso_token.unwrap().refresh_token.as_deref(), Some("refresh"));
    assert_eq!(state.registration.unwrap().client_id, "id");
}
