import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Fake `aws` executable put first on the PATH, recording its invocations.
 *
 * Modes:
 * - `session`: export-credentials returns temporary credentials
 * - `long-term`: export-credentials returns keys without session token nor expiration
 * - `expired`: export-credentials fails with an expired SSO token until `sso login` runs
 * - `missing-profile`: export-credentials fails with an unknown profile
 */
export class FakeAwsCli {
  private static readonly SCRIPT = `#!/bin/sh
echo "$*" >> "$FAKE_AWS_DIR/calls.log"
if [ "$1" = "sso" ]; then
  touch "$FAKE_AWS_DIR/logged-in"
  exit 0
fi
case "$(cat "$FAKE_AWS_DIR/mode")" in
  long-term)
    echo '{"Version":1,"AccessKeyId":"AKIALONGTERM","SecretAccessKey":"SK"}'
    ;;
  expired)
    if [ ! -f "$FAKE_AWS_DIR/logged-in" ]; then
      echo "Error when retrieving token from sso: Token has expired and refresh failed" >&2
      exit 255
    fi
    echo "{\\"Version\\":1,\\"AccessKeyId\\":\\"ASIA\\",\\"SecretAccessKey\\":\\"SK\\",\\"SessionToken\\":\\"ST\\",\\"Expiration\\":\\"$(cat "$FAKE_AWS_DIR/expiration")\\"}"
    ;;
  missing-profile)
    echo "The config profile ($4) could not be found" >&2
    exit 255
    ;;
  *)
    echo "{\\"Version\\":1,\\"AccessKeyId\\":\\"ASIA\\",\\"SecretAccessKey\\":\\"SK\\",\\"SessionToken\\":\\"ST\\",\\"Expiration\\":\\"$(cat "$FAKE_AWS_DIR/expiration")\\"}"
    ;;
esac
`;

  private readonly dir: string;
  private readonly originalPath: string | undefined;

  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), "fake-aws-"));
    this.originalPath = process.env["PATH"];

    writeFileSync(join(this.dir, "aws"), FakeAwsCli.SCRIPT);
    chmodSync(join(this.dir, "aws"), 0o755);
    process.env["FAKE_AWS_DIR"] = this.dir;
    process.env["PATH"] = `${this.dir}:${this.originalPath ?? ""}`;
    this.setMode("session");
    this.setExpiration(new Date(Date.now() + 3_600_000));
  }

  /** Arguments of each invocation, in order. */
  get calls(): string[] {
    const log = join(this.dir, "calls.log");

    return existsSync(log) ? readFileSync(log, "utf-8").trim().split("\n") : [];
  }

  setMode(mode: "expired" | "long-term" | "missing-profile" | "session"): void {
    writeFileSync(join(this.dir, "mode"), mode);
  }

  setExpiration(expiration: Date): void {
    writeFileSync(join(this.dir, "expiration"), expiration.toISOString());
  }

  restore(): void {
    process.env["PATH"] = this.originalPath;
    delete process.env["FAKE_AWS_DIR"];
    rmSync(this.dir, { force: true, recursive: true });
  }
}
