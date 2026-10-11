use std::collections::HashMap;
use std::env;
use std::rc::Rc;
use std::sync::Arc;

use alfred_bedrock::client::UreqHttpClient;
use alfred_bedrock::command::{AspellCommand, BedrockCommand, CommandRunner, TranslateCommand};
use alfred_bedrock::helper::{AlfredOutput, BrowserLauncher};
use anyhow::anyhow;

/// Usage: `alfred-bedrock <aspell|bedrock|translate> <query>`, configured by the Alfred workflow variables.
fn main() {
    let mut args = env::args_os().skip(1).map(|arg| arg.to_string_lossy().into_owned());
    let command = args.next().unwrap_or_default();
    let query = args.next().unwrap_or_default();
    let variables: HashMap<String, String> = env::vars_os()
        .filter_map(|(name, value)| Some((name.into_string().ok()?, value.into_string().ok()?)))
        .collect();
    let browser = variables.get("browser").filter(|browser| !browser.is_empty()).cloned();
    let runner = CommandRunner::new(
        variables,
        Arc::new(UreqHttpClient::new()),
        Rc::new(BrowserLauncher::new(browser)),
    );

    let result = match command.as_str() {
        "aspell" => AspellCommand::run(&runner, &query),
        "bedrock" => BedrockCommand::run(&runner, &query),
        "translate" => TranslateCommand::run(&runner, &query),
        other => Err(anyhow!("Unknown command \"{other}\": use aspell, bedrock or translate")),
    };
    let output = result.unwrap_or_else(|error| AlfredOutput::error(&format!("Error: {error:#}")));

    println!("{output}");
}
