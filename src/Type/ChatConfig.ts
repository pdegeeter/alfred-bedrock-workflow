import type { EffortLevel } from "./EffortLevel.js";

/**
 * Configuration for ChatService.
 */
export interface ChatConfig {
  /** Ignored by models that do not support effort. */
  effort?: EffortLevel;
  model: string;
  systemPrompt?: string;
  token: string;
}
