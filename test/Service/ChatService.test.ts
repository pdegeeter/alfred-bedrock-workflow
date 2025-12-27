import assert from "node:assert";
import { describe, it, mock } from "node:test";

import { ChatService } from "../../src/Service/ChatService.js";

void describe("ChatService", () => {
  void describe("constructor", () => {
    void it("creates service with provided model", () => {
      const service = new ChatService({
        model: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      assert.ok(service instanceof ChatService);
    });
  });

  void describe("ask", () => {
    void it("delegates to BedrockClient.chat", async () => {
      const service = new ChatService({
        model: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      const mockChat = mock.fn(() => Promise.resolve("AI response"));

      // @ts-expect-error - accessing private property for testing
      service.client.chat = mockChat;

      const result = await service.ask("What is 2+2?");

      assert.strictEqual(result, "AI response");
      assert.strictEqual(mockChat.mock.calls.length, 1);
      assert.deepStrictEqual(mockChat.mock.calls[0].arguments, ["What is 2+2?"]);
    });
  });
});
