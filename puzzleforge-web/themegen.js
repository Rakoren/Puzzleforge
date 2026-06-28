/**
 * AI theme generator.
 *
 * Turns a plain-language topic ("dinosaurs", "ancient Egypt", "ocean life")
 * into a difficulty-tiered, clued word list in the same shape PuzzleForge
 * themes use on disk: { id, label, category, tags, tiers: { 1, 2, 3 } }.
 *
 * Claude does the creative work; the engine's non-bypassable filters do the
 * safety work. Everything the model returns is re-validated here before it is
 * ever shown or saved: offensive words/clues are dropped, words are
 * upper-cased and stripped to letters, duplicates across tiers are removed,
 * and lengths are bounded so a generated theme behaves like a hand-authored
 * one in every puzzle type.
 */
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// Import the engine the same way the server does (package or relative).
let pf;
try {
  pf = require('puzzleforge-engine');
} catch (_) {
  pf = require('..');
}

// Default to Opus 4.8; override with PUZZLEFORGE_THEME_MODEL (e.g. a cheaper
// model for high-volume generation).
const DEFAULT_MODEL = process.env.PUZZLEFORGE_THEME_MODEL || 'claude-opus-4-8';

const MIN_LEN = 3;
const MAX_LEN = 14;
const TIERS = ['1', '2', '3'];

function clampPerTier(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 24;
  return Math.max(8, Math.min(40, Math.round(v)));
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// JSON schema the model must fill. Structured outputs guarantee the shape so we
// only have to worry about content, not parsing.
function themeSchema(perTier) {
  // Note: structured-output array schemas only allow minItems of 0 or 1, so the
  // target count is requested in the prompt rather than enforced in the schema.
  const tierArray = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        word: { type: 'string', description: 'A single word, letters only, 3-14 characters.' },
        clue: { type: 'string', description: 'A short, kid-friendly clue (a crossword-style definition).' },
      },
      required: ['word', 'clue'],
      additionalProperties: false,
    },
  };
  return {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'A short display name for the theme, e.g. "Dinosaurs".' },
      category: {
        type: 'string',
        description: 'A broad grouping this theme belongs to, e.g. "Animals & Nature" or "History & Places".',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '3-6 lowercase keywords for searching/filtering.',
      },
      tiers: {
        type: 'object',
        properties: { 1: tierArray, 2: tierArray, 3: tierArray },
        required: ['1', '2', '3'],
        additionalProperties: false,
      },
      facts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short, accurate, family-friendly fun facts about the topic (one sentence each).',
      },
    },
    required: ['label', 'category', 'tags', 'tiers', 'facts'],
    additionalProperties: false,
  };
}

function buildPrompt(topic, perTier) {
  return [
    `Create a puzzle-book word theme about: "${topic}".`,
    '',
    'This theme feeds word searches, crosswords, and word scrambles in books for',
    'children and families, so every word and clue must be wholesome and',
    'classroom-appropriate.',
    '',
    'Produce three difficulty tiers:',
    `  • Tier 1 (Easy): ~${perTier} short, common, very recognizable words (about 3-5 letters).`,
    `  • Tier 2 (Medium): ~${perTier} moderately challenging words (about 5-8 letters).`,
    `  • Tier 3 (Hard): ~${perTier} longer or more advanced words (about 7-14 letters).`,
    '',
    'Rules for every word:',
    '  • A single word only — no spaces, hyphens, numbers, or punctuation.',
    '  • Use the SINGULAR form (CAT, not CATS; LEAF, not LEAVES), unless the word',
    '    is only ever used in the plural (e.g. SCISSORS).',
    '  • Genuinely on-topic and real (no invented or misspelled words).',
    '  • Unique across all three tiers (never repeat a word).',
    '  • Avoid having one word be contained inside another (e.g. EAR inside HEART).',
    '',
    'Each clue should be one short sentence a child could understand — like a',
    'crossword definition, never giving away the spelling.',
    '',
    'Also provide 12-15 fun facts about the topic for "did you know?" pages:',
    '  • Each fact is one short, accurate, family-friendly sentence.',
    '  • No attributions or quotes — just interesting, true facts about the topic.',
    '',
    'Finally, give the theme a short label, a sensible broad category, and 3-6',
    'lowercase search tags.',
  ].join('\n');
}

/** Sanitize a single tier array into engine-ready entries. Mutates `seen`. */
function sanitizeTier(rawEntries, seen, report) {
  const out = [];
  for (const entry of rawEntries || []) {
    const word = String((entry && entry.word) || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (word.length < MIN_LEN || word.length > MAX_LEN) {
      report.dropped++;
      continue;
    }
    if (seen.has(word)) {
      report.dropped++;
      continue;
    }
    if (pf.isOffensiveWord(word)) {
      report.dropped++;
      report.blocked++;
      continue;
    }
    let clue = String((entry && entry.clue) || '').trim();
    if (clue && pf.scanTextForOffensive(clue).length) clue = '';
    seen.add(word);
    out.push(clue ? { word, clue } : word);
  }
  return out;
}

/**
 * Validate + normalize a raw model object into a theme ready to preview/save.
 * Safe to run on untrusted input (the server re-runs it before writing).
 * @returns {{ theme: object, report: object }}
 */
function sanitizeTheme(raw, fallbackTopic) {
  raw = raw || {};
  const report = { dropped: 0, blocked: 0 };
  const seen = new Set();
  const tiers = { 1: [], 2: [], 3: [] };
  for (const t of TIERS) {
    tiers[t] = sanitizeTier(raw.tiers && raw.tiers[t], seen, report);
  }

  const label = String(raw.label || fallbackTopic || 'New Theme').trim().slice(0, 60) || 'New Theme';
  const category = String(raw.category || 'Other').trim().slice(0, 40) || 'Other';

  const tags = [];
  for (const tag of Array.isArray(raw.tags) ? raw.tags : []) {
    const clean = String(tag || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (clean && !tags.includes(clean) && pf.scanTextForOffensive(clean).length === 0) tags.push(clean);
    if (tags.length >= 8) break;
  }

  // Fun facts: trim, drop empties/offensive, de-dupe, bound length and count.
  const facts = [];
  const seenFacts = new Set();
  for (const raw_fact of Array.isArray(raw.facts) ? raw.facts : []) {
    const fact = String(raw_fact || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const key = fact.toLowerCase();
    if (fact.length < 8 || seenFacts.has(key)) continue;
    if (pf.scanTextForOffensive(fact).length) continue;
    seenFacts.add(key);
    facts.push(fact);
    if (facts.length >= 25) break;
  }

  const id = slugify(label) || slugify(fallbackTopic) || 'theme';
  const counts = { 1: tiers[1].length, 2: tiers[2].length, 3: tiers[3].length };
  report.total = counts[1] + counts[2] + counts[3];
  report.counts = counts;
  report.factCount = facts.length;

  return { theme: { id, label, category, tags, tiers, facts }, report };
}

/** A few sample words per tier, for a preview without dumping the whole list. */
function sampleWords(theme, n = 6) {
  const pick = (tier) =>
    theme.tiers[tier].slice(0, n).map((e) => (typeof e === 'string' ? e : e.word));
  return { 1: pick('1'), 2: pick('2'), 3: pick('3') };
}

/**
 * Generate a theme from a topic with Claude.
 * @returns {Promise<{ theme, report, sample, model }>}
 */
async function generateTheme({ topic, wordsPerTier, model } = {}) {
  topic = String(topic || '').trim();
  if (!topic) {
    const e = new Error('Enter a topic to generate a theme.');
    e.status = 400;
    throw e;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error(
      'The AI theme generator needs an Anthropic API key. Set the ANTHROPIC_API_KEY environment variable and restart the server.'
    );
    e.status = 503;
    e.code = 'NO_API_KEY';
    throw e;
  }

  const perTier = clampPerTier(wordsPerTier);
  const useModel = model || DEFAULT_MODEL;
  const client = new Anthropic();

  let message;
  try {
    // Stream so a large word list doesn't hit a request timeout, then collect.
    const stream = client.messages.stream({
      model: useModel,
      max_tokens: 16000,
      messages: [{ role: 'user', content: buildPrompt(topic, perTier) }],
      output_config: { format: { type: 'json_schema', schema: themeSchema(perTier) } },
    });
    message = await stream.finalMessage();
  } catch (err) {
    const e = new Error(friendlyApiError(err));
    e.status = err && err.status ? err.status : 502;
    throw e;
  }

  const text = (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (_) {
    const e = new Error('The model returned an unexpected response. Please try again.');
    e.status = 502;
    throw e;
  }

  const { theme, report } = sanitizeTheme(raw, topic);
  if (report.total < 6) {
    const e = new Error('Could not build a usable theme for that topic. Try a more concrete subject.');
    e.status = 422;
    throw e;
  }
  return { theme, report, sample: sampleWords(theme), model: useModel };
}

function friendlyApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'The Anthropic API is rate limited right now. Wait a moment and try again.';
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check the network connection.';
  }
  return (err && err.message) || 'The theme generator failed. Please try again.';
}

/** True if a theme id already exists on disk. */
function themeExists(id) {
  return fs.existsSync(path.join(pf.themesDir, `${slugify(id)}.json`));
}

/** Pick an id that does not collide with an existing theme file. */
function uniqueId(id) {
  let base = slugify(id) || 'theme';
  let candidate = base;
  let n = 2;
  while (themeExists(candidate)) candidate = `${base}-${n++}`;
  return candidate;
}

/**
 * Persist a theme to the themes directory. Re-sanitizes first so a tampered
 * client payload can never write unsafe content. Never overwrites an existing
 * theme — collisions get a numeric suffix.
 * @returns {{ id, path, report }}
 */
function saveTheme(rawTheme) {
  const { theme, report } = sanitizeTheme(rawTheme, rawTheme && rawTheme.label);
  if (report.total < 1) {
    const e = new Error('There are no valid words to save.');
    e.status = 400;
    throw e;
  }
  const id = uniqueId(theme.id);
  const file = path.join(pf.themesDir, `${id}.json`);
  const payload = {
    id,
    label: theme.label,
    category: theme.category,
    tags: theme.tags,
    tiers: theme.tiers,
    facts: theme.facts || [],
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { id, path: file, report };
}

module.exports = { generateTheme, sanitizeTheme, saveTheme, slugify };
