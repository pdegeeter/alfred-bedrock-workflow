import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { SsoOidcClient } from "../../src/Client/SsoOidcClient.js";

void describe("SsoOidcClient", () => {
  const registration = { clientId: "client-id", clientSecret: "client-secret", expiresAt: Date.now() + 86_400_000 };
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const respondWith = (...responses: Array<{ body: unknown; status: number }>) => {
    const queue = [...responses];
    const fetchMock = mock.fn<(url: string, init: RequestInit) => Promise<Response>>(() => {
      const next = queue.shift();
      if (!next) {
        throw new Error("Unexpected fetch call");
      }

      return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    return fetchMock;
  };

  void describe("register", () => {
    void it("registers a public client with the account access scope", async () => {
      const fetchMock = respondWith({
        body: { clientId: "id", clientSecret: "secret", clientSecretExpiresAt: 1_800_000_000 },
        status: 200,
      });

      const result = await new SsoOidcClient("eu-west-1").register();

      assert.deepStrictEqual(result, { clientId: "id", clientSecret: "secret", expiresAt: 1_800_000_000_000 });
      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(url, "https://oidc.eu-west-1.amazonaws.com/client/register");
      assert.deepStrictEqual(JSON.parse(init.body as string), {
        clientName: "alfred-bedrock-workflow",
        clientType: "public",
        scopes: ["sso:account:access"],
      });
    });

    void it("throws on API error", async () => {
      respondWith({ body: { error: "invalid_request" }, status: 400 });

      await assert.rejects(new SsoOidcClient("eu-west-1").register(), /SSO OIDC error: 400 invalid_request/);
    });
  });

  void describe("startDeviceAuthorization", () => {
    void it("returns the verification URL and absolute expiry", async () => {
      const fetchMock = respondWith({
        body: { deviceCode: "device", expiresIn: 600, interval: 1, verificationUriComplete: "https://verify" },
        status: 200,
      });
      const before = Date.now();

      const result = await new SsoOidcClient("eu-west-1").startDeviceAuthorization(registration, "https://start");

      assert.strictEqual(result.deviceCode, "device");
      assert.strictEqual(result.interval, 1);
      assert.strictEqual(result.verificationUriComplete, "https://verify");
      assert.ok(result.expiresAt >= before + 600_000);
      assert.strictEqual(
        (JSON.parse(fetchMock.mock.calls[0].arguments[1].body as string) as { startUrl: string }).startUrl,
        "https://start"
      );
    });
  });

  void describe("waitForDeviceToken", () => {
    const authorization = {
      deviceCode: "device",
      expiresAt: Date.now() + 600_000,
      interval: 0,
      verificationUriComplete: "https://verify",
    };

    void it("polls until the user approves", async () => {
      const fetchMock = respondWith(
        { body: { error: "authorization_pending" }, status: 400 },
        { body: { accessToken: "access", expiresIn: 3600, refreshToken: "refresh" }, status: 200 }
      );

      const token = await new SsoOidcClient("eu-west-1").waitForDeviceToken(registration, authorization);

      assert.strictEqual(token.accessToken, "access");
      assert.strictEqual(token.refreshToken, "refresh");
      assert.strictEqual(fetchMock.mock.calls.length, 2);
      assert.strictEqual(
        (JSON.parse(fetchMock.mock.calls[0].arguments[1].body as string) as { grantType: string }).grantType,
        "urn:ietf:params:oauth:grant-type:device_code"
      );
    });

    void it("fails when the user denies the login", async () => {
      respondWith({ body: { error: "access_denied" }, status: 400 });

      await assert.rejects(
        new SsoOidcClient("eu-west-1").waitForDeviceToken(registration, authorization),
        /SSO login failed: access_denied/
      );
    });

    void it("fails when the authorization already expired", async () => {
      respondWith();

      await assert.rejects(
        new SsoOidcClient("eu-west-1").waitForDeviceToken(registration, { ...authorization, expiresAt: Date.now() - 1 }),
        /SSO login timed out/
      );
    });
  });

  void describe("refresh", () => {
    void it("exchanges the refresh token", async () => {
      const fetchMock = respondWith({ body: { accessToken: "new-access", expiresIn: 3600 }, status: 200 });

      const token = await new SsoOidcClient("eu-west-1").refresh(registration, "refresh");

      assert.strictEqual(token.accessToken, "new-access");
      assert.strictEqual(token.refreshToken, undefined);
      assert.deepStrictEqual(JSON.parse(fetchMock.mock.calls[0].arguments[1].body as string), {
        clientId: "client-id",
        clientSecret: "client-secret",
        grantType: "refresh_token",
        refreshToken: "refresh",
      });
    });
  });
});
