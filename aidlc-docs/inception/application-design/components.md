# Application Components — AutoCoder

## Component Architecture Overview

AutoCoder follows a layered component architecture aligned with Next.js 15 App Router conventions. UI components live under `components/` organized by domain (board, pipeline, agent-log, diff, auth, settings, layout). Server logic lives in `app/api/` route handlers. Client state is managed by domain-scoped Zustand stores under `lib/stores/`. Agent prompt templates live in `lib/prompts/`. The pipeline orchestrator is a server-side module under `lib/pipeline/`.

All components use TypeScript strict mode. shadcn/ui primitives are used for buttons, inputs, dialogs, selects, tabs, tooltips, and toasts. Framer Motion handles layout animations and transitions. dnd-kit handles drag-and-drop on the Kanban board.

---

## UI Components

### 1. Layout Components

#### AppShell

- **Purpose**: Root layout wrapper providing sidebar, header, bottom dock, and main content area.
- **Responsibilities**:
  - Render Sidebar, Header, main content slot, and BottomDock
  - Manage global layout state (sidebar collapsed, bottom dock height)
  - Apply authentication guard (redirect unauthenticated users)
  - Provide responsive breakpoint handling
- **Key Props/Interface**:
  ```ts
  interface AppShellProps {
    children: React.ReactNode;
  }
  ```

#### Sidebar

- **Purpose**: Left-side icon navigation with project switcher and project name display.
- **Responsibilities**:
  - Render navigation icons (Kanban board, Settings)
  - Display active project name at bottom
  - Host ProjectSwitcher dropdown trigger
  - Highlight active navigation item
  - Collapse to icon-only on narrow viewports
- **Key Props/Interface**:
  ```ts
  interface SidebarProps {
    activeProjectId: string;
    activeRoute: "board" | "settings";
  }
  ```

#### Header

- **Purpose**: Top bar with project context and user menu.
- **Responsibilities**:
  - Display current project name as breadcrumb
  - Render "New Task" action button
  - Show user avatar/name dropdown with logout action
  - Provide search/filter input for board view
- **Key Props/Interface**:
  ```ts
  interface HeaderProps {
    projectName: string;
    userName: string;
  }
  ```

#### BottomDock

- **Purpose**: Collapsible container anchored to viewport bottom housing the agent log panel.
- **Responsibilities**:
  - Toggle open/collapsed state with smooth slide animation
  - Show activity indicator (dot badge) when collapsed and logs are streaming
  - Allow drag-resize of panel height
  - Render child content (AgentLogPanel)
- **Key Props/Interface**:
  ```ts
  interface BottomDockProps {
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    hasActivity: boolean;
  }
  ```

---

### 2. Board Components

#### KanbanBoard

- **Purpose**: Five-column drag-and-drop board displaying all tasks for the active project.
- **Responsibilities**:
  - Render five KanbanColumn components (Backlog, Spec, Building, Review, Done)
  - Initialize dnd-kit DndContext with collision detection and sensors
  - Handle onDragEnd to update task status via taskStore
  - Filter/search tasks based on active filters
  - Show empty state when no tasks exist
- **Key Props/Interface**:
  ```ts
  interface KanbanBoardProps {
    projectId: string;
  }
  // Internal: reads tasks from taskStore, no task prop drilling
  ```

#### KanbanColumn

- **Purpose**: Single status column within the Kanban board.
- **Responsibilities**:
  - Render column header with name and task count badge
  - Act as dnd-kit droppable zone
  - Render sorted TaskCard list within the column
  - Show drop placeholder during drag-over
  - Animate card entry/exit with Framer Motion AnimatePresence
- **Key Props/Interface**:
  ```ts
  type ColumnStatus = "backlog" | "spec" | "building" | "review" | "done";

  interface KanbanColumnProps {
    status: ColumnStatus;
    tasks: Task[];
  }
  ```

#### TaskCard

- **Purpose**: Individual task card within a Kanban column showing key metadata at a glance.
- **Responsibilities**:
  - Display task title (truncated), category badge, priority indicator
  - Show color-coded phase indicator (amber/blue/purple/green)
  - Render animated pulse dot when pipeline is active
  - Show subtask progress count (e.g., "3/5")
  - Display relative timestamp ("2h ago")
  - Act as dnd-kit draggable item
  - Navigate to TaskDetailView on click
- **Key Props/Interface**:
  ```ts
  interface TaskCardProps {
    task: Task;
    isActive: boolean; // pipeline currently running
  }
  ```

---

### 3. Task Components

#### TaskCreationModal

- **Purpose**: Dialog form for creating new tasks with title, description, category, and priority.
- **Responsibilities**:
  - Render form fields: title (input), description (textarea), category (select), priority (select)
  - Validate form with Zod schema (title required, max 200 chars)
  - Show inline validation errors per field
  - Provide "Create" (backlog only) and "Create & Start" (backlog + trigger pipeline) actions
  - Block "Create & Start" when no API key is configured
  - Close on Escape or backdrop click without saving
- **Key Props/Interface**:
  ```ts
  interface TaskCreationModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    onCreated: (task: Task, startPipeline: boolean) => void;
  }
  ```

#### TaskDetailView

- **Purpose**: Full detail view of a single task showing pipeline visualization, logs, and diff review.
- **Responsibilities**:
  - Display task metadata (title, description, category, priority, status)
  - Render PipelineVisualization at top
  - Show subtask list with completion status
  - Conditionally render DiffReviewPanel when task is in "review" status
  - Provide "Start Pipeline", "Cancel Pipeline", "Retry Pipeline" action buttons based on state
  - Navigate back to KanbanBoard on Escape or back button
- **Key Props/Interface**:
  ```ts
  interface TaskDetailViewProps {
    taskId: string;
  }
  ```

---

### 4. Pipeline Components

#### PipelineVisualization

- **Purpose**: Horizontal flow diagram showing pipeline stages (Spec, Plan, Code, Review, Done) with animated state.
- **Responsibilities**:
  - Render five PipelineNode components connected by PipelineConnector lines
  - Map pipeline state to node states (inactive/active/completed/failed)
  - Animate transitions when pipeline advances stages
  - Display iteration counter when in retry loop
- **Key Props/Interface**:
  ```ts
  type PipelinePhase = "spec" | "plan" | "code" | "review" | "done";

  interface PipelineVisualizationProps {
    currentPhase: PipelinePhase | null;
    completedPhases: PipelinePhase[];
    failedPhase: PipelinePhase | null;
    iteration: number;
    phaseTiming: Record<PipelinePhase, number | null>; // seconds per phase
  }
  ```

#### PipelineNode

- **Purpose**: Single stage node in the pipeline visualization.
- **Responsibilities**:
  - Display stage icon and label
  - Apply visual state: dimmed (inactive), pulsing (active), green checkmark (completed), red X (failed)
  - Show elapsed time or live timer below node
  - Animate state transitions with Framer Motion
- **Key Props/Interface**:
  ```ts
  type NodeState = "inactive" | "active" | "completed" | "failed";

  interface PipelineNodeProps {
    phase: PipelinePhase;
    state: NodeState;
    elapsedSeconds: number | null;
  }
  ```

#### PipelineConnector

- **Purpose**: Animated connecting line between two pipeline nodes.
- **Responsibilities**:
  - Render horizontal line/arrow between adjacent nodes
  - Animate fill color when left node completes (progress effect)
  - Show dimmed state when neither node has been reached
- **Key Props/Interface**:
  ```ts
  interface PipelineConnectorProps {
    fromState: NodeState;
    toState: NodeState;
  }
  ```

---

### 5. Agent Log Components

#### AgentLogPanel

- **Purpose**: Tabbed log viewer displaying streaming output from Planner, Coder, and Reviewer agents.
- **Responsibilities**:
  - Render three AgentLogTab components (Planner, Coder, Reviewer)
  - Manage active tab selection
  - Show new-content indicator on inactive tabs when new logs arrive
  - Display empty state placeholder when no pipeline has run
  - Subscribe to SSE stream for active task
- **Key Props/Interface**:
  ```ts
  type AgentType = "planner" | "coder" | "reviewer";

  interface AgentLogPanelProps {
    taskId: string | null; // null = no active task selected
  }
  ```

#### AgentLogTab

- **Purpose**: Single agent's streaming log view within the tabbed panel.
- **Responsibilities**:
  - Render scrollable list of LogEntry components
  - Auto-scroll to bottom on new entries (pause on manual scroll-up)
  - Show "Jump to latest" button when auto-scroll is paused
  - Apply agent-specific accent color (amber/blue/purple)
- **Key Props/Interface**:
  ```ts
  interface AgentLogTabProps {
    agent: AgentType;
    entries: LogEntryData[];
    isStreaming: boolean;
  }
  ```

#### LogEntry

- **Purpose**: Individual log line with timestamp, agent color, and typing effect.
- **Responsibilities**:
  - Display timestamp prefix in muted style (e.g., "[14:32:05]")
  - Render text content with character-by-character typing animation (when streaming)
  - Show blinking cursor at end of line during active streaming
  - Highlight error entries in red
- **Key Props/Interface**:
  ```ts
  interface LogEntryProps {
    timestamp: string;
    content: string;
    isError: boolean;
    isStreaming: boolean; // true = show typing animation
    agentColor: string;
  }
  ```

---

### 6. Diff Review Components

#### DiffReviewPanel

- **Purpose**: Side panel displaying file changes for human review with approve/reject/retry actions.
- **Responsibilities**:
  - Render FileTree on left, DiffViewer on right
  - Track selected file for focused diff display
  - Render ReviewActions bar at bottom
  - Show "No file changes to review" empty state when applicable
- **Key Props/Interface**:
  ```ts
  interface DiffReviewPanelProps {
    taskId: string;
    fileChanges: FileChange[];
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
    onRetry: () => void;
  }
  ```

#### FileTree

- **Purpose**: Collapsible directory tree of all files changed by the AI pipeline.
- **Responsibilities**:
  - Parse flat file paths into nested directory structure
  - Render collapsible tree nodes (directories collapse, files are leaves)
  - Show change type icon per file (added / modified / deleted)
  - Highlight selected file
  - Trigger file selection on click
- **Key Props/Interface**:
  ```ts
  type ChangeType = "added" | "modified" | "deleted";

  interface FileTreeProps {
    files: { path: string; changeType: ChangeType }[];
    selectedPath: string | null;
    onSelectFile: (path: string) => void;
  }
  ```

#### DiffViewer

- **Purpose**: Side-by-side diff display with syntax highlighting for a single file.
- **Responsibilities**:
  - Render side-by-side layout (original left, generated right)
  - Highlight additions (green), deletions (red), unchanged (neutral)
  - Apply language-aware syntax highlighting
  - Show line numbers on both sides
  - Handle new-file case (empty left, all-green right)
- **Key Props/Interface**:
  ```ts
  interface DiffViewerProps {
    originalContent: string;
    generatedContent: string;
    filePath: string; // used to infer language for syntax highlighting
  }
  ```

#### ReviewActions

- **Purpose**: Action button bar for the diff review workflow.
- **Responsibilities**:
  - Render "Approve", "Request Changes", "Retry" buttons
  - Show feedback textarea when "Request Changes" is clicked
  - Confirm "Retry" with confirmation dialog before executing
  - Disable actions while pipeline is running
- **Key Props/Interface**:
  ```ts
  interface ReviewActionsProps {
    onApprove: () => void;
    onRequestChanges: (feedback: string) => void;
    onRetry: () => void;
    isLoading: boolean;
  }
  ```

---

### 7. Settings Components

#### SettingsPage

- **Purpose**: User settings page for API key management and profile editing.
- **Responsibilities**:
  - Render ApiKeyForm section and profile section
  - Display masked current API key or "No key configured" prompt
  - Show profile fields (name, email — email read-only)
  - Save profile changes to server
- **Key Props/Interface**:
  ```ts
  // Page component — no external props; reads from authStore
  ```

#### ApiKeyForm

- **Purpose**: Form to enter, validate, update, or remove the Anthropic API key.
- **Responsibilities**:
  - Render input field for API key entry
  - Validate key against Anthropic API on save
  - Encrypt and store valid key in localStorage
  - Show masked key display when key exists
  - Provide "Remove Key" action with confirmation
  - Display validation success/error feedback
- **Key Props/Interface**:
  ```ts
  interface ApiKeyFormProps {
    currentKeyMasked: string | null; // e.g., "sk-ant-...xxxx" or null
    onSave: (key: string) => Promise<boolean>; // returns validation result
    onRemove: () => void;
  }
  ```

---

### 8. Auth Components

#### LoginForm

- **Purpose**: Email and password login form.
- **Responsibilities**:
  - Render email and password input fields
  - Validate inputs client-side (email format, password not empty)
  - Submit credentials to auth API
  - Display generic error on invalid credentials (no enumeration)
  - Redirect to dashboard on success
  - Link to registration page
- **Key Props/Interface**:
  ```ts
  // Page component — no external props; redirects on success
  ```

#### RegisterForm

- **Purpose**: New user registration form with email, password, and display name.
- **Responsibilities**:
  - Render name, email, and password input fields
  - Validate inputs (email format, password min 8 chars, name required)
  - Submit to auth API for account creation
  - Display inline errors (duplicate email, validation failures)
  - Redirect to dashboard on success (default project auto-created)
  - Link to login page
- **Key Props/Interface**:
  ```ts
  // Page component — no external props; redirects on success
  ```

---

## Server Components (API Routes)

### AuthRouteHandler

- **Purpose**: Handle user registration, login, logout, and session verification.
- **Responsibilities**:
  - POST /api/auth/register — validate input, hash password, create user + default project, set session cookie
  - POST /api/auth/login — verify credentials, set session cookie
  - POST /api/auth/logout — invalidate session cookie
  - GET /api/auth/me — return current user from session

### ProjectRouteHandler

- **Purpose**: CRUD operations for user projects.
- **Responsibilities**:
  - GET /api/projects — list projects for authenticated user
  - POST /api/projects — create new project
  - PATCH /api/projects/[id] — rename project (ownership check)
  - DELETE /api/projects/[id] — delete project + cascade tasks (ownership check, prevent last-project deletion)

### TaskRouteHandler

- **Purpose**: CRUD operations for tasks and pipeline trigger.
- **Responsibilities**:
  - GET /api/tasks?projectId=X — list tasks for project (ownership check)
  - POST /api/tasks — create task in backlog
  - PATCH /api/tasks/[id] — update task status/details
  - DELETE /api/tasks/[id] — delete task
  - POST /api/tasks/[id]/start-pipeline — validate API key, start pipeline orchestrator

### PipelineRouteHandler

- **Purpose**: Pipeline control operations (status, retry, cancel, approve, request changes).
- **Responsibilities**:
  - GET /api/pipeline/[taskId]/status — return current pipeline state
  - POST /api/pipeline/[taskId]/retry — restart pipeline from Plan stage
  - POST /api/pipeline/[taskId]/cancel — abort running pipeline
  - POST /api/pipeline/[taskId]/approve — move task to Done
  - POST /api/pipeline/[taskId]/request-changes — send feedback, restart Coder

### SSERouteHandler

- **Purpose**: Server-Sent Events endpoint streaming agent logs and task state changes.
- **Responsibilities**:
  - GET /api/sse/[taskId] — open SSE connection for a task
  - Push agent log chunks as they stream from Anthropic SDK
  - Push task status/phase transitions as pipeline progresses
  - Handle client disconnect cleanup
  - Single connection multiplexes both log and state events

---

## State Management (Zustand Stores)

### authStore

- **Purpose**: Manage user authentication session state.
- **Responsibilities**:
  - Track current user (id, name, email) or null
  - Provide login, register, logout actions
  - Hydrate session on app mount (GET /api/auth/me)
  - Track loading/error state for auth operations
- **State Shape**:
  ```ts
  interface AuthState {
    user: { id: string; name: string; email: string } | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
  }
  ```

### projectStore

- **Purpose**: Manage projects list and active project selection.
- **Responsibilities**:
  - Store projects array and activeProjectId
  - Provide CRUD actions (create, rename, delete)
  - Fetch projects on mount and after mutations
  - Switch active project
- **State Shape**:
  ```ts
  interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    isLoading: boolean;
    fetchProjects: () => Promise<void>;
    createProject: (name: string) => Promise<Project>;
    renameProject: (id: string, name: string) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    setActiveProject: (id: string) => void;
  }
  ```

### taskStore

- **Purpose**: Manage tasks for the active project and board state.
- **Responsibilities**:
  - Store tasks array filtered by active project
  - Provide CRUD actions (create, update status, delete)
  - Handle optimistic updates for drag-and-drop moves
  - Update task state from SSE events (phase transitions, status changes)
- **State Shape**:
  ```ts
  interface TaskState {
    tasks: Task[];
    isLoading: boolean;
    fetchTasks: (projectId: string) => Promise<void>;
    createTask: (data: CreateTaskInput) => Promise<Task>;
    updateTaskStatus: (id: string, status: ColumnStatus) => Promise<void>;
    updateTask: (id: string, data: Partial<Task>) => void;
    deleteTask: (id: string) => Promise<void>;
    startPipeline: (id: string) => Promise<void>;
  }
  ```

### pipelineStore

- **Purpose**: Manage pipeline execution state, agent logs, and SSE connection.
- **Responsibilities**:
  - Track active pipeline per task (phase, iteration, timing, status)
  - Store agent log entries per agent type
  - Manage SSE connection lifecycle (connect, disconnect, reconnect)
  - Provide pipeline control actions (retry, cancel, approve, request changes)
  - Push SSE events into both log entries and task state
- **State Shape**:
  ```ts
  interface PipelineState {
    activePipelines: Record<string, PipelineRunState>; // keyed by taskId
    agentLogs: Record<string, Record<AgentType, LogEntryData[]>>; // taskId -> agent -> logs
    sseConnection: EventSource | null;
    connectSSE: (taskId: string) => void;
    disconnectSSE: () => void;
    retryPipeline: (taskId: string) => Promise<void>;
    cancelPipeline: (taskId: string) => Promise<void>;
    approvePipeline: (taskId: string) => Promise<void>;
    requestChanges: (taskId: string, feedback: string) => Promise<void>;
  }
  ```

### uiStore

- **Purpose**: Manage UI-level transient state (panel visibility, modals, sidebar).
- **Responsibilities**:
  - Track bottom dock open/collapsed state
  - Track task creation modal open/closed
  - Track sidebar collapsed state
  - Track active agent log tab
  - Store selected task ID for detail view
- **State Shape**:
  ```ts
  interface UIState {
    isBottomDockOpen: boolean;
    isTaskModalOpen: boolean;
    isSidebarCollapsed: boolean;
    activeLogTab: AgentType;
    selectedTaskId: string | null;
    toggleBottomDock: () => void;
    openTaskModal: () => void;
    closeTaskModal: () => void;
    toggleSidebar: () => void;
    setActiveLogTab: (tab: AgentType) => void;
    selectTask: (taskId: string | null) => void;
  }
  ```

---

## Component Dependency Map

```
AppShell
├── Sidebar (projectStore, uiStore)
├── Header (projectStore, authStore, uiStore)
├── Main Content
│   ├── KanbanBoard (taskStore, uiStore)
│   │   ├── KanbanColumn
│   │   │   └── TaskCard (pipelineStore)
│   │   └── [Empty State]
│   ├── TaskDetailView (taskStore, pipelineStore)
│   │   ├── PipelineVisualization
│   │   │   ├── PipelineNode
│   │   │   └── PipelineConnector
│   │   └── DiffReviewPanel
│   │       ├── FileTree
│   │       ├── DiffViewer
│   │       └── ReviewActions
│   └── SettingsPage (authStore)
│       └── ApiKeyForm
├── BottomDock (uiStore, pipelineStore)
│   └── AgentLogPanel (pipelineStore)
│       └── AgentLogTab
│           └── LogEntry
└── TaskCreationModal (taskStore, uiStore)

Auth Pages (no AppShell)
├── LoginForm (authStore)
└── RegisterForm (authStore)
```
