import Anthropic from "@anthropic-ai/sdk";

// -- Client Factory --

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

// -- Streaming Agent Response --

export interface StreamOptions {
  client: Anthropic;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model: string;
  onChunk: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export async function streamAgentResponse(
  options: StreamOptions
): Promise<string> {
  const { client, systemPrompt, userPrompt, maxTokens, model, onChunk, abortSignal } =
    options;

  let accumulated = "";

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  for await (const event of stream) {
    if (abortSignal?.aborted) {
      // Best-effort abort of the stream
      try {
        stream.abort();
      } catch {
        // ignore
      }
      throw new Error("Pipeline cancelled");
    }

    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const chunk = event.delta.text;
      onChunk(chunk);
      accumulated += chunk;
    }
  }

  return accumulated;
}

// -- JSON Extraction Utilities --

const CODE_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/i;
const OBJECT_RE = /(\{[\s\S]*\})/;

export function extractJSON(text: string): string | null {
  // 1. Try markdown code block
  const codeMatch = CODE_BLOCK_RE.exec(text);
  if (codeMatch?.[1]) {
    const trimmed = codeMatch[1].trim();
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // fall through
    }
  }

  // 2. Try raw JSON object
  const objectMatch = OBJECT_RE.exec(text);
  if (objectMatch?.[1]) {
    const trimmed = objectMatch[1].trim();
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // fall through
    }
  }

  // 3. Try full text
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

export function sanitizeAgentOutput(text: string): string {
  // Remove any leading/trailing whitespace
  return text.trim();
}
