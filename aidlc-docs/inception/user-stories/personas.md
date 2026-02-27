# User Personas — AutoCoder

---

## Persona 1: Alex — Junior Developer

**Type**: New User
**Technical Level**: Junior

### Background

Alex is a recent computer science graduate working at a mid-size startup as a frontend developer. He has about one year of professional experience and is still building confidence with larger codebases. He has heard about AI-assisted coding from colleagues and wants to try AutoCoder to accelerate his learning and output.

### Goals

- Offload boilerplate and repetitive coding tasks to AI so he can focus on learning higher-level patterns
- Understand AI-generated code before merging it, using the diff review panel as a learning tool
- Build confidence by seeing how the Planner agent breaks down tasks he would struggle to decompose himself

### Frustrations

- Overwhelmed by complex project setups; needs clear onboarding and a simple task creation flow
- Distrusts fully autonomous pipelines because he cannot yet judge code quality at a glance
- Gets confused when AI agents produce errors or unexpected output without clear explanation of what went wrong

### Usage Patterns

- Creates 2-3 tasks per day via the task creation modal, writing detailed natural-language descriptions
- Spends significant time in the diff review panel, reading every file change before approving
- Checks the live agent log panel frequently to understand what each agent is doing step by step

### Key Stories

- US-TASK-CREATE (task creation with guided descriptions)
- US-DIFF-REVIEW (line-by-line diff review and approval)
- US-AGENT-LOG (live agent log readability and error explanations)
- US-ONBOARDING (first-time user walkthrough)

---

## Persona 2: Sarah — Senior Full-Stack Developer

**Type**: Power User
**Technical Level**: Senior

### Background

Sarah is a senior full-stack developer at a SaaS company with eight years of experience across React, Node.js, and Python services. She manages her own feature backlog and constantly looks for ways to ship faster. She adopted AutoCoder early and now runs dozens of tasks per week across three active projects.

### Goals

- Maximize throughput by running multiple AI pipelines in parallel across different projects
- Use keyboard shortcuts and bulk actions to manage the Kanban board without touching the mouse
- Fine-tune AI agent behavior by providing precise task descriptions and constraints so output needs minimal revision

### Frustrations

- Slow UI interactions or unnecessary confirmation dialogs that break her flow
- Limited ability to customize agent pipeline order or skip the Planner step for trivial tasks
- Context-switching overhead when jumping between projects; needs fast project switching

### Usage Patterns

- Creates 8-12 tasks per day, often in batches, and monitors pipelines from the Kanban board overview
- Relies heavily on the pipeline visualization to spot bottlenecks and re-trigger failed stages
- Quickly scans diffs rather than reading line-by-line; approves or rejects within seconds

### Key Stories

- US-KANBAN (drag-and-drop board, filtering, bulk status updates)
- US-PIPELINE-VIZ (pipeline stage visualization and retry controls)
- US-MULTI-PROJECT (project switching and cross-project task awareness)
- US-KEYBOARD (keyboard shortcuts for navigation and actions)
- US-TASK-BATCH (batch task creation)

---

## Persona 3: Marcus — Tech Lead

**Type**: Team Lead
**Technical Level**: Lead

### Background

Marcus leads a backend engineering team of six developers at a fintech company. He is responsible for code quality standards, architectural decisions, and sprint planning. He introduced AutoCoder to the team to handle routine tasks and wants visibility into what AI agents produce before anything reaches the main branch.

### Goals

- Review and approve AI-generated code across the team to enforce quality and security standards
- Organize projects and task backlogs so the team has a clear, prioritized queue of work
- Track aggregate metrics on AI pipeline success rates, revision counts, and time saved

### Frustrations

- No role-based access control; he wants to restrict who can approve AI-generated diffs to senior members
- Lack of audit trail showing which agent made which decision and why
- Difficulty enforcing coding conventions across AI output without manually reviewing every diff

### Usage Patterns

- Spends most time in the diff review panel and Kanban board, reviewing others' tasks rather than creating his own
- Creates 1-2 tasks per day himself, mostly architectural scaffolding or refactoring tasks
- Checks the live agent log panel when a pipeline produces suspicious output to trace the root cause

### Key Stories

- US-DIFF-REVIEW (code review with approval/rejection and inline comments)
- US-KANBAN (board-level project overview and task prioritization)
- US-AGENT-LOG (detailed agent decision audit trail)
- US-PROJECT-MGMT (project creation, member management, settings)
- US-AUTH (email/password login and team member access)

---

## Persona 4: Priya — DevOps Engineer

**Type**: Specialized User
**Technical Level**: Senior

### Background

Priya is a DevOps engineer at a cloud-native consultancy. She works across Terraform, CI/CD pipelines, Docker, and Kubernetes configurations daily. She uses AutoCoder specifically for infrastructure-as-code tasks, automation scripts, and configuration generation rather than traditional application code.

### Goals

- Generate and validate infrastructure code (Terraform modules, Dockerfiles, CI configs) through the AI pipeline
- Monitor pipeline execution closely because infrastructure mistakes are costly and hard to roll back
- Get clear, actionable error messages when the Reviewer agent flags issues in generated IaC

### Frustrations

- AI agents sometimes lack context about infrastructure constraints (cloud provider limits, state dependencies) and produce invalid configs
- The pipeline visualization does not surface enough detail about why the Reviewer agent rejected a change
- No way to attach environment-specific context or variables to a task so agents can generate environment-aware code

### Usage Patterns

- Creates 3-5 tasks per day, each with highly specific descriptions including cloud provider, region, and resource constraints
- Watches the live agent log panel in real time via SSE streaming during every pipeline run
- Uses the diff review panel to validate generated configs against mental models of existing infrastructure

### Key Stories

- US-TASK-CREATE (task creation with structured context and constraints)
- US-PIPELINE-VIZ (granular stage status, error details, and retry)
- US-AGENT-LOG (real-time SSE streaming and filterable log output)
- US-DIFF-REVIEW (config-aware diff review for non-application code)
- US-ERROR-HANDLING (clear error reporting and recovery guidance)
