import type { EffortLevel } from "../Type/EffortLevel.js";

/**
 * Request features supported by a Bedrock Claude model.
 * Claude 5 models take an effort level and reject sampling parameters; older models the reverse.
 */
export class ModelFeatures {
  /** Output limit of models this class does not know. */
  private static readonly DEFAULT_MAX_OUTPUT_TOKENS = 4096;
  private static readonly LEVELS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];
  private static readonly VERSION = /claude-(fable|haiku|mythos|opus|sonnet)-(\d+)(?:-(\d)(?!\d))?/;

  /** Largest `maxTokens` the model accepts; it only caps the output, it is not reserved. */
  readonly maxOutputTokens: number;
  readonly usesEffort: boolean;

  constructor(modelId: string) {
    const match = ModelFeatures.VERSION.exec(modelId);
    const family = match?.[1] ?? "";
    const major = Number(match?.[2] ?? 0);
    const minor = Number(match?.[3] ?? 0);

    this.usesEffort = major >= 5;
    this.maxOutputTokens = ModelFeatures.maxOutputTokensOf(family, major, minor);
  }

  /**
   * @throws When the value is not a known effort level
   */
  static parseLevel(value: string): EffortLevel {
    if (!ModelFeatures.LEVELS.includes(value)) {
      throw new Error(`Unknown level "${value}": use one of ${ModelFeatures.LEVELS.join(", ")}`);
    }

    return value as EffortLevel;
  }

  private static maxOutputTokensOf(family: string, major: number, minor: number): number {
    if (major >= 5) {
      return 128000;
    }
    if (major === 4 && family === "opus" && minor < 5) {
      return 32000;
    }
    if (major === 4) {
      return 64000;
    }

    return ModelFeatures.DEFAULT_MAX_OUTPUT_TOKENS;
  }
}
