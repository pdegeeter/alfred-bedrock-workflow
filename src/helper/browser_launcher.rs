use std::process::Command;

use anyhow::{Context, bail};

use crate::types::UrlOpener;

/// Opens URLs in a macOS browser.
pub struct BrowserLauncher {
    app: Option<String>,
}

impl BrowserLauncher {
    const OPEN: &str = "/usr/bin/open";

    /// `app`: application name or path; the default browser when `None`.
    pub fn new(app: Option<String>) -> Self {
        Self { app }
    }
}

impl UrlOpener for BrowserLauncher {
    fn open(&self, url: &str) -> anyhow::Result<()> {
        if !url.starts_with("https://") {
            bail!("Refusing to open non-HTTPS URL: {url}");
        }

        let mut command = Command::new(Self::OPEN);
        if let Some(app) = &self.app {
            command.args(["-a", app]);
        }
        let output = command.arg(url).output().context("Cannot run open")?;

        if !output.status.success() {
            bail!(
                "Cannot open the browser: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }

        Ok(())
    }
}
