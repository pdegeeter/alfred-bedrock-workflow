import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../Helper/AlfredOutput.js";
import { ModelFeatures } from "../Helper/ModelFeatures.js";
import { detectRegion } from "../Helper/RegionDetector.js";
import { TranslationQuery } from "../Helper/TranslationQuery.js";
import { BedrockTokenProvider } from "../Service/BedrockTokenProvider.js";
import { ChatService } from "../Service/ChatService.js";

const DEFAULT_MODEL = "eu.anthropic.claude-haiku-5-5";

// Closest to Claude Haiku 4.5, which ran without thinking.
const DEFAULT_LEVEL = "low";

const SYSTEM_PROMPT = `You are a silent translator.
The user message contains ONLY text to translate to a target language.
ABSOLUTE rules:
- Return ONLY the translated text, nothing else
- NEVER add explanations, comments, preambles or questions
- Preserve punctuation and formatting
- If the text is already in the target language, return it as-is`;

async function main(): Promise<void> {
  const query = process.argv[2];
  const model = process.env["model"] || DEFAULT_MODEL;
  const defaultLang = process.env["default_lang"] || "en";

  if (!query) {
    const output = createErrorResponse("Please enter text to translate");
    process.stdout.write(JSON.stringify(output));
    return;
  }

  const effort = ModelFeatures.parseLevel(process.env["level"] || DEFAULT_LEVEL);
  const token = await BedrockTokenProvider.fromEnvironment(process.env).getToken(detectRegion(model));

  const { languageName, text } = new TranslationQuery(query, defaultLang);

  const service = new ChatService({ effort, model, systemPrompt: SYSTEM_PROMPT, token });
  const response = await service.ask(`Translate to ${languageName}:\n${text}`);
  const output = createScriptFilterResponse(response);

  process.stdout.write(JSON.stringify(output));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const output = createErrorResponse(`Error: ${message}`);
  process.stdout.write(JSON.stringify(output));
});
