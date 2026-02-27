// -- Subtask (Planner output) --

export interface Subtask {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SubtaskList {
  subtasks: Subtask[];
}

// -- File Change (Coder output) --

export type FileAction = "create" | "modify" | "delete";

export interface FileChange {
  filePath: string;
  language: string;
  content: string;
  action: FileAction;
}

export interface FileChanges {
  files: FileChange[];
}

// -- Review Result (Reviewer output) --

export type FindingSeverity = "error" | "warning" | "info";

export interface ReviewFinding {
  severity: FindingSeverity;
  file: string;
  line: number;
  message: string;
}

export interface ReviewResult {
  passed: boolean;
  score: number;
  findings: ReviewFinding[];
}

// -- Agent Type --

export type AgentType = "planner" | "coder" | "reviewer";

// -- Agent Logs --

export interface AgentLogs {
  planner: string[];
  coder: string[];
  reviewer: string[];
}

// -- Error Details --

export type ErrorType = "api_error" | "parse_error" | "timeout" | "unknown";

// PipelinePhase inline to avoid circular dependency with pipeline.ts
export type AgentFailedPhase = "planning" | "coding" | "reviewing" | "fixing";

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  statusCode?: number;
  failedAgent?: AgentType;
  failedPhase?: AgentFailedPhase;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

// -- Agent Execution Config --

export interface AgentConfig {
  model: string;
  maxTokens: number;
}

export const AGENT_CONFIGS: Record<AgentType, AgentConfig> = {
  planner: { model: "claude-sonnet-4-20250514", maxTokens: 4096 },
  coder: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
  reviewer: { model: "claude-sonnet-4-20250514", maxTokens: 4096 },
};
