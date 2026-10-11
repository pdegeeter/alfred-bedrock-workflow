import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../Helper/AlfredOutput.js";
import { ModelFeatures } from "../Helper/ModelFeatures.js";
import { detectRegion } from "../Helper/RegionDetector.js";
import { BedrockTokenProvider } from "../Service/BedrockTokenProvider.js";
import { ChatService } from "../Service/ChatService.js";

const DEFAULT_MODEL = "eu.anthropic.claude-haiku-5-5";

// Closest to Claude Haiku 4.5, which ran without thinking.
const DEFAULT_LEVEL = "low";

async function main(): Promise<void> {
  const query = process.argv[2];
  const model = process.env["model"] || DEFAULT_MODEL;

  if (!query) {
    const output = createErrorResponse("Please enter a message");
    process.stdout.write(JSON.stringify(output));
    return;
  }

  const effort = ModelFeatures.parseLevel(process.env["level"] || DEFAULT_LEVEL);
  const token = await BedrockTokenProvider.fromEnvironment(process.env).getToken(detectRegion(model));

  const service = new ChatService({ effort, model, token });
  const response = await service.ask(query);
  const output = createScriptFilterResponse(response);

  process.stdout.write(JSON.stringify(output));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const output = createErrorResponse(`Error: ${message}`);
  process.stdout.write(JSON.stringify(output));
});
