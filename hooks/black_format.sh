#!/bin/bash
# Black Formatter Hook - Auto-format Python files with Black
# Requires: pip install black
#
# Settings: {
#   "hooks": {
#     "PostToolUse": [
#       {
#         "matcher": "Edit|Write|Update|NotebookEdit|Delete",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "bash .claude/hooks/black_format.sh",
#             "statusMessage": "Formatting with Black"
#           }
#         ]
#       }
#     ]
#   }
# }

black --quiet --line-length 100 $CLAUDE_FILE_PATHS 2>/dev/null || true
