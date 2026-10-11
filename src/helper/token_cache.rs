use std::path::PathBuf;

use super::JsonFileStore;
use crate::types::TokenCacheState;

/// Persisted authentication state. Entries from another credentials source are discarded.
pub struct TokenCache {
    scope: String,
    store: JsonFileStore<TokenCacheState>,
}

impl TokenCache {
    /// `scope` identifies the credentials source owning the state.
    pub fn new(path: PathBuf, scope: String) -> Self {
        Self {
            scope,
            store: JsonFileStore::new(path),
        }
    }

    pub fn load(&self) -> TokenCacheState {
        match self.store.read() {
            Some(state) if state.scope == self.scope => state,
            _ => TokenCacheState {
                scope: self.scope.clone(),
                ..TokenCacheState::default()
            },
        }
    }

    /// Re-reads the state, applies the mutation and persists it.
    ///
    /// # Errors
    /// When the cache file cannot be written.
    pub fn update(&self, mutate: impl FnOnce(&mut TokenCacheState)) -> anyhow::Result<()> {
        let mut state = self.load();
        mutate(&mut state);

        self.store.write(&state)
    }
}
