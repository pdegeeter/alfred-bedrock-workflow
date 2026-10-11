use std::env;
use std::io::{ErrorKind, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use anyhow::{Context, bail};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::helper::JsonField;
use crate::types::AwsCredentials;

/// Wrapper around the AWS CLI v2, which resolves any configured profile
/// (IAM Identity Center, `credential_process` such as Granted, static keys).
pub struct AwsCliClient {
    path: PathBuf,
}

impl AwsCliClient {
    /// Install locations of Homebrew on Apple Silicon and Intel, missing from the PATH Alfred runs scripts with.
    const INSTALL_DIRS: [&str; 2] = ["/opt/homebrew/bin", "/usr/local/bin"];
    const EXECUTABLE: &str = "aws";
    const POLL_INTERVAL: Duration = Duration::from_millis(50);
    const SYSTEM_PATH: &str = "/usr/bin:/bin:/usr/sbin:/sbin";
    /// Leaves time to approve a browser login, short enough not to freeze Alfred.
    const TIMEOUT: Duration = Duration::from_secs(120);

    /// `configured` when set, else the first Homebrew install found, else `aws` from the PATH.
    pub fn locate(configured: Option<&str>) -> Self {
        let path = configured.map_or_else(
            || {
                Self::INSTALL_DIRS
                    .iter()
                    .map(|dir| Path::new(dir).join(Self::EXECUTABLE))
                    .find(|path| path.is_file())
                    .unwrap_or_else(|| PathBuf::from(Self::EXECUTABLE))
            },
            PathBuf::from,
        );

        Self { path }
    }

    /// # Errors
    /// When the profile cannot provide credentials, with the AWS CLI error message.
    pub fn export_credentials(&self, profile: &str) -> anyhow::Result<AwsCredentials> {
        let stdout = self.run(&[
            "configure",
            "export-credentials",
            "--profile",
            profile,
            "--format",
            "process",
        ])?;
        let data = serde_json::from_str(&stdout).context("Invalid output of aws configure export-credentials")?;
        let expiration = JsonField::optional_string(&data, "Expiration")
            .map(|value| OffsetDateTime::parse(&value, &Rfc3339))
            .transpose()
            .context("Invalid credentials expiration")?
            .map(|date| i64::try_from(date.unix_timestamp_nanos() / 1_000_000).expect("expiration fits in i64"));

        Ok(AwsCredentials {
            access_key_id: JsonField::string(&data, "AccessKeyId")?,
            expiration,
            secret_access_key: JsonField::string(&data, "SecretAccessKey")?,
            session_token: JsonField::optional_string(&data, "SessionToken"),
        })
    }

    /// Opens the browser to log in to IAM Identity Center for the profile.
    ///
    /// # Errors
    /// When the login fails or is not approved in time.
    pub fn sso_login(&self, profile: &str) -> anyhow::Result<()> {
        self.run(&["sso", "login", "--profile", profile])?;

        Ok(())
    }

    fn run(&self, args: &[&str]) -> anyhow::Result<String> {
        let name = format!("aws {}", args[..2].join(" "));
        let spawned = Command::new(&self.path)
            .args(args)
            .env("PATH", self.child_path())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = match spawned {
            Ok(child) => child,
            Err(error) if error.kind() == ErrorKind::NotFound => {
                bail!(
                    "AWS CLI not found at {}: install it or set aws_cli_path",
                    self.path.display()
                )
            }
            Err(error) => return Err(error).with_context(|| format!("Cannot run {name}")),
        };
        let stdout = Self::drain(child.stdout.take());
        let stderr = Self::drain(child.stderr.take());
        let deadline = Instant::now() + Self::TIMEOUT;

        let status = loop {
            if let Some(status) = child.try_wait()? {
                break status;
            }
            if Instant::now() >= deadline {
                child.kill().ok();
                child.wait().ok();
                bail!(
                    "{name} timed out after {}s: was the browser login approved?",
                    Self::TIMEOUT.as_secs()
                );
            }
            thread::sleep(Self::POLL_INTERVAL);
        };
        let stdout = stdout.join().unwrap_or_default();
        let stderr = stderr.join().unwrap_or_default();

        if !status.success() {
            let message = if stderr.trim().is_empty() {
                status.to_string()
            } else {
                stderr.trim().to_owned()
            };
            bail!("{name} failed: {message}");
        }

        Ok(stdout)
    }

    /// PATH of the AWS CLI process, so that `credential_process` helpers such as Granted resolve.
    fn child_path(&self) -> String {
        let cli_dir = self
            .path
            .parent()
            .filter(|dir| !dir.as_os_str().is_empty())
            .map(|dir| dir.display().to_string());
        let inherited = env::var("PATH").unwrap_or_else(|_| Self::SYSTEM_PATH.to_owned());

        cli_dir
            .into_iter()
            .chain(Self::INSTALL_DIRS.iter().map(|dir| (*dir).to_owned()))
            .chain([inherited])
            .collect::<Vec<_>>()
            .join(":")
    }

    fn drain(pipe: Option<impl Read + Send + 'static>) -> JoinHandle<String> {
        thread::spawn(move || {
            let mut output = String::new();
            if let Some(mut pipe) = pipe {
                pipe.read_to_string(&mut output).ok();
            }

            output
        })
    }
}
