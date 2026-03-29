#!/bin/bash
# Install git hooks from scripts/ into .git/hooks/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$(git rev-parse --show-toplevel)/.git/hooks"

ln -sf "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
echo "Git hooks installed."
