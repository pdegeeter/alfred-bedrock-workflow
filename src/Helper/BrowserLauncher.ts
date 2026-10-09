import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Opens URLs in a macOS browser.
 */
export class BrowserLauncher {
  /**
   * @param url - HTTPS URL to open
   * @param app - Application name or path; the default browser when empty
   */
  async open(url: string, app?: string): Promise<void> {
    if (!url.startsWith("https://")) {
      throw new Error(`Refusing to open non-HTTPS URL: ${url}`);
    }

    await promisify(execFile)("open", app ? ["-a", app, url] : [url]);
  }
}
