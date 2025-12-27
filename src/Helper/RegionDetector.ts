/**
 * Detects AWS region from Bedrock model ID prefix.
 * @param modelId - The Bedrock model identifier
 * @returns AWS region string
 */
export function detectRegion(modelId: string): string {
  if (modelId.startsWith("eu.")) {
    return "eu-west-1";
  }
  if (modelId.startsWith("us.") || modelId.startsWith("global.")) {
    return "us-east-1";
  }
  return "us-east-1";
}
