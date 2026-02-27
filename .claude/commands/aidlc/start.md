---
description: Start an AI-DLC workflow for structured software development
argument-hint: [describe your intent]
---

# AI-DLC Workflow Start

**User Intent**: $ARGUMENTS

## Instructions

1. Read `.claude/skills/aidlc/SKILL.md` completely — it contains:
   - The full AI-DLC methodology and rules
   - **Parallel Execution Strategy** — how to use Agent Teams and parallel Task calls
   - **Agent-Skill Mapping** — which agents and skills to use at each phase
   - **E2E Testing Strategy** — how to run tests with Playwright
   - **Build & Test execution instructions** — how to ACTUALLY run tests

2. Follow the Initialization Sequence defined in the skill

3. At each phase, follow the Parallel Execution Strategy:
   - **Brainstorm**: Spawn parallel research subagents (multiple Task calls in one message)
   - **Spec (SDD)**: Run sequentially (each phase depends on previous)
   - **Design**: Spawn parallel domain research subagents
   - **Implement**: Use `TeamCreate` to create an agent team, spawn `fullstack-developer` teammates with separate file ownership, let them work concurrently
   - **Build & Test**: Launch parallel Task agents — one for unit tests, one for E2E tests, one for security review. ACTUALLY EXECUTE `npm test`, `playwright`, etc. Don't just generate documentation.
   - **Review**: Parallel code review subagents (security, quality, performance)
   - **Secure**: Parallel OWASP audit subagents
   - **Ship**: Sequential deployment steps

4. Follow the core workflow orchestration from `rule-details/core-workflow.md`

## Critical Rules

- **PARALLEL EXECUTION**: When tasks are independent, launch them simultaneously using multiple Task tool calls in a single message. Do NOT run independent agents one-by-one.
- **AGENT TEAMS for implementation**: When building multiple units, use TeamCreate + Task with team_name to spawn parallel fullstack-developer teammates. Each teammate owns separate files.
- **ACTUALLY RUN TESTS**: At Build & Test stage, execute real test commands via Bash tool or tester agents. Check for `package.json` test scripts, run them, parse results. Don't just create instruction markdown files.
- **E2E with Playwright**: Use `playwright-skill` to auto-detect dev servers, write test scripts, execute them, and save screenshots to `plans/e2e/`. Use `playwright-cli` for quick visual validation.
- **APPROVAL GATES**: Always wait for user approval before moving between major phases.
- All deliverables go in `aidlc-docs/` directory
- Progress is tracked in `aidlc-docs/aidlc-state.md`
- Audit trail is maintained in `aidlc-docs/audit.md`

## Parallel Execution Quick Reference

```
# Independent research (spawn all at once):
Task(researcher, "Research technology A")     ← parallel
Task(researcher, "Research technology B")     ← parallel
Task(scout, "Search codebase for patterns")  ← parallel

# Implementation team (concurrent teammates):
TeamCreate("aidlc-impl")
TaskCreate("Build auth module → owns src/auth/*")
TaskCreate("Build API routes → owns src/api/*")
TaskCreate("Build UI → owns src/components/*")
Task(fullstack-developer, team_name="aidlc-impl", "Claim and build task")  ← parallel
Task(fullstack-developer, team_name="aidlc-impl", "Claim and build task")  ← parallel
Task(fullstack-developer, team_name="aidlc-impl", "Claim and build task")  ← parallel

# Testing (all at once):
Task(tester, "Run: npm test --coverage")          ← parallel
Task(tester, "Run E2E with playwright-skill")      ← parallel
Task(code-review-guardian, "Security audit")        ← parallel
```
