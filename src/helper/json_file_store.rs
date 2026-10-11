use std::fs::{self, DirBuilder, OpenOptions};
use std::io::Write;
use std::marker::PhantomData;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::PathBuf;
use std::process;

use serde::Serialize;
use serde::de::DeserializeOwned;

/// JSON file readable by the current user only, written atomically.
pub struct JsonFileStore<T> {
    path: PathBuf,
    value: PhantomData<T>,
}

impl<T: DeserializeOwned + Serialize> JsonFileStore<T> {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            value: PhantomData,
        }
    }

    /// `None` when the file is missing or corrupt.
    pub fn read(&self) -> Option<T> {
        let content = fs::read_to_string(&self.path).ok()?;

        serde_json::from_str(&content).ok()
    }

    /// # Errors
    /// When the directory or the file cannot be written.
    pub fn write(&self, value: &T) -> anyhow::Result<()> {
        if let Some(dir) = self.path.parent() {
            DirBuilder::new().recursive(true).mode(0o700).create(dir)?;
        }

        let mut tmp_path = self.path.clone().into_os_string();
        tmp_path.push(format!(".{}.tmp", process::id()));

        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(&tmp_path)?;
        file.write_all(&serde_json::to_vec(value)?)?;
        fs::rename(&tmp_path, &self.path)?;

        Ok(())
    }
}
