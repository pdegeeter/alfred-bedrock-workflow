# Alfred Bedrock Workflow

An Alfred workflow to interact with Amazon Bedrock models directly from Alfred.

## Requirements

- [Alfred 5+](https://www.alfredapp.com/) with Powerpack
- [Node.js 24+](https://nodejs.org/)
- Amazon Bedrock API key (bearer token), an AWS CLI v2 profile, or an IAM Identity Center (SSO) role allowed to call Bedrock

## Installation

### From Release

1. Download `alfred-bedrock-workflow.alfredworkflow` from the releases page
2. Double-click to install in Alfred
3. Configure authentication in the workflow settings

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the workflow package:
   ```bash
   pnpm workflow:build
   ```
4. Double-click `bedrock.alfredworkflow` to install

### Configuration

Configure the following variables in Alfred workflow settings:

| Variable         | Required | Description                                                               |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `token`          | No\*     | Static Bedrock API bearer token                                           |
| `aws_profile`    | No\*     | AWS CLI profile used to generate short-term keys                          |
| `sso_start_url`  | No\*     | IAM Identity Center access portal URL                                     |
| `sso_role_name`  | No\*     | IAM Identity Center role (permission set) used to generate the key        |
| `sso_region`     | No       | IAM Identity Center region (default: `eu-west-1`)                         |
| `sso_account_id` | No       | AWS account of the role; auto-discovered if the role is in one account    |
| `browser`        | No       | Application opening the SSO login, e.g. `Brave Browser` (default browser) |
| `model`          | No       | Select from dropdown (default: Claude Haiku 4.5 EU)                       |
| `default_lang`   | No       | Default target language for translations (e.g., en, fr, de)               |

\* Set one of `token`, `aws_profile`, or `sso_start_url` and `sso_role_name`. They are used in this order; `AWS_BEARER_TOKEN_BEDROCK` is the last resort.

Region is auto-detected from the model prefix.

### Authentication with an AWS CLI profile

Set `aws_profile` to any profile of your `~/.aws/config` (requires [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)). The workflow reads its credentials with `aws configure export-credentials` and signs a short-term key from them, cached like below.

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

Tokens are cached in Alfred's workflow cache folder (`auth.json`, readable only by your user). Delete this file to force a new login.

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
3. Use `:lang` prefix to specify target language (optional)

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

- **Persistent conversations**: Your chat history is saved between sessions
- **Multi-turn support**: Continue conversations with follow-up questions
- **Markdown rendering**: Responses are formatted with Markdown

## Supported Models

Available models in the dropdown:

| Model            | Region |
| ---------------- | ------ |
| Claude Haiku 4.5 | EU     |
| Claude Sonnet 4  | EU     |
| Claude Haiku 4.5 | US     |
| Claude Sonnet 4  | US     |

## License

MIT
