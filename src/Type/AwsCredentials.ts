/**
 * Temporary AWS credentials returned by IAM Identity Center.
 */
export interface AwsCredentials {
  accessKeyId: string;
  /** Epoch milliseconds. */
  expiration: number;
  secretAccessKey: string;
  sessionToken: string;
}
