import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { AwsCredentials } from "../Type/AwsCredentials.js";

/**
 * Wrapper around the AWS CLI v2, which resolves any configured profile
 * (IAM Identity Center, credential_process such as Granted, static keys).
 */
export class AwsCliClient {
  /** Leaves time to approve a browser login, short enough not to freeze Alfred. */
  private static readonly TIMEOUT_MS = 2 * 60 * 1000;

  /**
   * @throws When the profile cannot provide credentials, with the AWS CLI error message
   */
  async exportCredentials(profile: string): Promise<AwsCredentials> {
    const stdout = await AwsCliClient.run([
      "configure",
      "export-credentials",
      "--profile",
      profile,
      "--format",
      "process",
    ]);
    const data = JSON.parse(stdout) as {
      AccessKeyId: string;
      Expiration?: string;
      SecretAccessKey: string;
      SessionToken?: string;
    };

    return {
      accessKeyId: data.AccessKeyId,
      secretAccessKey: data.SecretAccessKey,
      ...(data.Expiration && { expiration: Date.parse(data.Expiration) }),
      ...(data.SessionToken && { sessionToken: data.SessionToken }),
    };
  }

  /**
   * Opens the browser to log in to IAM Identity Center for the profile.
   */
  async ssoLogin(profile: string): Promise<void> {
    await AwsCliClient.run(["sso", "login", "--profile", profile]);
  }

  private static async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await promisify(execFile)("aws", args, { timeout: AwsCliClient.TIMEOUT_MS });

      return stdout;
    } catch (error) {
      const { code, killed, stderr } = error as { code?: number | string; killed?: boolean; stderr?: string };
      if (code === "ENOENT") {
        throw new Error("AWS CLI not found: install it or add it to the PATH");
      }
      if (killed) {
        throw new Error(
          `aws ${args.slice(0, 2).join(" ")} timed out after ${String(AwsCliClient.TIMEOUT_MS / 1000)}s: was the browser login approved?`
        );
      }

      throw new Error(`aws ${args.slice(0, 2).join(" ")} failed: ${stderr?.trim() || String(error)}`);
    }
  }
}
