import assert from "node:assert";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { SsoPortalClient } from "../../src/Client/SsoPortalClient.js";
import { SsoUnauthorizedError } from "../../src/Error/SsoUnauthorizedError.js";

void describe("SsoPortalClient", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const route = (handler: (url: URL) => { body: unknown; status: number }) => {
    const fetchMock = mock.fn<(url: string, init: RequestInit) => Promise<Response>>((url) => {
      const { body, status } = handler(new URL(url));

      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    return fetchMock;
  };

  void describe("getRoleCredentials", () => {
    void it("requests credentials with the bearer token header", async () => {
      const roleCredentials = { accessKeyId: "AK", expiration: 1, secretAccessKey: "SK", sessionToken: "ST" };
      const fetchMock = route(() => ({ body: { roleCredentials }, status: 200 }));

      const result = await new SsoPortalClient("eu-west-1", "access").getRoleCredentials("111122223333", "Role");

      assert.deepStrictEqual(result, roleCredentials);
      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(
        url,
        "https://portal.sso.eu-west-1.amazonaws.com/federation/credentials?account_id=111122223333&role_name=Role"
      );
      assert.deepStrictEqual(init.headers, { "x-amz-sso_bearer_token": "access" });
    });

    void it("raises SsoUnauthorizedError on 401", async () => {
      route(() => ({ body: { message: "Session token not found or invalid" }, status: 401 }));

      await assert.rejects(
        new SsoPortalClient("eu-west-1", "access").getRoleCredentials("111122223333", "Role"),
        SsoUnauthorizedError
      );
    });

    void it("raises a generic error on other failures", async () => {
      route(() => ({ body: { message: "No access" }, status: 403 }));

      await assert.rejects(
        new SsoPortalClient("eu-west-1", "access").getRoleCredentials("111122223333", "Role"),
        /SSO portal error: 403/
      );
    });
  });

  void describe("findAccountIdForRole", () => {
    const rolesByAccount: Record<string, string[]> = {
      "111111111111": ["ReadOnly"],
      "222222222222": ["ReadOnly", "BedrockUser"],
      "333333333333": ["Admin"],
    };

    const portal = (url: URL) => {
      if (url.pathname === "/assignment/accounts") {
        // Two pages to exercise pagination.
        return url.searchParams.get("next_token") === "page-2"
          ? { body: { accountList: [{ accountId: "333333333333" }] }, status: 200 }
          : {
              body: { accountList: [{ accountId: "111111111111" }, { accountId: "222222222222" }], nextToken: "page-2" },
              status: 200,
            };
      }

      const accountId = url.searchParams.get("account_id") ?? "";

      return { body: { roleList: rolesByAccount[accountId].map((roleName) => ({ roleName })) }, status: 200 };
    };

    void it("returns the single account exposing the role", async () => {
      route(portal);

      const accountId = await new SsoPortalClient("eu-west-1", "access").findAccountIdForRole("BedrockUser");

      assert.strictEqual(accountId, "222222222222");
    });

    void it("searches accounts beyond the first page", async () => {
      route(portal);

      const accountId = await new SsoPortalClient("eu-west-1", "access").findAccountIdForRole("Admin");

      assert.strictEqual(accountId, "333333333333");
    });

    void it("fails when the role is in several accounts", async () => {
      route(portal);

      await assert.rejects(
        new SsoPortalClient("eu-west-1", "access").findAccountIdForRole("ReadOnly"),
        /set sso_account_id/
      );
    });

    void it("fails when no account exposes the role", async () => {
      route(portal);

      await assert.rejects(
        new SsoPortalClient("eu-west-1", "access").findAccountIdForRole("Missing"),
        /No account exposes the SSO role "Missing"/
      );
    });
  });
});
