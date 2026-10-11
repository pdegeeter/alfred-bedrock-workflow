# Alfred Bedrock Workflow

An Alfred workflow to interact with Amazon Bedrock models directly from Alfred.

The workflow is a single native binary: it does not depend on Node.js, Python or your shell configuration.

## Requirements

- [Alfred 5+](https://www.alfredapp.com/) with Powerpack
- macOS on Apple Silicon (arm64)
- Amazon Bedrock API key (bearer token), an AWS CLI v2 profile, or an IAM Identity Center (SSO) role allowed to call Bedrock

## Installation

### From Release

1. Download `bedrock.alfredworkflow` from the [releases page](https://github.com/pdegeeter/alfred-bedrock-workflow/releases)
2. Double-click to install in Alfred
3. Configure authentication in the workflow settings

The binary is not notarized. If macOS refuses to run it, remove the quarantine flag from the installed workflow folder (Alfred → Workflows → right-click the workflow → Open in Finder):

```bash
xattr -dr com.apple.quarantine "<workflow folder>"
```

### From Source

Requires a [Rust toolchain](https://rustup.rs/) (stable).

1. Clone this repository
2. Build the workflow package and open it in Alfred:
   ```bash
   make install
   ```

## How It Works

See [`docs/`](docs/):

- [Architecture](docs/architecture.md): request flow, modules, configuration
- [Authentication](docs/authentication.md): token resolution, short-term keys, AWS CLI profile, IAM Identity Center login, cache
- [Bedrock requests](docs/bedrock-requests.md): region, request by model generation, prompts, response handling

Release notes are in [CHANGELOG.md](CHANGELOG.md), generated on each release.

### Configuration

Configure the following variables in Alfred workflow settings:

| Variable         | Required | Description                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `token`          | No\*     | Static Bedrock API bearer token                                           |
| `aws_profile`    | No\*     | AWS CLI profile used to generate short-term keys                          |
| `aws_cli_path`   | No       | Path of the AWS CLI, when not installed with Homebrew                     |
| `sso_start_url`  | No\*     | IAM Identity Center access portal URL                                     |
| `sso_role_name`  | No\*     | IAM Identity Center role (permission set) used to generate the key        |
| `sso_region`     | No       | IAM Identity Center region (default: `eu-west-1`)                         |
| `sso_account_id` | No       | AWS account of the role; auto-discovered if the role is in one account    |
| `browser`        | No       | Application opening the SSO login, e.g. `Brave Browser` (default browser) |
| `model`          | No       | Select from dropdown (default: Claude Haiku 5.5 EU)                       |
| `level`          | No       | Effort level of Claude 5 models: `low` (default), `medium`, `high`, `xhigh`, `max` |
| `default_lang`   | No       | Default target language for translations (e.g., en, fr, de)               |

\* Set one of `token`, `aws_profile`, or `sso_start_url` and `sso_role_name`. They are used in this order; `AWS_BEARER_TOKEN_BEDROCK` is the last resort.

Region is auto-detected from the model prefix.

### Authentication with an AWS CLI profile

Set `aws_profile` to any profile of your `~/.aws/config` (requires [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)). The workflow reads its credentials with `aws configure export-credentials` and signs a short-term key from them, cached like below.

Alfred runs workflows without your shell `PATH`, so the AWS CLI is looked up in this order: `aws_cli_path`, `/opt/homebrew/bin/aws`, `/usr/local/bin/aws`, then `aws` from the `PATH`. Set `aws_cli_path` when it is installed elsewhere (asdf, mise, pip...). The AWS CLI runs with its own directory and the Homebrew directories first on its `PATH`, so `credential_process` helpers installed with Homebrew, such as Granted, are found.

Login is handled by the profile itself:

- **IAM Identity Center profile**: when the session expired, the workflow runs `aws sso login --profile <profile>` and retries.
- **[Granted](https://docs.commonfate.io/granted/introduction) profile** (`credential_process = granted credential-process --auto-login --profile <profile>`): Granted opens its configured browser, and its browser extension confirms the login automatically.

This is the recommended setup when you already use the AWS CLI or Granted: one SSO session is shared by all your tools.

### Authentication with IAM Identity Center

Without AWS CLI, the workflow can log in to IAM Identity Center itself and generate a Bedrock [short-term API key](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.md) itself:

1. On first use, your browser opens the IAM Identity Center login page. Approve the request; Alfred shows the spinner until you do.
2. The workflow fetches temporary credentials for the configured role and signs a short-term key locally.
3. The key is cached and reused until it expires. Its lifetime is the shorter of 12 hours and the role session duration configured on the permission set.
4. When the key expires, a new one is generated silently as long as the IAM Identity Center session is valid; otherwise the browser opens again.

The role needs the `bedrock:CallWithBearerToken` permission in addition to the model invocation permissions. Keys are region-bound: switching between EU and US models generates one key per region.

Tokens are cached in Alfred's workflow cache folder (`auth.json`, readable only by your user). Delete this file to force a new login. The cache format is unchanged since 1.x: upgrading keeps your SSO session.

SSO settings are excluded from workflow exports.

> The [Granted browser extension](https://docs.commonfate.io/granted/introduction) blocks the confirmation of logins it did not start. If you use it, prefer `aws_profile` with a Granted profile.

## Usage

### bedrock - Ask AI

1. Open Alfred
2. Type `bedrock` followed by your question
3. Press Enter to view response

### aspell - Spell Check

1. Open Alfred
2. Type `aspell` followed by text to correct
3. Press Enter to view corrected text

The spell checker preserves the original language and formatting while fixing spelling and grammar errors.

### translate - Translate Text

1. Open Alfred
2. Type `translate` followed by text to translate
3. Use `:lang` prefix to specify target language (optional). Without the colon, only known codes (de, en, es, fr, it, ja, ko, nl, pl, pt, ru, zh) are read as a language, so text starting with a short word such as "Le chat" is translated as a whole

Examples:

- `translate Hello world` → translates to default language
- `translate :fr Hello world` → translates to French
- `translate :de Bonjour le monde` → translates to German

### Universal Actions

Select text anywhere in macOS and use Alfred's Universal Actions (default: `⌘⌥\`) to access:

- **Ask Bedrock**: Send selected text to Bedrock AI
- **Spell Check with Bedrock**: Correct spelling and grammar
- **Translate with Bedrock**: Translate selected text

### Hotkeys (Selection in macOS)

Configure custom hotkeys in Alfred to trigger commands with selected text:

1. Open the workflow in Alfred
2. Double-click on a Hotkey trigger
3. Set your preferred keyboard shortcut

Available hotkeys:

- Bedrock query with selection
- Spell check with selection
- Translate with selection

### Keyboard Shortcuts (all commands)

- **Enter**: View response in Text View (markdown)
- **Cmd + Enter**: Copy response to clipboard
- **Opt + Enter**: Paste response directly

### Chat Features

- **Markdown rendering**: Responses are formatted with Markdown in Text View
- **Single turn**: each query is sent on its own, without the previous messages

## Supported Models

Available models in the dropdown:

| Model                      | Region         |
| -------------------------- | -------------- |
| Claude Haiku 5.5 (default) | EU, US, Global |
| Claude Sonnet 5.5          | EU, US, Global |
| Claude Sonnet 5            | EU, US, Global |
| Claude Opus 5.5            | EU, US, Global |
| Claude Haiku 4.5           | EU, US         |

### Level

Claude 5 models think adaptively; `level` sets their effort (thinking depth, latency and cost):

| Level    | Use                                                              |
| -------- | ---------------------------------------------------------------- |
| `low`    | Default. Spell check, translation, short answers; matches Claude Haiku 4.5 |
| `medium` | Default of the model when no level is sent; more careful answers |
| `high`   | Harder reasoning                                                 |
| `xhigh`  | Complex, multi-step questions                                    |
| `max`    | When correctness matters more than latency and cost              |

Older models ignore `level`. Claude 5 models reject `temperature`, so the workflow only sends it to older models.

## License

MIT
