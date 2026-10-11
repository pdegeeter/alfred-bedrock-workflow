import type { BedrockKey } from "./BedrockKey.js";
import type { DeviceAuthorization } from "./DeviceAuthorization.js";
import type { SsoClientRegistration } from "./SsoClientRegistration.js";
import type { SsoToken } from "./SsoToken.js";

/**
 * Persisted authentication state, scoped to one credentials source.
 */
export interface TokenCacheState {
  /** Keyed by `<source key prefix>:<region>`. */
  bedrockKeys: Record<string, BedrockKey | undefined>;
  pendingAuthorization?: DeviceAuthorization;
  registration?: SsoClientRegistration;
  /** Keyed by role name. */
  resolvedAccountIds: Record<string, string | undefined>;
  /** Credentials source the entries belong to. */
  scope: string;
  ssoToken?: SsoToken;
}
