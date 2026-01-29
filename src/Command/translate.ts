import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../Helper/AlfredOutput.js";
import { ChatService } from "../Service/ChatService.js";

const DEFAULT_MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const LANGUAGE_NAMES: Record<string, string> = {
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
};

const SYSTEM_PROMPT = `You are a silent translator.
The user message contains ONLY text to translate to a target language.
ABSOLUTE rules:
- Return ONLY the translated text, nothing else
- NEVER add explanations, comments, preambles or questions
- Preserve punctuation and formatting
- If the text is already in the target language, return it as-is`;

interface ParsedQuery {
  lang: string;
  text: string;
}

function parseQuery(query: string, defaultLang: string): ParsedQuery {
  const match = /^:?([a-zA-Z]{2})\s+(.+)$/s.exec(query);
  if (match) {
    return { lang: match[1].toLowerCase(), text: match[2] };
  }
  return { lang: defaultLang, text: query };
}

async function main(): Promise<void> {
  const query = process.argv[2];
  const token = process.env["token"] || process.env["AWS_BEARER_TOKEN_BEDROCK"] || "";
  const model = process.env["model"] || DEFAULT_MODEL;
  const defaultLang = process.env["default_lang"] || "en";

  if (!query) {
    const output = createErrorResponse("Please enter text to translate");
    process.stdout.write(JSON.stringify(output));
    return;
  }

  if (!token) {
    const output = createErrorResponse(
      "Error: Bedrock token not configured"
    );
    process.stdout.write(JSON.stringify(output));
    return;
  }

  const { lang, text } = parseQuery(query, defaultLang);
  const langName = LANGUAGE_NAMES[lang] ?? lang;

  const service = new ChatService({ model, systemPrompt: SYSTEM_PROMPT, token });
  const response = await service.ask(`Translate to ${langName}:\n${text}`);
  const output = createScriptFilterResponse(response);

  process.stdout.write(JSON.stringify(output));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const output = createErrorResponse(`Error: ${message}`);
  process.stdout.write(JSON.stringify(output));
});
