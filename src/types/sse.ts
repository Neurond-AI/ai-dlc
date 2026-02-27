import type { AgentType, FileChanges, ReviewResult, ErrorDetails } from "./agent";
import type { PipelinePhase, PipelineStatus } from "./pipeline";
import type { TaskStatus } from "./task";

// -- SSE Event Type Names --

export type SSEEventType =
  | "agent-log"
  | "phase-change"
  | "task-status"
  | "error"
  | "pipeline-complete"
  | "timeout"
  | "heartbeat";

// -- SSE Event Data Shapes --

export interface AgentLogEvent {
  agent: AgentType;
  chunk: string;
  timestamp: number;
}

export interface PhaseChangeEvent {
  phase: PipelinePhase;
  status: PipelineStatus;
  iteration: number;
  timestamp: number;
}

export interface TaskStatusEvent {
  taskId: string;
  newStatus: TaskStatus;
  timestamp: number;
}

export interface ErrorEvent {
  type: string;
  message: string;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
  errorDetails?: ErrorDetails;
  timestamp: number;
}

export interface PipelineCompleteEvent {
  taskId: string;
  result: "passed" | "failed";
  fileChanges?: FileChanges;
  reviewFindings?: ReviewResult;
  timestamp: number;
}

export interface TimeoutEvent {
  message: string;
}

export interface HeartbeatEvent {
  timestamp: number;
}

// -- Discriminated Union for SSE Dispatch --

export type SSEEvent =
  | { type: "agent-log"; data: AgentLogEvent }
  | { type: "phase-change"; data: PhaseChangeEvent }
  | { type: "task-status"; data: TaskStatusEvent }
  | { type: "error"; data: ErrorEvent }
  | { type: "pipeline-complete"; data: PipelineCompleteEvent }
  | { type: "timeout"; data: TimeoutEvent }
  | { type: "heartbeat"; data: HeartbeatEvent };

// -- Client-side Log Entry (for Zustand store) --

export interface LogEntry {
  chunk: string;
  timestamp: number;
}

export interface AgentLogsState {
  planner: LogEntry[];
  coder: LogEntry[];
  reviewer: LogEntry[];
}
