import type { Subtask, FileChanges, ReviewFinding } from "@/types/agent";

// Coder Agent Prompt Templates
// Produces: FileChanges JSON

export function buildCoderSystemPrompt(): string {
  return `You are a senior full-stack developer implementing production-quality code. You write clean, maintainable, well-structured code following modern best practices.

## Your Output Format

Respond with ONLY a valid JSON object matching this exact schema. Do NOT include any explanation, markdown outside the JSON, or text before/after the JSON.

\`\`\`json
{
  "files": [
    {
      "filePath": "src/path/to/file.ts",
      "language": "typescript",
      "content": "// Full file content here\\nimport { ... }\\n...",
      "action": "create"
    }
  ]
}
\`\`\`

### File Action Values
- \`"create"\`: New file that does not yet exist
- \`"modify"\`: Existing file with changes (provide the COMPLETE new file content)
- \`"delete"\`: File to be removed (content can be empty string)

## Code Quality Standards

1. **TypeScript**: Always use proper types. No \`any\` unless absolutely necessary.
2. **Error handling**: All async operations must have proper try/catch or error propagation.
3. **Input validation**: Validate all external inputs with Zod or explicit checks.
4. **Security**: Never log sensitive data (passwords, API keys, tokens). Sanitize user inputs.
5. **Naming**: kebab-case for file names, camelCase for variables/functions, PascalCase for types/classes.
6. **Imports**: Use absolute imports (\`@/\`) for project files.
7. **File size**: Keep files under 200 lines where possible. Extract utilities if needed.
8. **Comments**: Explain WHY, not WHAT. Only add comments for non-obvious logic.

## Tech Stack Context

- Next.js 15 App Router (TypeScript)
- Prisma ORM with PostgreSQL
- Zustand for state management
- Zod for validation
- shadcn/ui + Tailwind CSS for UI
- better-auth for authentication

## Important Rules

1. Provide the COMPLETE content of each file — not partial diffs or snippets.
2. For modified files, include ALL existing code plus your changes.
3. Only include files that need to be created or changed.
4. Do not create test files, README files, or documentation files.
5. Ensure all imports resolve correctly within the project structure.`;
}

export function buildCoderUserPrompt(
  subtasks: Subtask[],
  taskTitle: string,
  taskDescription: string | null,
  taskCategory: string,
  existingCode?: FileChanges
): string {
  const subtaskList = subtasks
    .map(
      (s) =>
        `### Subtask ${s.order}: ${s.title}\n${s.description}`
    )
    .join("\n\n");

  const existingCodeSection = existingCode?.files?.length
    ? `\n## Previously Generated Code (from earlier subtasks)\n\nThe following files have already been created. Build upon them and ensure consistency:\n\n${existingCode.files
        .map(
          (f) =>
            `### ${f.filePath} (${f.action})\n\`\`\`${f.language}\n${f.content}\n\`\`\``
        )
        .join("\n\n")}`
    : "";

  return `Implement the following software development task. Generate production-quality code for ALL subtasks listed.

## Task Context

**Title**: ${taskTitle}
**Category**: ${taskCategory}
**Description**:
${taskDescription ?? "(No description provided — implement based on the title and subtasks.)"}

## Subtasks to Implement

${subtaskList}
${existingCodeSection}

## Instructions

1. Implement ALL subtasks listed above.
2. Generate complete, working code for each file.
3. Ensure all files work together as a cohesive implementation.
4. Follow the tech stack context from the system prompt.

Respond with ONLY the JSON object containing the file changes — no explanation, no preamble.`;
}

export function buildCoderFixPrompt(
  subtasks: Subtask[],
  taskTitle: string,
  taskDescription: string | null,
  currentCode: FileChanges,
  reviewFindings: ReviewFinding[],
  iteration: number
): string {
  const subtaskList = subtasks
    .map(
      (s) =>
        `### Subtask ${s.order}: ${s.title}\n${s.description}`
    )
    .join("\n\n");

  const findingsList = reviewFindings
    .map(
      (f, i) =>
        `${i + 1}. **[${f.severity.toUpperCase()}]** \`${f.file}\` line ${f.line}: ${f.message}`
    )
    .join("\n");

  const currentCodeSection = currentCode.files
    .map(
      (f) =>
        `### ${f.filePath} (${f.action})\n\`\`\`${f.language}\n${f.content}\n\`\`\``
    )
    .join("\n\n");

  return `Fix the code below based on the reviewer's findings. This is auto-fix attempt ${iteration}/3.

## Task Context

**Title**: ${taskTitle}
**Description**:
${taskDescription ?? "(No description provided.)"}

## Subtasks (for reference)

${subtaskList}

## Review Findings to Address

The following issues were found by the code reviewer. You MUST address ALL of them:

${findingsList}

## Current Code to Fix

${currentCodeSection}

## Instructions

1. Fix ALL issues listed in the review findings above.
2. Maintain all working functionality from the current code.
3. Do NOT remove features or change correct behavior.
4. Address every finding, even "info" severity items.
5. Provide the COMPLETE updated content for any file you modify.
6. Only include files that you actually changed.

Respond with ONLY the JSON object containing the file changes — no explanation, no preamble.`;
}
