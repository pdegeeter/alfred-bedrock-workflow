import assert from "node:assert";
import { describe, it } from "node:test";

import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../../src/Helper/AlfredOutput.js";
import { TranslationQuery } from "../../src/Helper/TranslationQuery.js";

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

  void describe("TranslationQuery", () => {
    const parse = (query: string) => new TranslationQuery(query, "en");

    void it("uses default language when no prefix", () => {
      const result = parse("Hello world");
      assert.strictEqual(result.lang, "en");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("extracts language from :lang prefix", () => {
      const result = parse(":fr Hello world");
      assert.strictEqual(result.lang, "fr");
      assert.strictEqual(result.languageName, "French");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("extracts a known language from a prefix without colon", () => {
      const result = parse("fr Hello world");
      assert.strictEqual(result.lang, "fr");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("keeps a leading short word that is not a known language", () => {
      for (const query of ["Le chat dort", "La maison", "Un jour", "Il pleut"]) {
        const result = parse(query);
        assert.strictEqual(result.lang, "en");
        assert.strictEqual(result.text, query);
      }
    });

    void it("accepts an unknown code when the colon makes it explicit", () => {
      const result = parse(":sv Hello world");
      assert.strictEqual(result.lang, "sv");
      assert.strictEqual(result.languageName, "sv");
      assert.strictEqual(result.text, "Hello world");
    });

    void it("handles uppercase language codes", () => {
      const result = parse(":FR Hello world");
      assert.strictEqual(result.lang, "fr");
    });

    void it("preserves multiline text", () => {
      const result = parse(":de Line 1\nLine 2");
      assert.strictEqual(result.lang, "de");
      assert.strictEqual(result.text, "Line 1\nLine 2");
    });

    void it("does not match invalid prefixes", () => {
      const result = parse(":abc Hello world");
      assert.strictEqual(result.lang, "en");
      assert.strictEqual(result.text, ":abc Hello world");
    });
  });
});
