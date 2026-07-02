#!/usr/bin/env node
/*
 * Model Advisor — UserPromptSubmit hook.
 *
 * Reads the prompt from stdin (Claude Code passes hook input as JSON), runs a
 * fast keyword/length heuristic, and prints a one-line recommendation for the
 * cheapest Claude model likely to handle it well — biased toward saving usage.
 *
 * It's a RECOMMENDATION only: a hook cannot change the active model. Switch with
 * one keystroke, e.g.  /model opus   (aliases: haiku · sonnet · opus · fable).
 *
 * Zero token cost: pure string matching, no LLM call. Never blocks the prompt —
 * any error just exits 0 silently.
 *
 * Tune it: edit the keyword lists below. Turn it off: /hooks (or delete the
 * UserPromptSubmit entry in .claude/settings.json).
 */
'use strict';

function main(raw) {
  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch (_) { /* ignore */ }
  const prompt = String(data.prompt || '').toLowerCase();
  if (!prompt.trim()) return; // nothing to advise on (e.g. slash commands)

  const words = prompt.split(/\s+/).filter(Boolean).length;
  const has = (re) => re.test(prompt);
  // "and", numbered steps, or many lines → multi-part request.
  const parts = (prompt.match(/\band\b|\n\s*[-*\d]/g) || []).length;

  // Cheapest → priciest. Bias toward the lowest tier that fits.
  const MODELS = {
    haiku:  { name: 'Haiku 4.5',  alias: 'haiku',  note: 'quick lookup — cheapest' },
    sonnet: { name: 'Sonnet 4.6', alias: 'sonnet', note: 'everyday, well-scoped work' },
    opus:   { name: 'Opus 4.8',   alias: 'opus',   note: 'real engineering / debugging' },
    fable:  { name: 'Fable 5',    alias: 'fable',  note: 'hardest, long-horizon — priciest, use sparingly' },
  };

  // 0) Respect an explicit model mention in the prompt.
  let pick, why, up = null;
  if (has(/\bfable\b|\bmost capable\b/)) { pick = 'fable'; why = 'you named Fable'; }
  else if (has(/\bopus\b/)) { pick = 'opus'; why = 'you named Opus'; }
  else if (has(/\bsonnet\b/)) { pick = 'sonnet'; why = 'you named Sonnet'; }
  else if (has(/\bhaiku\b/)) { pick = 'haiku'; why = 'you named Haiku'; }
  else {
    // Keyword buckets (most-capable first so hard signals win).
    const fable = /\barchitect|\bdesign (the|a|our|this|an entire|the whole)|\bfrom scratch\b|rearchitect|re-architect|whole (system|app|codebase)|large[- ]?scale|cross-cutting|migration plan|concurren|race condition|deadlock|thread[- ]?safe|distributed|scalab|security (audit|review|vuln)|vulnerabilit|cryptograph|\bthink (hard|deeply|carefully|step)|reason through|prove\b|formally|algorithm design|really (hard|tricky|complex)/;
    const opus  = /\bimplement|\brefactor|\bdebug|fix (the |this |a )?(bug|issue|error|failure)|why (is|does|isn'?t|won'?t|are).*(fail|break|crash|wrong|not work)|\bbuild (a|the|an|out)|\bfeature\b|integrat|end[- ]?to[- ]?end|\bendpoint|\bmigrat|optimi|performance|redesign|multiple files|across (the|several|multiple)|wire up|write (the|a) (module|service|class|component|parser|api)/;
    const sonnet= /\badd\b|\bupdate\b|\brename\b|\btweak|\badjust|\bchange\b|\bformat\b|\blint\b|\bsmall\b|\btypo|\bcomment|docstring|write (a )?test|unit test|readme|\brefine|clean up|\bstyle\b|\bcss\b|copy(writing|edit)|reword|\bfield\b|\bbutton\b|\btooltip|\blabel\b/;
    const haiku = /^(what|where|which|who|when|how many|is |are |does |do |can )|explain|describe|summari[sz]e|\btl;?dr\b|show me|list (the|all)?|\bfind\b|\bsearch\b|\bgrep\b|look up|read (the|this)|what'?s in|\bstatus\b|run (the )?tests?|which file/;

    if (fable.test(prompt) || words > 140 || parts >= 6) { pick = 'fable'; why = words > 140 ? 'long, multi-part task' : 'hard / architectural task'; }
    else if (opus.test(prompt)) { pick = 'opus'; why = 'substantial coding task'; }
    else if (sonnet.test(prompt)) {
      pick = 'sonnet'; why = 'well-scoped edit';
      if (words > 70 || parts >= 3) up = 'opus'; // escalate note if it looks bigger than it reads
    }
    else if (haiku.test(prompt) && words <= 30 && !/\b(write|create|build|implement|refactor|fix|add|change|edit)\b/.test(prompt)) {
      pick = 'haiku'; why = 'quick read-only question';
    }
    else if (words > 90) { pick = 'opus'; why = 'long / involved request'; }
    else { pick = 'sonnet'; why = 'default for everyday work'; up = 'opus'; }
  }

  const m = MODELS[pick];
  let msg = `🔮 Model tip → ${m.name} (${why}). Switch: /model ${m.alias}`;
  if (up) msg += `  ·  ${MODELS[up].name} if it's more involved (/model ${MODELS[up].alias})`;
  if (pick === 'fable') msg += `  ·  Fable is the priciest — reserve for genuinely hard work`;

  // Compare to the current model when the runtime provides it.
  const cur = String(data.model || data.model_id || '').toLowerCase();
  if (cur && cur.includes(m.alias)) {
    msg = `✓ Current model (${m.name}) fits this (${why}).` + (up ? `  Bump to ${MODELS[up].name} if it grows: /model ${MODELS[up].alias}` : '');
  }

  process.stdout.write(JSON.stringify({ systemMessage: msg, suppressOutput: true }));
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { buf += c; });
process.stdin.on('end', () => { try { main(buf); } catch (_) { /* never block */ } process.exit(0); });
// If stdin never arrives, don't hang the prompt.
setTimeout(() => { try { main(buf); } catch (_) {} process.exit(0); }, 2000);
