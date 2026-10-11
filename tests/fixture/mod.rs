//! Test doubles shared by the integration tests; each test crate uses a subset of them.
#![allow(dead_code, unused_imports)]

mod cache_file;
mod fake_aws_cli;
mod fake_identity_center;
mod recorded_request;
mod recording_opener;
mod stub_http_client;

pub use cache_file::CacheFile;
pub use fake_aws_cli::FakeAwsCli;
pub use fake_identity_center::FakeIdentityCenter;
pub use recorded_request::RecordedRequest;
pub use recording_opener::RecordingOpener;
pub use stub_http_client::StubHttpClient;
