#!/bin/bash
# Detect when code is lazily replaced with comments like "// ... rest of code"
# Triggered by: Edit, MultiEdit tools (PostToolUse)

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

# Check for lazy comment patterns in new_string
LAZY_PATTERNS=(
  "// \.\.\. rest"
  "// \.\.\. existing"
  "// \.\.\. remaining"
  "// \.\.\. other"
  "# \.\.\. rest"
  "# \.\.\. existing"
  "// TODO: implement"
  "// \.\.\. keep"
  "/\* \.\.\. \*/"
)

NEW_STRING=$(echo "$TOOL_INPUT" | grep -oP '"new_string"\s*:\s*"([^"]*)"' | head -1)

for pattern in "${LAZY_PATTERNS[@]}"; do
  if echo "$NEW_STRING" | grep -qiE "$pattern"; then
    echo "WARNING: Detected lazy comment replacement pattern: '$pattern'"
    echo "Do not replace code with placeholder comments. Include the actual code."
    exit 2
  fi
done

exit 0
