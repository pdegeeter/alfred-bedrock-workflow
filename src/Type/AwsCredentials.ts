/**
 * AWS credentials used to sign Bedrock short-term keys.
 */
export interface AwsCredentials {
  accessKeyId: string;
  /** Epoch milliseconds; undefined for long-term credentials. */
  expiration?: number;
  secretAccessKey: string;
  /** Undefined for long-term credentials. */
  sessionToken?: string;
}
