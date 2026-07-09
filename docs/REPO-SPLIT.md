# Repo split — `maze-books` → `puzzleforge-engine` + `puzzleforge-web`

This walks through the split the PRD describes (Repository / "Repo Structure
(post-cleanup)"). It carves the current co-located sandbox into two repos with
**clean initial commits** (no `maze-books` history), then archives the sandbox.

| Repo | Visibility | License | Contents |
|---|---|---|---|
| `puzzleforge-engine` | **Private** | UNLICENSED | Generators, validators, solvers, layout system, PDF export, book pipeline, CLI, MCP server, themes |
| `puzzleforge-web` | **Public** | MIT | The web app (Puzzle Maker, Book Builder, Cover Builder, theme tools, Page Editor) |
| `maze-books` | Archived | — | Original sandbox, kept for reference |

The boundary already matches the layout: the repo **root is the engine**
(`package.json` is `name: puzzleforge-engine`, `private: true`), and
**`puzzleforge-web/`** is the app that depends on it. The split script just
copies each half into its own folder and fixes the one dependency link.

## 1. Run the split script

From a clean checkout of this branch (commit your work first):

```powershell
# Windows (PowerShell) — from the repo root
powershell -ExecutionPolicy Bypass -File scripts\split-repos.ps1
```
```bash
# macOS / Linux
bash scripts/split-repos.sh
```

This creates two **sibling** folders next to the repo:

```
..\puzzleforge-engine\   # private core library, 1 clean commit
..\puzzleforge-web\      # public MIT app, 1 clean commit
```

The web app's dependency is rewritten from `file:..` to
`file:../puzzleforge-engine`, so with the two repos cloned side by side it
resolves the engine as a sibling folder — which is exactly how the full app runs
locally (per the PRD's local-deployment model).

## 2. Smoke-test locally (before pushing)

Install the engine first, then the web app that points at it:

```bash
cd ../puzzleforge-engine && npm install && npm test      # expect all tests green
cd ../puzzleforge-web    && npm install && npm start      # open http://localhost:4000
```

If both work, the split is sound.

## 3. Create the GitHub repos and push

Create **empty** repos on GitHub (no README/license — the initial commits
already contain them):

- `puzzleforge-engine` → **Private**
- `puzzleforge-web` → **Public**, MIT

Then push each (the initial commit is on `main`):

```bash
cd ../puzzleforge-engine
git remote add origin git@github.com:rakoren/puzzleforge-engine.git
git push -u origin main

cd ../puzzleforge-web
git remote add origin git@github.com:rakoren/puzzleforge-web.git
git push -u origin main
```

(With the GitHub CLI: `gh repo create rakoren/puzzleforge-engine --private --source . --push`
and `gh repo create rakoren/puzzleforge-web --public --source . --push`.)

## 4. Archive the sandbox

On GitHub: **`maze-books` → Settings → Danger Zone → Archive this repository.**
It stays readable for reference but is frozen.

## Notes

- **Clean history is intentional.** The script uses `git archive`, so only
  tracked files are exported — no `.git` history, no `node_modules`. If you ever
  want the history preserved instead, use `git filter-repo` on a clone rather
  than this script.
- **What each repo excludes:** the engine drops `puzzleforge-web/`, `scripts/`
  (this split tooling), and `.claude/` (local agent config). The web repo gets
  its own `.gitignore` (its `data/` workspace store stays local).
- **Re-running:** the script refuses to overwrite existing output folders —
  delete them first if you need to re-run.
