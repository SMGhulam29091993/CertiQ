#!/usr/bin/env bash
# Stop: before the agent declares "done", unit tests and golden-case validation must pass.
# Once eval-harness.T05 ships, add `pnpm -s eval:fast` here (regression subset, 1 trial).
input=$(cat)
if printf '%s' "$input" | grep -q '"stop_hook_active": *true'; then
  exit 0 # already continuing because of this hook — don't loop
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! out=$(pnpm -s turbo run test --output-logs=errors-only 2>&1); then
  echo "Not done: unit tests are failing." >&2
  printf '%s\n' "$out" | grep -E '✗|×|FAIL|AssertionError|Error' | head -15 >&2
  exit 2
fi
if ! out=$(pnpm -s eval:validate 2>&1); then
  echo "Not done: golden cases failed validation." >&2
  printf '%s\n' "$out" | tail -10 >&2
  exit 2
fi
exit 0
