# Code Generation Plan -- UOW-06: Diff Review & Polish

## Overview

**Unit**: UOW-06
**Scope**: Diff review panel, file tree navigation, side-by-side diff viewer with syntax highlighting, review actions (approve/request-changes/retry), error handling UX, settings page profile editing, success animation
**Stories**: US-042 through US-054 (11 Must, 1 Should, 1 Could)
**Dependencies**: UOW-01 (auth, layout, settings), UOW-03 (tasks/TaskCard/TaskDetailView), UOW-04 (pipeline engine, PipelineRun.fileChanges, SSE events, pipelineStore), UOW-05 (pipeline UI)
**Tech Stack**: Next.js 15 App Router, React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Framer Motion, Zustand, Zod, Shiki (new), diff (new)

---

## File Manifest

All files created or modified in this unit:

| File Path | Action | Step |
|-----------|--------|------|
| `src/types/diff.ts` | Create | 1 |
| `src/lib/validators/review.ts` | Create | 2 |
| `src/lib/services/diff-service.ts` | Create | 3 |
| `src/lib/services/syntax-highlighter.ts` | Create | 3 |
| `src/app/api/pipeline/[taskId]/approve/route.ts` | Create | 4 |
| `src/app/api/pipeline/[taskId]/request-changes/route.ts` | Create | 4 |
| `src/app/api/auth/me/route.ts` | Modify | 5 |
| `src/components/diff-review/diff-review-panel.tsx` | Create | 6 |
| `src/components/diff-review/file-tree.tsx` | Create | 7 |
| `src/components/diff-review/diff-viewer.tsx` | Create | 8 |
| `src/components/diff-review/diff-hunk-view.tsx` | Create | 9 |
| `src/components/diff-review/code-block.tsx` | Create | 9 |
| `src/components/diff-review/review-actions.tsx` | Create | 10 |
| `src/components/diff-review/request-changes-form.tsx` | Create | 10 |
| `src/components/diff-review/success-animation.tsx` | Create | 11 |
| `src/components/pipeline/error-notification.tsx` | Create | 12 |
| `src/app/(dashboard)/settings/page.tsx` | Modify | 13 |
| `src/components/settings/profile-form.tsx` | Create | 14 |
| `src/components/task/task-card.tsx` | Modify | 15 |
| `src/components/task/task-detail-view.tsx` | Modify | 15 |
| `src/stores/pipeline-store.ts` | Modify | 10 |
| `src/__tests__/lib/services/diff-service.test.ts` | Create | 16 |
| `src/__tests__/lib/validators/review.test.ts` | Create | 16 |
| `src/__tests__/components/diff-review/file-tree.test.tsx` | Create | 16 |
| `src/__tests__/components/diff-review/review-actions.test.tsx` | Create | 16 |
| `src/__tests__/components/settings/profile-form.test.tsx` | Create | 16 |

---

## Pre-Implementation Checklist

- [ ] Install new dependencies: `npm install shiki diff` (pin exact versions)
- [ ] Install dev dependency for diff types: `npm install -D @types/diff`
- [ ] Verify shadcn/ui components available: Sheet, Tabs, Textarea, Alert, AlertDialog, Tooltip, Badge, ScrollArea, Separator (install any missing via `npx shadcn@latest add <component>`)
- [ ] Confirm UOW-04 types exist: `types/agent.ts` (FileChange, FileChanges, FileAction), `types/pipeline.ts` (PipelineRunState, PipelinePhase, PipelineStatus, ErrorDetails)
- [ ] Confirm UOW-04 stores exist: `stores/pipeline-store.ts` (pipelineStore with pipelineRuns Map)
- [ ] Confirm UOW-04 validators exist: `lib/validations/pipeline-schemas.ts` (fileChangesSchema, fileChangeSchema)
- [ ] Confirm UOW-03 components exist: `components/task/task-card.tsx`, `components/task/task-detail-view.tsx`
- [ ] Confirm UOW-01 components exist: `app/(dashboard)/settings/page.tsx`, `stores/auth-store.ts`, `app/api/auth/me/route.ts`

---

## Step-by-Step Implementation Plan

---

### Step 1: Type Definitions

**File**: `src/types/diff.ts`
**Action**: Create
**Stories**: US-042, US-043, US-044, US-045, US-046, US-047 (foundational types used across all diff-review stories)
**Business Rules**: BR-06-001, BR-06-007, BR-06-008, BR-06-009
**NFRs**: NFR-06-023 (TypeScript strict compliance)
**Estimated Lines**: ~80

- [ ] **1.1** Define `DiffFile` interface with fields: `filePath: string`, `language: string`, `originalContent: string | null` (null for "create"), `newContent: string` (empty for "delete"), `action: "create" | "modify" | "delete"`
- [ ] **1.2** Define `DiffLineType` union: `"added" | "removed" | "unchanged"`
- [ ] **1.3** Define `DiffLine` interface: `lineNumber: number` (-1 for truncation marker), `content: string`, `type: DiffLineType`
- [ ] **1.4** Define `DiffHunk` interface: `oldStart: number`, `oldCount: number`, `newStart: number`, `newCount: number`, `lines: DiffLine[]`
- [ ] **1.5** Define `UnifiedDiff` interface: `filePath: string`, `language: string`, `hunks: DiffHunk[]`
- [ ] **1.6** Define `FileTreeNode` interface: `name: string`, `path: string`, `type: "file" | "directory"`, `children?: FileTreeNode[]`, `language?: string`, `action?: "create" | "modify" | "delete"`
- [ ] **1.7** Define `ReviewAction` type: `"approve" | "request-changes" | "retry"`
- [ ] **1.8** Define `ReviewDecision` interface: `action: ReviewAction`, `feedback: string | null`, `decidedAt: number`, `taskId: string`, `pipelineRunId: string`
- [ ] **1.9** Define `ApprovalStatus` union: `"pending" | "approving" | "requesting" | "retrying" | "approved" | "changes-requested" | "retried"`
- [ ] **1.10** Define `ApprovalState` interface: `status: ApprovalStatus`, `decision: ReviewDecision | null`, `error: string | null`
- [ ] **1.11** Define `SUPPORTED_LANGUAGES` constant map: `{ typescript: "tsx", javascript: "jsx", json: "json", css: "css", html: "html", markdown: "md", python: "python", yaml: "yaml" }` (BR-06-008)
- [ ] **1.12** Define `MAX_DIFF_LINES` constant: `10_000` (BR-06-009)
- [ ] **1.13** Export all types and constants

**Testing Notes**: Types are compile-time only. Verify via `npx tsc --noEmit`. No runtime tests needed for type definitions.

**data-testid**: N/A (no UI in this step)

---

### Step 2: Zod Validators

**File**: `src/lib/validators/review.ts`
**Action**: Create
**Stories**: US-046 (request changes feedback), US-054 (profile update)
**Business Rules**: BR-06-003 (feedback min 10 chars), BR-06-012 (profile name 1-100 chars)
**NFRs**: NFR-06-010 (input validation), NFR-06-021 (shared schemas client+server)
**Estimated Lines**: ~40

- [ ] **2.1** Import `z` from "zod"
- [ ] **2.2** Define `requestChangesSchema`: `z.object({ feedback: z.string().min(10, "Feedback must be at least 10 characters").max(5000, "Feedback must be 5000 characters or fewer").trim() })`
- [ ] **2.3** Define `reviewDecisionSchema` with refinement: action enum + nullable feedback, refine that "request-changes" requires non-null feedback >= 10 chars
- [ ] **2.4** Define `updateProfileSchema`: `z.object({ name: z.string().min(1, "Name cannot be empty").max(100, "Name must be 100 characters or fewer").trim() })`
- [ ] **2.5** Export all schemas and their inferred TypeScript types via `z.infer<typeof schema>`

**Testing Notes**: Unit test each schema with valid and invalid inputs (Step 16). Test boundary conditions: feedback exactly 10 chars, empty name, 101-char name.

**data-testid**: N/A (validation logic, no UI)

---

### Step 3: DiffService

**Files**: `src/lib/services/diff-service.ts`, `src/lib/services/syntax-highlighter.ts`
**Action**: Create
**Stories**: US-042 (panel data), US-043 (file tree), US-044 (diff computation)
**Business Rules**: BR-06-007 (sort: directories first, alphabetical), BR-06-009 (10K line truncation)
**NFRs**: NFR-06-001 (500ms panel open), NFR-06-005 (truncation), NFR-06-006 (XSS prevention), NFR-06-007 (path sanitization), NFR-06-020 (pure utility, no side effects)
**Estimated Lines**: diff-service.ts ~180, syntax-highlighter.ts ~60

#### diff-service.ts

- [ ] **3.1** Import `diffLines` from "diff" and types from `types/diff.ts`
- [ ] **3.2** Import `fileChangesSchema` from UOW-04 `lib/validations/pipeline-schemas.ts` for input validation
- [ ] **3.3** Implement `sanitizeFilePath(path: string): string | null`:
  - Reject paths containing `../` (path traversal)
  - Reject absolute paths starting with `/`
  - Reject paths with null bytes (`\x00`)
  - Reject paths containing `<` or `>` (HTML injection)
  - Log warning to console for rejected paths
  - Return sanitized path or null (NFR-06-007)
- [ ] **3.4** Implement `buildFileTree(fileChanges: FileChanges): FileTreeNode[]`:
  - Validate input with `fileChangesSchema.safeParse()`, return `[]` on failure
  - Extract file paths, sanitize each via `sanitizeFilePath()` (skip null results)
  - Split each path by `/` to get directory segments
  - Build recursive `FileTreeNode` tree structure
  - Attach file metadata (language, action) to leaf nodes
  - Sort at each level: directories first (alphabetical), then files (alphabetical) per BR-06-007
  - Return root-level `FileTreeNode[]`
- [ ] **3.5** Implement `computeDiffs(fileChanges: FileChanges): UnifiedDiff[]`:
  - Validate input with `fileChangesSchema.safeParse()`, return `[]` on failure
  - For each file in `fileChanges.files`:
    - **"create"** action: single hunk, all lines type "added", `oldStart: 0, oldCount: 0`
    - **"delete"** action: single hunk, all lines type "removed", `newStart: 0, newCount: 0`
    - **"modify"** action: call `diffLines(originalContent, newContent)`, convert Change[] to DiffHunk[] with 3 context lines
  - Apply truncation: if total lines > `MAX_DIFF_LINES` (10,000), truncate and append marker line `{ lineNumber: -1, content: "--- File truncated (>10,000 lines) ---", type: "unchanged" }` (BR-06-009)
  - Return `UnifiedDiff[]`
- [ ] **3.6** Implement `computeLineDiff(originalContent: string, modifiedContent: string, contextLines: number = 3): DiffHunk[]`:
  - Internal helper used by `computeDiffs` for "modify" actions
  - Use `diffLines()` from "diff" package
  - Convert Change objects to `DiffLine[]` with proper line numbering (separate old/new counters)
  - Group consecutive changes into hunks with `contextLines` of surrounding unchanged content
  - Return structured `DiffHunk[]`
- [ ] **3.7** Implement helper `findFirstFile(tree: FileTreeNode[]): FileTreeNode | null`:
  - Depth-first traversal to find first file node
  - Used by DiffReviewPanel to auto-select first file on mount
- [ ] **3.8** Export all public functions: `buildFileTree`, `computeDiffs`, `findFirstFile`, `sanitizeFilePath`

#### syntax-highlighter.ts

- [ ] **3.9** Import `createHighlighter` (or `getHighlighter`) and `type Highlighter` from "shiki"
- [ ] **3.10** Implement lazy singleton pattern:
  - Module-level `highlighterInstance: Highlighter | null = null`
  - `getShikiHighlighter(): Promise<Highlighter>` creates instance on first call
  - Load themes: `["github-light", "github-dark"]`
  - Load languages: `["typescript", "javascript", "json", "css", "html", "markdown", "python", "yaml"]`
- [ ] **3.11** Implement `highlightCode(code: string, language: string, theme: "github-light" | "github-dark"): Promise<string>`:
  - Get highlighter instance
  - Check if language is in loaded languages, fallback to HTML-escaped plain text if not (BR-06-008)
  - Return Shiki-highlighted HTML string (entity-encoded, XSS-safe per NFR-06-006)
- [ ] **3.12** Export `getShikiHighlighter` and `highlightCode`

**Testing Notes**: DiffService is the most critical unit to test. Test `buildFileTree` with nested directories, single files, empty input. Test `computeDiffs` for create/modify/delete actions. Test truncation at 10,001 lines. Test `sanitizeFilePath` with traversal attacks, absolute paths, null bytes. Test sort order (directories first, alphabetical). All tests are pure function tests -- no mocking required.

**data-testid**: N/A (service layer, no UI)

---

### Step 4: Review API Routes

**Files**: `src/app/api/pipeline/[taskId]/approve/route.ts`, `src/app/api/pipeline/[taskId]/request-changes/route.ts`
**Action**: Create
**Stories**: US-045 (approve), US-046 (request changes)
**Business Rules**: BR-06-002 (approve always available in review), BR-06-003 (feedback min 10), BR-06-004 (retry from planning), BR-06-005 (request-changes from coding), BR-06-006 (approved task read-only)
**NFRs**: NFR-06-008 (CSRF protection), NFR-06-009 (API key secure handling), NFR-06-012 (approve idempotency)
**Estimated Lines**: approve/route.ts ~60, request-changes/route.ts ~80

#### approve/route.ts

- [ ] **4.1** Export `async function POST(req, { params })` handler
- [ ] **4.2** Authenticate request via session cookie (reuse UOW-01 auth middleware pattern)
- [ ] **4.3** Extract `taskId` from route params
- [ ] **4.4** Fetch task and validate: task exists, belongs to authenticated user, task.status === "review"
- [ ] **4.5** Fetch pipeline run and validate: pipelineRun exists, status === "passed"
- [ ] **4.6** Handle idempotency: if task.status already "done", return 200 OK (NFR-06-012)
- [ ] **4.7** Update task status to "done" via TaskService (BR-04-013)
- [ ] **4.8** Push SSE event: `task-status { taskId, newStatus: "done" }` via SSEService
- [ ] **4.9** Return `NextResponse.json({ success: true }, { status: 200 })`
- [ ] **4.10** Handle errors: 400 (invalid state), 404 (task not found), 500 (server error) with structured error responses

#### request-changes/route.ts

- [ ] **4.11** Export `async function POST(req, { params })` handler
- [ ] **4.12** Authenticate request via session cookie
- [ ] **4.13** Parse and validate request body with `requestChangesSchema` from `lib/validators/review.ts` (BR-06-003)
- [ ] **4.14** Extract `taskId` from route params, extract `x-anthropic-key` from headers (NFR-06-009)
- [ ] **4.15** Fetch task and validate: task exists, belongs to user, task.status === "review"
- [ ] **4.16** Fetch pipeline run and validate: status === "passed"
- [ ] **4.17** Increment `PipelineRun.iteration`
- [ ] **4.18** Update task status to "building" (BR-06-005)
- [ ] **4.19** Restart pipeline from CODING phase via PipelineOrchestrator with feedback as additional context
- [ ] **4.20** Push SSE events: `task-status { taskId, newStatus: "building" }`, `phase-change { phase: "coding", iteration }`
- [ ] **4.21** Return `NextResponse.json({ success: true }, { status: 202 })`
- [ ] **4.22** Handle errors: 400 (validation/state), 404 (not found), 500 (server error)

**Testing Notes**: Integration tests (or API route tests with mocked services). Test approve on valid review task, approve on already-done task (idempotency), approve on non-review task (400). Test request-changes with valid feedback, feedback < 10 chars (400), missing API key (401).

**data-testid**: N/A (API routes, no UI)

---

### Step 5: Profile API Route

**File**: `src/app/api/auth/me/route.ts`
**Action**: Modify (add PATCH handler alongside existing GET)
**Stories**: US-054 (update profile)
**Business Rules**: BR-06-012 (name 1-100 chars)
**NFRs**: NFR-06-010 (input validation client+server)
**Estimated Lines**: ~40 added to existing file

- [ ] **5.1** Import `updateProfileSchema` from `lib/validators/review.ts`
- [ ] **5.2** Export `async function PATCH(req)` handler
- [ ] **5.3** Authenticate request via session cookie
- [ ] **5.4** Parse and validate request body with `updateProfileSchema` (BR-06-012)
- [ ] **5.5** Update `User.name` in database via Prisma: `prisma.user.update({ where: { id: userId }, data: { name: validatedData.name } })`
- [ ] **5.6** Return updated user object (excluding sensitive fields): `{ id, name, email }`
- [ ] **5.7** Handle errors: 400 (validation), 401 (unauthenticated), 500 (server error)

**Testing Notes**: Test PATCH with valid name, empty name (400), 101-char name (400), name with HTML tags (sanitized/accepted with trimming), unauthenticated request (401).

**data-testid**: N/A (API route)

---

### Step 6: DiffReviewPanel (Sheet Container)

**File**: `src/components/diff-review/diff-review-panel.tsx`
**Action**: Create
**Stories**: US-042 (view diff panel)
**Business Rules**: BR-06-001 (visibility condition: task.status === "review" AND fileChanges !== null)
**NFRs**: NFR-06-001 (500ms panel open), NFR-06-015 (keyboard navigation), NFR-06-017 (responsive layout), NFR-06-022 (< 200 lines)
**Estimated Lines**: ~150

- [ ] **6.1** Add `"use client"` directive
- [ ] **6.2** Define `DiffReviewPanelProps`: `{ taskId: string }`
- [ ] **6.3** Read from `pipelineStore`: `pipelineRuns.get(taskId)` for fileChanges and reviewFindings
- [ ] **6.4** Read from `taskStore`: task by ID for status check and title (for toasts)
- [ ] **6.5** Define local state: `selectedFilePath: string | null`, `fileTree: FileTreeNode[]`, `diffs: UnifiedDiff[]`, `isOpen: boolean`
- [ ] **6.6** Implement mount `useEffect`: call `DiffService.buildFileTree()` and `DiffService.computeDiffs()`, auto-select first file via `findFirstFile()`
- [ ] **6.7** Implement visibility guard: `const isVisible = task?.status === "review" && pipelineRun?.fileChanges !== null` (BR-06-001)
- [ ] **6.8** Implement auto-close: `useEffect` watching `task?.status` -- if status leaves "review", set `isOpen = false`
- [ ] **6.9** Render shadcn/ui `Sheet` with `side="right"`:
  - Width: `min(80vw, 1200px)` desktop, `100vw` mobile (< 768px)
  - Height: `100vh`
- [ ] **6.10** Render Sheet header: close button (X icon), title "Code Review", file count badge
- [ ] **6.11** Render Sheet content layout:
  - Left panel (250px): `<FileTree>` (hidden on mobile, replaced by dropdown)
  - Separator (vertical)
  - Right panel (remaining): `<DiffViewer>`
- [ ] **6.12** Render Sheet footer: `<ReviewActions>`
- [ ] **6.13** Add Framer Motion slide-in animation: `initial={{ x: "100%" }}`, `animate={{ x: 0 }}`, `exit={{ x: "100%" }}`, `transition={{ type: "spring", damping: 25, stiffness: 200 }}`
- [ ] **6.14** Wrap with `AnimatePresence` for exit animations
- [ ] **6.15** Add `useReducedMotion()` check: skip animation if user prefers reduced motion

**Accessibility**:
- Focus trapped inside panel when open (Sheet handles this)
- Escape closes panel
- `aria-live="polite"` region announces panel open/close and file count
- Tab order: FileTree -> DiffViewer -> ReviewActions

**data-testid Attributes**:
- `data-testid="diff-review-panel"` on the Sheet root
- `data-testid="diff-review-header"` on the header
- `data-testid="diff-review-file-count"` on the file count badge
- `data-testid="diff-review-close"` on the close button

---

### Step 7: FileTree Component

**File**: `src/components/diff-review/file-tree.tsx`
**Action**: Create
**Stories**: US-043 (navigate file tree)
**Business Rules**: BR-06-007 (sort order -- enforced by DiffService, displayed by this component)
**NFRs**: NFR-06-003 (< 50ms expand, < 200ms file select), NFR-06-015 (keyboard nav), NFR-06-016 (screen reader), NFR-06-022 (< 200 lines)
**Estimated Lines**: ~180

- [ ] **7.1** Add `"use client"` directive
- [ ] **7.2** Define `FileTreeProps`: `{ tree: FileTreeNode[], selectedFilePath: string | null, onSelectFile: (filePath: string) => void }`
- [ ] **7.3** Define local state: `expandedPaths: Set<string>` initialized with all directory paths expanded by default
- [ ] **7.4** Implement `toggleExpanded(path: string)`: add/remove from `expandedPaths` Set
- [ ] **7.5** Implement recursive `FileTreeNodeComponent({ node, depth })`:
  - **Directory node**: button with chevron (rotates on expand), folder icon, name. onClick toggles expand.
  - **File node**: button with language icon, file name (truncated), action badge. onClick calls `onSelectFile`.
  - Indentation: `paddingLeft: ${depth * 16}px` for directories, `${depth * 16 + 20}px` for files
- [ ] **7.6** Implement `ActionBadge` sub-component:
  - "create" -> "A" in emerald (bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400)
  - "modify" -> "M" in amber (bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400)
  - "delete" -> "D" in red (bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400)
  - Size: `text-[10px] font-bold px-1.5 py-0.5 rounded`
- [ ] **7.7** Implement `FileIcon` mapping using Lucide icons:
  - typescript/javascript/python -> FileCode2
  - json -> FileJson
  - html -> FileCode
  - css/markdown/yaml -> FileText
  - Default: FileText
- [ ] **7.8** Add Framer Motion for directory expand/collapse: `AnimatePresence` on children, `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: "auto", opacity: 1 }}`
- [ ] **7.9** Wrap in `ScrollArea` (shadcn/ui) for overflow handling

**Accessibility (ARIA tree pattern)**:
- Root container: `role="tree"`, `aria-label="Changed files"`
- Each node: `role="treeitem"`
- Directory nodes: `aria-expanded="true|false"`
- Selected file: `aria-selected="true"`
- Keyboard navigation:
  - ArrowUp/ArrowDown: move between visible nodes
  - Enter: select file or toggle directory
  - ArrowRight: expand directory
  - ArrowLeft: collapse directory or move to parent
- Focus indicator: `focus-visible:ring-2 ring-ring` on all interactive items
- Action badges include `aria-label` (e.g., "Added", "Modified", "Deleted")

**data-testid Attributes**:
- `data-testid="file-tree"` on the root container
- `data-testid="file-tree-node-{path}"` on each node (path with slashes replaced by dashes)
- `data-testid="file-tree-badge-{action}"` on action badges
- `data-testid="file-tree-expand-{path}"` on directory toggle buttons

---

### Step 8: DiffViewer (CSS Grid Two-Column Layout)

**File**: `src/components/diff-review/diff-viewer.tsx`
**Action**: Create
**Stories**: US-044 (side-by-side diff display)
**Business Rules**: BR-06-008 (language support), BR-06-009 (truncation display)
**NFRs**: NFR-06-002 (2K lines at 60 FPS), NFR-06-004 (Shiki < 100ms/500 lines), NFR-06-006 (XSS prevention), NFR-06-016 (screen reader), NFR-06-017 (responsive), NFR-06-022 (< 200 lines)
**Estimated Lines**: ~150

- [ ] **8.1** Add `"use client"` directive
- [ ] **8.2** Define `DiffViewerProps`: `{ diff: UnifiedDiff | null }`
- [ ] **8.3** Define internal state: `highlighter: Highlighter | null` (loaded async), `isHighlighting: boolean`
- [ ] **8.4** Load Shiki highlighter on mount via `getShikiHighlighter()` with `useEffect` + dynamic import for code splitting
- [ ] **8.5** Detect current theme (light/dark) from HTML root `dark` class for Shiki theme selection (`github-light` / `github-dark`)
- [ ] **8.6** Render empty state when `diff === null`: centered message "Select a file from the tree to view changes"
- [ ] **8.7** Render file header: file path, language, change type indicator
- [ ] **8.8** Render hunks: iterate `diff.hunks`, render each via `<DiffHunkView>` (Step 9)
- [ ] **8.9** Wrap in single scroll container (`overflow-auto`, `font-mono`, `text-sm`) for natural scroll sync between columns
- [ ] **8.10** Handle new file (create): left column shows centered "New file" message
- [ ] **8.11** Handle deleted file (delete): right column shows centered "File deleted" message

**Accessibility**:
- `role="region"` with `aria-label="Diff viewer for {filePath}"`
- Hunk headers rendered as `role="separator"`
- Color independence: `+`/`-` prefix characters supplement green/red backgrounds
- `prefers-reduced-motion: reduce` disables syntax highlighting fade-in

**data-testid Attributes**:
- `data-testid="diff-viewer"` on the main container
- `data-testid="diff-viewer-empty"` on the empty state message
- `data-testid="diff-viewer-file-header"` on the file header
- `data-testid="diff-hunk-{index}"` on each hunk container

---

### Step 9: DiffHunkView and CodeBlock

**Files**: `src/components/diff-review/diff-hunk-view.tsx`, `src/components/diff-review/code-block.tsx`
**Action**: Create
**Stories**: US-044 (diff display with syntax highlighting)
**Business Rules**: BR-06-008 (supported languages), BR-06-009 (truncation marker)
**NFRs**: NFR-06-002 (rendering perf), NFR-06-004 (Shiki perf), NFR-06-006 (XSS prevention)
**Estimated Lines**: diff-hunk-view.tsx ~120, code-block.tsx ~80

#### diff-hunk-view.tsx

- [ ] **9.1** Define `DiffHunkViewProps`: `{ hunk: DiffHunk, language: string, highlighter: Highlighter | null }`
- [ ] **9.2** Render hunk header row spanning full width: `@@ -{oldStart},{oldCount} +{newStart},{newCount} @@`
  - Style: `bg-muted/30 px-4 py-1 text-xs text-muted-foreground font-mono border-y`
- [ ] **9.3** Render each line in a CSS Grid row with 4 cells (side-by-side mode):
  - `grid-template-columns: [leftGutter 60px] [leftContent 1fr] [rightGutter 60px] [rightContent 1fr]`
  - **unchanged**: both sides show line number + content
  - **added**: left side empty spacer, right side shows green-bg content with `<CodeBlock>`
  - **removed**: left side shows red-bg content with `<CodeBlock>`, right side empty spacer
- [ ] **9.4** Track separate line counters: `oldLineNumber` (increments for unchanged + removed), `newLineNumber` (increments for unchanged + added)
- [ ] **9.5** Render line numbers in muted color, right-aligned, fixed-width, `select-none`, `aria-hidden="true"`
- [ ] **9.6** Handle truncation marker: when `line.lineNumber === -1`, render full-width banner "--- File truncated (>10,000 lines) ---" with `col-span-full` (BR-06-009)
- [ ] **9.7** Add `aria-label` on added lines: `"Added line {lineNumber}: {content}"` and removed lines: `"Removed line {lineNumber}: {content}"` (NFR-06-016)

#### code-block.tsx

- [ ] **9.8** Define `CodeBlockProps`: `{ content: string, language: string, lineType: DiffLineType, highlighter: Highlighter | null }`
- [ ] **9.9** If highlighter available AND language in SUPPORTED_LANGUAGES: call `highlighter.codeToTokens()`, render token `<span>` elements with Shiki syntax colors
- [ ] **9.10** If highlighter unavailable OR language unsupported: render plain monospace text (no highlighting)
- [ ] **9.11** Apply diff background color based on `lineType`:
  - "added": `bg-emerald-50 dark:bg-emerald-950/20`
  - "removed": `bg-red-50 dark:bg-red-950/20`
  - "unchanged": `bg-transparent`
- [ ] **9.12** Typography: `font-mono text-sm whitespace-pre`, overflow: `overflow-x-auto`, min height: `min-h-[20px]`
- [ ] **9.13** XSS safety: only render Shiki output via `dangerouslySetInnerHTML` (Shiki entity-encodes all tokens). Never pass raw agent content to innerHTML. (NFR-06-006)

**data-testid Attributes**:
- `data-testid="diff-hunk-header-{index}"` on hunk headers
- `data-testid="diff-line-{type}-{lineNumber}"` on each diff line row
- `data-testid="diff-truncation-marker"` on truncation banner
- `data-testid="code-block"` on CodeBlock container

---

### Step 10: ReviewActions and RequestChangesForm

**Files**: `src/components/diff-review/review-actions.tsx`, `src/components/diff-review/request-changes-form.tsx`
**Action**: Create
**Stories**: US-045 (approve), US-046 (request changes), US-047 (retry)
**Business Rules**: BR-06-002 (no forced scroll), BR-06-003 (feedback >= 10 chars), BR-06-004 (retry from planning, confirmation), BR-06-005 (request-changes from coding), BR-06-006 (done = read-only)
**NFRs**: NFR-06-008 (CSRF), NFR-06-009 (API key in header), NFR-06-014 (feedback preserved on error), NFR-06-018 (retry confirmation)
**Estimated Lines**: review-actions.tsx ~160, request-changes-form.tsx ~120

#### review-actions.tsx

- [ ] **10.1** Add `"use client"` directive
- [ ] **10.2** Define `ReviewActionsProps`: `{ taskId: string, onClose: () => void }`
- [ ] **10.3** Read review score from `pipelineStore`: `pipelineRun.reviewFindings?.score`
- [ ] **10.4** Define local state: `showRequestChangesForm: boolean`, `showRetryConfirm: boolean`
- [ ] **10.5** Implement approve handler:
  - Disable all buttons, show spinner on Approve
  - POST `/api/pipeline/${taskId}/approve` with session cookie
  - On success: call `onClose()`, trigger success animation (via callback or event), show toast "Task approved and completed" (Sonner, success variant)
  - On error: show toast.error(), re-enable buttons
- [ ] **10.6** Implement request-changes handler (delegated from RequestChangesForm):
  - Extract decrypted API key from localStorage
  - POST `/api/pipeline/${taskId}/request-changes` with body `{ feedback }`, headers include `x-anthropic-key`
  - On success: call `onClose()`, show toast "Feedback sent -- pipeline restarting from Code phase", set `uiStore.setActiveLogTab("coder")`
  - On error: show toast.error(), re-enable form (feedback preserved per NFR-06-014)
- [ ] **10.7** Implement retry handler:
  - Show AlertDialog confirmation: "Retry will restart the entire pipeline from the Planning stage. Current code changes will be discarded. Continue?" with [Cancel] and [Confirm Retry]
  - On confirm: disable buttons, POST `/api/pipeline/${taskId}/retry` with `x-anthropic-key` header
  - On success: call `onClose()`, show toast "Pipeline restarting from Planning phase", `pipelineStore.clearLogs(taskId)`
  - On error: show toast.error(), re-enable buttons
- [ ] **10.8** Render button bar:
  - Approve: `<Button>` green accent (`bg-emerald-600 hover:bg-emerald-700 text-white`), Check icon, text "Approve" / "Approving..."
  - Request Changes: `<Button variant="outline">` amber accent (`border-amber-300 text-amber-700`), MessageSquare icon, text "Request Changes" / "Sending..."
  - Retry: `<Button variant="ghost">`, RotateCcw icon, text "Retry" / "Restarting..."
- [ ] **10.9** Render review score display: "Review: {score}/100"
- [ ] **10.10** All buttons disabled when any action is in-flight (`isApproving || isRequestingChanges || isRetrying`)
- [ ] **10.11** Conditionally render `<RequestChangesForm>` when `showRequestChangesForm === true`
- [ ] **10.12** Update `pipelineStore` with new actions: `approvePipeline(taskId)`, `requestChanges(taskId, feedback)` (add to existing store)

#### request-changes-form.tsx

- [ ] **10.13** Add `"use client"` directive
- [ ] **10.14** Define `RequestChangesFormProps`: `{ onSubmit: (feedback: string) => Promise<void>, onCancel: () => void, isSubmitting: boolean }`
- [ ] **10.15** Define local state: `feedback: string`, `error: string | null`
- [ ] **10.16** Render `<Textarea>` (shadcn/ui) with placeholder "Describe what needs to change..."
- [ ] **10.17** Render character count: `${feedback.length}/5000` right-aligned, muted text
- [ ] **10.18** Implement validation on blur: if `feedback.trim().length > 0 && feedback.trim().length < 10`, show error "Feedback must be at least 10 characters" (BR-06-003)
- [ ] **10.19** Submit button disabled when `!isValid || isSubmitting` where `isValid = feedback.trim().length >= 10`
- [ ] **10.20** Cancel button calls `onCancel()`
- [ ] **10.21** On submit: call `onSubmit(feedback.trim())`
- [ ] **10.22** Framer Motion expand animation: `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: "auto", opacity: 1 }}`

**Accessibility**:
- Buttons: `aria-busy="true"` when loading, spinner has `aria-label="Loading"`
- Disabled buttons: `aria-disabled="true"` with `title` explaining why
- AlertDialog (Retry): built-in ARIA dialog role, focus trap, Escape to close
- Character count: `aria-live="polite"` for real-time updates
- Validation errors: `role="alert"` for screen reader announcement
- Textarea: proper `<Label>` with `htmlFor`

**data-testid Attributes**:
- `data-testid="review-actions"` on the action bar container
- `data-testid="review-action-approve"` on approve button
- `data-testid="review-action-request-changes"` on request changes button
- `data-testid="review-action-retry"` on retry button
- `data-testid="review-score"` on review score display
- `data-testid="request-changes-form"` on the form container
- `data-testid="request-changes-textarea"` on the textarea
- `data-testid="request-changes-char-count"` on character count
- `data-testid="request-changes-error"` on validation error message
- `data-testid="request-changes-submit"` on submit button
- `data-testid="request-changes-cancel"` on cancel button
- `data-testid="retry-confirm-dialog"` on the AlertDialog

---

### Step 11: SuccessAnimation (Framer Motion Green Glow)

**File**: `src/components/diff-review/success-animation.tsx`
**Action**: Create
**Stories**: US-045 (approve triggers success animation)
**Business Rules**: None (visual feedback only)
**NFRs**: NFR-06-022 (< 200 lines)
**Estimated Lines**: ~60

- [ ] **11.1** Add `"use client"` directive
- [ ] **11.2** Define `SuccessAnimationProps`: `{ isVisible: boolean, onComplete: () => void }`
- [ ] **11.3** Render with `AnimatePresence`:
  - Overlay: `fixed inset-0 z-50 flex items-center justify-center pointer-events-none`
  - Fade in/out: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`
- [ ] **11.4** Render checkmark icon (CheckCircle2 from Lucide, `h-24 w-24 text-emerald-500`):
  - Scale + rotate: `initial={{ scale: 0, rotate: -180 }}`, `animate={{ scale: 1, rotate: 0 }}`
  - Spring transition: `{ type: "spring", damping: 15, stiffness: 200 }`
- [ ] **11.5** Call `onComplete` via `onAnimationComplete` after ~1.2s
- [ ] **11.6** Check `useReducedMotion()`: if true, skip animation and call `onComplete` immediately
- [ ] **11.7** Add `aria-live="assertive"` with visually hidden text "Task approved successfully" for screen readers

**data-testid Attributes**:
- `data-testid="success-animation"` on the overlay container
- `data-testid="success-animation-checkmark"` on the checkmark icon

---

### Step 12: ErrorNotification Enhancement (Sonner Toast + Inline Alert)

**File**: `src/components/pipeline/error-notification.tsx`
**Action**: Create (UOW-04 defined the interface; UOW-06 implements the full component)
**Stories**: US-048 (API failure notification), US-049 (user approves retry), US-050 (retry with backoff), US-051 (task failed state)
**Business Rules**: BR-06-010 (10s auto-dismiss toast)
**NFRs**: NFR-06-013 (toast lifecycle, max 3 stacked)
**Estimated Lines**: ~180

- [ ] **12.1** Add `"use client"` directive
- [ ] **12.2** Define `ErrorNotificationProps`: `{ taskId: string }`
- [ ] **12.3** Read from `pipelineStore`: `pipelineRun.errorDetails`, `pipelineRun.status`, agent logs
- [ ] **12.4** Use `usePipeline(taskId)` hook for retry/cancel actions
- [ ] **12.5** Define local state: `isDismissed: boolean`, `retryCountdown: number | null`
- [ ] **12.6** Implement Sonner toast trigger via `useEffect`:
  - Fire once per error (tracked by `errorDetails.timestamp`)
  - `toast.error("Pipeline Error", { description: errorDetails.message, duration: 10000, action: { label: "Retry", onClick: retryPipeline } })` (BR-06-010)
- [ ] **12.7** Render inline `<Alert variant="destructive">` (shadcn/ui) banner:
  - AlertTriangle icon, "Pipeline Error" title, dismiss X button
  - Error message in semibold, metadata (agent, phase, retry count) in muted text
  - [Retry] and [Cancel Pipeline] buttons
- [ ] **12.8** Implement countdown logic:
  - Listen for SSE agent-log events containing "Retrying in"
  - Parse seconds from message, start countdown interval
  - Display countdown text in banner: "Retrying in {N}s..."
  - Clear interval on countdown completion or component unmount (BR-04-017)
- [ ] **12.9** Render condition: `pipelineRun.status === "paused" && errorDetails !== null && !isDismissed`
- [ ] **12.10** Implement task failed state display: when `pipelineRun.status === "failed"`, show persistent error banner with "Retry Pipeline" button, no auto-dismiss
- [ ] **12.11** Framer Motion fade-in/out on banner

**Accessibility**:
- Alert banner: `role="alert"` for immediate screen reader announcement
- Retry/Cancel buttons: standard button a11y with loading states
- Countdown: `aria-live="polite"` for countdown updates

**data-testid Attributes**:
- `data-testid="error-notification"` on the Alert container
- `data-testid="error-notification-message"` on the error message
- `data-testid="error-notification-metadata"` on the agent/phase/retry info
- `data-testid="error-notification-retry"` on retry button
- `data-testid="error-notification-cancel"` on cancel button
- `data-testid="error-notification-dismiss"` on the X button
- `data-testid="error-notification-countdown"` on countdown text

---

### Step 13: Update Settings Page (Add Profile Tab)

**File**: `src/app/(dashboard)/settings/page.tsx`
**Action**: Modify
**Stories**: US-052 (view settings page), US-053 (update API key -- existing)
**Business Rules**: BR-06-011 (settings accessible anytime)
**NFRs**: NFR-06-019 (form UX), NFR-06-022 (< 200 lines)
**Estimated Lines**: ~60 (light orchestrator)

- [ ] **13.1** Import shadcn/ui `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- [ ] **13.2** Import `ApiKeyForm` from UOW-01 (existing, no changes)
- [ ] **13.3** Import `ProfileForm` from `components/settings/profile-form.tsx` (Step 14)
- [ ] **13.4** Render page header: "Settings"
- [ ] **13.5** Render `<Tabs defaultValue="api-key">`:
  - Tab trigger "API Key" (value="api-key")
  - Tab trigger "Profile" (value="profile")
- [ ] **13.6** Render tab content:
  - "api-key" tab: `<ApiKeyForm />` (existing from UOW-01, no modifications)
  - "profile" tab: `<ProfileForm />`
- [ ] **13.7** Tab navigation preserves unsaved state within each tab (tabs render both content panels, only visibility toggles)

**Accessibility**:
- shadcn/ui Tabs provides ARIA `tablist`, `tab`, `tabpanel` roles automatically
- Tab navigation via ArrowLeft/ArrowRight

**data-testid Attributes**:
- `data-testid="settings-page"` on the page container
- `data-testid="settings-tab-api-key"` on API Key tab trigger
- `data-testid="settings-tab-profile"` on Profile tab trigger
- `data-testid="settings-content-api-key"` on API Key tab content
- `data-testid="settings-content-profile"` on Profile tab content

---

### Step 14: ProfileForm Component

**File**: `src/components/settings/profile-form.tsx`
**Action**: Create
**Stories**: US-054 (update profile)
**Business Rules**: BR-06-012 (name 1-100 chars, non-empty)
**NFRs**: NFR-06-010 (input validation), NFR-06-019 (form UX: inline errors, unsaved warning, success toast)
**Estimated Lines**: ~120

- [ ] **14.1** Add `"use client"` directive
- [ ] **14.2** Read from `authStore`: `user.name`, `user.email`
- [ ] **14.3** Define local state: `name: string` (initialized from `authStore.user.name`), `errors: { name?: string, form?: string }`, `isSaving: boolean`, `isDirty: boolean`
- [ ] **14.4** Implement `isDirty` tracking: `name !== authStore.user.name`
- [ ] **14.5** Render "Display Name" `<Label>` + `<Input>` (shadcn/ui), pre-filled with current name
- [ ] **14.6** Render "Email" `<Label>` + `<Input disabled>` (read-only), with Lock icon, helper text "Your email cannot be changed." (`aria-disabled="true"`)
- [ ] **14.7** Render inline validation error below name input (BR-06-012): "Name cannot be empty" or "Name must be 100 characters or fewer"
- [ ] **14.8** Implement save handler:
  - Validate with `updateProfileSchema` from `lib/validators/review.ts`
  - On validation failure: set `errors.name` with Zod error message
  - On validation success: set `isSaving = true`, `PATCH /api/auth/me` with body `{ name: trimmedName }`
  - On API success: `authStore.setUser({ ...user, name: trimmedName })`, show `toast.success("Profile updated")`, reset `isDirty`
  - On API error: set `errors.form = "Failed to update profile. Please try again."`, show toast.error()
- [ ] **14.9** Render "Save Changes" `<Button>` disabled when `!isDirty || isSaving`
- [ ] **14.10** Show loading spinner on button during save

**Accessibility**:
- All inputs have associated `<Label>` via `htmlFor`
- Inline errors: `aria-live="polite"` and `role="alert"`
- Disabled email: `aria-disabled="true"` with explanatory text
- Success feedback: toast via Sonner (`role="status"`)

**data-testid Attributes**:
- `data-testid="profile-form"` on the form container
- `data-testid="profile-name-input"` on the name input
- `data-testid="profile-name-error"` on the name validation error
- `data-testid="profile-email-input"` on the email input
- `data-testid="profile-save-button"` on the Save Changes button
- `data-testid="profile-form-error"` on the form-level error

---

### Step 15: Update TaskCard and TaskDetailView

**Files**: `src/components/task/task-card.tsx` (modify), `src/components/task/task-detail-view.tsx` (modify)
**Action**: Modify
**Stories**: US-042 (integrate DiffReviewPanel), US-045 (success glow on Done), US-048 (error notification in detail), US-051 (failed state display)
**Business Rules**: BR-06-001 (panel visibility), BR-06-006 (done = read-only)
**NFRs**: NFR-06-011 (review state persistence)
**Estimated Lines**: ~30 added to task-card.tsx, ~40 added to task-detail-view.tsx

#### task-card.tsx Updates

- [ ] **15.1** Add green glow Framer Motion animation for task cards in "done" status:
  - `boxShadow` keyframes: `["0 0 0 rgba(34,197,94,0)", "0 0 20px rgba(34,197,94,0.4)", "0 0 0 rgba(34,197,94,0)"]`
  - `transition: { duration: 1.2, ease: "easeInOut" }`
  - Triggered once when task transitions to "done" (track via `prevStatus` ref)
- [ ] **15.2** Update phase indicator for "done" status: green checkmark icon replacing previous indicator
- [ ] **15.3** Stop pulse dot animation when task is "done"
- [ ] **15.4** Show amber warning icon on PulseDot when `pipelineRun.status === "paused"` (error state)
- [ ] **15.5** Show red "Failed" badge when task was in backlog after pipeline failure

#### task-detail-view.tsx Updates

- [ ] **15.6** Import `DiffReviewPanel`, `ErrorNotification`, `SuccessAnimation`
- [ ] **15.7** Replace diff placeholder slot with conditional DiffReviewPanel:
  ```tsx
  {task.status === "review" && pipelineRun?.fileChanges && (
    <DiffReviewPanel taskId={task.id} />
  )}
  ```
- [ ] **15.8** Add ErrorNotification for pipeline errors:
  ```tsx
  {pipelineRun?.status === "paused" && pipelineRun.errorDetails && (
    <ErrorNotification taskId={task.id} />
  )}
  ```
- [ ] **15.9** Add SuccessAnimation with local state `showSuccessAnimation`:
  ```tsx
  <SuccessAnimation
    isVisible={showSuccessAnimation}
    onComplete={() => setShowSuccessAnimation(false)}
  />
  ```
- [ ] **15.10** Add failed state display when task has failed pipeline:
  ```tsx
  {task.status === "backlog" && pipelineRun?.status === "failed" && (
    <FailedPipelineBanner taskId={task.id} />
  )}
  ```

**data-testid Attributes**:
- `data-testid="task-card-success-glow"` on the glow animation wrapper
- `data-testid="task-card-failed-badge"` on the failed badge
- `data-testid="task-detail-diff-panel"` on the DiffReviewPanel wrapper
- `data-testid="task-detail-error-notification"` on the ErrorNotification wrapper

---

### Step 16: Unit Tests

**Files**: Multiple test files in `src/__tests__/`
**Action**: Create
**Stories**: All US-042 through US-054 (testing coverage for the entire unit)
**NFRs**: NFR-06-020 (DiffService purity enables easy testing), NFR-06-023 (TypeScript strict)
**Estimated Lines**: ~600 total across test files

#### `src/__tests__/lib/services/diff-service.test.ts`

- [ ] **16.1** Test `buildFileTree`:
  - Single file at root: returns one file node
  - Nested directories: builds correct tree structure
  - Sort order: directories before files, both alphabetical (BR-06-007)
  - Empty fileChanges: returns empty array
  - Invalid input (fails Zod): returns empty array gracefully
- [ ] **16.2** Test `computeDiffs` for "create" action:
  - All lines marked as "added"
  - oldStart: 0, oldCount: 0
  - Correct line numbering
- [ ] **16.3** Test `computeDiffs` for "delete" action:
  - All lines marked as "removed"
  - newStart: 0, newCount: 0
- [ ] **16.4** Test `computeDiffs` for "modify" action:
  - Changed lines correctly identified as added/removed
  - Unchanged context lines present (3 lines of context)
  - Multiple hunks generated for non-adjacent changes
- [ ] **16.5** Test truncation: file with 10,001 lines truncated to 10,000 + marker line (BR-06-009)
- [ ] **16.6** Test `sanitizeFilePath`:
  - Valid paths pass through: "src/lib/db/schema.ts"
  - Path traversal rejected: "../../etc/passwd" returns null
  - Absolute paths rejected: "/root/.ssh/id_rsa" returns null
  - Null bytes rejected: "src/file\x00.ts" returns null
  - HTML tags rejected: "src/<script>/file.ts" returns null (NFR-06-007)
- [ ] **16.7** Test `findFirstFile`: returns first file in depth-first order

#### `src/__tests__/lib/validators/review.test.ts`

- [ ] **16.8** Test `requestChangesSchema`:
  - Valid: feedback with 10+ chars passes
  - Invalid: feedback with 9 chars fails with correct message
  - Invalid: empty string fails
  - Boundary: exactly 10 chars passes
  - Boundary: exactly 5000 chars passes, 5001 fails
  - Whitespace trimming: "  abc  " trims correctly
- [ ] **16.9** Test `updateProfileSchema`:
  - Valid: "Alex Johnson" passes
  - Invalid: empty string fails with "Name cannot be empty"
  - Invalid: 101-char string fails with "Name must be 100 characters or fewer"
  - Boundary: single char passes, 100 chars passes
  - Whitespace trimming applied

#### `src/__tests__/components/diff-review/file-tree.test.tsx`

- [ ] **16.10** Test rendering: tree with directories and files renders correctly
- [ ] **16.11** Test expand/collapse: clicking directory toggles children visibility
- [ ] **16.12** Test file selection: clicking file calls `onSelectFile` with correct path
- [ ] **16.13** Test action badges: correct badge text and colors for create/modify/delete
- [ ] **16.14** Test ARIA attributes: `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-selected`
- [ ] **16.15** Test keyboard navigation: ArrowDown/ArrowUp move focus, Enter selects/toggles

#### `src/__tests__/components/diff-review/review-actions.test.tsx`

- [ ] **16.16** Test approve flow: click Approve, verify API call, verify toast, verify onClose
- [ ] **16.17** Test request changes flow: click Request Changes, type feedback, submit, verify API call with feedback
- [ ] **16.18** Test retry flow: click Retry, verify confirmation dialog, confirm, verify API call
- [ ] **16.19** Test button disabled states: all buttons disabled during any API call
- [ ] **16.20** Test feedback validation: submit disabled when < 10 chars, enabled when >= 10

#### `src/__tests__/components/settings/profile-form.test.tsx`

- [ ] **16.21** Test rendering: name input pre-filled, email read-only
- [ ] **16.22** Test save: edit name, click save, verify API call, verify toast
- [ ] **16.23** Test validation: empty name shows inline error
- [ ] **16.24** Test dirty tracking: save button disabled when name unchanged
- [ ] **16.25** Test error handling: API failure shows form error, does not clear input

---

### Step 17: Documentation Summary

**Action**: No file creation (documentation is this plan itself)
**Purpose**: Capture decisions, traceability, and verification checklist for handoff

- [ ] **17.1** Verify all 13 stories (US-042 through US-054) are traced to implementation steps (see traceability matrix below)
- [ ] **17.2** Verify all business rules (BR-06-001 through BR-06-012) are implemented and tested
- [ ] **17.3** Verify all NFRs (NFR-06-001 through NFR-06-023) are addressed
- [ ] **17.4** Verify all `data-testid` attributes are documented
- [ ] **17.5** Run `npx tsc --noEmit` -- zero errors (NFR-06-023)
- [ ] **17.6** Run `wc -l` on all component files -- all under 200 lines (NFR-06-022)
- [ ] **17.7** Run full test suite -- all tests pass
- [ ] **17.8** Manual accessibility audit: keyboard navigation through DiffReviewPanel, screen reader test with VoiceOver

---

## Story Traceability Matrix

| Story | Title | Priority | Implementation Steps | Status |
|-------|-------|----------|---------------------|--------|
| US-042 | View Diff Panel | Must | 1, 3, 6, 8, 15.6-15.7 | [ ] |
| US-043 | Navigate File Tree | Must | 1, 3.4, 7 | [ ] |
| US-044 | Side-by-Side Diff Display | Must | 1, 3.5-3.6, 8, 9 | [ ] |
| US-045 | Approve Changes | Must | 2, 4.1-4.10, 10.5, 10.8, 11, 15.1-15.3 | [ ] |
| US-046 | Request Changes | Must | 2.2, 4.11-4.22, 10.6, 10.13-10.22 | [ ] |
| US-047 | Retry Entire Pipeline | Should | 10.7-10.8 | [ ] |
| US-048 | API Failure Notification | Must | 12.1-12.7 | [ ] |
| US-049 | User Approves Retry | Must | 12.7 (Retry button in ErrorNotification) | [ ] |
| US-050 | Retry with Exponential Backoff | Must | 12.8 (countdown display) | [ ] |
| US-051 | Task Marked as Failed | Must | 12.10, 15.4-15.5 | [ ] |
| US-052 | View Settings Page | Must | 13 | [ ] |
| US-053 | Update API Key | Must | 13.2, 13.6 (existing ApiKeyForm, no changes) | [ ] |
| US-054 | Update Profile | Could | 2.4, 5, 14 | [ ] |

---

## Business Rules Traceability

| Rule ID | Domain | Step(s) | Verified By |
|---------|--------|---------|-------------|
| BR-06-001 | Diff Panel Visibility | 6.7, 6.8 | Manual: verify panel only shows in "review" status |
| BR-06-002 | Approve Always Available | 10.5, 10.8 | Test 16.16: button enabled in review state |
| BR-06-003 | Feedback Min 10 Chars | 2.2, 10.18-10.19 | Test 16.8, 16.20: validation boundary tests |
| BR-06-004 | Retry from Planning | 10.7 | Test 16.18: confirmation dialog + API call |
| BR-06-005 | Request Changes from Coding | 10.6, 4.17-4.19 | Test 16.17: API call with feedback |
| BR-06-006 | Done = Read-Only | 10.10 (buttons hidden) | Manual: verify no action buttons on done task |
| BR-06-007 | File Tree Sort Order | 3.4 | Test 16.1: directories first, alphabetical |
| BR-06-008 | Supported Languages | 1.11, 3.11, 9.9 | Test: unsupported language falls back to plain text |
| BR-06-009 | 10K Line Truncation | 1.12, 3.5, 9.6 | Test 16.5: 10,001 lines truncated with marker |
| BR-06-010 | Toast Auto-Dismiss 10s | 12.6 | Manual: observe toast disappears after 10s |
| BR-06-011 | Settings Always Accessible | 13 | Manual: verify /settings reachable anytime |
| BR-06-012 | Name 1-100 Chars | 2.4, 5.4, 14.7 | Test 16.9, 16.23: validation boundary tests |

---

## NFR Coverage Map

| NFR ID | Category | Addressed In | Verification |
|--------|----------|-------------|--------------|
| NFR-06-001 | Performance (500ms open) | 3, 6.6 (DiffService + mount) | Chrome DevTools Performance trace |
| NFR-06-002 | Performance (2K lines 60fps) | 8, 9 (CSS Grid, single scroll) | DevTools Profiler with 2K-line file |
| NFR-06-003 | Performance (50ms expand) | 7 (Set-based toggle, Framer Motion) | React DevTools Profiler |
| NFR-06-004 | Performance (Shiki 100ms) | 3.9-3.12 (lazy singleton, cache) | DevTools long task monitor |
| NFR-06-005 | Performance (truncation) | 3.5, 9.6 | Test 16.5 |
| NFR-06-006 | Security (XSS) | 3.3, 9.13 (Shiki encoding) | Manual: inject script tags in file content |
| NFR-06-007 | Security (path sanitization) | 3.3 | Test 16.6 |
| NFR-06-008 | Security (CSRF) | 4 (inherits better-auth) | Manual: cross-origin POST rejected |
| NFR-06-009 | Security (API key header) | 10.6, 10.7 | Network inspect: key in header only |
| NFR-06-010 | Security (input validation) | 2, 5.4, 14.7-14.8 | Tests 16.8, 16.9 |
| NFR-06-011 | Reliability (state persistence) | 6.6 (Zustand + DB fallback) | Manual: navigate away and back |
| NFR-06-012 | Reliability (idempotent approve) | 4.6 | Manual: duplicate POST returns 200 |
| NFR-06-013 | Reliability (toast lifecycle) | 12.6 | Manual: observe 10s dismiss, max 3 stacked |
| NFR-06-014 | Reliability (feedback preserved) | 10.6 (error keeps form open) | Test 16.17 with simulated failure |
| NFR-06-015 | Usability (keyboard nav) | 7 (ARIA tree), 6 (Escape closes) | Manual: keyboard-only operation |
| NFR-06-016 | Usability (screen reader) | 7 (tree roles), 8 (region label), 9.7 (line labels) | VoiceOver/NVDA audit |
| NFR-06-017 | Usability (responsive) | 6.9, 8 (CSS Grid breakpoints) | Resize to 1280px, 768px, 375px |
| NFR-06-018 | Usability (confirmation) | 10.7 (AlertDialog for Retry) | Test 16.18 |
| NFR-06-019 | Usability (settings UX) | 13, 14 (dirty tracking, inline errors) | Tests 16.21-16.25 |
| NFR-06-020 | Maintainability (pure service) | 3 (no store/API/DOM access) | Inspect imports, test determinism |
| NFR-06-021 | Maintainability (shared schemas) | 2 (single source), 4 + 5 + 14 (import same) | Grep for duplicate schemas |
| NFR-06-022 | Maintainability (< 200 lines) | All components | `wc -l` on all files |
| NFR-06-023 | Maintainability (TS strict) | All files | `npx tsc --noEmit` exits 0 |

---

## Accessibility Specification Summary

| Component | ARIA Roles | Keyboard | Screen Reader |
|-----------|-----------|----------|---------------|
| DiffReviewPanel | Sheet (dialog role) | Escape closes, Tab between sections | Focus trap, panel announce |
| FileTree | `role="tree"`, `role="treeitem"` | Arrow keys navigate, Enter selects/toggles | Expanded/collapsed announced, file action announced |
| DiffViewer | `role="region"` | Scroll with arrows | File name in aria-label, line changes announced |
| DiffHunkView | `role="separator"` on headers | N/A (scroll context) | Line-level aria-labels for added/removed |
| ReviewActions | Standard buttons | Tab between buttons, Enter activates | aria-busy during loading, aria-disabled with title |
| RequestChangesForm | Standard form | Tab to textarea/buttons | aria-live char count, role="alert" errors |
| ErrorNotification | `role="alert"` | Standard button interaction | Immediate announcement of error |
| SuccessAnimation | N/A (decorative) | N/A | aria-live "Task approved successfully" |
| ProfileForm | Standard form | Tab between inputs/button | aria-live errors, disabled email announced |
| SettingsPage | `tablist`, `tab`, `tabpanel` | Arrow keys switch tabs | Tab names announced |

---

## data-testid Attribute Registry

Complete list of all `data-testid` attributes for E2E and integration testing:

| data-testid | Component | Purpose |
|-------------|-----------|---------|
| `diff-review-panel` | DiffReviewPanel | Panel root |
| `diff-review-header` | DiffReviewPanel | Header section |
| `diff-review-file-count` | DiffReviewPanel | File count badge |
| `diff-review-close` | DiffReviewPanel | Close button |
| `file-tree` | FileTree | Tree root |
| `file-tree-node-{path}` | FileTree | Individual node |
| `file-tree-badge-{action}` | FileTree | Action badge (A/M/D) |
| `file-tree-expand-{path}` | FileTree | Directory toggle |
| `diff-viewer` | DiffViewer | Viewer root |
| `diff-viewer-empty` | DiffViewer | Empty state |
| `diff-viewer-file-header` | DiffViewer | File header |
| `diff-hunk-{index}` | DiffViewer | Hunk container |
| `diff-hunk-header-{index}` | DiffHunkView | Hunk header |
| `diff-line-{type}-{lineNumber}` | DiffHunkView | Line row |
| `diff-truncation-marker` | DiffHunkView | Truncation banner |
| `code-block` | CodeBlock | Code container |
| `review-actions` | ReviewActions | Action bar |
| `review-action-approve` | ReviewActions | Approve button |
| `review-action-request-changes` | ReviewActions | Request Changes button |
| `review-action-retry` | ReviewActions | Retry button |
| `review-score` | ReviewActions | Score display |
| `request-changes-form` | RequestChangesForm | Form container |
| `request-changes-textarea` | RequestChangesForm | Textarea |
| `request-changes-char-count` | RequestChangesForm | Character count |
| `request-changes-error` | RequestChangesForm | Validation error |
| `request-changes-submit` | RequestChangesForm | Submit button |
| `request-changes-cancel` | RequestChangesForm | Cancel button |
| `retry-confirm-dialog` | ReviewActions | Retry confirmation |
| `success-animation` | SuccessAnimation | Overlay |
| `success-animation-checkmark` | SuccessAnimation | Checkmark icon |
| `error-notification` | ErrorNotification | Alert container |
| `error-notification-message` | ErrorNotification | Error message |
| `error-notification-metadata` | ErrorNotification | Agent/phase/retry info |
| `error-notification-retry` | ErrorNotification | Retry button |
| `error-notification-cancel` | ErrorNotification | Cancel button |
| `error-notification-dismiss` | ErrorNotification | Dismiss (X) button |
| `error-notification-countdown` | ErrorNotification | Countdown text |
| `settings-page` | SettingsPage | Page container |
| `settings-tab-api-key` | SettingsPage | API Key tab |
| `settings-tab-profile` | SettingsPage | Profile tab |
| `settings-content-api-key` | SettingsPage | API Key content |
| `settings-content-profile` | SettingsPage | Profile content |
| `profile-form` | ProfileForm | Form container |
| `profile-name-input` | ProfileForm | Name input |
| `profile-name-error` | ProfileForm | Name error |
| `profile-email-input` | ProfileForm | Email input |
| `profile-save-button` | ProfileForm | Save button |
| `profile-form-error` | ProfileForm | Form error |
| `task-card-success-glow` | TaskCard | Glow animation |
| `task-card-failed-badge` | TaskCard | Failed badge |
| `task-detail-diff-panel` | TaskDetailView | Panel wrapper |
| `task-detail-error-notification` | TaskDetailView | Error wrapper |

---

## Implementation Order and Dependencies

```
Step 1: Types ──────────────┐
                             ├──> Step 3: DiffService
Step 2: Validators ─────────┤
                             ├──> Step 4: Review API Routes
                             ├──> Step 5: Profile API Route
                             │
Step 3: DiffService ────────┼──> Step 6: DiffReviewPanel ──> Step 7: FileTree
                             │                               ──> Step 8: DiffViewer ──> Step 9: DiffHunkView + CodeBlock
                             │                               ──> Step 10: ReviewActions + RequestChangesForm
                             │
Step 4: Review API Routes ──┼──> Step 10: ReviewActions (API integration)
Step 5: Profile API Route ──┼──> Step 14: ProfileForm (API integration)
                             │
Step 11: SuccessAnimation (independent, can start after Step 1)
Step 12: ErrorNotification (independent, can start after Step 1)
Step 13: Settings Page (after Step 14 is created)
Step 14: ProfileForm (after Steps 2, 5)
Step 15: TaskCard/DetailView Updates (after Steps 6, 11, 12)
Step 16: Unit Tests (after all implementation steps)
Step 17: Documentation (after all tests pass)
```

**Parallelizable groups** (can be developed simultaneously):
- Group A: Steps 1-2 (types + validators) -- foundational, do first
- Group B: Steps 3, 4, 5 (services + API routes) -- after Group A
- Group C: Steps 6, 7, 8, 9, 10, 11, 12, 13, 14 (components) -- after relevant Group B items
- Group D: Steps 15, 16, 17 (integration, tests, docs) -- after Group C

---

## Estimated Effort

| Step | Description | Lines | Complexity |
|------|-------------|-------|-----------|
| 1 | Type Definitions | ~80 | Low |
| 2 | Zod Validators | ~40 | Low |
| 3 | DiffService + Syntax Highlighter | ~240 | Medium |
| 4 | Review API Routes | ~140 | Medium |
| 5 | Profile API Route | ~40 | Low |
| 6 | DiffReviewPanel | ~150 | Medium |
| 7 | FileTree | ~180 | Medium |
| 8 | DiffViewer | ~150 | Medium |
| 9 | DiffHunkView + CodeBlock | ~200 | Medium |
| 10 | ReviewActions + RequestChangesForm | ~280 | Medium |
| 11 | SuccessAnimation | ~60 | Low |
| 12 | ErrorNotification | ~180 | Medium |
| 13 | Settings Page Update | ~60 | Low |
| 14 | ProfileForm | ~120 | Low |
| 15 | TaskCard/DetailView Updates | ~70 | Low |
| 16 | Unit Tests | ~600 | Medium |
| 17 | Documentation Summary | ~0 | Low |
| **Total** | | **~2,590** | |
