//! Alfred workflow for Amazon Bedrock: one binary serving the `aspell`, `bedrock` and `translate` commands.

pub mod client;
pub mod command;
pub mod error;
pub mod helper;
pub mod service;
pub mod types;
