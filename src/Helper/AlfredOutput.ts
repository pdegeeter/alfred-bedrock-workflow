/**
 * Alfred Script Filter item structure.
 */
export interface AlfredItem {
  arg?: string;
  icon?: { path: string };
  mods?: Record<
    string,
    {
      arg?: string;
      subtitle?: string;
      valid?: boolean;
    }
  >;
  subtitle?: string;
  title: string;
  uid?: string;
  valid?: boolean;
}

/**
 * Alfred Script Filter response structure.
 */
export interface AlfredScriptFilterResponse {
  items: AlfredItem[];
  variables?: Record<string, string>;
}

/**
 * Creates an Alfred Script Filter response with a single result.
 * @param text - The response text
 * @returns Alfred Script Filter JSON response
 */
export function createScriptFilterResponse(
  text: string
): AlfredScriptFilterResponse {
  // Truncate for display in Alfred (first line or first 100 chars)
  const firstLine = text.split("\n")[0];
  const title =
    firstLine.length > 100 ? `${firstLine.substring(0, 100)}...` : firstLine;

  return {
    items: [
      {
        arg: text,
        mods: {
          alt: {
            arg: text,
            subtitle: "Paste response",
            valid: true,
          },
          cmd: {
            arg: text,
            subtitle: "Copy response to clipboard",
            valid: true,
          },
        },
        subtitle: "↵ View in Text View | ⌘↵ Copy | ⌥↵ Paste",
        title,
        uid: "bedrock-response",
        valid: true,
      },
    ],
    variables: { response: text },
  };
}

/**
 * Creates an error response for Alfred.
 * @param message - The error message
 * @returns Alfred Script Filter JSON response
 */
export function createErrorResponse(message: string): AlfredScriptFilterResponse {
  return {
    items: [
      {
        subtitle: "Press Enter to dismiss",
        title: message,
        uid: "bedrock-error",
        valid: false,
      },
    ],
  };
}
