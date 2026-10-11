import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import { AwsCliClient } from "../../src/Client/AwsCliClient.js";
import { FakeAwsCli } from "../Fixture/FakeAwsCli.js";

void describe("AwsCliClient", () => {
  let aws: FakeAwsCli;

  beforeEach(() => {
    aws = new FakeAwsCli();
  });

  afterEach(() => {
    aws.restore();
  });

  void describe("exportCredentials", () => {
    void it("parses temporary credentials", async () => {
      aws.setExpiration(new Date("2026-01-15T11:00:00Z"));

      const credentials = await new AwsCliClient().exportCredentials("my-profile");

      assert.deepStrictEqual(credentials, {
        accessKeyId: "ASIA",
        expiration: Date.parse("2026-01-15T11:00:00Z"),
        secretAccessKey: "SK",
        sessionToken: "ST",
      });
      assert.deepStrictEqual(aws.calls, ["configure export-credentials --profile my-profile --format process"]);
    });

    void it("parses long-term credentials", async () => {
      aws.setMode("long-term");

      const credentials = await new AwsCliClient().exportCredentials("my-profile");

      assert.deepStrictEqual(credentials, { accessKeyId: "AKIALONGTERM", secretAccessKey: "SK" });
    });

    void it("surfaces the AWS CLI error message", async () => {
      aws.setMode("missing-profile");

      await assert.rejects(
        new AwsCliClient().exportCredentials("unknown"),
        /aws configure export-credentials failed: The config profile \(unknown\) could not be found/
      );
    });

    void it("reports a missing AWS CLI", async () => {
      const path = process.env["PATH"];
      process.env["PATH"] = "/nonexistent";

      try {
        await assert.rejects(new AwsCliClient().exportCredentials("my-profile"), /AWS CLI not found/);
      } finally {
        process.env["PATH"] = path;
      }
    });
  });

  void describe("ssoLogin", () => {
    void it("runs aws sso login for the profile", async () => {
      await new AwsCliClient().ssoLogin("my-profile");

      assert.deepStrictEqual(aws.calls, ["sso login --profile my-profile"]);
    });
  });
});
