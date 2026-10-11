use std::cell::RefCell;

use alfred_bedrock::types::UrlOpener;

/// Records the URLs instead of opening a browser.
#[derive(Default)]
pub struct RecordingOpener {
    urls: RefCell<Vec<String>>,
}

impl RecordingOpener {
    pub fn urls(&self) -> Vec<String> {
        self.urls.borrow().clone()
    }
}

impl UrlOpener for RecordingOpener {
    fn open(&self, url: &str) -> anyhow::Result<()> {
        self.urls.borrow_mut().push(url.to_owned());

        Ok(())
    }
}
