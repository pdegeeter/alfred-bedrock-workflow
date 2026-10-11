import { AwsCliClient } from "../Client/AwsCliClient.js";
import type { AwsCredentials } from "../Type/AwsCredentials.js";
import type { CredentialsSource } from "../Type/CredentialsSource.js";

/**
 * Credentials from an AWS CLI profile. Login is delegated to the profile's own tooling
 * (credential_process such as Granted, or `aws sso login` for native SSO profiles).
 */
export class AwsProfileCredentialsSource implements CredentialsSource {
  /** AWS CLI messages for an expired IAM Identity Center session, the only case `aws sso login` fixes. */
  private static readonly EXPIRED_SSO_SESSION =
    /Token has expired and refresh failed|SSO session associated with this profile has expired/i;

  readonly cacheScope: string;
  readonly keyPrefix: string;

  private readonly cli = new AwsCliClient();
  private readonly profile: string;

  constructor(profile: string) {
    this.profile = profile;
    this.cacheScope = `profile:${profile}`;
    this.keyPrefix = profile;
  }

  async getCredentials(): Promise<AwsCredentials> {
    try {
      return await this.cli.exportCredentials(this.profile);
    } catch (error) {
      if (!(error instanceof Error) || !AwsProfileCredentialsSource.EXPIRED_SSO_SESSION.test(error.message)) {
        throw error;
      }

      await this.cli.ssoLogin(this.profile);

      return this.cli.exportCredentials(this.profile);
    }
  }
}
