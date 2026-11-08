#!/usr/bin/env bash
# PreToolUse(Edit|MultiEdit|Write): agents may never edit golden cases or the baseline.
# Exit 2 blocks the tool call and shows stderr to the agent.
input=$(cat)
path=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.tool_input?.file_path??""))}catch{}})')

case "$path" in
  *packages/evals/golden/*|*packages/evals/baseline.json)
    echo "BLOCKED by protect-evals hook: '$path' is a protected eval file." >&2
    echo "Golden cases and the baseline change only by a human (constitution.md › Testing Discipline)." >&2
    echo "If an eval fails, fix the code or the prompt — not the test. If you believe the case is wrong, say so and stop." >&2
    exit 2
    ;;
esac
exit 0
