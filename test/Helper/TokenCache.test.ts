import assert from "node:assert";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { TokenCache } from "../../src/Helper/TokenCache.js";

void describe("TokenCache", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bedrock-cache-"));
    path = join(dir, "nested", "auth.json");
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  void it("returns an empty state when the file is missing", () => {
    const state = new TokenCache(path, "scope-a").load();

    assert.deepStrictEqual(state, { bedrockKeys: {}, resolvedAccountIds: {}, scope: "scope-a" });
  });

  void it("persists updates readable only by the owner", () => {
    new TokenCache(path, "scope-a").update((state) => {
      state.resolvedAccountIds["Role"] = "111122223333";
    });

    assert.strictEqual(new TokenCache(path, "scope-a").load().resolvedAccountIds["Role"], "111122223333");
    assert.strictEqual(statSync(path).mode & 0o777, 0o600);
    assert.strictEqual(statSync(join(dir, "nested")).mode & 0o777, 0o700);
  });

  void it("discards state from another SSO scope", () => {
    new TokenCache(path, "scope-a").update((state) => {
      state.resolvedAccountIds["Role"] = "111122223333";
    });

    assert.deepStrictEqual(new TokenCache(path, "scope-b").load().resolvedAccountIds, {});
  });

  void it("treats a corrupt file as empty", () => {
    new TokenCache(path, "scope-a").update(() => undefined);
    writeFileSync(path, "{not json");

    assert.deepStrictEqual(new TokenCache(path, "scope-a").load().bedrockKeys, {});
  });
});
