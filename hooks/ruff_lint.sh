#!/bin/bash
# Ruff Linter Hook - Lint and auto-fix Python files with Ruff
# Requires: pip install ruff
#
# Settings: {
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "Edit|Write|Update|NotebookEdit|Delete",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash .claude/hooks/ruff_lint.sh",
#             "statusMessage": "Linting with Ruff"
#           }
#         ]
#       }
#     ]
#   }
# }

ruff check --fix --quiet $CLAUDE_FILE_PATHS 2>/dev/null || true
