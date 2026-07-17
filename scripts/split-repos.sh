#!/usr/bin/env bash
#
# Split this co-located repo into the two repos the PRD describes:
#   • puzzleforge-engine  — private core library (generators, engine, layouts, …)
#   • puzzleforge-web     — public MIT teacher/publisher app
#
# Both get a CLEAN initial commit (no maze-books history), as sibling folders of
# the current checkout. This script only prepares the local folders — creating
# the GitHub repos and archiving maze-books are manual steps printed at the end
# (see docs/REPO-SPLIT.md).
#
# Usage:   bash scripts/split-repos.sh [OUTPUT_PARENT_DIR]
#          (defaults to the parent of this repo)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$(dirname "$REPO_ROOT")}"
ENGINE_DIR="$OUT/puzzleforge-engine"
WEB_DIR="$OUT/puzzleforge-web"

cd "$REPO_ROOT"
command -v git >/dev/null || { echo "git is required"; exit 1; }
git rev-parse HEAD >/dev/null 2>&1 || { echo "run this inside the git repo"; exit 1; }

for d in "$ENGINE_DIR" "$WEB_DIR"; do
  if [ -e "$d" ]; then echo "Refusing to overwrite existing: $d"; exit 1; fi
  mkdir -p "$d"
done

echo "→ Exporting engine (everything except puzzleforge-web/) …"
# git archive exports only tracked files — no .git, no node_modules.
git archive HEAD | tar -x -C "$ENGINE_DIR"
rm -rf "$ENGINE_DIR/puzzleforge-web"
rm -rf "$ENGINE_DIR/scripts"    # split tooling belongs only to the sandbox repo
rm -rf "$ENGINE_DIR/.claude"    # local agent/session config — not part of the library

echo "→ Exporting web (puzzleforge-web/ as its own root) …"
git archive "HEAD:puzzleforge-web" | tar -x -C "$WEB_DIR"
# The web subtree has no .gitignore of its own — give the standalone repo one
# (data/ is the local workspace store, previously ignored as puzzleforge-web/data/).
cat > "$WEB_DIR/.gitignore" <<'GI'
node_modules/
*.pdf
*.log
.DS_Store
out/
dist/

# Workspace (team) data — local, not committed
data/
GI

echo "→ Repointing the web app at the sibling engine folder …"
# In separate repos, cloned side by side, the web app resolves the engine as
# a sibling directory instead of the parent.
node -e '
  const fs = require("fs"), p = process.argv[1] + "/package.json";
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (j.dependencies && j.dependencies["puzzleforge-engine"]) {
    j.dependencies["puzzleforge-engine"] = "file:../puzzleforge-engine";
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
' "$WEB_DIR"

commit_repo () {
  local dir="$1" name="$2"
  ( cd "$dir"
    git init -q
    git add -A
    git -c user.name="Rakoren" -c user.email="noreply@puzzleforge.local" \
        commit -q -m "Initial commit — $name (split from maze-books sandbox)"
  )
  echo "  ✓ $dir  ($(git -C "$dir" rev-list --count HEAD) commit, clean history)"
}

echo "→ Creating clean initial commits …"
commit_repo "$ENGINE_DIR" "puzzleforge-engine"
commit_repo "$WEB_DIR" "puzzleforge-web"

cat <<EOF

Done. Two repos prepared as siblings:
  $ENGINE_DIR   (private)
  $WEB_DIR      (public, MIT)

Next (manual — needs your GitHub account):
  1. Create an EMPTY private repo 'puzzleforge-engine' and an EMPTY public repo
     'puzzleforge-web' on GitHub (no README/license — the commits already have them).
  2. Push each:
       cd "$ENGINE_DIR" && git remote add origin <engine-url> && git push -u origin main
       cd "$WEB_DIR"    && git remote add origin <web-url>    && git push -u origin main
  3. Install & smoke-test the engine first, then the web app:
       cd "$ENGINE_DIR" && npm install && npm test
       cd "$WEB_DIR"    && npm install && npm start
  4. Archive the old sandbox repo (GitHub → Settings → Archive this repository).

See docs/REPO-SPLIT.md for the full walkthrough.
EOF
