# AutoCoder — Requirements Document

## Intent Analysis

- **User Request**: Build "AutoCoder" — a web app where users describe a coding task and AI agents autonomously plan, code, and validate it
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: System-wide — full web application with 6 MVP features, AI agent orchestration, real-time streaming, and persistent data
- **Complexity Estimate**: Complex — multi-agent AI pipeline, real-time SSE streaming, drag-and-drop Kanban, diff viewer, authentication, multi-project support

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (full-stack) |
| UI Library | React 19 |
| State Management | Zustand 5 |
| Styling | Tailwind CSS v4 |
| Component Library | shadcn/ui |
| Animation | Framer Motion |
| AI SDK | Anthropic TypeScript SDK |
| Drag & Drop | dnd-kit |
| Icons | Lucide React |
| ORM | Prisma |
| Database | PostgreSQL (Docker locally) |
| Auth | Basic auth (email + password) |

---

## Functional Requirements

### FR-01: User Authentication
- Basic email + password authentication (sign up / log in / log out)
- Passwords hashed with bcrypt (adaptive hashing)
- Session management with secure httpOnly cookies
- Protected routes — all app pages require authentication
- Settings page for user profile and API key management

### FR-02: API Key Management
- Users enter their own Anthropic API key via Settings page
- API key stored encrypted in browser localStorage
- Key validated against Anthropic API before saving
- Key accessible to server-side pipeline via secure API route
- Clear indication when no API key is set (blocking pipeline start)

### FR-03: Multi-Project Support
- Users can create, rename, and delete projects
- Project switcher in the sidebar
- Each project has its own set of tasks and Kanban board
- Default project created on first login

### FR-04: Task Creation Modal
- Fields: Title (required), Description (textarea), Category selector, Priority selector
- Categories: Feature, Bug Fix, Refactoring, Performance, Security, UI/UX
- Priority levels: Low, Medium, High, Critical
- "Create & Start" button — creates task in Backlog and immediately kicks off the AI pipeline
- "Create" button — creates task in Backlog without starting pipeline
- Form validation with inline error messages

### FR-05: Kanban Board (Main View)
- 5 columns: Backlog, Spec, Building, Review, Done
- Drag-and-drop between columns via dnd-kit
- Task cards display:
  - Title
  - Animated phase indicator (color-coded: amber=plan, blue=code, purple=QA, green=done)
  - Live pulse dot (when pipeline is active)
  - Category badge
  - Subtask count (completed/total)
  - Timestamp (created or last updated)
- Cards auto-animate between columns as pipeline progresses
- Click card to open Task Detail view

### FR-06: Autonomous Task Pipeline
- 3 AI agents via Anthropic TypeScript SDK:
  - **Planner Agent**: Takes task description → produces ordered subtask list (JSON schema)
  - **Coder Agent**: Takes subtask → produces file changes (path + content as JSON)
  - **Reviewer Agent**: Validates Coder output → returns pass/fail + findings (JSON)
- **Orchestrator Loop**:
  1. Plan → Code → Review
  2. If review fails → auto-fix → re-review (max 3 iterations)
  3. On pass → task moves to Review column for human approval
  4. On max retries exhausted → task marked as failed with error details
- Each agent call streams output via SSE to the Live Agent Log Panel
- Pipeline state tracked per task (current phase, iteration count, timestamps)

### FR-07: Pipeline Visualization
- Horizontal flow at top of Task Detail view
- 5 nodes: Spec → Plan → Code → Review → Done
- Each node lights up as pipeline progresses to that stage
- Animated connecting lines between nodes
- Current stage pulses with animation
- Time spent per phase displayed below each node
- Completed stages show checkmark

### FR-08: Live Agent Log Panel
- Bottom dock panel (collapsible, resizable)
- Tabbed interface: Planner / Coder / Reviewer tabs
- Streaming text with typing effect (character-by-character or chunk)
- Color-coded per agent (amber=Planner, blue=Coder, purple=Reviewer)
- Timestamps on each log entry
- Auto-scroll to bottom (with manual scroll override)
- Styled log viewer — NOT a real PTY
- SSE-powered real-time streaming from server

### FR-09: Diff Review Panel
- Side panel opens when task reaches Review column
- Side-by-side diff view with syntax highlighting
- File tree of all changed files (collapsible)
- Per-file diff navigation
- Action buttons:
  - "Approve" → card moves to Done with success animation
  - "Request Changes" → sends feedback back to Coder agent for another iteration
  - "Retry" → reruns the entire pipeline from Plan stage
- Virtual diffs: AI returns file path + content as JSON, rendered as diffs (no actual filesystem writes)

### FR-10: Error Handling for Pipeline
- When Anthropic API fails or rate-limits:
  1. Notify user with error details in the Agent Log Panel
  2. Pause pipeline and wait for user approval to retry
  3. On approval: retry with exponential backoff (max 3 retries)
  4. On exhausted retries: mark task as failed
- Clear error state indicators on task cards
- Ability to manually retry failed tasks

---

## Non-Functional Requirements

### NFR-01: Performance
- Initial page load < 3 seconds
- SSE log streaming latency < 500ms from server event to UI render
- Kanban drag-and-drop operations < 100ms response time
- Pipeline state updates reflected in UI within 1 second

### NFR-02: Security
- All SECURITY extension rules enforced (SECURITY-01 through SECURITY-15)
- API keys encrypted at rest (localStorage + server-side)
- Passwords hashed with bcrypt (min 10 rounds)
- CSRF protection on all state-changing endpoints
- Input validation on all API parameters (Zod schemas)
- HTTP security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Rate limiting on authentication endpoints

### NFR-03: Usability
- Responsive design — functional on desktop, tablet, and mobile
- Light theme with clean, dense layout (Linear meets Vercel aesthetic)
- Keyboard navigation support
- Loading states and skeleton screens for async operations
- Toast notifications for success/error states

### NFR-04: Reliability
- Graceful degradation when Anthropic API is unavailable
- Pipeline state recovery after page refresh (persisted in PostgreSQL)
- Database connection pooling via Prisma
- Global error handler with safe user-facing error messages

### NFR-05: Maintainability
- File-based routing (Next.js App Router conventions)
- Zustand stores organized by domain (task store, project store, auth store, pipeline store)
- Shared UI components via shadcn/ui
- Type-safe API with Zod validation schemas
- Prisma schema as single source of truth for data models

---

## Layout & UI Structure

```
+--------------------------------------------------+
| [Logo] AutoCoder          [Project Switcher] [User]|
+--------+-----------------------------------------+
| Sidebar| Main Content Area                        |
|        |                                          |
| [K]    | Kanban Board / Task Detail View          |
| Kanban |                                          |
|        |                                          |
| [S]    |                                          |
| Settngs|                                          |
|        |                                          |
|        |                                          |
| Project|                                          |
| Name   |                                          |
+--------+-----------------------------------------+
| Agent Log Panel (collapsible bottom dock)         |
| [Planner] [Coder] [Reviewer]    [^] collapse      |
| > Planning task: "Add auth"...                    |
+--------------------------------------------------+
```

- **Left Sidebar**: Icon navigation (Kanban, Settings) + project name
- **Main Area**: Active view (Kanban board or Task Detail)
- **Bottom Dock**: Agent log panel (collapsible)
- **Theme**: Light, clean, dense — Linear meets Vercel aesthetic

---

## Data Model Overview

### User
- id, email, passwordHash, name, createdAt, updatedAt

### Project
- id, name, userId (owner), createdAt, updatedAt

### Task
- id, title, description, category, priority, status (backlog/spec/building/review/done)
- projectId, pipelineState (JSON), subtasks (JSON), createdAt, updatedAt

### PipelineRun
- id, taskId, phase (plan/code/review), iteration, status (running/passed/failed)
- agentLogs (JSON), fileChanges (JSON), reviewFindings (JSON)
- startedAt, completedAt

---

## Deployment

- **Primary**: Local development (npm run dev + Docker PostgreSQL)
- **Future**: Docker container and/or Vercel deployment (prepare configuration)
- Docker Compose for local dev: PostgreSQL + app
- Environment variables via `.env` file
