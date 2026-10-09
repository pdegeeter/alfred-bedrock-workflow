/**
 * IAM Identity Center settings used to generate Bedrock keys.
 */
export interface SsoConfig {
  /** Resolved from the role name when empty. */
  accountId?: string;
  region: string;
  roleName: string;
  startUrl: string;
}
