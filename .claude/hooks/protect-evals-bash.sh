#!/usr/bin/env bash
# PreToolUse(Bash): close the shell side-door around protect-evals.sh.
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.tool_input?.command??""))}catch{}})')

if printf '%s' "$cmd" | grep -Eq 'eval:baseline|--write-baseline'; then
  echo "BLOCKED by protect-evals hook: re-recording the eval baseline is a human-only action." >&2
  exit 2
fi
if printf '%s' "$cmd" | grep -Eq 'packages/evals/(golden|baseline)' &&
   printf '%s' "$cmd" | grep -Eq '(>|sed +-i|\brm\b|\bmv\b|\bcp\b|\btee\b|\btruncate\b|git +checkout|git +restore)'; then
  echo "BLOCKED by protect-evals hook: shell writes to packages/evals/golden or baseline.json are not allowed." >&2
  exit 2
fi
exit 0
