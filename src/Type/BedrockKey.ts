/**
 * Cached Bedrock short-term API key.
 */
export interface BedrockKey {
  /** Epoch milliseconds: min(generation + 12h, role credentials expiration). */
  expiresAt: number;
  token: string;
}
