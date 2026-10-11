import assert from "node:assert";
import { describe, it } from "node:test";

import { ModelFeatures } from "../../src/Helper/ModelFeatures.js";

void describe("ModelFeatures", () => {
  void describe("usesEffort", () => {
    for (const modelId of [
      "eu.anthropic.claude-haiku-5-5",
      "us.anthropic.claude-haiku-5-5",
      "global.anthropic.claude-haiku-5-5",
      "eu.anthropic.claude-sonnet-5-5",
      "us.anthropic.claude-sonnet-5",
      "anthropic.claude-opus-5",
    ]) {
      void it(`is true for ${modelId}`, () => {
        assert.strictEqual(new ModelFeatures(modelId).usesEffort, true);
      });
    }

    for (const modelId of [
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      "us.anthropic.claude-sonnet-4-20250514-v1:0",
      "eu.anthropic.claude-3-haiku-20240307-v1:0",
      "amazon.nova-pro-v1:0",
    ]) {
      void it(`is false for ${modelId}`, () => {
        assert.strictEqual(new ModelFeatures(modelId).usesEffort, false);
      });
    }
  });

  void describe("parseLevel", () => {
    void it("accepts every effort level", () => {
      for (const level of ["low", "medium", "high", "xhigh", "max"]) {
        assert.strictEqual(ModelFeatures.parseLevel(level), level);
      }
    });

    void it("rejects an unknown level", () => {
      assert.throws(() => ModelFeatures.parseLevel("extreme"), /Unknown level "extreme"/);
    });
  });

  void describe("maxOutputTokens", () => {
    const cases: Array<[string, number]> = [
      ["eu.anthropic.claude-haiku-5-5", 128000],
      ["global.anthropic.claude-sonnet-5-5", 128000],
      ["eu.anthropic.claude-sonnet-5", 128000],
      ["eu.anthropic.claude-haiku-4-5-20251001-v1:0", 64000],
      ["us.anthropic.claude-sonnet-4-20250514-v1:0", 64000],
      ["us.anthropic.claude-opus-4-1-20250805-v1:0", 32000],
      ["us.anthropic.claude-opus-4-5-20251101-v1:0", 64000],
      ["eu.anthropic.claude-3-haiku-20240307-v1:0", 4096],
      ["amazon.nova-pro-v1:0", 4096],
    ];

    for (const [modelId, expected] of cases) {
      void it(`is ${String(expected)} for ${modelId}`, () => {
        assert.strictEqual(new ModelFeatures(modelId).maxOutputTokens, expected);
      });
    }
  });
});
