#!/usr/bin/env bash
# Stop: before the agent declares "done", unit tests and golden-case validation must pass.
# Then `pnpm -s eval:fast` (regression subset, 1 trial) — eval-harness.T05.
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

# eval-harness.T05: regression subset, 1 trial. Eval exit codes: 0 ok · 1 regression ·
# 2 setup missing (no DB/API key — skip, or every session without infra would be blocked) ·
# 3 harness errors (ground truth failed — block, a broken case must be noticed).
# Opt-in (CERTIQ_EVAL_ON_STOP=1): with a .env present this is a live, paid run against the API and
# DB on every stop, and a stopped DB would surface as exit 3 and block every session. Owner decides.
if [ "${CERTIQ_EVAL_ON_STOP:-0}" != "1" ]; then
  exit 0
fi
out=$(pnpm -s eval:fast 2>&1)
code=$?
if [ "$code" -eq 2 ]; then
  echo "Note: eval:fast skipped — eval setup missing (DB/API key)." >&2
elif [ "$code" -ne 0 ]; then
  echo "Not done: eval:fast failed (exit $code)." >&2
  printf '%s\n' "$out" | grep -E '✖|Regression|Harness|HARNESS|↳' | head -15 >&2
  exit 2
fi
exit 0
