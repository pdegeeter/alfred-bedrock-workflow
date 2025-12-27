# Alfred Bedrock Workflow

An Alfred workflow to interact with Amazon Bedrock models directly from Alfred.

## Requirements

- [Alfred 5+](https://www.alfredapp.com/) with Powerpack
- [Node.js 24+](https://nodejs.org/)
- Amazon Bedrock API key (bearer token)

## Installation

### From Release

1. Download `alfred-bedrock-workflow.alfredworkflow` from the releases page
2. Double-click to install in Alfred
3. Configure your API key in the workflow settings

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

| Variable       | Required | Description                                                 |
| -------------- | -------- | ----------------------------------------------------------- |
| `token`        | Yes      | Bedrock API bearer token                                    |
| `model`        | No       | Select from dropdown (default: Claude Haiku 4.5 EU)         |
| `default_lang` | No       | Default target language for translations (e.g., en, fr, de) |

Region is auto-detected from the model prefix.

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
