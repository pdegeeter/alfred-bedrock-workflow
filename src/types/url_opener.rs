/// Opens a URL for the user to act on, such as an SSO login page.
pub trait UrlOpener {
    /// # Errors
    /// When the URL is not HTTPS or cannot be opened.
    fn open(&self, url: &str) -> anyhow::Result<()>;
}
