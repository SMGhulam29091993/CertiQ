#!/usr/bin/env bash
# PostToolUse(Edit|MultiEdit|Write): typecheck after any TS edit. Turbo caches untouched packages,
# so this is fast. Exit 2 feeds the errors back to the agent immediately.
input=$(cat)
path=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.tool_input?.file_path??""))}catch{}})')

case "$path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! out=$(pnpm -s turbo run typecheck --output-logs=errors-only 2>&1); then
  echo "Typecheck failed after editing $path:" >&2
  printf '%s\n' "$out" | grep -E 'error TS|Error:' | head -20 >&2
  exit 2
fi
exit 0
