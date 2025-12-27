import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { BedrockClient } from "../../src/Client/BedrockClient.js";

void describe("BedrockClient", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  void describe("constructor", () => {
    void it("creates client with provided modelId", () => {
      const client = new BedrockClient({
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      assert.ok(client instanceof BedrockClient);
    });

    void it("creates client with US model", () => {
      const client = new BedrockClient({
        modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        token: "test-token",
      });

      assert.ok(client instanceof BedrockClient);
    });
  });

  void describe("chat", () => {
    void it("sends message and returns response text", async () => {
      const mockFetch = mock.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              output: {
                message: {
                  content: [{ text: "Hello from Bedrock!" }],
                },
              },
            }),
          ok: true,
        })
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const client = new BedrockClient({
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      const result = await client.chat("Hello");

      assert.strictEqual(result, "Hello from Bedrock!");
      assert.strictEqual(mockFetch.mock.calls.length, 1);
    });

    void it("returns empty string when no content", async () => {
      const mockFetch = mock.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              output: {
                message: {
                  content: [],
                },
              },
            }),
          ok: true,
        })
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const client = new BedrockClient({
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      const result = await client.chat("Hello");

      assert.strictEqual(result, "");
    });

    void it("returns empty string when output is undefined", async () => {
      const mockFetch = mock.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({}),
          ok: true,
        })
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const client = new BedrockClient({
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "test-token",
      });

      const result = await client.chat("Hello");

      assert.strictEqual(result, "");
    });

    void it("throws error on API failure", async () => {
      const mockFetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        })
      );
      global.fetch = mockFetch as unknown as typeof fetch;

      const client = new BedrockClient({
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "invalid-token",
      });

      await assert.rejects(
        () => client.chat("Hello"),
        /Bedrock API error: 401 Unauthorized/
      );
    });
  });
});
