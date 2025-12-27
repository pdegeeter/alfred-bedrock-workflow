import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../../src/Helper/AlfredOutput.js";

void describe("AlfredOutput", () => {
  void describe("createScriptFilterResponse", () => {
    void it("creates response with items array", () => {
      const result = createScriptFilterResponse("Hello World");

      assert.ok(Array.isArray(result.items));
      assert.strictEqual(result.items.length, 1);
    });

    void it("sets title to first line of response", () => {
      const result = createScriptFilterResponse("Hello World\nSecond line");

      assert.strictEqual(result.items[0].title, "Hello World");
    });

    void it("truncates long titles", () => {
      const longText = "A".repeat(150);
      const result = createScriptFilterResponse(longText);

      assert.ok(result.items[0].title.length <= 103);
      assert.ok(result.items[0].title.endsWith("..."));
    });

    void it("includes response in variables", () => {
      const result = createScriptFilterResponse("Hello");

      assert.strictEqual(result.variables?.response, "Hello");
    });

    void it("includes arg for passing to next workflow step", () => {
      const result = createScriptFilterResponse("Hello");

      assert.strictEqual(result.items[0].arg, "Hello");
    });

    void it("includes modifier keys", () => {
      const result = createScriptFilterResponse("Hello");
      const mods = result.items[0].mods;

      assert.ok(mods);
      assert.ok(mods.cmd);
      assert.ok(mods.alt);
    });
  });

  void describe("createErrorResponse", () => {
    void it("creates error item with valid false", () => {
      const result = createErrorResponse("Error message");

      assert.strictEqual(result.items[0].title, "Error message");
      assert.strictEqual(result.items[0].valid, false);
    });
  });
});
