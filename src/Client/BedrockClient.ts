import { detectRegion } from "../Helper/RegionDetector.js";

/**
 * Configuration for BedrockClient.
 */
export interface BedrockConfig {
  modelId: string;
  systemPrompt?: string;
  token: string;
}

/**
 * Bedrock Converse API request body.
 */
interface ConverseRequest {
  inferenceConfig: {
    maxTokens: number;
    temperature: number;
  };
  messages: Array<{
    content: Array<{ text: string }>;
    role: "user" | "assistant";
  }>;
  system?: Array<{ text: string }>;
}

/**
 * Bedrock Converse API response.
 */
interface ConverseResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
}

/**
 * Client for Amazon Bedrock Runtime API using fetch.
 */
export class BedrockClient {
  private readonly modelId: string;
  private readonly region: string;
  private readonly systemPrompt?: string;
  private readonly token: string;

  constructor(config: BedrockConfig) {
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
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
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
    const content = data.output?.message?.content;

    if (!content || content.length === 0) {
      return "";
    }

    return content[0].text ?? "";
  }
}
