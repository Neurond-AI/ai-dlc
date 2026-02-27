# Domain Entities -- UOW-06: Diff Review & Polish

## Overview

UOW-06 introduces **no new database entities**. All persistent state is already defined in UOW-01 (User) and UOW-04 (PipelineRun, with FileChanges/ReviewResult JSON columns). This document defines the **client-side TypeScript types** used by the diff review panel, the DiffService utility, and the Settings profile form. These types exist only in the frontend -- they represent derived/transformed data structures, not database records.

---

## New TypeScript Types (UOW-06 Scope)

### types/diff.ts

```ts
// -- Diff File (input to DiffService, derived from FileChange) --

export interface DiffFile {
  filePath: string;
  language: string;
  originalContent: string | null;  // null for "create" action
  newContent: string;              // empty string for "delete" action
  action: "create" | "modify" | "delete";
}

// -- Diff Line (single line in a diff hunk) --

export type DiffLineType = "added" | "removed" | "unchanged";

export interface DiffLine {
  lineNumber: number;    // -1 for truncation marker
  content: string;
  type: DiffLineType;
}

// -- Diff Hunk (contiguous block of changes with context) --

export interface DiffHunk {
  oldStart: number;      // Starting line in original file (0 if new file)
  oldCount: number;      // Number of lines from original (0 if new file)
  newStart: number;      // Starting line in new file (0 if deleted file)
  newCount: number;      // Number of lines in new file (0 if deleted file)
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
  name: string;                          // File or directory name
  path: string;                          // Full path (e.g., "src/lib/db/schema.ts")
  type: "file" | "directory";
  children?: FileTreeNode[];             // Only for directories
  language?: string;                     // Only for files (from FileChange.language)
  action?: "create" | "modify" | "delete";  // Only for files (from FileChange.action)
}

// -- Review Action Type --

export type ReviewAction = "approve" | "request-changes" | "retry";

// -- Review Decision (captures the user's review verdict with metadata) --

export interface ReviewDecision {
  action: ReviewAction;
  feedback: string | null;       // Non-null only for "request-changes"
  decidedAt: number;             // Timestamp of user decision
  taskId: string;
  pipelineRunId: string;
}

// -- Approval State (tracks review panel UI state) --

export type ApprovalStatus =
  | "pending"          // Review panel open, no action taken yet
  | "approving"        // Approve API call in flight
  | "requesting"       // Request Changes API call in flight
  | "retrying"         // Retry API call in flight
  | "approved"         // Approve completed successfully
  | "changes-requested" // Request Changes completed, pipeline restarting
  | "retried";         // Retry completed, pipeline restarting from Planning

export interface ApprovalState {
  status: ApprovalStatus;
  decision: ReviewDecision | null;  // Set when user takes an action
  error: string | null;             // API error message if action fails
}
```

---

## Enum Definitions

### ChangeType (FileAction)

Defined in `types/agent.ts` (UOW-04), reused in UOW-06 diff context:

| Value | Display | Description | Badge Color |
|-------|---------|-------------|-------------|
| create | Added | New file (did not exist before) | Emerald/Green |
| modify | Modified | Existing file with changes | Amber/Yellow |
| delete | Deleted | File to be removed | Red |

### DiffLineType

| Value | Description | Visual |
|-------|-------------|--------|
| added | Line exists only in new version | Green background |
| removed | Line exists only in original version | Red background |
| unchanged | Line identical in both versions | Neutral background |

### ReviewAction

| Value | Display | Description | Restarts From |
|-------|---------|-------------|---------------|
| approve | Approve | Accept changes, move task to Done | N/A (terminal) |
| request-changes | Request Changes | Send feedback, restart from Coding phase | CODING |
| retry | Retry | Discard everything, restart from Planning phase | PLANNING |

### ApprovalStatus

| Value | Description | Transitions To |
|-------|-------------|---------------|
| pending | Panel open, awaiting user action | approving, requesting, retrying |
| approving | Approve API call in flight | approved (success), pending (error) |
| requesting | Request Changes API call in flight | changes-requested (success), pending (error) |
| retrying | Retry API call in flight | retried (success), pending (error) |
| approved | Task moved to Done | (terminal) |
| changes-requested | Pipeline restarting from Code phase | (terminal, panel closes) |
| retried | Pipeline restarting from Planning phase | (terminal, panel closes) |

---

## Relationship to Existing Types

### From types/agent.ts (UOW-04)

UOW-06 consumes these existing types but does not modify them:

```ts
// Already defined in UOW-04:
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
```

**Transformation**: `DiffService.computeDiffs()` transforms `FileChanges` (UOW-04) into `UnifiedDiff[]` (UOW-06). The key difference: `FileChange` has a single `content` field, while `DiffFile` separates `originalContent` and `newContent` for side-by-side comparison.

**Note on originalContent**: For "create" actions, `originalContent` is null. For "modify" actions, `originalContent` comes from the previous iteration's file content (if available in pipelineRun history) or is left null (showing full content as additions). For "delete" actions, the original content is the `content` field from FileChange and `newContent` is empty. The CoderAgent output (`FileChange.content`) represents the final state of the file for "create" and "modify", and empty for "delete".

### From types/pipeline.ts (UOW-04)

```ts
// Already defined, consumed by DiffReviewPanel:
export interface PipelineRunState {
  runId: string;
  phase: PipelinePhase;
  status: PipelineStatus;
  iteration: number;
  startedAt: number;
  completedAt: number | null;
  errorDetails: ErrorDetails | null;
  fileChanges: FileChanges | null;      // <-- consumed by DiffService
  reviewFindings: ReviewResult | null;  // <-- displayed in DiffReviewPanel
}
```

---

## Type Usage Map

| Type | Defined In | Produced By | Consumed By |
|------|-----------|------------|-------------|
| `FileChanges` | types/agent.ts (UOW-04) | CoderAgent, pipelineStore | DiffService.computeDiffs() |
| `DiffFile` | types/diff.ts (UOW-06) | DiffService (internal) | DiffService (internal) |
| `DiffLine` | types/diff.ts (UOW-06) | DiffService.computeDiffs() | DiffViewer |
| `DiffHunk` | types/diff.ts (UOW-06) | DiffService.computeDiffs() | DiffViewer |
| `UnifiedDiff` | types/diff.ts (UOW-06) | DiffService.computeDiffs() | DiffViewer |
| `FileTreeNode` | types/diff.ts (UOW-06) | DiffService.buildFileTree() | FileTree |
| `ReviewAction` | types/diff.ts (UOW-06) | ReviewActions (user input) | ReviewActions (API call routing) |
| `PipelineRunState` | types/pipeline.ts (UOW-04) | pipelineStore | DiffReviewPanel |
| `ReviewResult` | types/agent.ts (UOW-04) | ReviewerAgent, pipelineStore | DiffReviewPanel (findings display) |
| `ErrorDetails` | types/agent.ts (UOW-04) | pipelineStore | ErrorNotification |

---

## Data Flow: FileChanges to Rendered Diff

```
PipelineRun.fileChanges (DB, Json column)
  |
  v
pipelineStore.pipelineRuns[taskId].fileChanges  (Zustand, via SSE)
  |
  v
DiffService.buildFileTree(fileChanges)  -->  FileTreeNode[]  -->  FileTree component
  |
  v
DiffService.computeDiffs(fileChanges)   -->  UnifiedDiff[]   -->  DiffViewer component
  |                                                                    |
  |                                                           Shiki syntax highlighting
  |                                                           Line numbers
  |                                                           Added/removed coloring
  v
User selects file in FileTree
  |
  v
DiffViewer renders UnifiedDiff for selected file
```

---

## Zod Validation Schemas (UOW-06 Scope)

### FileChange Validation (from UOW-04, consumed in UOW-06)

DiffService validates incoming FileChanges JSON from the AI agent pipeline before transforming into diff structures. The schemas below are defined in UOW-04 (`lib/validations/pipeline-schemas.ts`) and reused by UOW-06's DiffService as a safety check:

```ts
// Defined in UOW-04 -- reused by DiffService.computeDiffs() as input validation:

export const fileActionSchema = z.enum(["create", "modify", "delete"]);

export const fileChangeSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
  language: z.string().min(1, "Language identifier is required"),
  content: z.string(),  // Can be empty for "delete" actions
  action: fileActionSchema,
});

export const fileChangesSchema = z.object({
  files: z.array(fileChangeSchema),
});

// DiffService usage:
// Before computing diffs, validate the raw JSON from pipelineStore:
//   const parsed = fileChangesSchema.safeParse(rawFileChanges);
//   if (!parsed.success) { return []; } // Graceful fallback: empty diff
```

### Review Decision Validation (New in UOW-06)

```ts
export const reviewDecisionSchema = z.object({
  action: z.enum(["approve", "request-changes", "retry"]),
  feedback: z.string()
    .min(10, "Feedback must be at least 10 characters")
    .max(5000, "Feedback must be 5000 characters or fewer")
    .trim()
    .nullable(),  // null for "approve" and "retry", required for "request-changes"
}).refine(
  (data) => data.action !== "request-changes" || (data.feedback !== null && data.feedback.length >= 10),
  { message: "Feedback is required when requesting changes", path: ["feedback"] }
);
```

### lib/validations/pipeline-schemas.ts (Additions)

```ts
// Added to existing pipeline-schemas.ts from UOW-04:

export const requestChangesSchema = z.object({
  feedback: z.string()
    .min(10, "Feedback must be at least 10 characters")
    .max(5000, "Feedback must be 5000 characters or fewer")
    .trim(),
});

// Note: requestChangesSchema may already exist as a stub in UOW-04.
// UOW-06 ensures the min(10) constraint is enforced.
```

### lib/validations/profile-schemas.ts (New)

```ts
export const updateProfileSchema = z.object({
  name: z.string()
    .min(1, "Name cannot be empty")
    .max(100, "Name must be 100 characters or fewer")
    .trim(),
});
```

---

## Entity Relationship Context (UOW-06 Scope)

```
+----------------+       1:N       +------------------+
|     Task       |<--------------->|   PipelineRun    |
|----------------|                 |------------------|
| status="review"|                 | status="passed"  |
|                |                 | fileChanges (Json)|----> DiffService
|                |                 | reviewFindings    |      |
+----------------+                 +------------------+      |
                                                             v
                                              +----------------------------+
                                              | Client-Side Types (UOW-06) |
                                              |----------------------------|
                                              | UnifiedDiff[]              |
                                              | FileTreeNode[]             |
                                              | DiffFile (internal)        |
                                              | DiffLine, DiffHunk         |
                                              +----------------------------+
                                                        |
                                                        v
                                              +----------------------------+
                                              | UI Components              |
                                              |----------------------------|
                                              | DiffReviewPanel            |
                                              | FileTree                   |
                                              | DiffViewer                 |
                                              | ReviewActions              |
                                              +----------------------------+

+----------------+
|     User       |
|----------------|
| name (editable)|----> ProfileForm (PATCH /api/auth/me)
| email (read)   |
+----------------+
```

**Key Point**: No new Prisma models, no schema migrations. UOW-06 is purely frontend types + a utility service + UI components, consuming data structures already stored by UOW-04.
