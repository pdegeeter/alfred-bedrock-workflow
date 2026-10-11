import { SsoPortalClient } from "../Client/SsoPortalClient.js";
import { SsoUnauthorizedError } from "../Error/SsoUnauthorizedError.js";
import type { TokenCache } from "../Helper/TokenCache.js";
import type { AwsCredentials } from "../Type/AwsCredentials.js";
import type { CredentialsSource } from "../Type/CredentialsSource.js";
import type { SsoConfig } from "../Type/SsoConfig.js";
import { SsoAuthService } from "./SsoAuthService.js";

/**
 * Role credentials from IAM Identity Center, with the built-in browser login.
 */
export class SsoCredentialsSource implements CredentialsSource {
  readonly cacheScope: string;
  readonly keyPrefix: string;

  private readonly auth: SsoAuthService;
  private readonly cache: TokenCache;
  private readonly config: SsoConfig;

  constructor(config: SsoConfig, cache: TokenCache) {
    this.auth = new SsoAuthService(config, cache);
    this.cache = cache;
    this.cacheScope = SsoCredentialsSource.scopeOf(config);
    this.config = config;
    this.keyPrefix = `${config.accountId ?? "auto"}:${config.roleName}`;
  }

  /**
   * Cache scope of an SSO configuration, needed to build its cache before the source.
   */
  static scopeOf(config: SsoConfig): string {
    return `sso:${config.startUrl}|${config.region}`;
  }

  async getCredentials(): Promise<AwsCredentials> {
    try {
      return await this.fetchCredentials();
    } catch (error) {
      if (!(error instanceof SsoUnauthorizedError)) {
        throw error;
      }

      this.auth.invalidate();

      return this.fetchCredentials();
    }
  }

  private async fetchCredentials(): Promise<AwsCredentials> {
    const portal = new SsoPortalClient(this.config.region, await this.auth.getAccessToken());
    const accountId =
      this.config.accountId ??
      this.cache.load().resolvedAccountIds[this.config.roleName] ??
      (await portal.findAccountIdForRole(this.config.roleName));

    this.cache.update((state) => {
      state.resolvedAccountIds[this.config.roleName] = accountId;
    });

    return portal.getRoleCredentials(accountId, this.config.roleName);
  }
}
