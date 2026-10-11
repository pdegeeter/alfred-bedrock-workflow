# CLAUDE.md

This file provides guidance to Claude Code when working on this project.

## Project Overview

Alfred Bedrock Workflow is an Alfred workflow, written in Rust, that integrates with Amazon Bedrock to provide AI responses directly from Alfred. It ships as one arm64 binary, `alfred-bedrock <aspell|bedrock|translate> <query>`, with no dependency on the user environment (Node.js, shell `PATH`).

## Build & Test Commands

- `make check` - `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` (`pedantic` enabled in `Cargo.toml`) and `cargo test`; the CI runs this target
- `make fmt` - Format code (`rustfmt.toml`)
- `make build` - Build the release binary and package `bedrock.alfredworkflow` (`scripts/build-workflow.sh`)
- `make install` - Same, then open the package in Alfred
- `make clean` - Remove build outputs

CI (`.github/workflows/ci.yml`) runs `make check` on `macos-latest`. Releases are managed by release-please (`.github/workflows/release-please.yml`): conventional commits on `main` feed a release PR that bumps `Cargo.toml`, `Cargo.lock` and `info.plist` (XML updater on the top-level `version` key) and updates `CHANGELOG.md`; merging it tags the release, and the `upload` job attaches `bedrock.alfredworkflow`. Never bump versions by hand. Commit messages and PR titles must follow Conventional Commits.

How the workflow works is documented in `docs/`: `architecture.md`, `authentication.md`, `bedrock-requests.md`.

## Architecture

```
src/
├── main.rs   # Composition root: reads args and variables, wires the adapters, prints Alfred JSON
├── lib.rs
├── client/   # Bedrock Runtime, IAM Identity Center OIDC and portal APIs, AWS CLI, ureq HTTP adapter
├── command/  # aspell, bedrock, translate and the shared CommandRunner
├── error/
├── helper/   # Alfred output, region detection, short-term key signing, file cache, translation query
├── service/  # Credentials sources, SSO login and Bedrock token resolution
└── types/    # Shared structs and traits (one per file), including the HttpClient and UrlOpener ports

tests/
├── fixture/  # Stub HTTP client, fake IAM Identity Center, fake `aws` executable, recording URL opener
└── *.rs      # One integration test crate per client or service

docs/         # How the workflow works: architecture, authentication, Bedrock requests
```

External systems are behind two traits injected from `main.rs`: `HttpClient` (`UreqHttpClient`, rustls with bundled roots) and `UrlOpener` (`BrowserLauncher`, `/usr/bin/open`). Tests replace them with the fixtures; production code has no test-only hooks.

## Key Dependencies

- `ureq` - Blocking HTTPS client with rustls
- `serde`, `serde_json` - JSON bodies and the `auth.json` cache
- `hmac`, `sha2`, `hex`, `base64` - SigV4 signing of short-term keys
- `time` - SigV4 dates and AWS CLI expiration parsing
- `anyhow` - Error propagation; `SsoUnauthorizedError` is matched with `Error::is`
- `tempfile` (dev) - Temporary cache directories and fake `aws` executable

## Alfred Configuration Variables

- `token` (optional) - Static Bedrock API bearer token
- `aws_profile` (optional) - AWS CLI profile whose credentials sign short-term keys (`aws configure export-credentials`)
- `aws_cli_path` (optional) - AWS CLI location; default: `/opt/homebrew/bin/aws`, `/usr/local/bin/aws`, then `aws` from the `PATH`. The CLI runs with its own directory and the Homebrew directories prepended to its `PATH`, so `credential_process` helpers (Granted) resolve
- `sso_start_url`, `sso_role_name` (optional) - IAM Identity Center portal URL and role used to generate short-term keys when no static token is set
- `sso_region` (optional) - IAM Identity Center region, default: `eu-west-1`
- `sso_account_id` (optional) - AWS account of the role, auto-discovered when the role exists in a single account
- `browser` (optional) - Application opening the SSO login page (`open -a`), default browser when empty

All authentication variables are listed in `variablesdontexport`. Never commit real SSO URLs, role names or account IDs: their values live in Alfred's `prefs.plist` (git-ignored).
- `model` (optional) - Dropdown selection of available models, default: `eu.anthropic.claude-haiku-5-5`
- `level` (optional) - Effort level of Claude 5 models (`low`, `medium`, `high`, `xhigh`, `max`), default: `low` (closest to Claude Haiku 4.5, which ran without thinking)
- `default_lang` (optional) - Default target language for translations

Region is auto-detected from model prefix (`eu.` → `eu-west-1`, `us.`/`global.` → `us-east-1`).

`ModelFeatures` switches the Converse request by model generation: Claude 5 models get `additionalModelRequestFields.output_config.effort`, no `temperature` (rejected with a 400); older models get `temperature` and no effort. `maxTokens` is the model's output limit (Claude 5: 128000, Claude 4: 64000, Opus 4/4.1: 32000, unknown: 4096): it only caps the output, and thinking counts toward it. Responses may start with reasoning blocks, so the client joins the text blocks instead of reading the first one.

## Bedrock Token Resolution

`BedrockTokenProvider` resolves the bearer token in this order:

1. `token` variable
2. A `CredentialsSource`, when configured:
   - `AwsProfileCredentialsSource` (`aws_profile`): `aws configure export-credentials`, with one `aws sso login` retry on an expired SSO session
   - `SsoCredentialsSource` (`sso_*`): IAM Identity Center access token (cache → refresh token → browser device login) → `GetRoleCredentials`

   A cached short-term key for `<source key prefix>:<region>` is reused (keys are region-bound); otherwise the credentials sign a new one as a SigV4-presigned `CallWithBearerToken` URL (`BedrockTokenGenerator`, byte-identical to `@aws/bedrock-token-generator`)
3. `AWS_BEARER_TOKEN_BEDROCK`, last so an ambient variable never hides an explicit configuration

A key is cached until `min(generation + 12h, credentials expiration)`, minus a 5-minute margin. State is stored in `$alfred_workflow_cache/auth.json` (mode 0600), in the same camelCase layout as the 1.x TypeScript workflow so upgrades keep the SSO session. A pending device authorization is persisted so a process killed by Alfred resumes polling instead of opening a new browser tab.

## Alfred Workflow Triggers

Each command has three entry points:

1. **Script Filter** - Keyword-triggered (e.g., `bedrock`, `aspell`, `translate`)
2. **Universal Action** - Text selection via Alfred Universal Actions
3. **Hotkey** - Configurable keyboard shortcut with "Selection in macOS"

All triggers connect to the same Script Filter, then to outputs (Text View, Copy, Paste). Each Script Filter runs `./alfred-bedrock <command> "$1"`, without sourcing any shell profile.

## Code Style

- Clippy `pedantic` (minus `missing_errors_doc`, `missing_panics_doc`, `must_use_candidate`), `unsafe_code` forbidden
- `rustfmt` with `max_width = 120`
- One struct, enum or trait per file, re-exported by the module's `mod.rs`
- Constants and helpers are associated items of their type, never free items above it
- Expiry is tested by editing `auth.json` through `tests/fixture/CacheFile`, not by injecting a clock

## Documentation

Update `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` and `docs/` when:

- Adding new source files or directories
- Adding new commands or scripts
- Changing the project architecture
- Adding new dependencies

## Running the Workflow

`make install` builds and imports the workflow into Alfred. The binary can also be run directly, configured through environment variables like Alfred does:

```bash
token=<bedrock-api-key> ./target/release/alfred-bedrock translate ":fr Hello world"
```
