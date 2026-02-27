import type { Subtask, FileChanges, ReviewResult } from "@/types/agent";
import { AGENT_CONFIGS } from "@/types/agent";
import {
  createAnthropicClient,
  streamAgentResponse,
} from "./agent-base";
import { parseAgentJSON, reviewResultSchema } from "@/lib/validators/pipeline";
import {
  buildReviewerSystemPrompt,
  buildReviewerUserPrompt,
} from "@/lib/prompts/reviewer";

export const REVIEW_PASS_THRESHOLD = 70;

export interface ReviewerAgentOptions {
  apiKey: string;
  taskTitle: string;
  taskDescription: string | null;
  taskCategory: string;
  subtasks: Subtask[];
  fileChanges: FileChanges;
  onLog: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export class ReviewerOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewerOutputError";
  }
}

/**
 * Run the Reviewer agent to evaluate generated code.
 * Pass threshold: score >= 70 AND no error-severity findings.
 * Retries once on parse failure.
 */
export async function runReviewerAgent(
  options: ReviewerAgentOptions
): Promise<ReviewResult> {
  const {
    apiKey,
    taskTitle,
    taskDescription,
    taskCategory,
    subtasks,
    fileChanges,
    onLog,
    abortSignal,
  } = options;

  const config = AGENT_CONFIGS.reviewer;
  const client = createAnthropicClient(apiKey);
  const systemPrompt = buildReviewerSystemPrompt();
  const userPrompt = buildReviewerUserPrompt(
    subtasks,
    taskTitle,
    taskDescription,
    taskCategory,
    fileChanges
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

  const firstResult = parseAgentJSON(rawOutput, reviewResultSchema);
  if (firstResult.success) {
    return normalizeReviewResult(firstResult.data);
  }

  // Retry once with explicit JSON instruction
  onLog(
    "\n\n[Reviewer: output was not valid JSON — retrying with explicit instruction]\n"
  );

  const retryPrompt =
    userPrompt +
    "\n\n**IMPORTANT**: Your previous response was not valid JSON. Respond with ONLY valid JSON matching the ReviewResult schema. No explanation, no markdown fences outside the JSON.";

  const retryOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt: retryPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const retryResult = parseAgentJSON(retryOutput, reviewResultSchema);
  if (retryResult.success) {
    return normalizeReviewResult(retryResult.data);
  }

  throw new ReviewerOutputError(
    `Reviewer output failed schema validation after retry. ${retryResult.error}`
  );
}

/**
 * Normalize ReviewResult: ensure `passed` is consistent with score threshold.
 * If score < 70, passed must be false regardless of what the model says.
 */
function normalizeReviewResult(result: ReviewResult): ReviewResult {
  const hasErrors = result.findings.some((f) => f.severity === "error");
  const passed =
    result.score >= REVIEW_PASS_THRESHOLD && !hasErrors && result.passed;
  return { ...result, passed };
}
