import type { SubtaskList } from "@/types/agent";
import { AGENT_CONFIGS } from "@/types/agent";
import {
  createAnthropicClient,
  streamAgentResponse,
} from "./agent-base";
import { parseAgentJSON, subtaskListSchema } from "@/lib/validators/pipeline";
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
} from "@/lib/prompts/planner";

export interface PlannerAgentOptions {
  apiKey: string;
  taskTitle: string;
  taskDescription: string | null;
  taskCategory: string;
  onLog: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export class PlannerOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerOutputError";
  }
}

/**
 * Run the Planner agent to decompose a task into subtasks.
 * Retries once with explicit JSON instruction on parse failure.
 */
export async function runPlannerAgent(
  options: PlannerAgentOptions
): Promise<SubtaskList> {
  const { apiKey, taskTitle, taskDescription, taskCategory, onLog, abortSignal } =
    options;

  const config = AGENT_CONFIGS.planner;
  const client = createAnthropicClient(apiKey);
  const systemPrompt = buildPlannerSystemPrompt();

  // First attempt
  const userPrompt = buildPlannerUserPrompt(
    taskTitle,
    taskDescription,
    taskCategory
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

  const firstResult = parseAgentJSON(rawOutput, subtaskListSchema);
  if (firstResult.success) {
    return firstResult.data;
  }

  // Retry once with explicit JSON instruction
  onLog(
    "\n\n[Planner: output was not valid JSON — retrying with explicit instruction]\n"
  );

  const retryPrompt =
    userPrompt +
    "\n\n**IMPORTANT**: Your previous response was not valid JSON. Respond with ONLY valid JSON matching the SubtaskList schema. No explanation, no markdown fences outside the JSON.";

  const retryOutput = await streamAgentResponse({
    client,
    systemPrompt,
    userPrompt: retryPrompt,
    maxTokens: config.maxTokens,
    model: config.model,
    onChunk: onLog,
    abortSignal,
  });

  const retryResult = parseAgentJSON(retryOutput, subtaskListSchema);
  if (retryResult.success) {
    return retryResult.data;
  }

  throw new PlannerOutputError(
    `Planner output failed schema validation after retry. ${retryResult.error}`
  );
}
