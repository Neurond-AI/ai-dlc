# Business Logic Model -- UOW-06: Diff Review & Polish

## Overview

This document defines the business processes for UOW-06, covering the diff review panel (file tree + side-by-side diff viewer), review actions (approve, request changes, retry), error handling UX (toast notifications, retry with exponential backoff), and the Settings page (API key management + profile editing). All review actions call pipeline API routes defined in UOW-04. The diff viewer operates entirely client-side, transforming `FileChanges` JSON (from `pipelineStore`) into a renderable unified diff format via `DiffService`. Syntax highlighting uses **Shiki** (lightweight, tree-shakeable, supports TypeScript/JS/CSS/HTML/JSON/YAML/Python/Markdown).

---

## 1. Diff Review Panel Activation

**Trigger**: Task reaches "review" status (pipeline completed with `status = "passed"`)

```
Client (TaskDetailView -- already rendered from UOW-03)
  |
  [1] useSSE receives pipeline-complete event with result = "passed"
  [2] pipelineStore.setComplete(taskId, "passed", fileChanges, reviewFindings)
  [3] taskStore.updateTaskStatus(taskId, "review")
  |
  [4] TaskDetailView detects:
      - task.status === "review"
      - pipelineRun.fileChanges !== null
  |
  [5] DiffReviewPanel renders as Sheet (shadcn/ui) from right side
      - Framer Motion: slide in from right (x: "100%" -> 0)
      - Width: 80vw on desktop, 100vw on mobile, max 1200px
      - Contains: FileTree (left 250px) + DiffViewer (remaining) + ReviewActions (bottom bar)
  |
  [6] On mount, DiffReviewPanel:
      - Reads pipelineRun.fileChanges from pipelineStore
      - Calls DiffService.buildFileTree(fileChanges) -> FileTreeNode[]
      - Calls DiffService.computeDiffs(fileChanges) -> UnifiedDiff[]
      - Auto-selects first file in tree
```

**Close Conditions**:
- User clicks overlay backdrop
- User clicks close (X) button
- Review action completes (approve/request-changes/retry)
- Task status changes away from "review" (via SSE)

---

## 2. File Tree Navigation

**Trigger**: DiffReviewPanel mounts with fileChanges data

```
DiffService.buildFileTree(fileChanges):
  |
  [1] Parse filePaths from FileChanges.files array
  [2] Group by directory segments:
      e.g., "src/lib/db/schema.ts" -> ["src", "lib", "db", "schema.ts"]
  [3] Build recursive FileTreeNode structure:
      {
        name: "src",
        path: "src",
        type: "directory",
        children: [
          {
            name: "lib",
            path: "src/lib",
            type: "directory",
            children: [
              {
                name: "db",
                path: "src/lib/db",
                type: "directory",
                children: [
                  {
                    name: "schema.ts",
                    path: "src/lib/db/schema.ts",
                    type: "file",
                    language: "typescript",
                    action: "create"
                  }
                ]
              }
            ]
          }
        ]
      }
  [4] Sort: directories first (alphabetical), then files (alphabetical) (BR-06-007)
  [5] Return FileTreeNode[] (root-level entries)
```

**User Interaction**:

| Action | Handler | Result |
|--------|---------|--------|
| Click directory node | Toggle expand/collapse | Children shown/hidden, chevron rotates |
| Click file node | `setSelectedFile(filePath)` | DiffViewer shows diff for that file, file highlighted in tree |
| View file node | Render icon + name + action badge | Icon by language (Lucide), badge color by action |

**Action Badge Colors**:

| Action | Badge Text | Color |
|--------|-----------|-------|
| create | Added | Green (bg-emerald-100 text-emerald-700) |
| modify | Modified | Yellow (bg-amber-100 text-amber-700) |
| delete | Deleted | Red (bg-red-100 text-red-700) |

---

## 3. DiffService -- File Changes to Unified Diff

**Service**: `lib/services/diff-service.ts`

### computeDiffs

```
DiffService.computeDiffs(fileChanges: FileChanges): UnifiedDiff[]
  |
  For each file in fileChanges.files:
  |
  [1] Determine diff type based on action:
      - "create": left side empty, right side = full content (all lines "added")
      - "delete": left side = full content (all lines "removed"), right side empty
      - "modify": left side = originalContent, right side = content
        - Compute line-level diff (simple line-by-line comparison)
        - Group consecutive changes into hunks
  |
  [2] Build UnifiedDiff:
      {
        filePath: file.filePath,
        language: file.language,
        hunks: DiffHunk[]
      }
  |
  [3] For "create" action:
      Single hunk:
      {
        oldStart: 0, oldCount: 0,
        newStart: 1, newCount: <total lines>,
        lines: content.split("\n").map((line, i) => ({
          lineNumber: i + 1,
          content: line,
          type: "added"
        }))
      }
  |
  [4] For "delete" action:
      Single hunk:
      {
        oldStart: 1, oldCount: <total lines>,
        newStart: 0, newCount: 0,
        lines: originalContent.split("\n").map((line, i) => ({
          lineNumber: i + 1,
          content: line,
          type: "removed"
        }))
      }
  |
  [5] For "modify" action:
      - Split originalContent and content into line arrays
      - Compare line-by-line using simple diff algorithm (Myers or patience diff)
        NOTE: Use a lightweight JS diff library (e.g., "diff" npm package)
      - Group consecutive changed lines into hunks with 3 lines of context
      - Each hunk contains DiffLine[] with type: "added" | "removed" | "unchanged"
  |
  [6] Truncation check (BR-06-009):
      - If total lines in a file > 10,000: truncate to first 10,000 lines
      - Append marker line: { lineNumber: -1, content: "--- File truncated (>10,000 lines) ---", type: "unchanged" }
  |
  [7] Return UnifiedDiff[]
```

### buildFileTree

```
DiffService.buildFileTree(fileChanges: FileChanges): FileTreeNode[]
  |
  [1] Extract unique directory paths from all filePaths
  [2] Build nested tree structure
  [3] Attach file metadata (language, action) to leaf nodes
  [4] Sort per BR-06-007
  [5] Return root-level FileTreeNode array
```

**Note**: DiffService is a pure utility module (no side effects, no API calls, no store access). It transforms data structures only.

---

## 4. Side-by-Side Diff Viewer

**Trigger**: User selects a file in the FileTree

```
DiffViewer receives:
  - diff: UnifiedDiff (for selected file)
  - language: string (for syntax highlighting)
  |
  [1] Render two-column layout:
      Left column: "Original" (or empty for new files)
      Right column: "Modified" (or empty for deleted files)
  |
  [2] For each hunk in diff.hunks:
      [a] Render hunk header: "@@ -oldStart,oldCount +newStart,newCount @@"
      [b] For each line in hunk.lines:
          - "unchanged": render in both columns, neutral bg
          - "added": render in right column only, green bg (bg-emerald-50 dark:bg-emerald-950/20)
            Left column shows empty row (maintains line alignment)
          - "removed": render in left column only, red bg (bg-red-50 dark:bg-red-950/20)
            Right column shows empty row (maintains line alignment)
  |
  [3] Line numbers:
      - Left column: original line numbers (incrementing for unchanged + removed)
      - Right column: new line numbers (incrementing for unchanged + added)
      - Line numbers in muted color, fixed-width font, right-aligned
  |
  [4] Syntax highlighting:
      - Use Shiki with language parameter
      - Highlight individual lines (not full-file), preserving diff colors
      - Supported languages (BR-06-008):
        TypeScript, JavaScript, JSON, CSS, HTML, Markdown, Python, YAML
      - Unsupported languages: render as plain text (monospace, no highlighting)
  |
  [5] Scroll sync:
      - Both columns share a single scroll container (CSS grid, single overflow-y)
      - Vertical scroll synced naturally (same container)
  |
  [6] Empty file states:
      - New file (create): left column shows centered message "New file"
      - Deleted file (delete): right column shows centered message "File deleted"
```

---

## 5. Review Actions

**Location**: Fixed bottom bar inside DiffReviewPanel

### 5a. Approve

**Trigger**: User clicks "Approve" button

```
Client (ReviewActions)
  |
  [1] Disable all action buttons, show spinner on Approve
  [2] Retrieve API key from localStorage (decrypt)
  [3] POST /api/pipeline/[taskId]/approve
      Headers: { Cookie: <session> }
  |
Server (approve route -- defined in UOW-04)
  |
  [4] Validate: task status = "review", pipeline status = "passed"
  [5] Update Task status to "done" (BR-04-013)
  [6] Push SSE: task-status { taskId, newStatus: "done" }
  [7] Return 200 OK
  |
Client (on success)
  |
  [8] Close DiffReviewPanel (Framer Motion slide out)
  [9] Trigger SuccessAnimation:
      - Green checkmark overlay on task card (Framer Motion scale + opacity)
      - Task card animates to Done column (via taskStore update from SSE)
      - Green glow pulse on card (2 cycles, 300ms each)
  [10] Show toast: "Task [title] approved and completed" (Sonner, variant: success)
```

**Error handling**: If 400/404/500, show error toast, re-enable buttons.

### 5b. Request Changes

**Trigger**: User clicks "Request Changes" button

```
Client (ReviewActions)
  |
  [1] Open RequestChangesForm (textarea slides down, Framer Motion)
  |
  [2] User types feedback (min 10 characters, BR-06-003)
      - Character count displayed
      - Submit button disabled until >= 10 chars
  |
  [3] User clicks "Submit Feedback"
      - Disable form, show spinner
      - POST /api/pipeline/[taskId]/request-changes
        Body: { feedback: string }
        Headers: { Cookie: <session>, x-anthropic-key: <decryptedKey> }
  |
Server (request-changes route -- defined in UOW-04)
  |
  [4] Validate: task status = "review", pipeline status = "passed"
  [5] Validate: feedback string min 10 chars
  [6] Increment PipelineRun.iteration
  [7] Update Task status to "building" (BR-06-005)
  [8] Restart CoderAgent with human feedback as additional context
  [9] Resume pipeline from CODING phase
  [10] Push SSE: task-status { taskId, newStatus: "building" }
  [11] Push SSE: phase-change { phase: "coding", iteration }
  [12] Return 202 Accepted
  |
Client (on success)
  |
  [13] Close DiffReviewPanel
  [14] Task card animates back to Building column (via SSE -> taskStore)
  [15] Show toast: "Feedback sent -- pipeline restarting from Code phase"
  [16] Agent Log Panel auto-switches to Coder tab (uiStore.setActiveLogTab("coder"))
```

### 5c. Retry (Full Pipeline Restart)

**Trigger**: User clicks "Retry" button

```
Client (ReviewActions)
  |
  [1] Show confirmation dialog (shadcn/ui AlertDialog):
      "Retry will restart the entire pipeline from the Planning stage.
       Current code changes will be discarded. Continue?"
      [Cancel] [Confirm Retry]
  |
  [2] User confirms
      - Disable all buttons, show spinner on Retry
      - POST /api/pipeline/[taskId]/retry
        Headers: { Cookie: <session>, x-anthropic-key: <decryptedKey> }
  |
Server (retry route -- defined in UOW-04)
  |
  [3] Validate: PipelineRun exists
  [4] Reset: create new PipelineRun (fresh start)
  [5] Update Task status to "spec" (BR-06-004)
  [6] Start PipelineOrchestrator from PLANNING phase
  [7] Push SSE: task-status { taskId, newStatus: "spec" }
  [8] Push SSE: phase-change { phase: "planning", iteration: 0 }
  [9] Return 202 Accepted
  |
Client (on success)
  |
  [10] Close DiffReviewPanel
  [11] Task card animates to Spec column (via SSE -> taskStore)
  [12] pipelineStore.clearLogs(taskId)
  [13] Show toast: "Pipeline restarting from Planning phase"
```

---

## 6. Error Handling UX

### 6a. Pipeline Error Notification

**Trigger**: SSE "error" event received by useSSE hook

```
useSSE hook
  |
  [1] Receives error event: { type, message, retryable, retryCount, maxRetries, timestamp }
  [2] pipelineStore.setError(taskId, errorDetails)
  |
ErrorNotification component (already defined in UOW-04 frontend-components)
  |
  [3] Detects pipelineRun.status === "paused" && errorDetails !== null
  |
  [4] Fire Sonner toast (auto-dismiss after 10s, BR-06-010):
      toast.error("Pipeline Error", {
        description: errorDetails.message,
        duration: 10000,
        action: {
          label: "Retry",
          onClick: () => usePipeline.retryPipeline()
        }
      })
  |
  [5] Render inline Alert banner in TaskDetailView:
      +--------------------------------------------------------------+
      | [AlertTriangle] Pipeline Error                        [X]     |
      |                                                               |
      | Anthropic API error: 429 Rate Limited                         |
      | Agent: Coder | Phase: Coding | Retry 1/3                     |
      |                                                               |
      | [Retry]  [Cancel Pipeline]                                    |
      +--------------------------------------------------------------+
  |
  [6] Task card in Kanban: yellow warning icon replaces pulse dot
      - PulseDot receives isError=true, renders amber dot instead of animated pulse
```

### 6b. Retry with Exponential Backoff

**Trigger**: User clicks "Retry" on error notification

```
Client (ErrorNotification or PipelineControls)
  |
  [1] POST /api/pipeline/[taskId]/retry
  |
Server (retry route -- from UOW-04)
  |
  [2] Calculate backoff: 1000 * 2^retryCount ms (BR-04-017)
      - Retry 0: 1000ms
      - Retry 1: 2000ms
      - Retry 2: 4000ms
  [3] Push SSE: agent-log { agent: failedAgent, chunk: "Retrying in Xs...", timestamp }
  [4] Wait for backoff delay
  [5] Resume failed agent call
  |
Client (via SSE)
  |
  [6] Receives agent-log "Retrying in Xs..." -> displays countdown in:
      - Agent Log Panel (under relevant agent tab)
      - ErrorNotification banner (countdown text replaces error message temporarily)
  [7] On success: pipelineStore clears error, pipeline resumes
  [8] On failure: new error event, ErrorNotification re-renders with incremented retryCount
```

### 6c. Task Failed State

**Trigger**: All retries exhausted OR pipeline reaches FAILED status

```
SSE: pipeline-complete { taskId, result: "failed" }
  |
  [1] pipelineStore.setComplete(taskId, "failed")
  [2] taskStore.updateTaskStatus(taskId, "backlog")
  |
  [3] Task card in Kanban:
      - Red indicator badge "Failed"
      - No pulse dot
      - Context menu gains "Retry Pipeline" option
  |
  [4] TaskDetailView:
      - Error banner persists with error history
      - "Retry Pipeline" button visible (restarts from PLANNING, fresh run)
      - Review score and findings from last attempt still visible
  |
  [5] Toast: "Pipeline failed for [task title]" (variant: error, persistent until dismissed)
```

---

## 7. Settings Page

**Trigger**: User clicks "Settings" in Sidebar

### 7a. Tab Layout

```
Settings page renders:
  |
  [1] Page header: "Settings"
  [2] shadcn/ui Tabs component:
      - Tab 1: "API Key" (default active)
      - Tab 2: "Profile"
  |
  [3] Tab content:
      - API Key tab: renders ApiKeyForm (from UOW-01, fully functional)
      - Profile tab: renders ProfileForm (new in UOW-06)
```

**Layout**:
```
Settings
+---------+---------+
| API Key | Profile |
+---------+---------+
|                   |
| (Tab content)     |
|                   |
+-------------------+
```

### 7b. API Key Tab

Reuses `ApiKeyForm` from UOW-01 with no changes. Already handles:
- Add/update/remove API key
- Format validation (sk-ant- prefix)
- Optional Anthropic API validation
- AES-GCM encryption in localStorage
- Masked display (sk-ant-...xxxx)

### 7c. Profile Tab

```
ProfileForm:
  |
  [1] Read user data from authStore: { name, email }
  |
  [2] Display:
      - Name: editable Input field, pre-filled with current name
      - Email: read-only Input field (disabled), shows current email
      - Future placeholder: Avatar upload (not in MVP)
  |
  [3] User edits name, clicks "Save":
      - Client-side validation: name not empty, max 100 chars
      - PATCH /api/auth/me
        Body: { name: newName }
        Headers: { Cookie: <session> }
  |
  [4] Server:
      - Authenticate via session
      - Validate name (non-empty, <= 100 chars)
      - Update User.name in database
      - Return updated user object
  |
  [5] Client (on success):
      - authStore.user.name = newName
      - Header UserMenu reflects updated name
      - Show toast: "Profile updated"
  |
  [6] Error states:
      - Empty name: inline error "Name cannot be empty" (BR-06-012)
      - Server error: toast "Failed to update profile"
```

---

## 8. Success Animation (Approve Flow)

**Trigger**: Approve action succeeds (task moves to Done)

```
[1] DiffReviewPanel closes (slide out right, 300ms)
[2] Task card in Kanban:
    - taskStore receives SSE task-status { newStatus: "done" }
    - Card animates from Review column to Done column (Framer Motion layout animation)
    - On arrival in Done column, card receives green glow effect:
      {
        boxShadow: [
          "0 0 0 rgba(34,197,94,0)",
          "0 0 20px rgba(34,197,94,0.4)",
          "0 0 0 rgba(34,197,94,0)"
        ]
      }
      transition: { duration: 1.2, ease: "easeInOut" }
    - Phase indicator changes to green checkmark icon
    - Pulse dot stops
```

**No confetti** -- keeping it professional. Green glow + checkmark provides clear visual feedback.

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| Diff Review Panel Activation | US-042 |
| File Tree Navigation | US-043 |
| Side-by-Side Diff Viewer | US-044 |
| Approve Action | US-045 |
| Request Changes Action | US-046 |
| Retry (Full Restart) Action | US-047 |
| Error Notification (API failure) | US-048 |
| User Approves Retry | US-049 |
| Retry with Exponential Backoff | US-050 |
| Task Failed State | US-051 |
| Settings Page (Tab Layout) | US-052 |
| Update API Key | US-053 |
| Update Profile | US-054 |

---

## Sequence Diagram: Approve Happy Path

```
User            DiffReviewPanel    ReviewActions    API Route       SSE          pipelineStore   taskStore    KanbanBoard
  |                  |                 |               |              |               |              |            |
  |-- click Approve->|                 |               |              |               |              |            |
  |                  |-- delegate ---->|               |              |               |              |            |
  |                  |                 |-- POST /approve-->            |               |              |            |
  |                  |                 |               |-- validate -->|               |              |            |
  |                  |                 |               |-- task->done--|               |              |            |
  |                  |                 |               |-- SSE push ---|-------------->|              |            |
  |                  |                 |               |              |  task-status   |              |            |
  |                  |                 |<-- 200 OK ----|              |               |              |            |
  |                  |<-- close panel--|               |              |               |              |            |
  |<-- toast --------|                 |               |              |               |              |            |
  |                  |                 |               |              |-- updateTask ->|-- move card->|            |
  |                  |                 |               |              |               |              |-- animate ->|
```

## Sequence Diagram: Request Changes Flow

```
User            ReviewActions    RequestChangesForm   API Route       Orchestrator    SSE          taskStore
  |                 |                  |                 |               |              |              |
  |-- click RC ---->|                  |                 |               |              |              |
  |                 |-- show form ---->|                 |               |              |              |
  |-- type feedback-|----------------->|                 |               |              |              |
  |-- click submit--|----------------->|                 |               |              |              |
  |                 |                  |-- POST /request-changes-------->|              |              |
  |                 |                  |                 |-- validate -->|              |              |
  |                 |                  |                 |-- task->building             |              |
  |                 |                  |                 |-- restart coder------------->|              |
  |                 |                  |                 |              |-- SSE push ---|              |
  |                 |                  |                 |              | task-status   |-- update --->|
  |                 |                  |<-- 202 ---------|              | phase-change  |              |
  |<-- close panel--|                  |                 |              |               |              |
  |<-- toast -------|                  |                 |              |               |              |
```
