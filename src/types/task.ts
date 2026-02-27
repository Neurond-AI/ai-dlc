// --- Enum Constants ---

export const TASK_CATEGORIES = [
  "feature",
  "bug-fix",
  "refactoring",
  "performance",
  "security",
  "ui-ux",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = [
  "backlog",
  "spec",
  "building",
  "review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// --- Display Label Mappings ---

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  feature: "Feature",
  "bug-fix": "Bug Fix",
  refactoring: "Refactoring",
  performance: "Performance",
  security: "Security",
  "ui-ux": "UI/UX",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  spec: "Spec",
  building: "Building",
  review: "Review",
  done: "Done",
};

// --- Kanban Column Configuration ---

export const KANBAN_COLUMNS: {
  status: TaskStatus;
  label: string;
  emptyText: string;
}[] = [
  {
    status: "backlog",
    label: "Backlog",
    emptyText: "Drop tasks here or create a new one",
  },
  {
    status: "spec",
    label: "Spec",
    emptyText: "Tasks move here during planning",
  },
  {
    status: "building",
    label: "Building",
    emptyText: "Tasks move here during coding",
  },
  {
    status: "review",
    label: "Review",
    emptyText: "Tasks move here for review",
  },
  {
    status: "done",
    label: "Done",
    emptyText: "Completed tasks appear here",
  },
];

// --- JSON Field Types ---

export type SubtaskStatus = "pending" | "in-progress" | "completed" | "failed";

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  order: number;
}

export type PipelinePhase =
  | "planning"
  | "coding"
  | "reviewing"
  | "fixing"
  | "completed"
  | "failed";

export interface PipelineState {
  phase: PipelinePhase;
  iteration: number;
  isActive: boolean;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
}

// --- Phase Color Mapping ---

export const PHASE_COLORS: Record<PipelinePhase | "idle", string> = {
  idle: "#6B7280",
  planning: "#F59E0B",
  coding: "#3B82F6",
  reviewing: "#8B5CF6",
  fixing: "#3B82F6",
  completed: "#22C55E",
  failed: "#EF4444",
};

// --- Core Entity ---

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  pipelineState: PipelineState | null;
  subtasks: Subtask[] | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

// --- API Input Types ---

export interface CreateTaskInput {
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  projectId: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
}

// --- Filter Types ---

export interface TaskFilter {
  search: string;
  category: TaskCategory | null;
  priority: TaskPriority | null;
}

// --- Category Badge Colors ---

export const CATEGORY_BADGE_COLORS: Record<
  TaskCategory,
  { bg: string; text: string }
> = {
  feature: { bg: "bg-blue-100", text: "text-blue-700" },
  "bug-fix": { bg: "bg-red-100", text: "text-red-700" },
  refactoring: { bg: "bg-yellow-100", text: "text-yellow-700" },
  performance: { bg: "bg-green-100", text: "text-green-700" },
  security: { bg: "bg-purple-100", text: "text-purple-700" },
  "ui-ux": { bg: "bg-pink-100", text: "text-pink-700" },
};
