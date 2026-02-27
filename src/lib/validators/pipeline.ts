import { z } from "zod";

// -- Subtask Schema (Planner output) --

export const subtaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  order: z.number().int().min(1),
});

export const subtaskListSchema = z.object({
  subtasks: z.array(subtaskSchema).min(1).max(10),
});

// -- File Change Schema (Coder output) --

export const fileChangeSchema = z.object({
  filePath: z.string().min(1),
  language: z.string().min(1),
  content: z.string(),
  action: z.enum(["create", "modify", "delete"]),
});

export const fileChangesSchema = z.object({
  files: z.array(fileChangeSchema),
});

// -- Review Result Schema (Reviewer output) --

export const findingSeveritySchema = z.enum(["error", "warning", "info"]);

export const findingSchema = z.object({
  severity: findingSeveritySchema,
  file: z.string().min(1),
  line: z.number().int().min(0),
  message: z.string().min(1),
});

export const reviewResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  findings: z.array(findingSchema),
});

// -- Agent Logs Schema --

export const agentLogsSchema = z.object({
  planner: z.array(z.string()),
  coder: z.array(z.string()),
  reviewer: z.array(z.string()),
});

// -- Error Details Schema --

export const errorDetailsSchema = z.object({
  type: z.enum(["api_error", "parse_error", "timeout", "unknown"]),
  message: z.string(),
  statusCode: z.number().optional(),
  failedAgent: z.enum(["planner", "coder", "reviewer"]).optional(),
  failedPhase: z
    .enum(["planning", "coding", "reviewing", "fixing"])
    .optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().default(3),
  timestamp: z.number(),
});

// -- Pipeline API Input Schemas --

export const startPipelineSchema = z.object({
  // No body required — API key comes from header
});

export const retryPipelineSchema = z.object({
  // No body required
});

export const requestChangesSchema = z.object({
  feedback: z
    .string()
    .min(10, "Feedback must be at least 10 characters")
    .max(5000, "Feedback must be 5000 characters or fewer"),
});

// -- Utility: extract JSON from markdown code blocks or plain text --

const CODE_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/i;
const OBJECT_RE = /(\{[\s\S]*\})/;

export function parseAgentJSON<T>(
  text: string,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: string } {
  // 1. Try markdown code block extraction first
  const codeBlockMatch = CODE_BLOCK_RE.exec(text);
  const candidates: string[] = [];

  if (codeBlockMatch?.[1]) {
    candidates.push(codeBlockMatch[1].trim());
  }

  // 2. Try extracting raw JSON object
  const objectMatch = OBJECT_RE.exec(text);
  if (objectMatch?.[1]) {
    candidates.push(objectMatch[1].trim());
  }

  // 3. Try the full text as-is
  candidates.push(text.trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return { success: true, data: result.data };
      }
    } catch {
      // continue to next candidate
    }
  }

  return {
    success: false,
    error: `Failed to parse agent output as valid JSON matching schema. Raw text length: ${text.length}`,
  };
}
