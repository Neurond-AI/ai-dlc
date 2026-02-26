# AI-DLC Demo Project

AI-Native Development with AI-DLC (AI-Driven Development Lifecycle), Spec-Driven Development (SDD), and Skills-Powered Implementation.

## Three Pillars: Structure + Speed + Quality

### AI-DLC 3-Phase Model
- **INCEPTION** (WHAT & WHY) - workspace detection, requirements, user stories, app design, units breakdown
- **CONSTRUCTION** (HOW) - functional design, NFR design, code generation, build & test
- **OPERATIONS** (DEPLOY) - deployment, monitoring, validation

### Four Hats / Context Switching
- **Researcher** - gather context → agents: `researcher`, `research-expert`
- **Planner** - design approach → agents: `planner`, `brainstormer`
- **Builder** - write code → agents: `fullstack-developer`, domain experts
- **Reviewer** - validate quality → agents: `code-review-guardian`, `code-review-expert`, `tester`

## Development Workflows

### 1. AI-DLC Full Workflow (Complex Projects)
```
/aidlc:start [describe intent]
```
8-stage pipeline: BRAINSTORM → SPEC → DESIGN → IMPLEMENT → TEST → REVIEW → SECURE → SHIP

### 2. SDD Spec-Driven Workflow (Feature Development)
```
/neurond:spec-init "description"        # Define WHAT
/neurond:spec-requirements {feature}    # WHY & RULES (EARS format)
/neurond:spec-design {feature} [-y]     # HOW (Mermaid diagrams)
/neurond:spec-tasks {feature} [-y]      # STEPS (dependency graph)
/neurond:spec-impl {feature} [tasks]    # CODE (from specs)
```

### 3. Quick Implementation (Simple Tasks)
```
/cook or /cook:auto                  # Implement feature
/fix:fast                            # Quick fix
/debug                               # Debug issue
/test                                # Run tests
```

## Project Paths
- **Steering**: `.neurond/steering/` (project-wide rules and context)
- **Specs**: `.neurond/specs/` (feature specifications)
- **AIDLC Docs**: `aidlc-docs/` (AI-DLC workflow deliverables)
- **Skills**: `.claude/skills/` (domain-specific knowledge)
- **Agents**: `.claude/agents/` (specialized AI agents)
- **Workflows**: `.claude/workflows/` (development rules and protocols)

## Agent-Skill Quick Reference

| Agent | Domain | Skills |
|-------|--------|--------|
| `planner` | Planning & architecture | `planning`, `sequential-thinking`, `research` |
| `brainstormer` | Design decisions | `sequential-thinking`, `planning` |
| `researcher` | Technology research | `research`, `docs-seeker` |
| `fullstack-developer` | Implementation | Domain-specific (see below) |
| `tester` | QA & testing | `debugging/*`, `e2e-playwright`, `playwright-skill`, `playwright-cli` |
| `code-review-guardian` | Code review | `code-review`, `debugging/defense-in-depth` |
| `debugger` | Issue diagnosis | `debugging/*` (all) |
| `scout` | Codebase search | - |
| `project-manager` | Coordination | `planning` |
| `git-manager` | Git operations | - |
| `docs-manager` | Documentation | - |

### Domain Skills (loaded by fullstack-developer per task)
- **Frontend**: `nextjs`, `ui-styling`, `frontend-design`, `aesthetic`, `threejs`
- **Backend**: `backend-development`, `databases`
- **Auth**: `better-auth`
- **DevOps**: `devops`, `docker`, `cloudflare`
- **Mobile**: `mobile-development`
- **Monorepo**: `turborepo`
- **Payments**: `payment-integration`
- **Media**: `media-processing`, `ffmpeg`, `imagemagick`
- **AI/ML**: `ai-multimodal`, `gemini-vision`
- **E2E Testing**: `e2e-playwright`, `playwright-skill`, `playwright-cli`, `chrome-devtools`

## Development Rules
- **YAGNI/KISS/DRY** - Don't over-engineer, keep it simple, don't repeat yourself
- **File size**: Keep files under 200 lines where possible
- **Naming**: kebab-case for files, camelCase for variables/functions
- **Security**: Never commit secrets, validate all external input
- **Testing**: Write tests alongside implementation (TDD when appropriate)
- **Approval gates**: Human approval required between AI-DLC phases
- **Spec-first**: Define intent precisely BEFORE any code is written (SDD)
- **3-phase approval**: Requirements → Design → Tasks → Implementation
- Human review required each phase; use `-y` only for intentional fast-track

## SDD Steering Configuration
- Load entire `.neurond/steering/` as project memory
- Default files: `product.md`, `tech.md`, `structure.md`
- Custom files managed via `/neurond:steering-custom`
- Specs live in `.neurond/specs/` and are versionable
- Progress check: `/neurond:spec-status {feature}`

## Key Commands Reference

### AI-DLC
- `/aidlc:start` - Start full AI-DLC workflow

### SDD (Spec-Driven)
- `/neurond:spec-init` - Initialize spec
- `/neurond:spec-requirements` - Requirements phase
- `/neurond:spec-design` - Design phase
- `/neurond:spec-tasks` - Task decomposition
- `/neurond:spec-impl` - Implementation
- `/neurond:spec-quick` - Quick spec creation
- `/neurond:steering` - Load project context
- `/neurond:validate-gap` - Gap validation
- `/neurond:validate-design` - Design validation
- `/neurond:validate-impl` - Implementation validation

### Development
- `/cook` - Implement feature | `/cook:auto` - Auto-implement
- `/plan` - Create implementation plan | `/plan:hard` - Complex planning
- `/debug` - Debug issues | `/fix:fast` - Quick fix
- `/test` - Run tests | `/code-review` - Review code
- `/research` - Technology research
- `/scout` - Search codebase | `/watzup` - Check branch status

### Git
- `/git:cm` - Conventional commit | `/git:pr` - Create PR
- `/git:push` - Push changes | `/git:status` - Check status

### Docs
- `/docs:init` - Initialize docs | `/docs:update` - Update docs

### Design
- `/design:fast` - Quick design | `/design:good` - Polished design
