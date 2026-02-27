# User Stories — AutoCoder

## Story Organization
- **Breakdown**: Feature-Based
- **Total Stories**: 48
- **Format**: Given/When/Then (BDD)
- **Priority**: Must (MVP core) / Should (MVP important) / Could (post-MVP)

## Personas

| ID | Name | Role | Context |
|----|------|------|---------|
| P1 | Alex | Junior Developer / New User | First time using AI coding tools; needs clear onboarding and guidance |
| P2 | Sarah | Senior Developer / Power User | Runs multiple projects simultaneously; values speed, keyboard shortcuts, bulk operations |
| P3 | Marcus | Tech Lead | Reviews AI output quality; cares about diff review accuracy and pipeline reliability |
| P4 | Priya | DevOps Engineer | Manages API keys and infrastructure concerns; values error visibility and retry control |

---

## Feature 1: Authentication & Onboarding (FR-01, FR-02)

### US-001: User Registration
**As** Alex (new user), **I want** to create an account with email and password, **so that** I can access AutoCoder and start using AI agents.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am on the registration page, **When** I submit a valid email and password (min 8 chars), **Then** my account is created with a bcrypt-hashed password and I am redirected to the dashboard.
- **Given** I submit an email that already exists, **When** the form is submitted, **Then** I see an inline error "Email already registered" and the form is not submitted.
- **Given** I leave required fields empty, **When** I click Register, **Then** inline validation errors appear on each empty field.

---

### US-002: User Login
**As** Sarah (returning user), **I want** to log in with my email and password, **so that** I can resume working on my projects.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I have a registered account, **When** I submit valid credentials, **Then** a secure httpOnly session cookie is set and I am redirected to the Kanban board.
- **Given** I enter incorrect credentials, **When** I submit the form, **Then** I see a generic error "Invalid email or password" (no credential enumeration).
- **Given** I am already logged in, **When** I navigate to the login page, **Then** I am redirected to the dashboard automatically.

---

### US-003: User Logout
**As** Marcus, **I want** to log out of my session, **so that** my account is secure on shared machines.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am logged in, **When** I click Logout in the user menu, **Then** my session cookie is invalidated and I am redirected to the login page.
- **Given** I have logged out, **When** I press the browser back button, **Then** I am redirected to the login page instead of seeing authenticated content.

---

### US-004: Session Persistence
**As** Sarah, **I want** my session to persist across browser refreshes, **so that** I don't have to log in every time I reopen the app.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** I am logged in with a valid session, **When** I refresh the page or close and reopen the browser, **Then** I remain authenticated and see my dashboard.
- **Given** my session has expired, **When** I make any request, **Then** I am redirected to the login page with a message "Session expired, please log in again."

---

### US-005: API Key Setup
**As** Alex (first-time user), **I want** to enter my Anthropic API key during onboarding, **so that** the AI pipeline can make requests on my behalf.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I have no API key configured, **When** I navigate to Settings or attempt to start a pipeline, **Then** I see a prompt to enter my Anthropic API key.
- **Given** I enter a valid API key, **When** I click Save, **Then** the key is encrypted and stored in localStorage, and a success toast appears.
- **Given** I enter an invalid API key, **When** I click Save, **Then** the key is validated against the Anthropic API and I see an error "Invalid API key — please check and try again."

---

### US-006: API Key Validation on Pipeline Start
**As** Priya, **I want** the system to verify my API key is valid before starting a pipeline, **so that** I don't waste time on tasks that will immediately fail.
**Priority**: Must
**Personas**: Priya, Sarah, Marcus

**Acceptance Criteria**:
- **Given** I have a saved API key, **When** I trigger "Create & Start" on a task, **Then** the system validates the key before invoking any agent.
- **Given** my stored API key has been revoked or is expired, **When** I start a pipeline, **Then** I see a notification "API key invalid — please update in Settings" and the pipeline does not start.

---

## Feature 2: Project Management (FR-03)

### US-007: Create Project
**As** Sarah, **I want** to create a new project, **so that** I can organize tasks for different codebases separately.
**Priority**: Must
**Personas**: Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am on the dashboard, **When** I click "New Project" and enter a name, **Then** a new project is created and I am switched to it.
- **Given** I try to create a project with an empty name, **When** I submit, **Then** I see a validation error "Project name is required."
- **Given** I have existing projects, **When** the new project is created, **Then** it appears in the project switcher sidebar immediately.

---

### US-008: Switch Between Projects
**As** Sarah, **I want** to switch between projects via the sidebar, **so that** I can context-switch quickly without losing progress.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** I have multiple projects, **When** I click a project in the sidebar switcher, **Then** the Kanban board updates to show only that project's tasks.
- **Given** I switch projects, **When** the new project loads, **Then** the project name in the header updates and the URL reflects the selected project.

---

### US-009: Rename Project
**As** Marcus, **I want** to rename a project, **so that** I can keep project names aligned with actual codebases.
**Priority**: Should
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** I right-click or open the context menu on a project, **When** I select "Rename" and enter a new name, **Then** the project name updates in the sidebar and header.
- **Given** I try to rename a project to an empty string, **When** I submit, **Then** the rename is rejected and the original name is preserved.

---

### US-010: Delete Project
**As** Marcus, **I want** to delete a project I no longer need, **so that** my workspace stays clean.
**Priority**: Should
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** I select "Delete" from the project context menu, **When** I confirm in the confirmation dialog, **Then** the project and all its tasks are permanently deleted.
- **Given** I delete the currently active project, **When** deletion completes, **Then** I am switched to the next available project (or the default project).
- **Given** I only have one project, **When** I try to delete it, **Then** I see a warning "Cannot delete your only project."

---

### US-011: Default Project on First Login
**As** Alex, **I want** a default project created automatically when I sign up, **so that** I can start creating tasks immediately without setup friction.
**Priority**: Must
**Personas**: Alex

**Acceptance Criteria**:
- **Given** I have just registered and logged in for the first time, **When** the dashboard loads, **Then** a project named "My First Project" exists and is selected.
- **Given** the default project exists, **When** I view the Kanban board, **Then** I see an empty board with helpful placeholder text explaining how to create a task.

---

## Feature 3: Task Creation (FR-04)

### US-012: Open Task Creation Modal
**As** Alex, **I want** to open a task creation modal from the Kanban board, **so that** I can quickly describe a coding task for AI agents.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am on the Kanban board, **When** I click the "New Task" button, **Then** a modal opens with fields for Title, Description, Category, and Priority.
- **Given** the modal is open, **When** I press Escape or click outside the modal, **Then** the modal closes without saving.

---

### US-013: Fill Task Creation Form
**As** Sarah, **I want** to set category and priority on a task, **so that** I can organize and triage work effectively.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** the task modal is open, **When** I select a Category (Feature, Bug Fix, Refactoring, Performance, Security, UI/UX), **Then** the selected category is highlighted and stored.
- **Given** the task modal is open, **When** I select a Priority (Low, Medium, High, Critical), **Then** the selected priority is highlighted and stored.
- **Given** I am filling in the form, **When** I type in the Description textarea, **Then** the textarea auto-expands to fit content up to a reasonable max height.

---

### US-014: Form Validation
**As** Alex, **I want** clear validation errors when I miss required fields, **so that** I know exactly what to fix before submitting.
**Priority**: Must
**Personas**: Alex

**Acceptance Criteria**:
- **Given** I leave the Title field empty, **When** I click Create or Create & Start, **Then** I see an inline error "Title is required" below the Title field.
- **Given** I enter a title longer than 200 characters, **When** I try to submit, **Then** I see an inline error "Title must be 200 characters or fewer."
- **Given** all required fields are valid, **When** I click Create, **Then** no validation errors are shown and the task is created.

---

### US-015: Create Task and Start Pipeline
**As** Sarah, **I want** to create a task and immediately start the AI pipeline, **so that** I can get results faster without a separate step.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** I have filled out the task form with valid data, **When** I click "Create & Start", **Then** the task is created in the Backlog column and the AI pipeline begins immediately.
- **Given** the pipeline starts, **When** the task card appears on the board, **Then** it shows a live pulse dot and the phase indicator set to "Spec."
- **Given** I have no API key configured, **When** I click "Create & Start", **Then** I see a prompt to configure my API key and the pipeline does not start.

---

### US-016: Create Task Without Starting Pipeline
**As** Marcus, **I want** to create a task without starting the pipeline, **so that** I can queue up tasks and start them at my discretion.
**Priority**: Must
**Personas**: Marcus, Priya

**Acceptance Criteria**:
- **Given** I have filled out the task form, **When** I click "Create", **Then** the task is added to the Backlog column without triggering the pipeline.
- **Given** the task is created, **When** I view it on the Kanban board, **Then** it has no pulse dot and no active phase indicator.

---

## Feature 4: Kanban Board (FR-05)

### US-017: View Kanban Board
**As** Alex, **I want** to see all my tasks organized in columns, **so that** I can understand the status of all work at a glance.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am logged in and on the dashboard, **When** the page loads, **Then** I see 5 columns: Backlog, Spec, Building, Review, Done.
- **Given** tasks exist in the current project, **When** the board renders, **Then** each task card appears in its correct column based on its status.
- **Given** I am viewing the board, **When** I look at any column header, **Then** I see the column name and a count of tasks in that column.

---

### US-018: Drag Task Between Columns
**As** Marcus, **I want** to manually drag tasks between Kanban columns, **so that** I can override or adjust task status when needed.
**Priority**: Must
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** a task card exists in any column, **When** I drag it to a different column, **Then** the card animates smoothly into the new column and the task status is persisted.
- **Given** I am dragging a card, **When** I hover over a valid drop zone, **Then** a visual placeholder shows where the card will land.
- **Given** I drop a card, **When** the drop completes, **Then** the operation takes less than 100ms to reflect in the UI.

---

### US-019: Auto-Move on Pipeline Progress
**As** Alex, **I want** tasks to move between columns automatically as the AI pipeline progresses, **so that** the board always reflects the real-time pipeline state.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** the Planner agent starts processing, **When** the pipeline enters the "plan" phase, **Then** the task card animates from Backlog to the Spec column.
- **Given** the Coder agent starts processing, **When** the pipeline enters the "code" phase, **Then** the card animates from Spec to Building.
- **Given** the pipeline passes review, **When** the task enters human review, **Then** the card animates from Building to Review.

---

### US-020: Task Card Details Display
**As** Sarah, **I want** each task card to show key metadata at a glance, **so that** I can assess task state without opening the detail view.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** a task is in an active pipeline phase, **When** I view its card, **Then** I see a color-coded phase indicator (amber=plan, blue=code, purple=review, green=done).
- **Given** a task pipeline is running, **When** I view its card, **Then** I see a live animated pulse dot next to the phase indicator.
- **Given** a task has subtasks, **When** I view its card, **Then** I see a subtask count badge (e.g., "3/5 subtasks").
- **Given** any task on the board, **When** I view its card, **Then** I see the category badge and a relative timestamp (e.g., "2h ago").

---

### US-021: Click Card to Open Task Detail
**As** Alex, **I want** to click a task card to see full details, **so that** I can view the pipeline visualization, logs, and diff.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am on the Kanban board, **When** I click a task card, **Then** the Task Detail view opens showing pipeline visualization, logs, and (if applicable) diff panel.
- **Given** the Task Detail view is open, **When** I click the back button or press Escape, **Then** I return to the Kanban board with my scroll position preserved.

---

### US-022: Empty State
**As** Alex, **I want** to see a helpful empty state when no tasks exist, **so that** I know how to get started.
**Priority**: Should
**Personas**: Alex

**Acceptance Criteria**:
- **Given** the current project has no tasks, **When** the Kanban board loads, **Then** I see a centered empty state with an illustration and a "Create your first task" CTA button.
- **Given** the empty state is shown, **When** I click "Create your first task", **Then** the task creation modal opens.

---

### US-023: Filter and Search Tasks
**As** Sarah, **I want** to filter or search tasks on the Kanban board, **so that** I can find specific tasks quickly in a large project.
**Priority**: Should
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** I am on the Kanban board, **When** I type in the search bar, **Then** only task cards matching the query (title or description) are visible.
- **Given** I apply a category filter, **When** the filter is active, **Then** only tasks with the selected category are shown across all columns.
- **Given** I clear all filters, **When** the filters are reset, **Then** all tasks reappear in their respective columns.

---

### US-024: Loading Skeleton
**As** Priya, **I want** to see a loading skeleton while the board data loads, **so that** the page feels responsive even on slow connections.
**Priority**: Should
**Personas**: Priya, Alex

**Acceptance Criteria**:
- **Given** the Kanban board is loading, **When** the page first renders, **Then** I see skeleton placeholders for the 5 columns and card shapes.
- **Given** data has loaded, **When** the API response arrives, **Then** the skeleton is replaced by real content with a smooth fade transition.

---

## Feature 5: AI Pipeline (FR-06)

### US-025: Start Pipeline Manually
**As** Marcus, **I want** to start the AI pipeline on a backlog task, **so that** I can control when AI processing begins.
**Priority**: Must
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** a task is in the Backlog column with no active pipeline, **When** I click "Start Pipeline" from the task detail or card menu, **Then** the orchestrator begins with the Planner agent.
- **Given** a task already has an active pipeline, **When** I try to start the pipeline, **Then** the start button is disabled with tooltip "Pipeline already running."

---

### US-026: Planner Agent Generates Subtasks
**As** Alex, **I want** the Planner agent to break my task into subtasks, **so that** the Coder agent has clear, ordered steps to implement.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus

**Acceptance Criteria**:
- **Given** the pipeline has started, **When** the Planner agent completes, **Then** an ordered list of subtasks is generated and stored as structured JSON on the task.
- **Given** the Planner is running, **When** I view the Agent Log Panel, **Then** I see the Planner's streaming output in real-time under the Planner tab.
- **Given** the Planner finishes, **When** the subtasks are generated, **Then** the task card updates its subtask count (e.g., "0/4 subtasks").

---

### US-027: Coder Agent Generates File Changes
**As** Sarah, **I want** the Coder agent to produce file changes for each subtask, **so that** the code is generated automatically based on the plan.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** the Planner has completed subtasks, **When** the Coder agent processes each subtask, **Then** it produces file changes as JSON (file path + content) and the task moves to the Building column.
- **Given** the Coder is running, **When** I view the Agent Log Panel, **Then** I see the Coder's streaming output under the Coder tab in blue.
- **Given** the Coder completes a subtask, **When** the subtask is done, **Then** the subtask count on the card increments (e.g., "1/4" to "2/4").

---

### US-028: Reviewer Agent Validates Output
**As** Marcus, **I want** the Reviewer agent to validate generated code, **so that** obvious issues are caught before I review manually.
**Priority**: Must
**Personas**: Marcus, Priya

**Acceptance Criteria**:
- **Given** the Coder has completed all file changes, **When** the Reviewer agent runs, **Then** it evaluates the output and returns a pass/fail verdict with findings in JSON.
- **Given** the Reviewer is running, **When** I view the Agent Log Panel, **Then** I see the Reviewer's streaming output under the Reviewer tab in purple.

---

### US-029: Auto-Fix on Review Failure
**As** Sarah, **I want** the pipeline to auto-fix issues when the Reviewer rejects code, **so that** minor problems are resolved without my intervention.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** the Reviewer returns a "fail" verdict, **When** the iteration count is below 3, **Then** the orchestrator sends the review findings back to the Coder for auto-fix and increments the iteration counter.
- **Given** auto-fix is triggered, **When** I view the Agent Log Panel, **Then** I see a log entry "Review failed — auto-fixing (attempt 2/3)" and the Coder tab becomes active again.

---

### US-030: Pipeline Completes Successfully
**As** Alex, **I want** to be notified when the pipeline passes review, **so that** I can review the AI-generated code and approve it.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** the Reviewer returns a "pass" verdict, **When** the pipeline completes, **Then** the task moves to the Review column for human approval.
- **Given** the pipeline completes, **When** I view the board, **Then** a toast notification appears: "Task [title] ready for review."
- **Given** the pipeline completes, **When** I view the task card, **Then** the pulse dot stops and the phase indicator shows green.

---

### US-031: Pipeline Fails After Max Retries
**As** Priya, **I want** the pipeline to stop after 3 failed iterations, **so that** resources are not wasted on unsolvable tasks.
**Priority**: Must
**Personas**: Priya, Marcus

**Acceptance Criteria**:
- **Given** the Reviewer has failed the code 3 times, **When** the max iteration count is reached, **Then** the pipeline stops and the task is marked as "failed."
- **Given** the pipeline has failed, **When** I view the task card, **Then** I see a red error indicator and the failure reason is visible in the task detail.
- **Given** a task has failed, **When** I open the task detail, **Then** I see a "Retry Pipeline" button to restart from the Plan stage.

---

### US-032: Cancel Running Pipeline
**As** Sarah, **I want** to cancel a running pipeline, **so that** I can stop a task that I realize was poorly defined.
**Priority**: Should
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** a task has an active pipeline, **When** I click "Cancel Pipeline" in the task detail, **Then** the pipeline stops, the SSE connection closes, and the task returns to Backlog.
- **Given** I cancel a pipeline, **When** the cancellation completes, **Then** the task card pulse dot stops and a toast confirms "Pipeline cancelled."

---

## Feature 6: Pipeline Visualization (FR-07)

### US-033: View Pipeline Stages
**As** Alex, **I want** to see a horizontal pipeline flow in the task detail view, **so that** I understand where the task is in the AI process.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I open a task detail view, **When** the view renders, **Then** I see a horizontal pipeline with 5 nodes: Spec, Plan, Code, Review, Done connected by lines.
- **Given** the pipeline has not started, **When** I view the visualization, **Then** all nodes are dimmed/inactive.

---

### US-034: Current Stage Pulses
**As** Alex, **I want** the current pipeline stage to pulse with animation, **so that** I can instantly see what phase is active.
**Priority**: Must
**Personas**: Alex, Sarah

**Acceptance Criteria**:
- **Given** the pipeline is in the "Code" phase, **When** I view the pipeline visualization, **Then** the "Code" node has a pulsing animation and connecting lines to completed stages are highlighted.
- **Given** the pipeline moves to a new phase, **When** the phase transition occurs, **Then** the previous node stops pulsing and the new node begins pulsing with an animated transition.

---

### US-035: Phase Timing Display
**As** Marcus, **I want** to see how long each pipeline phase took, **so that** I can identify bottlenecks in the AI process.
**Priority**: Should
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** a pipeline phase has completed, **When** I view the pipeline visualization, **Then** I see the elapsed time below the completed node (e.g., "12s").
- **Given** a phase is currently active, **When** I view the visualization, **Then** I see a live timer counting up below the active node.

---

### US-036: Completed Stages Show Checkmark
**As** Alex, **I want** completed pipeline stages to show a checkmark icon, **so that** I can quickly see which phases are done.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus

**Acceptance Criteria**:
- **Given** a pipeline phase has completed successfully, **When** I view the pipeline visualization, **Then** the completed node shows a green checkmark icon replacing the default icon.
- **Given** a phase has failed, **When** I view the visualization, **Then** the failed node shows a red X icon indicating failure.

---

## Feature 7: Agent Log Panel (FR-08)

### US-037: Open and Collapse Log Panel
**As** Alex, **I want** to toggle the agent log panel open and closed, **so that** I can focus on the board when I don't need logs.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am on the dashboard, **When** I click the collapse/expand toggle on the bottom dock, **Then** the Agent Log Panel slides open or closed with a smooth animation.
- **Given** the panel is collapsed, **When** a pipeline is actively running, **Then** a subtle indicator (badge or dot) on the toggle shows that logs are streaming.

---

### US-038: Switch Agent Tabs
**As** Marcus, **I want** to switch between Planner, Coder, and Reviewer tabs, **so that** I can read each agent's output independently.
**Priority**: Must
**Personas**: Marcus, Sarah, Priya

**Acceptance Criteria**:
- **Given** the log panel is open, **When** I click a tab (Planner/Coder/Reviewer), **Then** the panel content switches to show that agent's log output.
- **Given** I am on the Coder tab, **When** the Reviewer agent starts producing output, **Then** the Reviewer tab shows a new-content indicator (dot or highlight).
- **Given** no pipeline has run, **When** I open the panel, **Then** I see a placeholder message "No logs yet — start a pipeline to see agent output."

---

### US-039: Streaming Text with Typing Effect
**As** Alex, **I want** agent output to stream in with a typing effect, **so that** the experience feels live and engaging.
**Priority**: Must
**Personas**: Alex, Sarah

**Acceptance Criteria**:
- **Given** an agent is producing output, **When** text chunks arrive via SSE, **Then** each chunk renders character-by-character (or chunk-by-chunk) with a typing animation.
- **Given** the typing effect is active, **When** text is being rendered, **Then** a blinking cursor appears at the end of the current line.

---

### US-040: Auto-Scroll Behavior
**As** Sarah, **I want** the log panel to auto-scroll to new content but let me scroll up to read history, **so that** I can follow live output or review past entries.
**Priority**: Should
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** new log entries arrive and I am scrolled to the bottom, **When** new text streams in, **Then** the panel auto-scrolls to keep the latest content visible.
- **Given** I have manually scrolled up, **When** new log entries arrive, **Then** auto-scroll is paused and a "Jump to latest" button appears.
- **Given** auto-scroll is paused, **When** I click "Jump to latest", **Then** the panel scrolls to the bottom and auto-scroll resumes.

---

### US-041: Timestamps and Color Coding
**As** Priya, **I want** log entries to have timestamps and color coding per agent, **so that** I can correlate events and distinguish which agent produced which output.
**Priority**: Should
**Personas**: Priya, Marcus

**Acceptance Criteria**:
- **Given** a log entry is rendered, **When** I view it, **Then** it has a timestamp prefix in a muted color (e.g., "[14:32:05]").
- **Given** the Planner is active, **When** its output renders, **Then** the text and tab accent color are amber.
- **Given** the Coder is active, **When** its output renders, **Then** the text and tab accent color are blue.
- **Given** the Reviewer is active, **When** its output renders, **Then** the text and tab accent color are purple.

---

## Feature 8: Diff Review (FR-09)

### US-042: View Diff Panel
**As** Marcus, **I want** a diff review panel to open when a task reaches the Review column, **so that** I can examine AI-generated code changes.
**Priority**: Must
**Personas**: Marcus, Sarah, Priya

**Acceptance Criteria**:
- **Given** a task has moved to the Review column, **When** I open the task detail, **Then** a side panel displays the diff review interface with all changed files.
- **Given** no file changes exist, **When** I view the diff panel, **Then** I see a message "No file changes to review."

---

### US-043: Navigate File Tree
**As** Sarah, **I want** a collapsible file tree of all changed files, **so that** I can navigate large changesets efficiently.
**Priority**: Must
**Personas**: Sarah, Marcus

**Acceptance Criteria**:
- **Given** the diff panel is open, **When** I view the file tree, **Then** I see all changed files organized by directory structure in a collapsible tree.
- **Given** the file tree is shown, **When** I click a file, **Then** the diff viewer scrolls to or displays that file's changes.
- **Given** a file in the tree, **When** I view it, **Then** I see an icon indicating the change type (added, modified, deleted).

---

### US-044: Side-by-Side Diff Display
**As** Marcus, **I want** to see code diffs in a side-by-side view with syntax highlighting, **so that** I can review changes precisely.
**Priority**: Must
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** I select a file in the diff panel, **When** the diff renders, **Then** I see a side-by-side view with the original on the left and the AI-generated code on the right.
- **Given** a diff is displayed, **When** I view it, **Then** additions are highlighted green, deletions red, and syntax is color-highlighted per language.
- **Given** a newly created file, **When** I view its diff, **Then** the left side is empty and the right side shows all content as additions.

---

### US-045: Approve Changes
**As** Marcus, **I want** to approve AI-generated changes, **so that** the task is marked as complete.
**Priority**: Must
**Personas**: Marcus, Sarah, Priya

**Acceptance Criteria**:
- **Given** I am reviewing diffs in the Review column, **When** I click "Approve", **Then** the task moves to the Done column with a success animation.
- **Given** I approve changes, **When** the task moves to Done, **Then** a toast notification confirms "Task [title] approved and completed."

---

### US-046: Request Changes
**As** Marcus, **I want** to request changes on AI-generated code, **so that** the Coder agent can address my feedback.
**Priority**: Must
**Personas**: Marcus, Sarah

**Acceptance Criteria**:
- **Given** I am reviewing diffs, **When** I click "Request Changes", **Then** a text input appears for me to describe what needs to change.
- **Given** I submit change feedback, **When** the request is sent, **Then** the pipeline restarts the Coder agent with my feedback, and the task moves back to Building.
- **Given** I request changes, **When** the Coder agent restarts, **Then** the iteration counter increments and the Agent Log Panel shows the new Coder output.

---

### US-047: Retry Entire Pipeline
**As** Priya, **I want** to retry the entire pipeline from scratch, **so that** I can get a fresh attempt when the code is fundamentally wrong.
**Priority**: Should
**Personas**: Priya, Marcus

**Acceptance Criteria**:
- **Given** I am reviewing diffs, **When** I click "Retry", **Then** the entire pipeline restarts from the Planner stage and the task moves back to Backlog.
- **Given** I click Retry, **When** a confirmation dialog appears and I confirm, **Then** previous file changes are discarded and the Planner generates a new plan.

---

## Feature 9: Error Handling (FR-10)

### US-048: API Failure Notification
**As** Priya, **I want** to be notified when the Anthropic API fails or rate-limits, **so that** I can decide how to proceed.
**Priority**: Must
**Personas**: Priya, Sarah, Marcus

**Acceptance Criteria**:
- **Given** the pipeline is running, **When** an Anthropic API call fails (network error, 429, 500), **Then** a toast notification appears with the error type and the pipeline pauses.
- **Given** an API error occurs, **When** I view the Agent Log Panel, **Then** the error is logged with a red highlight and timestamp.
- **Given** the pipeline is paused due to error, **When** I view the task card, **Then** a yellow warning indicator replaces the pulse dot.

---

### US-049: User Approves Retry
**As** Priya, **I want** to approve or dismiss a retry after an API failure, **so that** I maintain control over pipeline execution.
**Priority**: Must
**Personas**: Priya, Marcus

**Acceptance Criteria**:
- **Given** the pipeline is paused due to an API error, **When** I see the error notification, **Then** I have "Retry" and "Cancel" action buttons.
- **Given** I click "Retry", **When** the retry is initiated, **Then** the pipeline resumes from the failed step and the retry count is displayed (e.g., "Retry 1/3").

---

### US-050: Retry with Exponential Backoff
**As** Priya, **I want** retries to use exponential backoff, **so that** the system doesn't overwhelm the Anthropic API during outages.
**Priority**: Must
**Personas**: Priya

**Acceptance Criteria**:
- **Given** I approve a retry, **When** the retry executes, **Then** the system waits with exponential backoff (e.g., 2s, 4s, 8s) before making the API call.
- **Given** a retry is pending, **When** the backoff timer is counting down, **Then** I see a countdown indicator (e.g., "Retrying in 4s...") in the Agent Log Panel.

---

### US-051: Task Marked as Failed
**As** Marcus, **I want** a task to be clearly marked as failed after exhausting all retries, **so that** I know it needs manual intervention.
**Priority**: Must
**Personas**: Marcus, Priya, Sarah

**Acceptance Criteria**:
- **Given** all 3 retry attempts have failed, **When** the final retry is exhausted, **Then** the task is marked as "failed" with a red indicator on the card and a toast notification.
- **Given** a task is marked as failed, **When** I open the task detail, **Then** I see the error history (all attempts with timestamps and error messages) and a "Retry Pipeline" button.

---

## Feature 10: Settings & Profile

### US-052: View Settings Page
**As** Alex, **I want** to access a settings page from the sidebar, **so that** I can manage my profile and API key in one place.
**Priority**: Must
**Personas**: Alex, Sarah, Marcus, Priya

**Acceptance Criteria**:
- **Given** I am logged in, **When** I click the Settings icon in the sidebar, **Then** the Settings page opens showing my profile info and API key configuration sections.
- **Given** I am on the Settings page, **When** I view the API key section, **Then** I see a masked display of my current key (e.g., "sk-ant-...xxxx") or a prompt to add one if none is set.

---

### US-053: Update API Key
**As** Priya, **I want** to update or remove my Anthropic API key, **so that** I can rotate keys or switch accounts.
**Priority**: Must
**Personas**: Priya, Sarah, Marcus

**Acceptance Criteria**:
- **Given** I am on the Settings page, **When** I enter a new API key and click Save, **Then** the key is validated, encrypted, and stored, replacing the previous key.
- **Given** I want to remove my key, **When** I click "Remove Key" and confirm, **Then** the key is deleted from localStorage and pipelines are blocked until a new key is set.

---

### US-054: Update Profile
**As** Alex, **I want** to update my display name, **so that** the app feels personalized.
**Priority**: Could
**Personas**: Alex, Sarah

**Acceptance Criteria**:
- **Given** I am on the Settings page, **When** I edit my display name and click Save, **Then** the name updates in the database and the user menu in the header reflects the new name.
- **Given** I try to save an empty name, **When** I click Save, **Then** I see a validation error "Name cannot be empty."

---

## Traceability Matrix

| Feature | Stories | FR Coverage | Priority Spread |
|---------|---------|-------------|-----------------|
| Authentication & Onboarding | US-001 to US-006 | FR-01, FR-02 | 6 Must |
| Project Management | US-007 to US-011 | FR-03 | 3 Must, 2 Should |
| Task Creation | US-012 to US-016 | FR-04 | 5 Must |
| Kanban Board | US-017 to US-024 | FR-05 | 5 Must, 3 Should |
| AI Pipeline | US-025 to US-032 | FR-06 | 7 Must, 1 Should |
| Pipeline Visualization | US-033 to US-036 | FR-07 | 3 Must, 1 Should |
| Agent Log Panel | US-037 to US-041 | FR-08 | 3 Must, 2 Should |
| Diff Review | US-042 to US-047 | FR-09 | 5 Must, 1 Should |
| Error Handling | US-048 to US-051 | FR-10 | 4 Must |
| Settings & Profile | US-052 to US-054 | FR-01, FR-02 | 2 Must, 1 Could |

**Totals**: 54 stories — 43 Must / 10 Should / 1 Could

## Persona Coverage

| Persona | Stories Involved |
|---------|-----------------|
| Alex (P1) | US-001–006, 011–012, 014–015, 017, 019–022, 025–026, 030, 033–034, 036–039, 048, 052, 054 |
| Sarah (P2) | US-001–005, 007–010, 013, 015, 017–020, 023–025, 027, 029–030, 032, 034–035, 038–040, 042–047, 048, 051, 053–054 |
| Marcus (P3) | US-001–003, 005–010, 013, 016–019, 021, 025–026, 028–031, 035–036, 038, 040–049, 051, 053 |
| Priya (P4) | US-001–002, 005–007, 016–017, 019, 021, 024, 028, 031, 037, 041–042, 047–053 |
