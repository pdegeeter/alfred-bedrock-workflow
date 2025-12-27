import { BedrockClient } from "../Client/BedrockClient.js";

/**
 * Configuration for ChatService.
 */
export interface ChatConfig {
  model: string;
  systemPrompt?: string;
  token: string;
}

/**
 * Service for handling chat interactions with Bedrock.
 */
export class ChatService {
  private readonly client: BedrockClient;

  constructor(config: ChatConfig) {
    this.client = new BedrockClient({
      modelId: config.model,
      systemPrompt: config.systemPrompt,
      token: config.token,
    });
  }

  /**
   * Sends a question to Bedrock and returns the AI response.
   * @param question - The user's question
   * @returns The AI response text
   */
  async ask(question: string): Promise<string> {
    return this.client.chat(question);
  }
}
