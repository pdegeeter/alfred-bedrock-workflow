import { homedir } from "node:os";
import { join } from "node:path";

import { BedrockTokenGenerator } from "../Helper/BedrockTokenGenerator.js";
import { TokenCache } from "../Helper/TokenCache.js";
import type { CredentialsSource } from "../Type/CredentialsSource.js";
import type { SsoConfig } from "../Type/SsoConfig.js";
import { AwsProfileCredentialsSource } from "./AwsProfileCredentialsSource.js";
import { SsoCredentialsSource } from "./SsoCredentialsSource.js";

/**
 * Resolves the Bedrock bearer token, by priority:
 * static token, AWS CLI profile, built-in IAM Identity Center login, fallback token.
 * Short-term keys are cached until they expire.
 */
export class BedrockTokenProvider {
  private static readonly CACHE_FILE = "auth.json";
  private static readonly DEFAULT_SSO_REGION = "eu-west-1";
  private static readonly KEY_MARGIN_MS = 5 * 60 * 1000;

  private readonly fallbackToken: string;
  private readonly source?: { cache: TokenCache; credentials: CredentialsSource };
  private readonly staticToken: string;

  /**
   * @param options.staticToken - Bedrock API key used as-is when not empty
   * @param options.awsProfile - AWS CLI profile providing the signing credentials
   * @param options.sso - IAM Identity Center settings, used when no profile is set
   * @param options.fallbackToken - Bedrock API key used when no credentials source is set
   * @param options.cacheDir - Directory holding the authentication cache
   */
  constructor(options: {
    awsProfile?: string;
    cacheDir: string;
    fallbackToken?: string;
    sso?: SsoConfig;
    staticToken?: string;
  }) {
    this.fallbackToken = options.fallbackToken ?? "";
    this.staticToken = options.staticToken ?? "";

    const cachePath = join(options.cacheDir, BedrockTokenProvider.CACHE_FILE);

    if (options.awsProfile) {
      const credentials = new AwsProfileCredentialsSource(options.awsProfile);
      this.source = { cache: new TokenCache(cachePath, credentials.cacheScope), credentials };
    } else if (options.sso) {
      const cache = new TokenCache(cachePath, SsoCredentialsSource.scopeOf(options.sso));
      this.source = { cache, credentials: new SsoCredentialsSource(options.sso, cache) };
    }
  }

  /**
   * Builds a provider from Alfred workflow variables.
   * @throws When the SSO settings are incomplete
   */
  static fromEnvironment(env: NodeJS.ProcessEnv): BedrockTokenProvider {
    const startUrl = env["sso_start_url"] ?? "";
    const roleName = env["sso_role_name"] ?? "";

    if (Boolean(startUrl) !== Boolean(roleName)) {
      throw new Error("Incomplete SSO configuration: set both sso_start_url and sso_role_name");
    }

    return new BedrockTokenProvider({
      awsProfile: env["aws_profile"] || undefined,
      cacheDir: env["alfred_workflow_cache"] || join(homedir(), ".cache", "alfred-bedrock-workflow"),
      fallbackToken: env["AWS_BEARER_TOKEN_BEDROCK"],
      sso: startUrl
        ? {
            accountId: env["sso_account_id"] || undefined,
            browser: env["browser"] || undefined,
            region: env["sso_region"] || BedrockTokenProvider.DEFAULT_SSO_REGION,
            roleName,
            startUrl,
          }
        : undefined,
      staticToken: env["token"],
    });
  }

  /**
   * @param region - Bedrock Runtime region; short-term keys are region-bound
   * @returns A bearer token valid for at least a few minutes
   */
  async getToken(region: string): Promise<string> {
    if (this.staticToken) {
      return this.staticToken;
    }
    if (!this.source) {
      if (this.fallbackToken) {
        return this.fallbackToken;
      }

      throw new Error("Bedrock token not configured: set token, aws_profile, or sso_start_url and sso_role_name");
    }

    const { cache, credentials } = this.source;
    const keyId = `${credentials.keyPrefix}:${region}`;
    const cached = cache.load().bedrockKeys[keyId];

    if (cached && cached.expiresAt - BedrockTokenProvider.KEY_MARGIN_MS > Date.now()) {
      return cached.token;
    }

    const awsCredentials = await credentials.getCredentials();
    const token = new BedrockTokenGenerator(region).generate(awsCredentials);
    const expiresAt = Math.min(
      Date.now() + BedrockTokenGenerator.MAX_TTL_SECONDS * 1000,
      awsCredentials.expiration ?? Number.POSITIVE_INFINITY
    );

    cache.update((state) => {
      state.bedrockKeys = Object.fromEntries(
        Object.entries(state.bedrockKeys).filter(([, key]) => key && key.expiresAt > Date.now())
      );
      state.bedrockKeys[keyId] = { expiresAt, token };
    });

    return token;
  }
}
