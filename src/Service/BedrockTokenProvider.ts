import { homedir } from "node:os";
import { join } from "node:path";

import { SsoPortalClient } from "../Client/SsoPortalClient.js";
import { SsoUnauthorizedError } from "../Error/SsoUnauthorizedError.js";
import { BedrockTokenGenerator } from "../Helper/BedrockTokenGenerator.js";
import { TokenCache } from "../Helper/TokenCache.js";
import type { SsoConfig } from "../Type/SsoConfig.js";
import { SsoAuthService } from "./SsoAuthService.js";

/**
 * Resolves the Bedrock bearer token: a static token when configured, otherwise a short-term
 * key generated from IAM Identity Center role credentials and cached until it expires.
 */
export class BedrockTokenProvider {
  private static readonly CACHE_FILE = "auth.json";
  private static readonly DEFAULT_SSO_REGION = "eu-west-1";
  private static readonly KEY_MARGIN_MS = 5 * 60 * 1000;

  private readonly sso?: { auth: SsoAuthService; cache: TokenCache; config: SsoConfig };
  private readonly staticToken: string;

  /**
   * @param staticToken - Bedrock API key used as-is when not empty
   * @param sso - IAM Identity Center settings used when no static token is set
   * @param cacheDir - Directory holding the authentication cache
   */
  constructor(staticToken: string, sso: SsoConfig | undefined, cacheDir: string) {
    this.staticToken = staticToken;

    if (sso) {
      const cache = new TokenCache(join(cacheDir, BedrockTokenProvider.CACHE_FILE), `${sso.startUrl}|${sso.region}`);
      this.sso = { auth: new SsoAuthService(sso, cache), cache, config: sso };
    }
  }

  /**
   * Builds a provider from Alfred workflow variables.
   * @throws When the SSO settings are incomplete
   */
  static fromEnvironment(env: NodeJS.ProcessEnv): BedrockTokenProvider {
    const staticToken = env["token"] || env["AWS_BEARER_TOKEN_BEDROCK"] || "";
    const startUrl = env["sso_start_url"] ?? "";
    const roleName = env["sso_role_name"] ?? "";
    const cacheDir = env["alfred_workflow_cache"] || join(homedir(), ".cache", "alfred-bedrock-workflow");

    if (Boolean(startUrl) !== Boolean(roleName)) {
      throw new Error("Incomplete SSO configuration: set both sso_start_url and sso_role_name");
    }

    const sso: SsoConfig | undefined = startUrl
      ? {
          accountId: env["sso_account_id"] || undefined,
          browser: env["browser"] || undefined,
          region: env["sso_region"] || BedrockTokenProvider.DEFAULT_SSO_REGION,
          roleName,
          startUrl,
        }
      : undefined;

    return new BedrockTokenProvider(staticToken, sso, cacheDir);
  }

  /**
   * @param region - Bedrock Runtime region; short-term keys are region-bound
   * @returns A bearer token valid for at least a few minutes
   */
  async getToken(region: string): Promise<string> {
    if (this.staticToken) {
      return this.staticToken;
    }
    if (!this.sso) {
      throw new Error("Bedrock token not configured: set token, or sso_start_url and sso_role_name");
    }

    const { auth, cache, config } = this.sso;
    const state = cache.load();
    const accountId = config.accountId ?? state.resolvedAccountIds[config.roleName];
    const cached = accountId ? state.bedrockKeys[BedrockTokenProvider.keyId(accountId, config.roleName, region)] : undefined;

    if (cached && cached.expiresAt - BedrockTokenProvider.KEY_MARGIN_MS > Date.now()) {
      return cached.token;
    }

    try {
      return await BedrockTokenProvider.generate(auth, cache, config, region);
    } catch (error) {
      if (!(error instanceof SsoUnauthorizedError)) {
        throw error;
      }

      auth.invalidate();

      return BedrockTokenProvider.generate(auth, cache, config, region);
    }
  }

  private static async generate(
    auth: SsoAuthService,
    cache: TokenCache,
    config: SsoConfig,
    region: string
  ): Promise<string> {
    const portal = new SsoPortalClient(config.region, await auth.getAccessToken());
    const accountId =
      config.accountId ??
      cache.load().resolvedAccountIds[config.roleName] ??
      (await portal.findAccountIdForRole(config.roleName));
    const credentials = await portal.getRoleCredentials(accountId, config.roleName);
    const token = new BedrockTokenGenerator(region).generate(credentials);
    const expiresAt = Math.min(Date.now() + BedrockTokenGenerator.MAX_TTL_SECONDS * 1000, credentials.expiration);

    cache.update((state) => {
      state.bedrockKeys = Object.fromEntries(
        Object.entries(state.bedrockKeys).filter(([, key]) => key && key.expiresAt > Date.now())
      );
      state.resolvedAccountIds[config.roleName] = accountId;
      state.bedrockKeys[BedrockTokenProvider.keyId(accountId, config.roleName, region)] = { expiresAt, token };
    });

    return token;
  }

  private static keyId(accountId: string, roleName: string, region: string): string {
    return `${accountId}:${roleName}:${region}`;
  }
}
