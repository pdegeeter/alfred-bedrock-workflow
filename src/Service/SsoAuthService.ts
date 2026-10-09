import { SsoOidcClient } from "../Client/SsoOidcClient.js";
import { BrowserLauncher } from "../Helper/BrowserLauncher.js";
import type { TokenCache } from "../Helper/TokenCache.js";
import type { SsoClientRegistration } from "../Type/SsoClientRegistration.js";
import type { SsoConfig } from "../Type/SsoConfig.js";

/**
 * Maintains an IAM Identity Center access token: cache, then refresh token, then browser login.
 */
export class SsoAuthService {
  private static readonly REGISTRATION_MARGIN_MS = 24 * 60 * 60 * 1000;
  private static readonly TOKEN_MARGIN_MS = 60 * 1000;

  private readonly cache: TokenCache;
  private readonly config: SsoConfig;
  private readonly oidc: SsoOidcClient;

  constructor(config: SsoConfig, cache: TokenCache) {
    this.cache = cache;
    this.config = config;
    this.oidc = new SsoOidcClient(config.region);
  }

  /**
   * Returns a valid access token. May open the browser and wait for the user to approve the login.
   */
  async getAccessToken(): Promise<string> {
    const { ssoToken } = this.cache.load();

    if (ssoToken && ssoToken.expiresAt - SsoAuthService.TOKEN_MARGIN_MS > Date.now()) {
      return ssoToken.accessToken;
    }

    const registration = await this.getRegistration();

    if (ssoToken?.refreshToken) {
      try {
        const refreshed = await this.oidc.refresh(registration, ssoToken.refreshToken);
        this.cache.update((state) => {
          state.ssoToken = { refreshToken: ssoToken.refreshToken, ...refreshed };
        });

        return refreshed.accessToken;
      } catch {
        // Refresh token expired with the SSO session: fall back to an interactive login.
      }
    }

    return this.login(registration);
  }

  /**
   * Drops the cached access token so the next call logs in again.
   */
  invalidate(): void {
    this.cache.update((state) => {
      delete state.ssoToken;
    });
  }

  private async login(registration: SsoClientRegistration): Promise<string> {
    let authorization = this.cache.load().pendingAuthorization;

    // A pending authorization survives Alfred killing the script while the user approves in the browser.
    if (!authorization || authorization.expiresAt <= Date.now()) {
      authorization = await this.oidc.startDeviceAuthorization(registration, this.config.startUrl);
      const pending = authorization;
      this.cache.update((state) => {
        state.pendingAuthorization = pending;
      });
      await new BrowserLauncher().open(authorization.verificationUriComplete, this.config.browser);
    }

    try {
      const token = await this.oidc.waitForDeviceToken(registration, authorization);
      this.cache.update((state) => {
        state.ssoToken = token;
        delete state.pendingAuthorization;
      });

      return token.accessToken;
    } catch (error) {
      this.cache.update((state) => {
        delete state.pendingAuthorization;
      });
      throw error;
    }
  }

  private async getRegistration(): Promise<SsoClientRegistration> {
    const { registration } = this.cache.load();

    if (registration && registration.expiresAt - SsoAuthService.REGISTRATION_MARGIN_MS > Date.now()) {
      return registration;
    }

    const registered = await this.oidc.register();
    this.cache.update((state) => {
      state.registration = registered;
      // Tokens and authorizations are bound to the previous client.
      delete state.pendingAuthorization;
      delete state.ssoToken;
    });

    return registered;
  }
}
