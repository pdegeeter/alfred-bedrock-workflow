import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../../src/Helper/AlfredOutput.js";

void describe("bedrock command", () => {
  void describe("createScriptFilterResponse integration", () => {
    void it("creates valid Alfred JSON output", () => {
      const response = "# Hello\n\nThis is a response from Bedrock.";
      const output = createScriptFilterResponse(response);
      const json = JSON.stringify(output);

      const parsed = JSON.parse(json) as {
        items: Array<{ arg: string; title: string }>;
        variables: { response: string };
      };

      assert.ok(Array.isArray(parsed.items));
      assert.strictEqual(parsed.items[0].arg, response);
      assert.strictEqual(parsed.variables.response, response);
    });

    void it("handles error message format", () => {
      const errorMessage = "Error: Bedrock token not configured";
      const output = createErrorResponse(errorMessage);

      assert.strictEqual(output.items[0].title, errorMessage);
      assert.strictEqual(output.items[0].valid, false);
    });
  });
});
