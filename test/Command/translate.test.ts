import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../../src/Helper/AlfredOutput.js";

void describe("translate command", () => {
  void describe("createScriptFilterResponse integration", () => {
    void it("creates valid Alfred JSON output for translation", () => {
      const response = "Bonjour le monde";
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

  void describe("parseQuery", () => {
    // Test the query parsing logic inline
    const parseQuery = (
      query: string,
      defaultLang: string
    ): { lang: string; text: string } => {
      const match = /^:?([a-zA-Z]{2})\s+(.+)$/s.exec(query);
      if (match) {
        return { lang: match[1].toLowerCase(), text: match[2] };
      }
      return { lang: defaultLang, text: query };
    };

    void it("uses default language when no prefix", () => {
      const result = parseQuery("Hello world", "en");
      assert.strictEqual(result.lang, "en");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("extracts language from :lang prefix", () => {
      const result = parseQuery(":fr Hello world", "en");
      assert.strictEqual(result.lang, "fr");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("extracts language from lang prefix without colon", () => {
      const result = parseQuery("fr Hello world", "en");
      assert.strictEqual(result.lang, "fr");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("handles uppercase language codes", () => {
      const result = parseQuery(":FR Hello world", "en");
      assert.strictEqual(result.lang, "fr");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("preserves multiline text", () => {
      const result = parseQuery(":de Line 1\nLine 2", "en");
      assert.strictEqual(result.lang, "de");
      assert.strictEqual(result.text, "Line 1\nLine 2");
    });

    void it("does not match invalid prefixes", () => {
      const result = parseQuery(":abc Hello world", "en");
      assert.strictEqual(result.lang, "en");
      assert.strictEqual(result.text, ":abc Hello world");
    });
  });
});
