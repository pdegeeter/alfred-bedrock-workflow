import assert from "node:assert";
import { describe, it } from "node:test";

import { detectRegion } from "../../src/Helper/RegionDetector.js";

void describe("RegionDetector", () => {
  void describe("detectRegion", () => {
    void it("returns eu-west-1 for eu.* models", () => {
      assert.strictEqual(
        detectRegion("eu.anthropic.claude-haiku-4-5-20251001-v1:0"),
        "eu-west-1"
      );
    });

    void it("returns eu-west-1 for eu.sonnet model", () => {
      assert.strictEqual(
        detectRegion("eu.anthropic.claude-sonnet-4-20250514-v1:0"),
        "eu-west-1"
      );
    });

    void it("returns us-east-1 for us.* models", () => {
      assert.strictEqual(
        detectRegion("us.anthropic.claude-sonnet-4-20250514-v1:0"),
        "us-east-1"
      );
    });

    void it("returns us-east-1 for global.* models", () => {
      assert.strictEqual(
        detectRegion("global.meta.llama-3-8b-instruct-v1:0"),
        "us-east-1"
      );
    });

    void it("returns us-east-1 as default for unknown prefixes", () => {
      assert.strictEqual(detectRegion("unknown-model"), "us-east-1");
    });

    void it("returns us-east-1 for empty string", () => {
      assert.strictEqual(detectRegion(""), "us-east-1");
    });
  });
});
