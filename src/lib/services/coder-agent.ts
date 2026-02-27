import type { Subtask, FileChanges, ReviewFinding } from "@/types/agent";
import { AGENT_CONFIGS } from "@/types/agent";
import {
  createAnthropicClient,
  streamAgentResponse,
} from "./agent-base";
import { parseAgentJSON, fileChangesSchema } from "@/lib/validators/pipeline";
import {
  buildCoderSystemPrompt,
  buildCoderUserPrompt,
  buildCoderFixPrompt,
} from "@/lib/prompts/coder";

export interface CoderAgentOptions {
  apiKey: string;
  taskTitle: string;
  taskDescription: string | null;
  taskCategory: string;
  subtasks: Subtask[];
  onLog: (chunk: string) => void;
  existingCode?: FileChanges;
  abortSignal?: AbortSignal;
}

export interface CoderFixOptions {
  apiKey: string;
  taskTitle: string;
  taskDescription: string | null;
  subtasks: Subtask[];
  currentCode: FileChanges;
  reviewFindings: ReviewFinding[];
  iteration: number;
  onLog: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export class CoderOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoderOutputError";
  }
}

/**
 * Run the Coder agent to generate file changes for all subtasks.
 * Retries once on parse failure.
 */
export async function runCoderAgent(
  options: CoderAgentOptions
): Promise<FileChanges> {
  const {
    apiKey,
    taskTitle,
    taskDescription,
    taskCategory,
    subtasks,
    onLog,
    existingCode,
    abortSignal,
  } = options;

  const config = AGENT_CONFIGS.coder;
  const client = createAnthropicClient(apiKey);
  const systemPrompt = buildCoderSystemPrompt();
  const userPrompt = buildCoderUserPrompt(
    subtasks,
    taskTitle,
    taskDescription,
    taskCategory,
    existingCode
  );

  const rawOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const firstResult = parseAgentJSON(rawOutput, fileChangesSchema);
  if (firstResult.success) {
    return firstResult.data;
  }

  // Retry once with explicit JSON instruction
  onLog(
    "\n\n[Coder: output was not valid JSON — retrying with explicit instruction]\n"
  );

  const retryPrompt =
    userPrompt +
    "\n\n**IMPORTANT**: Your previous response was not valid JSON. Respond with ONLY valid JSON matching the FileChanges schema. No explanation, no markdown fences outside the JSON.";

  const retryOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt: retryPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const retryResult = parseAgentJSON(retryOutput, fileChangesSchema);
  if (retryResult.success) {
    return retryResult.data;
  }

  throw new CoderOutputError(
    `Coder output failed schema validation after retry. ${retryResult.error}`
  );
}

/**
 * Run the Coder agent in fix mode, addressing review findings.
 * Retries once on parse failure.
 */
export async function runCoderFixAgent(
  options: CoderFixOptions
): Promise<FileChanges> {
  const {
    apiKey,
    taskTitle,
    taskDescription,
    subtasks,
    currentCode,
    reviewFindings,
    iteration,
    onLog,
    abortSignal,
  } = options;

  const config = AGENT_CONFIGS.coder;
  const client = createAnthropicClient(apiKey);
  const systemPrompt = buildCoderSystemPrompt();
  const userPrompt = buildCoderFixPrompt(
    subtasks,
    taskTitle,
    taskDescription,
    currentCode,
    reviewFindings,
    iteration
  );

  const rawOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const firstResult = parseAgentJSON(rawOutput, fileChangesSchema);
  if (firstResult.success) {
    return firstResult.data;
  }

  // Retry once
  onLog(
    "\n\n[Coder Fix: output was not valid JSON — retrying with explicit instruction]\n"
  );

  const retryPrompt =
    userPrompt +
    "\n\n**IMPORTANT**: Your previous response was not valid JSON. Respond with ONLY valid JSON matching the FileChanges schema. No explanation, no markdown fences outside the JSON.";

  const retryOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt: retryPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const retryResult = parseAgentJSON(retryOutput, fileChangesSchema);
  if (retryResult.success) {
    return retryResult.data;
  }

  throw new CoderOutputError(
    `Coder fix output failed schema validation after retry. ${retryResult.error}`
  );
}
