---
name: aidlc
description: Start an AI-DLC (AI-Driven Development Lifecycle) workflow for structured software development. Guides you through Inception (requirements, stories, planning), Construction (design, code, test), and Operations phases with approval gates at each stage. Use this skill when starting any new project, feature, or structured development workflow.
argument-hint: [describe your intent]
disable-model-invocation: true
---

# AI-DLC Workflow Skill

You are now executing the AI-DLC (AI-Driven Development Lifecycle) workflow. This is a structured, adaptive software development methodology that guides development through three major phases: Inception, Construction, and Operations.

## Your Role

You are the **team lead** orchestrating an AI development team. You MUST:
1. Read and follow the rules defined in the supporting rule-detail files
2. Ask clarifying questions directly in conversation (chat-based Q&A)
3. Create deliverables in the `aidlc-docs/` directory
4. Track progress in `aidlc-docs/aidlc-state.md`
5. Wait for user approval at designated approval gates
6. Maintain an audit trail in `aidlc-docs/audit.md`
7. **Spawn parallel agent teams for concurrent work** using `TeamCreate` + `Task` tools
8. **Actually execute tests** (not just generate instruction files) at the Build & Test stage

## Parallel Execution Strategy (Agent Teams)

**CRITICAL**: Claude Code supports agent teams for parallel work. You MUST use them for independent tasks instead of running everything sequentially.

### How to Execute in Parallel

**For independent research/exploration** (no file conflicts):
```
Use multiple Task tool calls in a SINGLE message to spawn parallel subagents:
- Task 1: researcher agent exploring technology A
- Task 2: researcher agent exploring technology B
- Task 3: scout agent searching codebase
All three run concurrently and return results.
```

**For implementation with file ownership** (parallel coding):
```
1. Use TeamCreate to create a team (e.g., "aidlc-impl")
2. Use TaskCreate to create tasks with clear file ownership boundaries
3. Spawn teammates via Task tool with team_name parameter
4. Each teammate owns specific files/directories - NO overlapping edits
5. Teammates work in parallel, communicate via SendMessage
6. Use TaskUpdate to track completion, then assign next tasks
```

**For testing** (parallel test execution):
```
Spawn multiple Task agents concurrently:
- Task 1: tester agent running unit tests
- Task 2: tester agent running E2E tests with playwright-skill
- Task 3: code-review-guardian running security audit
All run in parallel, results collected when done.
```

### When to Use Parallel vs Sequential

| Phase | Execution | Why |
|-------|-----------|-----|
| Brainstorm | Parallel subagents | Independent research angles |
| Spec (SDD) | Sequential | Each phase depends on previous |
| Design | Parallel subagents | Independent domain research |
| Implement | **Agent Team** (parallel teammates) | Each unit has separate files |
| Build & Test | **Parallel subagents** | Unit tests + E2E + review run concurrently |
| Review | Parallel subagents | Security, quality, performance reviews are independent |
| Secure | Parallel subagents | OWASP checks across different domains |
| Ship | Sequential | Deployment steps depend on each other |

### Parallel Implementation Pattern

During the IMPLEMENT stage, when multiple units need to be built:

```
Step 1: TeamCreate with team name "aidlc-construction"
Step 2: TaskCreate for each unit with clear file boundaries:
  - Task: "Build auth module" → owns src/auth/*, tests/auth/*
  - Task: "Build API routes" → owns src/api/*, tests/api/*
  - Task: "Build UI components" → owns src/components/*, tests/components/*
Step 3: Spawn fullstack-developer teammates, one per unit
Step 4: Each teammate claims a task, works independently
Step 5: When all complete, proceed to Build & Test
```

### Parallel Testing Pattern

During BUILD & TEST, launch ALL test types concurrently:

```
Launch in a SINGLE message (parallel Task calls):
- Task(tester): "Run unit tests: npm test -- --coverage"
- Task(tester): "Run E2E tests using playwright-skill and playwright-cli"
- Task(code-review-guardian): "Security audit focusing on OWASP Top 10"
Collect all results, generate combined test summary.
```

## Rule Detail Files

The full AI-DLC methodology is documented in supporting files that you MUST read on demand:

### Core Orchestration
- **[rule-details/core-workflow.md](rule-details/core-workflow.md)** - Main workflow orchestration logic (READ THIS FIRST)

### Common Rules (read at workflow start)
- **[rule-details/common/welcome-message.md](rule-details/common/welcome-message.md)** - Welcome message to display
- **[rule-details/common/process-overview.md](rule-details/common/process-overview.md)** - High-level process overview
- **[rule-details/common/session-continuity.md](rule-details/common/session-continuity.md)** - Session resumption logic
- **[rule-details/common/question-format-guide.md](rule-details/common/question-format-guide.md)** - How to ask questions (chat-based)
- **[rule-details/common/content-validation.md](rule-details/common/content-validation.md)** - Content quality standards
- **[rule-details/common/terminology.md](rule-details/common/terminology.md)** - AI-DLC terminology
- **[rule-details/common/depth-levels.md](rule-details/common/depth-levels.md)** - Content depth guidance
- **[rule-details/common/ascii-diagram-standards.md](rule-details/common/ascii-diagram-standards.md)** - Diagram formatting
- **[rule-details/common/error-handling.md](rule-details/common/error-handling.md)** - Error handling approach
- **[rule-details/common/overconfidence-prevention.md](rule-details/common/overconfidence-prevention.md)** - Avoiding overconfidence
- **[rule-details/common/workflow-changes.md](rule-details/common/workflow-changes.md)** - Handling workflow deviations

### Inception Phase Rules (read when entering inception stages)
- **[rule-details/inception/workspace-detection.md](rule-details/inception/workspace-detection.md)** - Detect greenfield vs brownfield
- **[rule-details/inception/reverse-engineering.md](rule-details/inception/reverse-engineering.md)** - Analyze existing codebases
- **[rule-details/inception/requirements-analysis.md](rule-details/inception/requirements-analysis.md)** - Requirements gathering
- **[rule-details/inception/user-stories.md](rule-details/inception/user-stories.md)** - User story generation
- **[rule-details/inception/workflow-planning.md](rule-details/inception/workflow-planning.md)** - Plan workflow stages
- **[rule-details/inception/application-design.md](rule-details/inception/application-design.md)** - Application architecture
- **[rule-details/inception/units-generation.md](rule-details/inception/units-generation.md)** - Break down into units of work

### Construction Phase Rules (read when entering construction stages)
- **[rule-details/construction/functional-design.md](rule-details/construction/functional-design.md)** - Functional specifications
- **[rule-details/construction/nfr-requirements.md](rule-details/construction/nfr-requirements.md)** - Non-functional requirements
- **[rule-details/construction/nfr-design.md](rule-details/construction/nfr-design.md)** - Non-functional design
- **[rule-details/construction/infrastructure-design.md](rule-details/construction/infrastructure-design.md)** - Infrastructure specs
- **[rule-details/construction/code-generation.md](rule-details/construction/code-generation.md)** - Code implementation
- **[rule-details/construction/build-and-test.md](rule-details/construction/build-and-test.md)** - Testing instructions

### Operations Phase Rules (read when entering operations)
- **[rule-details/operations/operations.md](rule-details/operations/operations.md)** - Operations phase guidance

---

## Agent-Skill Mapping: Which Agent Uses Which Skills

This section defines which specialized agents should be delegated to at each AI-DLC phase, and which skills each agent should load for optimal performance.

### Phase 1: INCEPTION (WHAT & WHY)

#### Brainstorm Stage
- **Primary Agent**: `brainstormer` - Architectural decisions, technical brainstorming
- **Skills to Load**: `sequential-thinking`, `planning`, `research`
- **Support Agent**: `researcher` - Technology research and synthesis
- **Skills to Load**: `research`, `docs-seeker`, `sequential-thinking`

#### Spec Stage (SDD Integration)
- **Primary Agent**: `planner` - Research, analysis, implementation planning
- **Skills to Load**: `planning`, `sequential-thinking`, `research`
- **SDD Commands**: `/neurond:spec-init`, `/neurond:spec-requirements`, `/neurond:spec-design`, `/neurond:spec-tasks`
- **SDD Agents**: `neurond/steering`, `neurond/spec-requirements`, `neurond/spec-design`, `neurond/spec-tasks`

#### Design Stage
- **Primary Agent**: `brainstormer` - System architecture design
- **Skills to Load**: `planning`, `sequential-thinking`
- **Domain Agents** (as needed):
  - `database/database-expert` + skill: `databases`
  - `infrastructure/infrastructure-docker-expert` + skill: `docker`, `devops`
  - `framework/framework-nextjs-expert` + skill: `nextjs`

### Phase 2: CONSTRUCTION (HOW)

#### Implement Stage
- **Primary Agent**: `fullstack-developer` - Phase-based implementation execution
- **Skills to Load** (per task domain):
  - Frontend: `nextjs`, `ui-styling`, `frontend-design`, `aesthetic`
  - Backend: `backend-development`, `databases`
  - Auth: `better-auth`
  - DevOps: `devops`, `docker`, `cloudflare`
  - Mobile: `mobile-development`
  - Monorepo: `turborepo`
  - Payments: `payment-integration`
  - 3D/Visual: `threejs`, `canvas-design`
  - Media: `media-processing`, `ffmpeg`, `imagemagick`
  - AI/ML: `ai-multimodal`, `gemini-vision`
- **Support Agents**:
  - `react/react-expert` + skill: `nextjs`, `ui-styling`
  - `typescript/typescript-expert` (for type safety)
  - `nodejs/nodejs-expert` + skill: `backend-development`
  - `frontend/frontend-css-styling-expert` + skill: `ui-styling`, `aesthetic`
  - `database/database-postgres-expert` + skill: `databases`

#### Test Stage (MUST ACTUALLY EXECUTE TESTS)
- **Primary Agent**: `tester` - Testing, coverage analysis, QA
- **Skills to Load**: `debugging/systematic-debugging`, `debugging/verification-before-completion`
- **E2E Agent**: `e2e/e2e-playwright-expert`
- **E2E Skills** (load ALL for comprehensive browser testing):
  - `e2e-playwright` - Test generation from specs, cross-browser testing, TDD E2E
  - `playwright-skill` - Custom browser automation scripts, dev server detection, advanced testing
  - `playwright-cli` - Interactive browser sessions, snapshots, form testing, visual debugging
  - `chrome-devtools` - DevTools-based debugging, performance profiling, network analysis
- **Testing Agent**: `testing/testing-expert`
- **Screenshot & Snapshot Storage**: All E2E test artifacts saved to `plans/e2e/[timestamp]-[test-topic]/`

**CRITICAL - Test Execution Instructions**:
The Build & Test stage MUST actually run tests, not just generate instruction files. Follow this concrete execution pattern:

```
Step 1: Detect project's test runner and dev server
  - Check package.json for test scripts (vitest, jest, mocha, pytest, etc.)
  - Check for existing test files (*.test.ts, *.spec.ts, *_test.go, etc.)
  - Detect dev server command (npm run dev, pnpm dev, etc.)

Step 2: Run unit tests (via Bash tool)
  - Execute: npm test / pnpm test / vitest run / jest --coverage
  - Capture output, parse pass/fail counts and coverage %
  - If tests fail, fix them before proceeding

Step 3: Run E2E tests IN PARALLEL with unit tests (via parallel Task calls)
  - Spawn tester agent: "Start the dev server, then run E2E tests using
    playwright-skill (auto-detect server, write test to /tmp, execute).
    Save screenshots to plans/e2e/[timestamp]/screenshots/.
    Generate report at plans/e2e/[timestamp]/report.md."
  - The tester agent should:
    a. Use playwright-skill to detect dev servers
    b. Write E2E test scripts based on spec-defined user flows
    c. Execute via playwright-skill's run.js
    d. Take screenshots at each step
    e. Save all artifacts to plans/e2e/

Step 4: Collect results and generate combined summary
  - Unit test results (pass/fail/coverage)
  - E2E test results (pass/fail/screenshots)
  - Security findings (if running review in parallel)
  - Write combined summary to aidlc-docs/construction/build-and-test/
```

**Parallel Test Execution** (spawn ALL in one message):
```
Task 1 (tester): "Run unit tests: [detected test command] --coverage"
Task 2 (tester): "Run E2E tests using playwright-skill, save to plans/e2e/"
Task 3 (code-review-guardian): "Security review of implemented code"
```

#### Review Stage
- **Primary Agent**: `code-review-guardian` - Code review for implemented features
- **Skills to Load**: `code-review`, `debugging/defense-in-depth`
- **Deep Review**: `code-review-expert` - Deep review across 6 focus areas
- **Support**: `code-quality/code-quality-linting-expert`

#### Secure Stage (OWASP Audit)
- **Primary Agent**: `code-review-expert` + `tester`
- **Skills to Load**: `backend-development` (OWASP section), `debugging/defense-in-depth`
- **Focus**: OWASP Top 10, input validation, auth review, SQL injection, XSS

### Phase 3: OPERATIONS (DEPLOY)

#### Ship Stage
- **Primary Agent**: `devops/devops-expert`
- **Skills to Load**: `devops`, `docker`, `cloudflare`
- **Support**: `infrastructure/infrastructure-docker-expert`

### Cross-Cutting Agents (Available at Any Phase)

| Agent | When to Use | Skills |
|-------|-------------|--------|
| `scout` / `codebase-scout` | File search, codebase exploration | - |
| `debugger` | Issue diagnosis, performance debugging | `debugging/*` (all) |
| `researcher` | Technology research | `research`, `docs-seeker` |
| `project-manager` | Progress tracking, coordination | `planning` |
| `docs-manager` | Documentation management | - |
| `git-manager` | Git operations, commits, PRs | - |
| `triage-expert` | Initial problem diagnosis | `sequential-thinking` |
| `oracle` | Second opinions, deep analysis | `sequential-thinking` |

### Four Hats / Context Switching

| Hat | Agent(s) | Skills |
|-----|----------|--------|
| **Researcher** | `researcher`, `research-expert` | `research`, `docs-seeker`, `sequential-thinking` |
| **Planner** | `planner`, `brainstormer` | `planning`, `sequential-thinking`, `research` |
| **Builder** | `fullstack-developer`, domain experts | Domain-specific skills (see Implement Stage) |
| **Reviewer** | `code-review-guardian`, `code-review-expert`, `tester` | `code-review`, `debugging/*` |

---

## E2E Testing Strategy: Playwright-Powered

The AI-DLC TEST stage uses three complementary Playwright skills for comprehensive end-to-end testing. All test artifacts are stored persistently for review and audit.

### Three Playwright Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `e2e-playwright` | Structured test suites from specs | Generate test files from SDD specs, cross-browser matrix testing, Page Object Model |
| `playwright-skill` | Custom browser automation | Complex interactions, dev server auto-detection, responsive testing, custom scripts |
| `playwright-cli` | Interactive browser sessions | Quick visual checks, form filling, snapshots, live debugging, tracing |

### E2E Workflow (Spec → Test → Screenshot → Report)

1. **Generate tests from specs**: SDD spec tasks define user flows → `e2e-playwright` converts to test suites
2. **Auto-detect dev servers**: `playwright-skill` detects running servers before test execution
3. **Execute with screenshots**: All tests capture screenshots at key checkpoints
4. **Store artifacts**: Screenshots, snapshots, traces saved to `plans/e2e/` (see below)
5. **Generate report**: Summary report with pass/fail, screenshots, and visual diffs

### Screenshot & Artifact Storage

Similar to how `codebase-scout` saves reports to `plans/scouts/`, E2E tests save artifacts to:

```
plans/e2e/
├── [YYYY-MM-DD-HHmmss]-[test-topic]/
│   ├── report.md                    # Test summary report
│   ├── screenshots/
│   │   ├── desktop-home.png         # Full page screenshots
│   │   ├── tablet-home.png          # Responsive variants
│   │   ├── mobile-home.png
│   │   ├── login-before.png         # Flow step screenshots
│   │   ├── login-after.png
│   │   └── error-state.png          # Error/edge case captures
│   ├── snapshots/
│   │   ├── page-*.yaml              # Playwright CLI snapshots (DOM state)
│   │   └── accessibility-*.yaml     # Accessibility tree snapshots
│   ├── traces/
│   │   └── trace.zip                # Playwright trace files
│   └── videos/
│       └── test-run.webm            # Video recordings of test runs
```

### Report Format (plans/e2e/[timestamp]-[topic]/report.md)

```markdown
# E2E Test Report: [Test Topic]
Generated: [ISO timestamp]
Dev Server: [detected URL]
Browser: [Chromium/Firefox/WebKit]

## Test Results

### Passed (X/Y)
- [x] User can login with valid credentials
  - Screenshot: screenshots/login-success.png
- [x] Dashboard loads after authentication
  - Screenshot: screenshots/dashboard-loaded.png

### Failed (Z/Y)
- [ ] Form validation shows error messages
  - Screenshot: screenshots/form-error-missing.png
  - Error: Expected element [data-testid="error-message"] to be visible

## Responsive Testing
| Viewport | Status | Screenshot |
|----------|--------|------------|
| Desktop (1920x1080) | Pass | screenshots/desktop-home.png |
| Tablet (768x1024) | Pass | screenshots/tablet-home.png |
| Mobile (375x667) | Fail | screenshots/mobile-home.png |

## Recommendations
- [Actionable findings from test results]
```

### Playwright CLI for Quick Visual Validation

During any AI-DLC phase, use `playwright-cli` for quick visual checks:

```bash
# Quick visual check of current implementation
playwright-cli open http://localhost:3000
playwright-cli snapshot --filename=plans/e2e/quick-check.yaml
playwright-cli screenshot --filename=plans/e2e/quick-check.png
playwright-cli close
```

### TDD + E2E Integration (Red-Green-Refactor)

1. **Red**: Write failing E2E test from spec (using `e2e-playwright` skill)
2. **Green**: Implement feature until test passes (using `fullstack-developer` agent)
3. **Refactor**: Clean up, then re-run E2E to confirm no regressions
4. **Screenshot**: Capture final state for the report

---

## SDD Integration (Spec-Driven Development)

The AI-DLC workflow integrates with SDD via `/neurond:*` commands for the Spec stage:

### SDD Five-Phase Workflow
1. **`/neurond:spec-init`** - Define WHAT to build (maps to INCEPTION)
2. **`/neurond:spec-requirements`** - Generate EARS-format requirements (WHY & RULES)
3. **`/neurond:spec-design`** - Produce architecture with Mermaid diagrams (HOW)
4. **`/neurond:spec-tasks`** - Break into small, testable tasks with dependency graph (STEPS)
5. **`/neurond:spec-impl`** - Generate code from specs (CODE, maps to CONSTRUCTION)

### SDD Validation Commands
- **`/neurond:validate-gap`** - Quality validation (brownfield)
- **`/neurond:validate-design`** - Design validation (brownfield)
- **`/neurond:validate-impl`** - Implementation validation

### SDD Project Memory
- **`/neurond:steering`** - Load project context and patterns
- **`/neurond:steering-custom`** - Create custom steering documents

---

## Initialization Sequence

Follow these steps in order:

### 1. Display Welcome Message
Read and display the content from `rule-details/common/welcome-message.md`.

### 2. Check for Session Resumption
Check if `aidlc-docs/aidlc-state.md` exists:
- **If it exists**: Read `rule-details/common/session-continuity.md` and follow its instructions
- **If it does NOT exist**: This is a new workflow - proceed to step 3

### 3. Ask User Preference for Question Style
Before loading the full workflow rules, ask the user how they prefer to answer questions.

### 4. Load Core Rules
Read the following files:
1. `rule-details/core-workflow.md` - The main orchestration logic (CRITICAL)
2. `rule-details/common/process-overview.md` - High-level overview
3. `rule-details/common/question-format-guide.md` - Question formatting
4. `rule-details/common/content-validation.md` - Quality standards
5. `rule-details/common/terminology.md` - Key terms

### 5. Initialize Workspace
Create the `aidlc-docs/` directory if it doesn't exist. Store user preferences.

### 6. Begin Inception Phase
Read `rule-details/inception/workspace-detection.md` and execute Workspace Detection.

### 7. Follow Core Workflow
From this point forward, follow the orchestration logic in `rule-details/core-workflow.md`. At each stage, **load the relevant skills** and **delegate to the appropriate agents** as defined in the Agent-Skill Mapping above.

## Key Principles

1. **Chat-Based Q&A**: Always ask questions directly in conversation
2. **Approval Gates**: Wait for explicit user approval before proceeding
3. **Progress Tracking**: Update `aidlc-docs/aidlc-state.md` at every stage transition
4. **Audit Trail**: Log all major decisions in `aidlc-docs/audit.md` with timestamps
5. **Read Before Execute**: Always read the relevant rule-detail file before executing
6. **Quality Standards**: Follow content validation rules for all deliverables
7. **Skill-Powered**: Load relevant skills for each agent at each phase
8. **Agent Delegation**: Use specialized agents (see Agent-Skill Mapping) rather than generic responses
9. **Parallel by Default**: Use parallel Task calls or Agent Teams for independent work. NEVER run independent tasks sequentially when they can run concurrently.
10. **Execute, Don't Just Document**: At Build & Test stage, ACTUALLY RUN the test commands (npm test, playwright, etc.) — don't just generate instruction files. Tests must execute and produce real pass/fail results.

## Deliverables Directory Structure

```
aidlc-docs/
├── aidlc-state.md              # Progress tracking (checkboxes)
├── aidlc-preferences.md        # User Q&A style preferences
├── audit.md                    # Audit trail with timestamps
├── inception/
│   ├── plans/
│   ├── reverse-engineering/    # Brownfield only
│   ├── requirements/
│   ├── user-stories/
│   └── application-design/
├── construction/
│   ├── plans/
│   ├── {unit-name}/
│   │   ├── functional-design/
│   │   ├── nfr-requirements/
│   │   ├── nfr-design/
│   │   ├── infrastructure-design/
│   │   └── code/
│   └── build-and-test/
└── operations/

plans/
├── scouts/                     # Codebase scout reports
│   └── [timestamp]-[topic].md
└── e2e/                        # E2E test artifacts
    └── [timestamp]-[topic]/
        ├── report.md           # Test summary report
        ├── screenshots/        # Page screenshots (desktop, tablet, mobile)
        ├── snapshots/          # Playwright CLI DOM snapshots (.yaml)
        ├── traces/             # Playwright trace files (.zip)
        └── videos/             # Test run recordings (.webm)
```

## Session Continuity

If this session ends and is resumed later:
- The user can run `/aidlc:start` again without arguments
- You will detect `aidlc-docs/aidlc-state.md` and resume from the last checkpoint
- Follow the session resumption logic in `rule-details/common/session-continuity.md`

---

**NOW BEGIN**: Start by reading and displaying `rule-details/common/welcome-message.md`, then proceed with the initialization sequence above.
