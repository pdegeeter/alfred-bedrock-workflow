use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

use tempfile::TempDir;

/// Fake `aws` executable recording its invocations and the PATH it received.
///
/// Modes:
/// - `session`: export-credentials returns temporary credentials
/// - `long-term`: export-credentials returns keys without session token nor expiration
/// - `expired`: export-credentials fails with an expired SSO token until `sso login` runs
/// - `missing-profile`: export-credentials fails with an unknown profile
pub struct FakeAwsCli {
    dir: TempDir,
}

impl FakeAwsCli {
    const SCRIPT: &str = r#"#!/bin/sh
DIR="__DIR__"
echo "$*" >> "$DIR/calls.log"
echo "$PATH" > "$DIR/path.log"
if [ "$1" = "sso" ]; then
  touch "$DIR/logged-in"
  exit 0
fi
case "$(cat "$DIR/mode")" in
  long-term)
    echo '{"Version":1,"AccessKeyId":"AKIALONGTERM","SecretAccessKey":"SK"}'
    ;;
  expired)
    if [ ! -f "$DIR/logged-in" ]; then
      echo "Error when retrieving token from sso: Token has expired and refresh failed" >&2
      exit 255
    fi
    echo "{\"Version\":1,\"AccessKeyId\":\"ASIA\",\"SecretAccessKey\":\"SK\",\"SessionToken\":\"ST\",\"Expiration\":\"$(cat "$DIR/expiration")\"}"
    ;;
  missing-profile)
    echo "The config profile ($4) could not be found" >&2
    exit 255
    ;;
  *)
    echo "{\"Version\":1,\"AccessKeyId\":\"ASIA\",\"SecretAccessKey\":\"SK\",\"SessionToken\":\"ST\",\"Expiration\":\"$(cat "$DIR/expiration")\"}"
    ;;
esac
"#;

    /// Session mode, credentials expiring in one hour.
    pub fn new() -> Self {
        let dir = TempDir::new().unwrap();
        let script = dir.path().join("aws");
        fs::write(
            &script,
            Self::SCRIPT.replace("__DIR__", &dir.path().display().to_string()),
        )
        .unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();

        let cli = Self { dir };
        cli.set_mode("session");
        cli.set_expiration(&FakeAwsCli::in_one_hour());

        cli
    }

    /// Value for the `aws_cli_path` variable.
    pub fn path(&self) -> String {
        self.dir.path().join("aws").display().to_string()
    }

    pub fn calls(&self) -> Vec<String> {
        fs::read_to_string(self.dir.path().join("calls.log"))
            .map(|log| log.lines().map(str::to_owned).collect())
            .unwrap_or_default()
    }

    /// PATH of the last invocation.
    pub fn last_path(&self) -> String {
        fs::read_to_string(self.dir.path().join("path.log"))
            .unwrap()
            .trim()
            .to_owned()
    }

    pub fn set_mode(&self, mode: &str) {
        fs::write(self.dir.path().join("mode"), mode).unwrap();
    }

    /// RFC 3339 date, as `aws configure export-credentials` prints it.
    pub fn set_expiration(&self, expiration: &str) {
        fs::write(self.dir.path().join("expiration"), expiration).unwrap();
    }

    pub fn dir(&self) -> PathBuf {
        self.dir.path().to_path_buf()
    }

    fn in_one_hour() -> String {
        let expiration = time::OffsetDateTime::now_utc() + time::Duration::hours(1);

        expiration
            .format(&time::format_description::well_known::Rfc3339)
            .unwrap()
    }
}
