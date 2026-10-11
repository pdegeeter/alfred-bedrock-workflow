use std::fs;
use std::path::{Path, PathBuf};

use alfred_bedrock::types::TokenCacheState;

/// Direct access to `auth.json`, standing in for the passage of time: tests expire entries instead of waiting.
pub struct CacheFile {
    path: PathBuf,
}

impl CacheFile {
    pub fn new(cache_dir: &Path) -> Self {
        Self {
            path: cache_dir.join("auth.json"),
        }
    }

    pub fn read(&self) -> TokenCacheState {
        serde_json::from_str(&fs::read_to_string(&self.path).unwrap()).unwrap()
    }

    pub fn edit(&self, mutate: impl FnOnce(&mut TokenCacheState)) {
        let mut state = self.read();
        mutate(&mut state);
        fs::write(&self.path, serde_json::to_string(&state).unwrap()).unwrap();
    }

    pub fn expire_bedrock_keys(&self) {
        self.edit(|state| state.bedrock_keys.values_mut().for_each(|key| key.expires_at = 0));
    }

    pub fn expire_sso_token(&self) {
        self.edit(|state| state.sso_token.as_mut().unwrap().expires_at = 0);
    }
}
