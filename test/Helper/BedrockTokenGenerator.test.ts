import assert from "node:assert";
import { afterEach, describe, it, mock } from "node:test";

import { BedrockTokenGenerator } from "../../src/Helper/BedrockTokenGenerator.js";

void describe("BedrockTokenGenerator", () => {
  const credentials = {
    accessKeyId: "ASIAEXAMPLEKEY123",
    expiration: Date.parse("2026-01-15T11:30:00Z"),
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    sessionToken: "session/token+value==",
  };

  afterEach(() => {
    mock.timers.reset();
  });

  void it("matches the token produced by @aws/bedrock-token-generator", () => {
    // Reference generated with @aws/bedrock-token-generator 1.1.0 for the same inputs.
    const expected =
      "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249Q2FsbFdpdGhCZWFyZXJUb2tlbiZYLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFTSUFFWEFNUExFS0VZMTIzJTJGMjAyNjAxMTUlMkZldS13ZXN0LTElMkZiZWRyb2NrJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjAxMTVUMTAzMDAwWiZYLUFtei1FeHBpcmVzPTQzMjAwJlgtQW16LVNlY3VyaXR5LVRva2VuPXNlc3Npb24lMkZ0b2tlbiUyQnZhbHVlJTNEJTNEJlgtQW16LVNpZ25hdHVyZT0wYTJmZWMzZGQ4NGU2MDU0YzlmNWQzODQ5NmQ5OGUxZjhmNDEzNWI1MDlhZDJjZWFlNGUyNmJkZjBiMGMzZDY4JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZWZXJzaW9uPTE=";
    mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-15T10:30:00Z") });

    const token = new BedrockTokenGenerator("eu-west-1").generate(credentials);

    assert.strictEqual(token, expected);
  });

  void it("binds the key to the requested region", () => {
    mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-15T10:30:00Z") });

    const token = new BedrockTokenGenerator("us-east-1").generate(credentials);
    const url = Buffer.from(token.replace("bedrock-api-key-", ""), "base64").toString("utf-8");

    assert.match(url, /^bedrock\.amazonaws\.com\/\?Action=CallWithBearerToken&/);
    assert.match(url, /X-Amz-Credential=ASIAEXAMPLEKEY123%2F20260115%2Fus-east-1%2Fbedrock%2Faws4_request/);
    assert.match(url, /X-Amz-Expires=43200/);
    assert.match(url, /&Version=1$/);
  });

  void it("omits the security token for long-term credentials", () => {
    const token = new BedrockTokenGenerator("eu-west-1").generate({
      accessKeyId: "AKIALONGTERM",
      secretAccessKey: credentials.secretAccessKey,
    });
    const url = Buffer.from(token.replace("bedrock-api-key-", ""), "base64").toString("utf-8");

    assert.doesNotMatch(url, /X-Amz-Security-Token/);
    assert.match(url, /X-Amz-Credential=AKIALONGTERM%2F/);
  });
});
