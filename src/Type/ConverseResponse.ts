/**
 * Bedrock Converse API response.
 */
export interface ConverseResponse {
  output?: {
    message?: {
      /** Reasoning blocks may precede the text blocks. */
      content?: Array<{ text?: string }>;
    };
  };
  /** e.g. end_turn, max_tokens, refusal, content_filtered, guardrail_intervened. */
  stopReason?: string;
}
