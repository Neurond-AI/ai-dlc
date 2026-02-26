#!/bin/bash
# File guard hook - blocks access to sensitive files
# Triggered by: Read, Edit, MultiEdit, Write, Bash tools

TOOL_INPUT="$CLAUDE_TOOL_INPUT"

# Extract file path from tool input
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]*)"' | head -1 | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/')

if [ -z "$FILE_PATH" ]; then
  # Try to extract from command for Bash tool
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"command"\s*:\s*"([^"]*)"' | head -1 | sed 's/.*"command"\s*:\s*"\([^"]*\)".*/\1/')
fi

# Define blocked patterns
BLOCKED_PATTERNS=(
  "\.env$"
  "\.env\."
  "credentials"
  "\.pem$"
  "\.key$"
  "\.p12$"
  "\.pfx$"
  "secrets"
  "\.aws/"
  "\.ssh/"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$FILE_PATH" | grep -qiE "$pattern"; then
    echo "BLOCKED: Access to sensitive file matching pattern '$pattern' is not allowed."
    echo "File: $FILE_PATH"
    exit 2
  fi
done

exit 0
