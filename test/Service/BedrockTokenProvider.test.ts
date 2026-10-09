import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { BrowserLauncher } from "../../src/Helper/BrowserLauncher.js";
import { BedrockTokenProvider } from "../../src/Service/BedrockTokenProvider.js";

interface FakeIdentityCenter {
  calls: string[];
  credentialsTtlMs: number;
  /** Status returned by the next GetRoleCredentials call, then reset to 200. */
  nextCredentialsStatus: number;
}

void describe("BedrockTokenProvider", () => {
  const sso = { region: "eu-west-1", roleName: "BedrockUser", startUrl: "https://example.awsapps.com/start" };
  let cacheDir: string;
  let idc: FakeIdentityCenter;
  let originalFetch: typeof global.fetch;
  let openBrowser: ReturnType<typeof mock.method>;

  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "bedrock-provider-"));
    idc = { calls: [], credentialsTtlMs: 3_600_000, nextCredentialsStatus: 200 };
    originalFetch = global.fetch;
    openBrowser = mock.method(BrowserLauncher.prototype, "open", () => Promise.resolve());

    global.fetch = ((input: string) => {
      const url = new URL(input);
      idc.calls.push(url.pathname);

      switch (url.pathname) {
        case "/client/register":
          return json({ clientId: "client", clientSecret: "secret", clientSecretExpiresAt: Date.now() / 1000 + 7_776_000 });
        case "/device_authorization":
          return json({ deviceCode: "device", expiresIn: 600, interval: 0, verificationUriComplete: "https://verify" });
        case "/token":
          return json({ accessToken: `access-${String(idc.calls.length)}`, expiresIn: 28_800, refreshToken: "refresh" });
        case "/assignment/accounts":
          return json({ accountList: [{ accountId: "111122223333" }] });
        case "/assignment/roles":
          return json({ roleList: [{ roleName: "BedrockUser" }] });
        case "/federation/credentials": {
          const status = idc.nextCredentialsStatus;
          idc.nextCredentialsStatus = 200;

          return status === 200
            ? json({
                roleCredentials: {
                  accessKeyId: "AK",
                  expiration: Date.now() + idc.credentialsTtlMs,
                  secretAccessKey: "SK",
                  sessionToken: "ST",
                },
              })
            : json({ message: "expired" }, status);
        }
        default:
          throw new Error(`Unexpected call ${url.pathname}`);
      }
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    openBrowser.mock.restore();
    mock.timers.reset();
    rmSync(cacheDir, { force: true, recursive: true });
  });

  void describe("fromEnvironment", () => {
    void it("prefers the static token without calling AWS", async () => {
      const provider = BedrockTokenProvider.fromEnvironment({
        sso_role_name: "BedrockUser",
        sso_start_url: sso.startUrl,
        token: "static-token",
      });

      assert.strictEqual(await provider.getToken("eu-west-1"), "static-token");
      assert.deepStrictEqual(idc.calls, []);
    });

    void it("falls back to AWS_BEARER_TOKEN_BEDROCK", async () => {
      const provider = BedrockTokenProvider.fromEnvironment({ AWS_BEARER_TOKEN_BEDROCK: "env-token" });

      assert.strictEqual(await provider.getToken("eu-west-1"), "env-token");
    });

    void it("fails when nothing is configured", async () => {
      const provider = BedrockTokenProvider.fromEnvironment({ alfred_workflow_cache: cacheDir });

      await assert.rejects(provider.getToken("eu-west-1"), /Bedrock token not configured/);
    });

    void it("rejects a start URL without role name", () => {
      assert.throws(
        () => BedrockTokenProvider.fromEnvironment({ sso_start_url: sso.startUrl }),
        /Incomplete SSO configuration/
      );
    });
  });

  void describe("with IAM Identity Center", () => {
    void it("logs in through the browser and returns a short-term key", async () => {
      const token = await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");

      assert.match(token, /^bedrock-api-key-/);
      assert.strictEqual(openBrowser.mock.callCount(), 1);
      assert.deepStrictEqual(openBrowser.mock.calls[0].arguments, ["https://verify", undefined]);
      assert.deepStrictEqual(idc.calls, [
        "/client/register",
        "/device_authorization",
        "/token",
        "/assignment/accounts",
        "/assignment/roles",
        "/federation/credentials",
      ]);
    });

    void it("reuses the cached key across processes while it is valid", async () => {
      const first = await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      idc.calls = [];

      const second = await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");

      assert.strictEqual(second, first);
      assert.deepStrictEqual(idc.calls, []);
    });

    void it("caps the key lifetime to the role session and renews it without browser", async () => {
      mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-15T08:00:00Z") });
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      idc.calls = [];

      // Role session is 1h: the key must not be served past it even though SigV4 allows 12h.
      mock.timers.setTime(Date.parse("2026-01-15T08:56:00Z"));
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");

      assert.deepStrictEqual(idc.calls, ["/federation/credentials"]);
      assert.strictEqual(openBrowser.mock.callCount(), 1);
    });

    void it("keeps the key up to 12 hours when the role session is longer", async () => {
      idc.credentialsTtlMs = 13 * 3_600_000;
      mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-15T08:00:00Z") });
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      idc.calls = [];

      mock.timers.setTime(Date.parse("2026-01-15T19:50:00Z"));
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      assert.deepStrictEqual(idc.calls, []);

      mock.timers.setTime(Date.parse("2026-01-15T19:56:00Z"));
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      assert.deepStrictEqual(idc.calls, ["/token", "/federation/credentials"]);
    });

    void it("generates one key per region", async () => {
      const eu = await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      idc.calls = [];

      const us = await new BedrockTokenProvider("", sso, cacheDir).getToken("us-east-1");

      assert.notStrictEqual(us, eu);
      assert.deepStrictEqual(idc.calls, ["/federation/credentials"]);
    });

    void it("opens the login in the configured browser", async () => {
      await new BedrockTokenProvider("", { ...sso, browser: "Brave Browser" }, cacheDir).getToken("eu-west-1");

      assert.deepStrictEqual(openBrowser.mock.calls[0].arguments, ["https://verify", "Brave Browser"]);
    });

    void it("skips account discovery when the account ID is configured", async () => {
      await new BedrockTokenProvider("", { ...sso, accountId: "444455556666" }, cacheDir).getToken("eu-west-1");

      assert.ok(!idc.calls.includes("/assignment/accounts"));
    });

    void it("logs in again when the SSO session was revoked", async () => {
      mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-01-15T08:00:00Z") });
      await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");
      idc.calls = [];
      idc.nextCredentialsStatus = 401;

      mock.timers.setTime(Date.parse("2026-01-15T09:00:00Z"));
      const token = await new BedrockTokenProvider("", sso, cacheDir).getToken("eu-west-1");

      assert.match(token, /^bedrock-api-key-/);
      assert.deepStrictEqual(idc.calls, [
        "/federation/credentials",
        "/device_authorization",
        "/token",
        "/federation/credentials",
      ]);
      assert.strictEqual(openBrowser.mock.callCount(), 2);
    });
  });
});
