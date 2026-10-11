import type { EffortLevel } from "./EffortLevel.js";

/**
 * Bedrock Converse API request body.
 */
export interface ConverseRequest {
  additionalModelRequestFields?: {
    output_config: { effort: EffortLevel };
  };
  inferenceConfig: {
    maxTokens: number;
    temperature?: number;
  };
  messages: Array<{
    content: Array<{ text: string }>;
    role: "user" | "assistant";
  }>;
  system?: Array<{ text: string }>;
}
