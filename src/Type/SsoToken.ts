/**
 * IAM Identity Center access token.
 */
export interface SsoToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  refreshToken?: string;
}
