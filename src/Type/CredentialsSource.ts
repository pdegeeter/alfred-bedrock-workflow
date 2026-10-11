import type { AwsCredentials } from "./AwsCredentials.js";

/**
 * Provides the AWS credentials used to sign Bedrock short-term keys.
 */
export interface CredentialsSource {
  /** Identifies the cached state owned by this source; state from another scope is discarded. */
  readonly cacheScope: string;
  /** Prefix of the cached key identifiers, completed with the region. */
  readonly keyPrefix: string;

  getCredentials(): Promise<AwsCredentials>;
}
