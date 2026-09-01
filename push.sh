#!/bin/bash
# push.sh — one-command push of openroutai to GitHub.
# Reads the full PAT from ~/.hermes/bsac.env (OPENROUT_GITHUB_TOKEN) and pushes the
# full local git history to main. Avoids chat-truncation entirely.
#
# Usage:
#   chmod +x push.sh && ./push.sh
set -euo pipefail

# 1. Load the credential from bsac.env (no shell truncation: full value read from file)
if [[ ! -f ~/.hermes/bsac.env ]]; then
  echo "FATAL: ~/.hermes/bsac.env not found" >&2; exit 2
fi
# shellcheck disable=SC1090
source . ~/.hermes/bsac.env

if [[ -z "${OPENROUT_GITHUB_TOKEN:-}" ]]; then
  echo "FATAL: OPENROUT_GITHUB_TOKEN is not set in ~/.hermes/bsac.env"
  echo "Add this line (paste token via your text editor, not chat):"
  echo "    OPENROUT_GITHUB_TOKEN=*** full token here  full token here, no truncation>>>"
  exit 3
fi
TOKEN="${OPENROUT_GITHUB_TOKEN}"

# 2. Sanity-check token length (GitHub PATs are 82+ chars)
TOKEN_LEN=${#TOKEN}
echo "Token length on disk: $TOKEN_LEN"
if (( TOKEN_LEN < 70 )); then
  echo "FATAL: token is $TOKEN_LEN chars, expected 80+. Likely truncated." >&2
  exit 4
fi

# 3. Test the token can read the repo (must be 200, not 401)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -u "x-access-token:${TOKEN}" \
  "https://api.github.com/repos/nxscrypto/openroutai")
echo "GET /repos/nxscrypto/openroutai → HTTP $HTTP"
if [[ "$HTTP" != "200" ]]; then
  echo "FATAL: token rejected by GitHub (HTTP $HTTP). Check it's a fine-grained PAT"
  echo "with Contents: Read and write on nxscrypto/openroutai." >&2
  exit 5
fi

# 4. Configure remote and push
cd "$(dirname "$0")"
git remote set-url origin "https://x-access-token:${TOKEN}@github.com/nxscrypto/openroutai.git"

echo "Pushing $(git rev-list --count HEAD) commits to main..."
git push origin HEAD:main 2>&1 | tail -20

echo ""
echo "Done. Check https://github.com/nxscrypto/openroutai/commits/main"
echo "Then watch the Railway service for the auto-deploy."