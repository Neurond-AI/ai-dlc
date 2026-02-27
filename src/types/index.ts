// ============================================================
// Auth Types
// ============================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthSession {
  id: string;
  token: string;
  expiresAt: Date;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// Domain Enums
// ============================================================

export type TaskCategory = "feature" | "bug" | "chore" | "research";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export type PipelinePhase = "planning" | "coding" | "reviewing";
export type PipelineRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// ============================================================
// Domain Stub Types (matching Prisma schema)
// ============================================================

export interface Project {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  pipelineState?: Record<string, unknown> | null;
  subtasks?: Record<string, unknown>[] | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRun {
  id: string;
  taskId: string;
  phase: PipelinePhase;
  iteration: number;
  status: PipelineRunStatus;
  agentLogs?: Record<string, unknown>[] | null;
  fileChanges?: Record<string, unknown>[] | null;
  reviewFindings?: Record<string, unknown>[] | null;
  startedAt: Date;
  completedAt?: Date | null;
}
