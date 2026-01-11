#!/bin/bash
# Pre-commit Runner Hook - Run pre-commit hooks on staged files before git commit
# Requires: pip install pre-commit
#
# Settings: {
#   "hooks": {
#     "PreToolUse": [
#       {
#         "matcher": "Bash",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash .claude/hooks/precommit_run.sh",
#             "statusMessage": "Running pre-commit"
#           }
#         ]
#       }
#     ]
#   }
# }

# Read tool input from environment
if echo "$CLAUDE_TOOL_INPUT" | grep -q 'git commit'; then
    staged_files=$(git diff --cached --name-only 2>/dev/null)
    if [ -n "$staged_files" ]; then
        pre-commit run --files $staged_files 2>/dev/null || true
    fi
fi
