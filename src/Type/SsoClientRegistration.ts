/**
 * OIDC public client registered with IAM Identity Center.
 */
export interface SsoClientRegistration {
  clientId: string;
  clientSecret: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}
