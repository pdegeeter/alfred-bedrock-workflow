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

  void describe("request by model generation", () => {
    const respond = (content: unknown[]) => {
      const fetchMock = mock.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
        Promise.resolve(new Response(JSON.stringify({ output: { message: { content } } }), { status: 200 }))
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      return fetchMock;
    };
    const sentBody = (fetchMock: ReturnType<typeof respond>) =>
      JSON.parse(fetchMock.mock.calls[0].arguments[1].body as string) as Record<string, unknown>;

    void it("sends the effort level without temperature to Claude 5 models", async () => {
      const fetchMock = respond([{ text: "OK" }]);

      await new BedrockClient({ effort: "low", modelId: "eu.anthropic.claude-haiku-5-5", token: "t" }).chat("Hi");

      const body = sentBody(fetchMock);
      assert.deepStrictEqual(body["additionalModelRequestFields"], { output_config: { effort: "low" } });
      assert.deepStrictEqual(body["inferenceConfig"], { maxTokens: 128000 });
    });

    void it("lets Claude 5 models use their default effort when no level is set", async () => {
      const fetchMock = respond([{ text: "OK" }]);

      await new BedrockClient({ modelId: "eu.anthropic.claude-haiku-5-5", token: "t" }).chat("Hi");

      assert.strictEqual(sentBody(fetchMock)["additionalModelRequestFields"], undefined);
    });

    void it("sends temperature without effort to older models", async () => {
      const fetchMock = respond([{ text: "OK" }]);

      await new BedrockClient({
        effort: "high",
        modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        token: "t",
      }).chat("Hi");

      const body = sentBody(fetchMock);
      assert.strictEqual(body["additionalModelRequestFields"], undefined);
      assert.deepStrictEqual(body["inferenceConfig"], { maxTokens: 64000, temperature: 0.7 });
    });

    void it("fails when the model declines the request", async () => {
      for (const stopReason of ["refusal", "content_filtered", "guardrail_intervened"]) {
        global.fetch = (() =>
          Promise.resolve(
            new Response(JSON.stringify({ output: { message: { content: [] } }, stopReason }), { status: 200 })
          )) as unknown as typeof fetch;

        await assert.rejects(
          new BedrockClient({ modelId: "eu.anthropic.claude-haiku-5-5", token: "t" }).chat("Hi"),
          new RegExp(`Bedrock declined the request \\(${stopReason}\\)`)
        );
      }
    });

    void it("flags a response cut at the output limit", async () => {
      global.fetch = (() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ output: { message: { content: [{ text: "Partial" }] } }, stopReason: "max_tokens" }),
            { status: 200 }
          )
        )) as unknown as typeof fetch;

      const result = await new BedrockClient({ modelId: "eu.anthropic.claude-haiku-5-5", token: "t" }).chat("Hi");

      assert.match(result, /^Partial\n\n_\[Response truncated: output limit reached\]_$/);
    });

    void it("skips reasoning blocks and joins the text blocks", async () => {
      respond([{ reasoningContent: { reasoningText: { text: "" } } }, { text: "Hello " }, { text: "world" }]);

      const result = await new BedrockClient({ modelId: "eu.anthropic.claude-haiku-5-5", token: "t" }).chat("Hi");

      assert.strictEqual(result, "Hello world");
    });
  });
});

