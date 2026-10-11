import { SsoUnauthorizedError } from "../Error/SsoUnauthorizedError.js";
import type { AwsCredentials } from "../Type/AwsCredentials.js";

/**
 * Client for the IAM Identity Center portal API (accounts, roles, role credentials).
 */
export class SsoPortalClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(region: string, accessToken: string) {
    this.accessToken = accessToken;
    this.baseUrl = `https://portal.sso.${region}.amazonaws.com`;
  }

  /**
   * Returns temporary credentials for a role the user is assigned to.
   */
  async getRoleCredentials(accountId: string, roleName: string): Promise<AwsCredentials> {
    const data = (await this.get("/federation/credentials", {
      account_id: accountId,
      role_name: roleName,
    })) as {
      roleCredentials: {
        accessKeyId: string;
        expiration: number;
        secretAccessKey: string;
        sessionToken: string;
      };
    };

    return data.roleCredentials;
  }

  /**
   * Finds the only account in which the user is assigned the given role.
   * @throws When no account or several accounts expose the role
   */
  async findAccountIdForRole(roleName: string): Promise<string> {
    const accountIds = await this.listAccountIds();
    const exposesRole = await Promise.all(
      accountIds.map(async (accountId) => {
        const roles = await this.paginate("/assignment/roles", "roleList", { account_id: accountId });

        return (roles as Array<{ roleName: string }>).some((role) => role.roleName === roleName);
      })
    );
    const matches = accountIds.filter((_, index) => exposesRole[index]);

    if (matches.length === 0) {
      throw new Error(`No account exposes the SSO role "${roleName}"`);
    }
    if (matches.length > 1) {
      throw new Error(`Several accounts expose the SSO role "${roleName}": set sso_account_id`);
    }

    return matches[0];
  }

  private async listAccountIds(): Promise<string[]> {
    const accounts = await this.paginate("/assignment/accounts", "accountList", {});

    return (accounts as Array<{ accountId: string }>).map((account) => account.accountId);
  }

  private async paginate(path: string, listKey: string, params: Record<string, string>): Promise<unknown[]> {
    const items: unknown[] = [];
    let nextToken: string | undefined;

    do {
      const data = (await this.get(path, {
        ...params,
        max_result: "100",
        ...(nextToken && { next_token: nextToken }),
      })) as Record<string, unknown>;
      items.push(...((data[listKey] as unknown[] | undefined) ?? []));
      nextToken = data["nextToken"] as string | undefined;
    } while (nextToken);

    return items;
  }

  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}?${new URLSearchParams(params).toString()}`, {
      headers: { "x-amz-sso_bearer_token": this.accessToken },
      method: "GET",
    });

    if (response.status === 401) {
      throw new SsoUnauthorizedError("SSO session expired or revoked");
    }
    if (!response.ok) {
      throw new Error(`SSO portal error: ${String(response.status)} ${await response.text()}`);
    }

    return response.json();
  }
}
