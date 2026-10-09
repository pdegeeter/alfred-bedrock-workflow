import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Opens URLs in the default macOS browser.
 */
export class BrowserLauncher {
  async open(url: string): Promise<void> {
    if (!url.startsWith("https://")) {
      throw new Error(`Refusing to open non-HTTPS URL: ${url}`);
    }

    await promisify(execFile)("open", [url]);
  }
}
