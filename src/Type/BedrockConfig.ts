import type { EffortLevel } from "./EffortLevel.js";

/**
 * Configuration for BedrockClient.
 */
export interface BedrockConfig {
  /** Ignored by models that do not support effort. */
  effort?: EffortLevel;
  modelId: string;
  systemPrompt?: string;
  token: string;
}
