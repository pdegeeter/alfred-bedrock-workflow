import {
  createErrorResponse,
  createScriptFilterResponse,
} from "../Helper/AlfredOutput.js";
import { ChatService } from "../Service/ChatService.js";

const DEFAULT_MODEL = "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

async function main(): Promise<void> {
  const query = process.argv[2];
  const token = process.env["token"] ?? "";
  const model = process.env["model"] ?? DEFAULT_MODEL;

  if (!query) {
    const output = createErrorResponse("Please enter a message");
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

  const service = new ChatService({ model, token });
  const response = await service.ask(query);
  const output = createScriptFilterResponse(response);

  process.stdout.write(JSON.stringify(output));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const output = createErrorResponse(`Error: ${message}`);
  process.stdout.write(JSON.stringify(output));
});
