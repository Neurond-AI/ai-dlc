---
description: Start an AI-DLC workflow for structured software development
argument-hint: [describe your intent]
---

# AI-DLC Workflow Start

Load and activate the AIDLC skill from `.claude/skills/aidlc/SKILL.md`.

**User Intent**: $ARGUMENTS

## Instructions

1. Read `.claude/skills/aidlc/SKILL.md` completely
2. Follow the Initialization Sequence defined in the skill
3. Use the Agent-Skill Mapping to delegate to appropriate agents at each phase
4. Load relevant skills for each agent as defined in the mapping
5. Follow the core workflow orchestration from `rule-details/core-workflow.md`

## Important

- This workflow uses **approval gates** - always wait for user approval before proceeding
- Each phase delegates to **specialized agents** with **domain-specific skills**
- All deliverables go in `aidlc-docs/` directory
- Progress is tracked in `aidlc-docs/aidlc-state.md`
- Audit trail is maintained in `aidlc-docs/audit.md`
