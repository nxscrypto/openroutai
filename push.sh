#!/bin/bash
# push.sh — push openroutai via raw GitHub git-data API using the saved token.
# Reads OPENROUT_GITHUB_TOKEN from .env at repo root. No git protocol used.
set -euo pipefail
cd "$(dirname "$0")"

# Load token (no shell interpolation in argument position; sourced from file)
if [[ ! -f .env ]]; then
  echo "FATAL: .env not found in $(pwd)" >&2
  exit 2
fi
# shellcheck disable=SC1090
set -a; . ./.env; set +a

: "${OPENROUT_GITHUB_TOKEN:?FATAL: OPENROUT_GITHUB_TOKEN not set in .env}"

TOK="$OPENROUT_GITHUB_TOKEN"
echo "Token length on disk: ${#TOK}"
if (( ${#TOK} < 70 )); then
  echo "FATAL: token is ${#TOK} chars, expected 80+. Likely truncated in transit." >&2
  echo "Re-save .env by writing the token to a file via TextEdit (NOT pasting into chat)." >&2
  exit 3
fi

REPO='nxscrypto/openroutai'
EMPTY_TREE='4b825dc642cb6eb9a060e54bf8d69288fbee4900'

# The token is read straight from the .env file at runtime — no shell token arg
API="https://api.github.com"
A() { curl -s --max-time 20 -H "Authorization: token $TOK" -H "Accept: application/vnd.github+json" -H "User-Agent: openrout-pusher/1.0" "$@"; }
AC() { curl -s -X POST --max-time 20 -H "Authorization: token $TOK" -H "Accept: application/vnd.github+json" -H "User-Agent: openrout-pusher/1.0" "$@"; }

echo "=== sanity check the token ==="
A "$API/repos/$REPO" -o /tmp/_r.json -w "" && {
  HTTP=$(curl -s -o /tmp/_r.json -w "%{http_code}" --max-time 10 -H "Authorization: token $TOK" "$API/repos/$REPO")
  echo "GET /repos: HTTP $HTTP"
  if [[ "$HTTP" != "200" ]]; then
    echo "FATAL: token rejected (HTTP $HTTP). It is not authorized for this repo, or it is invalid." >&2
    cat /tmp/_r.json; echo
    exit 4
  fi
}

echo "=== get main HEAD ==="
MAIN_SHA=$(curl -s --max-time 10 -H "Authorization: token $TOK" "$API/repos/$REPO/git/refs/heads/main" | python3 -c "import sys,json;print(json.load(sys.stdin)['object']['sha'])")
echo "main: $MAIN_SHA"

# 1. create blobs for each file
echo "=== creating blobs ==="
declare -A SHAS
for f in package.json package-lock.json tsconfig.json next.config.js next-env.d.ts postcss.config.js tailwind.config.js Procfile railway.toml README.md .gitignore app/layout.tsx app/page.tsx app/globals.css app/favicon.svg app/dashboard/page.tsx components/HeroCanvas.tsx; do
  if [[ ! -f "$f" ]]; then echo "skip missing: $f"; continue; fi
  content=$(cat "$f")
  # JSON-encode content safely using python (handles all escaping)
  body=$(python3 -c "import json,sys; print(json.dumps({'content':open(sys.argv[1]).read(),'encoding':'utf-8'}))" "$f")
  resp=$(curl -s -X POST --max-time 20 -H "Authorization: token $TOK" -H "Content-Type: application/json" -d "$body" "$API/repos/$REPO/git/blobs")
  sha=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('sha',''))" 2>/dev/null)
  if [[ -z "$sha" ]]; then echo "  FAIL $f: $resp"; exit 5; fi
  SHAS["$f"]="$sha"
  printf "  ok %-40s %s\n" "$f" "${sha:0:8}"
done

# 2. build tree
echo "=== building tree ==="
TREE_JSON=$(python3 -c "
import json
shas = json.load(open('/tmp/shas.json')) if False else {}
import os
shas = $(printf '%s\n' "${SHAS[@]@K}" | python3 -c '...')
" 2>/dev/null || true)

# Build tree JSON via Python
python3 - <<'PYEOF' > /tmp/tree.json
import json, os
files = [
  'package.json','package-lock.json','tsconfig.json','next.config.js',
  'next-env.d.ts','postcss.config.js','tailwind.config.js','Procfile',
  'railway.toml','README.md','.gitignore','app/layout.tsx','app/page.tsx',
  'app/globals.css','app/favicon.svg','app/dashboard/page.tsx',
  'components/HeroCanvas.tsx',
]
tree = []
for f in files:
    sha = os.environ.get('SHA_'+f.replace('/','_').replace('.','_').replace('-','_'))
    if sha:
        tree.append({'path': f, 'mode': '100644', 'type': 'blob', 'sha': sha})
print(json.dumps({'base_tree': '4b825dc642cb6eb9a060e54bf8d69288fbee4900', 'tree': tree}))
PYEOF

# That heredoc approach won't pass env vars cleanly. Simpler: write the JSON inline.
python3 -c "
import json, os
files = ['package.json','package-lock.json','tsconfig.json','next.config.js','next-env.d.ts','postcss.config.js','tailwind.config.js','Procfile','railway.toml','README.md','.gitignore','app/layout.tsx','app/page.tsx','app/globals.css','app/favicon.svg','app/dashboard/page.tsx','components/HeroCanvas.tsx']
shas = {f: os.environ['SHA_'+f.replace('/','_').replace('.','_').replace('-','_')] for f in files if 'SHA_'+f.replace('/','_').replace('.','_').replace('-','_') in os.environ}
tree = [{'path': f, 'mode': '100644', 'type': 'blob', 'sha': s} for f, s in shas.items()]
print(json.dumps({'base_tree': '$EMPTY_TREE', 'tree': tree}))
" > /tmp/tree.json

# re-export SHAS to env so python sees them
for f in "${!SHAS[@]}"; do
  export "SHA_$(echo "$f" | tr '/.-' '___')=${SHAS[$f]}"
done
python3 -c "
import json, os
files = ['package.json','package-lock.json','tsconfig.json','next.config.js','next-env.d.ts','postcss.config.js','tailwind.config.js','Procfile','railway.toml','README.md','.gitignore','app/layout.tsx','app/page.tsx','app/globals.css','app/favicon.svg','app/dashboard/page.tsx','components/HeroCanvas.tsx']
shas = {f: os.environ['SHA_'+f.replace('/','_').replace('.','_').replace('-','_')] for f in files if 'SHA_'+f.replace('/','_').replace('.','_').replace('-','_') in os.environ}
tree = [{'path': f, 'mode': '100644', 'type': 'blob', 'sha': s} for f, s in shas.items()]
print(json.dumps({'base_tree': '$EMPTY_TREE', 'tree': tree}))
" > /tmp/tree.json

TREE_RESP=$(curl -s -X POST --max-time 20 -H "Authorization: token $TOK" -H "Content-Type: application/json" -d @/tmp/tree.json "$API/repos/$REPO/git/trees")
NEW_TREE=$(echo "$TREE_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('sha',''))" 2>/dev/null)
echo "new tree: $NEW_TREE"
if [[ -z "$NEW_TREE" ]]; then echo "TREE FAIL: $TREE_RESP"; exit 6; fi

# 3. commit
echo "=== creating commit ==="
COMMIT_BODY=$(python3 -c "import json; print(json.dumps({'message': 'openroutai: initial deploy\n\nNext.js 14 + Tailwind landing page from designer prototype.\nAdds package.json + railway.toml so Railway Railpack can build.', 'tree': '$NEW_TREE', 'parents': ['$MAIN_SHA']}))")
COMMIT_RESP=$(curl -s -X POST --max-time 20 -H "Authorization: token $TOK" -H "Content-Type: application/json" -d "$COMMIT_BODY" "$API/repos/$REPO/git/commits")
NEW_COMMIT=$(echo "$COMMIT_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('sha',''))" 2>/dev/null)
echo "new commit: $NEW_COMMIT"
if [[ -z "$NEW_COMMIT" ]]; then echo "COMMIT FAIL: $COMMIT_RESP"; exit 7; fi

# 4. update main ref
echo "=== updating main ref ==="
REF_BODY=$(python3 -c "import json; print(json.dumps({'sha': '$NEW_COMMIT'}))")
REF_RESP=$(curl -s -X PATCH --max-time 20 -H "Authorization: token $TOK" -H "Content-Type: application/json" -d "$REF_BODY" "$API/repos/$REPO/git/refs/heads/main")
echo "$REF_RESP" | head -3

echo ""
echo "✅ PUSHED. Check:"
echo "   https://github.com/$REPO/commits/main"
echo "   Railway will auto-deploy openroutai.com within ~2 minutes."
