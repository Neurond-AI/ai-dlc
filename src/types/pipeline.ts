import type { AgentLogs, ErrorDetails, FileChanges, ReviewResult } from "./agent";

// -- Pipeline Phase --

export type PipelinePhase =
  | "planning"
  | "coding"
  | "reviewing"
  | "fixing"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

// -- Pipeline Status --

export type PipelineStatus =
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "paused";

// -- PipelineRun (DB record shape) --

export interface PipelineRun {
  id: string;
  taskId: string;
  phase: PipelinePhase;
  iteration: number;
  status: PipelineStatus;
  agentLogs: AgentLogs | null;
  fileChanges: FileChanges | null;
  reviewFindings: ReviewResult | null;
  errorDetails: ErrorDetails | null;
  startedAt: Date;
  completedAt: Date | null;
}

// -- Client-side pipeline state (Zustand) --

export interface PipelineRunState {
  runId: string;
  phase: PipelinePhase;
  status: PipelineStatus;
  iteration: number;
  startedAt: number;
  completedAt: number | null;
  errorDetails: ErrorDetails | null;
  fileChanges: FileChanges | null;
  reviewFindings: ReviewResult | null;
}
