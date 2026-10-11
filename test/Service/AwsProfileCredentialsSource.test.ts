import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import { AwsProfileCredentialsSource } from "../../src/Service/AwsProfileCredentialsSource.js";
import { FakeAwsCli } from "../Fixture/FakeAwsCli.js";

void describe("AwsProfileCredentialsSource", () => {
  let aws: FakeAwsCli;

  beforeEach(() => {
    aws = new FakeAwsCli();
  });

  afterEach(() => {
    aws.restore();
  });

  void it("returns the profile credentials without login when the session is valid", async () => {
    const credentials = await new AwsProfileCredentialsSource("my-profile").getCredentials();

    assert.strictEqual(credentials.accessKeyId, "ASIA");
    assert.deepStrictEqual(aws.calls, ["configure export-credentials --profile my-profile --format process"]);
  });

  void it("logs in and retries once when the SSO session expired", async () => {
    aws.setMode("expired");

    const credentials = await new AwsProfileCredentialsSource("my-profile").getCredentials();

    assert.strictEqual(credentials.sessionToken, "ST");
    assert.deepStrictEqual(aws.calls, [
      "configure export-credentials --profile my-profile --format process",
      "sso login --profile my-profile",
      "configure export-credentials --profile my-profile --format process",
    ]);
  });

  void it("does not log in for unrelated errors", async () => {
    aws.setMode("missing-profile");

    await assert.rejects(new AwsProfileCredentialsSource("unknown").getCredentials(), /could not be found/);
    assert.strictEqual(aws.calls.length, 1);
  });

  void it("does not log in when an unrelated error mentions sso", async () => {
    aws.setMode("missing-profile");

    await assert.rejects(
      new AwsProfileCredentialsSource("my-sso-token-profile").getCredentials(),
      /The config profile \(my-sso-token-profile\) could not be found/
    );
    assert.deepStrictEqual(aws.calls, [
      "configure export-credentials --profile my-sso-token-profile --format process",
    ]);
  });

  void it("scopes the cache to the profile", () => {
    const source = new AwsProfileCredentialsSource("my-profile");

    assert.strictEqual(source.cacheScope, "profile:my-profile");
    assert.strictEqual(source.keyPrefix, "my-profile");
  });
});
