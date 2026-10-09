/**
 * Raised when IAM Identity Center rejects the access token (expired or revoked).
 */
export class SsoUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsoUnauthorizedError";
  }
}
