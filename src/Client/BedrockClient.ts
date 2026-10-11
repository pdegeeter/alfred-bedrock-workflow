import { ModelFeatures } from "../Helper/ModelFeatures.js";
import { detectRegion } from "../Helper/RegionDetector.js";
import type { BedrockConfig } from "../Type/BedrockConfig.js";
import type { ConverseRequest } from "../Type/ConverseRequest.js";
import type { ConverseResponse } from "../Type/ConverseResponse.js";
import type { EffortLevel } from "../Type/EffortLevel.js";

/**
 * Client for Amazon Bedrock Runtime API using fetch.
 */
export class BedrockClient {
  /** Stop reasons for which the model or a guardrail declined to answer. */
  private static readonly DECLINED: readonly string[] = ["content_filtered", "guardrail_intervened", "refusal"];

  private readonly effort?: EffortLevel;
  private readonly features: ModelFeatures;
  private readonly modelId: string;
  private readonly region: string;
  private readonly systemPrompt?: string;
  private readonly token: string;

  constructor(config: BedrockConfig) {
    this.effort = config.effort;
    this.features = new ModelFeatures(config.modelId);
    this.modelId = config.modelId;
    this.region = detectRegion(config.modelId);
    this.systemPrompt = config.systemPrompt;
    this.token = config.token;
  }

  /**
   * Sends a chat message to Bedrock and returns the response.
   * @param message - The user message to send
   * @returns The AI response text
   */
  async chat(message: string): Promise<string> {
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${this.modelId}/converse`;

    const body: ConverseRequest = {
      ...(this.features.usesEffort && this.effort && {
        additionalModelRequestFields: { output_config: { effort: this.effort } },
      }),
      inferenceConfig: {
        maxTokens: this.features.maxOutputTokens,
        ...(!this.features.usesEffort && { temperature: 0.7 }),
      },
      messages: [
        {
          content: [{ text: message }],
          role: "user",
        },
      ],
      ...(this.systemPrompt && {
        system: [{ text: this.systemPrompt }],
      }),
    };

    const response = await fetch(url, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bedrock API error: ${String(response.status)} ${errorText}`);
    }

    const data = (await response.json()) as ConverseResponse;
    const text = (data.output?.message?.content ?? []).map((block) => block.text ?? "").join("");

    if (data.stopReason && BedrockClient.DECLINED.includes(data.stopReason)) {
      throw new Error(`Bedrock declined the request (${data.stopReason})`);
    }
    if (data.stopReason === "max_tokens") {
      return `${text}\n\n_[Response truncated: output limit reached]_`;
    }

    return text;
  }
}
