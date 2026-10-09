import type { TokenCacheState } from "../Type/TokenCacheState.js";
import { JsonFileStore } from "./JsonFileStore.js";

/**
 * Persisted authentication state. Entries from another SSO scope are discarded.
 */
export class TokenCache {
  private readonly scope: string;
  private readonly store: JsonFileStore<TokenCacheState>;

  /**
   * @param path - Cache file path
   * @param scope - Identifies the SSO instance (start URL and region)
   */
  constructor(path: string, scope: string) {
    this.scope = scope;
    this.store = new JsonFileStore(path);
  }

  load(): TokenCacheState {
    const state = this.store.read();

    if (state?.scope !== this.scope) {
      return { bedrockKeys: {}, resolvedAccountIds: {}, scope: this.scope };
    }

    return state;
  }

  /**
   * Re-reads the state, applies the mutation and persists it.
   */
  update(mutate: (state: TokenCacheState) => void): void {
    const state = this.load();
    mutate(state);
    this.store.write(state);
  }
}
