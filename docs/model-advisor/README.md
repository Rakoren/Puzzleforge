# Model Advisor — global install

The **Model Advisor** shows a one-line tip before each prompt suggesting the
cheapest Claude model likely to handle it well (Haiku 4.5 / Sonnet 4.6 /
Opus 4.8 / Fable 5), so you don't burn Opus/Fable usage on small tasks.

- **Zero token cost** — a keyword/length heuristic, *not* an LLM call.
- **Advisory only** — a hook can't change the active model. It prints a tip
  plus a one-keystroke switch: `/model opus` (aliases: `haiku` · `sonnet` ·
  `opus` · `fable`).
- Honors a model named in your prompt, says "✓ current model fits" when it
  already matches, escalates on long/multi-part requests, and never blocks a
  prompt (any error just exits 0).

This folder holds a standalone copy of the script (`model-advisor.js`) so you
can install it **globally** — active in every project, not just this repo.
(The repo already ships a project-scoped copy at `.claude/hooks/` +
`.claude/settings.json`; global install below makes it apply everywhere.)

---

## 1. Copy the script into your user Claude folder

**Windows (PowerShell):**
```powershell
mkdir "$env:USERPROFILE\.claude\hooks" -Force
copy "docs\model-advisor\model-advisor.js" "$env:USERPROFILE\.claude\hooks\model-advisor.js"
```

**macOS / Linux:**
```bash
mkdir -p ~/.claude/hooks
cp docs/model-advisor/model-advisor.js ~/.claude/hooks/model-advisor.js
```

## 2. Register the hook in `~/.claude/settings.json`

Add the `UserPromptSubmit` block below. If the file already has a `"hooks"`
key, **merge** this in (add the `UserPromptSubmit` array alongside your
existing events); don't replace the whole file. Use the command line for your
OS — the only difference is the path to the script.

**Windows** — `%USERPROFILE%\.claude\settings.json` (Claude Code runs the
command in **PowerShell**, so use `$env:USERPROFILE`, not `%USERPROFILE%`):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$env:USERPROFILE\\.claude\\hooks\\model-advisor.js\"",
            "timeout": 10,
            "statusMessage": "Picking the best model…"
          }
        ]
      }
    ]
  }
}
```

> **If you use Git Bash** as your Claude Code shell (not PowerShell), use the
> macOS/Linux `node ~/.claude/hooks/model-advisor.js` form instead. Unsure?
> The bulletproof option on any shell is a full absolute path, e.g.
> `"command": "node \"C:\\\\Users\\\\YOURNAME\\\\.claude\\\\hooks\\\\model-advisor.js\""`.

**macOS / Linux** — `~/.claude/settings.json`:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/model-advisor.js",
            "timeout": 10,
            "statusMessage": "Picking the best model…"
          }
        ]
      }
    ]
  }
}
```

## 3. Activate it

New hooks aren't picked up mid-session. In any Claude Code session, open
**`/hooks`** once (it reloads the config) or restart. You should see the
"🔮 Model tip → …" line appear under your next prompt.

---

## Turning it off / tuning it

- **Off (one project):** delete the `UserPromptSubmit` entry from that
  project's `.claude/settings.json`, or run `/hooks` and disable it.
- **Off (everywhere):** remove the block from `~/.claude/settings.json`.
- **Tune it:** edit the keyword lists near the top of `model-advisor.js`
  (`fable` / `opus` / `sonnet` / `haiku` regexes) to match how you phrase
  things. Want it to speak up **only** when it suggests a *different* model
  than the one you're on? The script already special-cases the current model
  when the runtime reports it — tell Claude and it can make that the default.

## How the tiers are chosen (default heuristic)

| Tip | When |
|-----|------|
| **Haiku 4.5** | short, read-only questions ("what does X do", "run the tests", "list …") |
| **Sonnet 4.6** | everyday, well-scoped edits ("add a tooltip", "fix this typo", "write a test for") |
| **Opus 4.8** | real engineering ("implement …", "refactor …", "why is X failing", multi-file work) |
| **Fable 5** | hardest / long-horizon (architecture, concurrency, security, very long multi-part asks) — flagged as priciest |

An explicit model name in your prompt always wins.
