# Bedrock requests

Each query is one call to the Bedrock Runtime [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), with a single user message and no conversation history.

## Region

`RegionDetector` derives the region from the inference profile prefix of the model:

| Prefix | Region |
| --- | --- |
| `eu.` | `eu-west-1` |
| `us.`, `global.`, none | `us-east-1` |

The request goes to `https://bedrock-runtime.<region>.amazonaws.com/model/<model>/converse` with `Authorization: Bearer <token>`.

## Request by model generation

`ModelFeatures` reads the family and version from the model id (`claude-<family>-<major>[-<minor>]`) and shapes the request:

| Model | `inferenceConfig` | `additionalModelRequestFields` |
| --- | --- | --- |
| Claude 5 | `maxTokens: 128000` | `output_config.effort` = `level` |
| Claude 4 (Opus 4 and 4.1: 32000) | `maxTokens: 64000`, `temperature: 0.7` | none |
| Unknown | `maxTokens: 4096`, `temperature: 0.7` | none |

Claude 5 models reject `temperature` with a 400, and older models do not support `effort`. `maxTokens` is the output limit of the model: it caps the output without reserving it, and thinking counts toward it.

`level` accepts `low` (default), `medium`, `high`, `xhigh` and `max`; any other value is an error.

## Prompts

| Command | System prompt | User message |
| --- | --- | --- |
| `bedrock` | none | the query |
| `aspell` | silent spelling and grammar checker, keeps the language and formatting | the query |
| `translate` | silent translator | `Translate to <language>:\n<text>` |

`translate` reads an optional language prefix with `TranslationQuery`:

- `:xx text` accepts any two-letter code (`:sv` → `sv`);
- `xx text` only a known code (`de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `nl`, `pl`, `pt`, `ru`, `zh`), so that text starting with a short word such as "Le chat" is not read as a language;
- otherwise the target is `default_lang`.

## Response

- The text blocks of the answer are concatenated. Claude 5 answers may start with reasoning blocks, which carry no text and are skipped.
- `stopReason` `refusal`, `content_filtered` or `guardrail_intervened` is reported as an error.
- `stopReason` `max_tokens` keeps the partial answer and appends `_[Response truncated: output limit reached]_`.
- A non-2xx status is reported with its body (`Bedrock API error: <status> <body>`).
