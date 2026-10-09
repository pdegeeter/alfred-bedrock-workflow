import type { BedrockKey } from "./BedrockKey.js";
import type { DeviceAuthorization } from "./DeviceAuthorization.js";
import type { SsoClientRegistration } from "./SsoClientRegistration.js";
import type { SsoToken } from "./SsoToken.js";

/**
 * Persisted authentication state, scoped to one SSO start URL and region.
 */
export interface TokenCacheState {
  /** Keyed by `<accountId>:<roleName>:<region>`. */
  bedrockKeys: Record<string, BedrockKey | undefined>;
  pendingAuthorization?: DeviceAuthorization;
  registration?: SsoClientRegistration;
  /** Keyed by role name. */
  resolvedAccountIds: Record<string, string | undefined>;
  /** `<startUrl>|<region>` the SSO entries belong to. */
  scope: string;
  ssoToken?: SsoToken;
}
