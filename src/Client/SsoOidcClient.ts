import { setTimeout as sleep } from "node:timers/promises";

import type { DeviceAuthorization } from "../Type/DeviceAuthorization.js";
import type { SsoClientRegistration } from "../Type/SsoClientRegistration.js";
import type { SsoToken } from "../Type/SsoToken.js";

/**
 * Client for the IAM Identity Center OIDC API (device authorization grant).
 */
export class SsoOidcClient {
  private static readonly CLIENT_NAME = "alfred-bedrock-workflow";
  private static readonly DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
  private static readonly SCOPES = ["sso:account:access"];

  private readonly baseUrl: string;

  constructor(region: string) {
    this.baseUrl = `https://oidc.${region}.amazonaws.com`;
  }

  /**
   * Registers a public OIDC client. Requesting scopes makes CreateToken return a refresh token.
   */
  async register(): Promise<SsoClientRegistration> {
    const data = (await this.post("/client/register", {
      clientName: SsoOidcClient.CLIENT_NAME,
      clientType: "public",
      scopes: SsoOidcClient.SCOPES,
    })) as { clientId: string; clientSecret: string; clientSecretExpiresAt: number };

    return {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      expiresAt: data.clientSecretExpiresAt * 1000,
    };
  }

  /**
   * Starts a device authorization the user approves in the browser.
   */
  async startDeviceAuthorization(
    registration: SsoClientRegistration,
    startUrl: string
  ): Promise<DeviceAuthorization> {
    const data = (await this.post("/device_authorization", {
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      startUrl,
    })) as { deviceCode: string; expiresIn: number; interval?: number; verificationUriComplete: string };

    return {
      deviceCode: data.deviceCode,
      expiresAt: Date.now() + data.expiresIn * 1000,
      interval: data.interval ?? 5,
      verificationUriComplete: data.verificationUriComplete,
    };
  }

  /**
   * Polls CreateToken until the user approves the device authorization.
   * @throws When the authorization is denied or expires
   */
  async waitForDeviceToken(
    registration: SsoClientRegistration,
    authorization: DeviceAuthorization
  ): Promise<SsoToken> {
    let interval = authorization.interval;

    while (Date.now() < authorization.expiresAt) {
      const response = await this.request("/token", {
        clientId: registration.clientId,
        clientSecret: registration.clientSecret,
        deviceCode: authorization.deviceCode,
        grantType: SsoOidcClient.DEVICE_GRANT,
      });

      if (response.ok) {
        return SsoOidcClient.toToken(await response.json());
      }

      const error = await SsoOidcClient.readError(response);
      if (error === "slow_down") {
        interval += 5;
      } else if (error !== "authorization_pending") {
        throw new Error(`SSO login failed: ${error}`);
      }

      await sleep(interval * 1000);
    }

    throw new Error("SSO login timed out: authorization was not approved in time");
  }

  /**
   * Exchanges a refresh token for a new access token.
   */
  async refresh(registration: SsoClientRegistration, refreshToken: string): Promise<SsoToken> {
    const data = await this.post("/token", {
      clientId: registration.clientId,
      clientSecret: registration.clientSecret,
      grantType: "refresh_token",
      refreshToken,
    });

    return SsoOidcClient.toToken(data);
  }

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.request(path, body);

    if (!response.ok) {
      throw new Error(`SSO OIDC error: ${String(response.status)} ${await SsoOidcClient.readError(response)}`);
    }

    return response.json();
  }

  private request(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  private static async readError(response: Response): Promise<string> {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as { error?: string };

      return data.error ?? text;
    } catch {
      return text;
    }
  }

  private static toToken(data: unknown): SsoToken {
    const token = data as { accessToken: string; expiresIn: number; refreshToken?: string };

    return {
      accessToken: token.accessToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
      ...(token.refreshToken && { refreshToken: token.refreshToken }),
    };
  }
}
