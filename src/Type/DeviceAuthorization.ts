/**
 * Pending OIDC device authorization awaiting user approval in the browser.
 */
export interface DeviceAuthorization {
  deviceCode: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Polling interval in seconds. */
  interval: number;
  verificationUriComplete: string;
}
