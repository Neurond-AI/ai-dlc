// -- Diff File (input to DiffService, derived from FileChange) --

export interface DiffFile {
  filePath: string;
  language: string;
  originalContent: string | null; // null for "create" action
  newContent: string; // empty string for "delete" action
  action: "create" | "modify" | "delete";
}

// -- Diff Line (single line in a diff hunk) --

export type DiffLineType = "added" | "removed" | "unchanged";

export interface DiffLine {
  lineNumber: number; // -1 for truncation marker
  content: string;
  type: DiffLineType;
}

// -- Diff Hunk (contiguous block of changes with context) --

export interface DiffHunk {
  oldStart: number; // Starting line in original file (0 if new file)
  oldCount: number; // Number of lines from original (0 if new file)
  newStart: number; // Starting line in new file (0 if deleted file)
  newCount: number; // Number of lines in new file (0 if deleted file)
  lines: DiffLine[];
}

// -- Unified Diff (full diff for a single file) --

export interface UnifiedDiff {
  filePath: string;
  language: string;
  hunks: DiffHunk[];
}

// -- File Tree Node (recursive tree structure for file navigation) --

export interface FileTreeNode {
  name: string; // File or directory name
  path: string; // Full path (e.g., "src/lib/db/schema.ts")
  type: "file" | "directory";
  children?: FileTreeNode[]; // Only for directories
  language?: string; // Only for files
  action?: "create" | "modify" | "delete"; // Only for files
}

// -- Review Action Type --

export type ReviewAction = "approve" | "request-changes" | "retry";

// -- Review Decision (captures the user's review verdict with metadata) --

export interface ReviewDecision {
  action: ReviewAction;
  feedback: string | null; // Non-null only for "request-changes"
  decidedAt: number; // Timestamp of user decision
  taskId: string;
  pipelineRunId: string;
}

// -- Approval Status Enum --

export type ApprovalStatus =
  | "pending" // Review panel open, no action taken yet
  | "approving" // Approve API call in flight
  | "requesting" // Request Changes API call in flight
  | "retrying" // Retry API call in flight
  | "approved" // Approve completed successfully
  | "changes-requested" // Request Changes completed, pipeline restarting
  | "retried"; // Retry completed, pipeline restarting from Planning

// -- Approval State (tracks review panel UI state) --

export interface ApprovalState {
  status: ApprovalStatus;
  decision: ReviewDecision | null; // Set when user takes an action
  error: string | null; // API error message if action fails
}

// -- Change Type Enum (for display) --

export type ChangeType = "create" | "modify" | "delete";
