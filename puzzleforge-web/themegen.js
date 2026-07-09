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
const TIERS = ['1', '2', '3', '4'];
const ALL_AUDIENCES = ['kids', 'adult'];

// Normalize the requested audience into the list a theme records + which prompt
// guidance to use. 'both' (default) suits kids and adults.
function normAudience(raw) {
  const a = String(raw || 'both').toLowerCase().trim();
  if (a === 'kids' || a === 'child' || a === 'children') return { mode: 'kids', audiences: ['kids'] };
  if (a === 'adult' || a === 'adults') return { mode: 'adult', audiences: ['adult'] };
  return { mode: 'both', audiences: [...ALL_AUDIENCES] };
}

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
        properties: { 1: tierArray, 2: tierArray, 3: tierArray, 4: tierArray },
        required: ['1', '2', '3', '4'],
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

// Audience-specific tier guidance. There are four tiers (matching the engine's
// four difficulty levels); the vocabulary and clue reading-level of each tier
// depend on who the theme is for. Kids and adults are two different ramps — a
// kids "hardest" tier is far gentler than an adult one.
function tierGuidance(mode, perTier) {
  if (mode === 'kids') {
    return [
      'This theme is for CHILDREN (roughly ages 4–12). Every word must be one a',
      'child would actually know, concrete and common — no technical, abstract, or',
      'obscure vocabulary. Clues read at a young level (simple words, present tense).',
      '',
      'Produce four gently increasing tiers:',
      `  • Tier 1 (ages 4–6): ~${perTier} very short, super-common words (3-4 letters).`,
      `  • Tier 2 (ages 6–8): ~${perTier} short, familiar words (4-6 letters).`,
      `  • Tier 3 (ages 8–10): ~${perTier} slightly longer everyday words (5-7 letters).`,
      `  • Tier 4 (ages 10–12): ~${perTier} longer but still kid-friendly words (7-9 letters).`,
    ];
  }
  if (mode === 'adult') {
    return [
      'This theme is for ADULTS. Vocabulary can be rich and specific; the hardest',
      'tier should genuinely challenge an adult solver. Keep everything wholesome',
      'and accurate. Clues may be more sophisticated (still fair, never giving away',
      'the spelling).',
      '',
      'Produce four increasing tiers:',
      `  • Tier 1 (Easy): ~${perTier} short, common words (3-5 letters).`,
      `  • Tier 2 (Medium): ~${perTier} moderately challenging words (5-8 letters).`,
      `  • Tier 3 (Hard): ~${perTier} longer or less-common words (7-11 letters).`,
      `  • Tier 4 (Expert): ~${perTier} advanced, specialist, or rare words (9-14 letters).`,
    ];
  }
  // both: a general audience spanning easy → hard, kept wholesome for all ages.
  return [
    'This theme feeds books for a general audience (children through adults), so',
    'every word and clue must be wholesome and classroom-appropriate. Clues read',
    'like a crossword definition and never give away the spelling.',
    '',
    'Produce four increasing tiers:',
    `  • Tier 1 (Easy): ~${perTier} short, common, very recognizable words (3-5 letters).`,
    `  • Tier 2 (Medium): ~${perTier} moderately challenging words (5-8 letters).`,
    `  • Tier 3 (Hard): ~${perTier} longer or more advanced words (7-11 letters).`,
    `  • Tier 4 (Expert): ~${perTier} the longest or most advanced words (9-14 letters).`,
  ];
}

function buildPrompt(topic, perTier, mode) {
  return [
    `Create a puzzle-book word theme about: "${topic}".`,
    '',
    'This theme feeds word searches, crosswords, and word scrambles.',
    '',
    ...tierGuidance(mode, perTier),
    '',
    'Rules for every word:',
    '  • A single word only — no spaces, hyphens, numbers, or punctuation.',
    '  • Use the SINGULAR form (CAT, not CATS; LEAF, not LEAVES), unless the word',
    '    is only ever used in the plural (e.g. SCISSORS).',
    '  • Genuinely on-topic and real (no invented or misspelled words).',
    '  • Unique across all four tiers (never repeat a word).',
    '  • Each tier should be clearly harder than the one before it.',
    '  • Avoid having one word be contained inside another (e.g. EAR inside HEART).',
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
    // An entry is a plain string (clue-less word) or a { word, clue } object.
    const word = String((typeof entry === 'string' ? entry : (entry && entry.word)) || '')
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
  const tiers = { 1: [], 2: [], 3: [], 4: [] };
  for (const t of TIERS) {
    tiers[t] = sanitizeTier(raw.tiers && raw.tiers[t], seen, report);
  }
  // Preserve a theme's audience suitability (missing/invalid = both).
  const audiences = (() => {
    const list = (Array.isArray(raw.audiences) ? raw.audiences : [])
      .map((a) => String(a || '').toLowerCase().trim())
      .filter((a) => ALL_AUDIENCES.includes(a));
    return list.length ? [...new Set(list)] : [...ALL_AUDIENCES];
  })();

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
  const counts = { 1: tiers[1].length, 2: tiers[2].length, 3: tiers[3].length, 4: tiers[4].length };
  report.total = counts[1] + counts[2] + counts[3] + counts[4];
  report.counts = counts;
  report.factCount = facts.length;

  return { theme: { id, label, category, tags, audiences, tiers, facts }, report };
}

/** A few sample words per tier, for a preview without dumping the whole list. */
function sampleWords(theme, n = 6) {
  const pick = (tier) =>
    (theme.tiers[tier] || []).slice(0, n).map((e) => (typeof e === 'string' ? e : e.word));
  return { 1: pick('1'), 2: pick('2'), 3: pick('3'), 4: pick('4') };
}

/**
 * Generate a theme from a topic with Claude.
 * @returns {Promise<{ theme, report, sample, model }>}
 */
async function generateTheme({ topic, wordsPerTier, audience, model } = {}) {
  topic = String(topic || '').trim();
  if (!topic) {
    const e = new Error('Enter a topic to generate a theme.');
    e.status = 400;
    throw e;
  }
  const aud = normAudience(audience);
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
      messages: [{ role: 'user', content: buildPrompt(topic, perTier, aud.mode) }],
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

  raw.audiences = aud.audiences; // record who this theme was generated for
  const { theme, report } = sanitizeTheme(raw, topic);
  if (report.total < 6) {
    const e = new Error('Could not build a usable theme for that topic. Try a more concrete subject.');
    e.status = 422;
    throw e;
  }
  return { theme, report, sample: sampleWords(theme), model: useModel };
}

/**
 * Generate a whole category: break a broad topic into several concrete
 * sub-themes, then generate a full theme for each (all sharing one category
 * label so "Whole category" selection merges them). Returns previews; nothing
 * is saved.
 * @returns {Promise<{ category, themes: Array<{theme, report, sample}> }>}
 */
async function generateCategory({ topic, count, wordsPerTier, audience } = {}) {
  topic = String(topic || '').trim();
  if (!topic) {
    const e = new Error('Enter a topic to generate a category.');
    e.status = 400;
    throw e;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    const e = new Error(
      'The AI generator needs an Anthropic API key. Set ANTHROPIC_API_KEY and restart the server.'
    );
    e.status = 503;
    e.code = 'NO_API_KEY';
    throw e;
  }

  const n = Math.max(2, Math.min(6, Math.round(Number(count) || 4)));
  const client = new Anthropic();

  // Step 1: a category label + N concrete sub-theme names.
  const schema = {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'A short label for the whole group, e.g. "Gaming".' },
      subthemes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Distinct, concrete sub-topics suitable for puzzle word lists.',
      },
    },
    required: ['category', 'subthemes'],
    additionalProperties: false,
  };
  const prompt = [
    `Break the broad topic "${topic}" into ${n} distinct, concrete sub-themes.`,
    'Each sub-theme must be specific enough to build a 60+ word puzzle list from',
    '(e.g. for "Gaming": "Tabletop RPGs", "Retro Arcade Games", "Game Genres").',
    'Avoid overlap between sub-themes. Also give the whole group a short category label.',
  ].join('\n');

  let names;
  let category;
  try {
    const msg = await client.messages
      .stream({
        model: DEFAULT_MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: { type: 'json_schema', schema } },
      })
      .finalMessage();
    const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const data = JSON.parse(text);
    category = String(data.category || topic).trim().slice(0, 40) || topic;
    names = (data.subthemes || []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, n);
  } catch (err) {
    const e = new Error(friendlyApiError(err));
    e.status = err && err.status ? err.status : 502;
    throw e;
  }

  // Step 2: generate a full theme for each sub-theme; skip any that fail.
  const themes = [];
  for (const name of names) {
    try {
      const r = await generateTheme({ topic: name, wordsPerTier, audience });
      r.theme.category = category; // force shared grouping
      themes.push({ theme: r.theme, report: r.report, sample: r.sample });
    } catch (_) {
      /* skip a sub-theme that couldn't be built */
    }
  }
  if (!themes.length) {
    const e = new Error('Could not generate any themes for that topic. Try a broader subject.');
    e.status = 422;
    throw e;
  }
  return { category, themes };
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
    audiences: theme.audiences,
    tiers: theme.tiers,
    facts: theme.facts || [],
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { id, path: file, report };
}

/** Resolve a theme id to its file path, guarding against path traversal. */
function themeFile(id) {
  const slug = slugify(id);
  if (!slug) {
    const e = new Error('Invalid theme id.');
    e.status = 400;
    throw e;
  }
  const file = path.join(pf.themesDir, `${slug}.json`);
  if (path.dirname(file) !== path.resolve(pf.themesDir)) {
    const e = new Error('Invalid theme id.');
    e.status = 400;
    throw e;
  }
  return file;
}

/** Delete a theme file by id. */
function deleteTheme(id) {
  const file = themeFile(id);
  if (!fs.existsSync(file)) {
    const e = new Error('Theme not found.');
    e.status = 404;
    throw e;
  }
  fs.unlinkSync(file);
  return { id: slugify(id) };
}

/**
 * Re-run the safety/dedup/length filter over an existing theme and write the
 * cleaned result back in place (same id). Returns what changed.
 */
function cleanTheme(id) {
  const file = themeFile(id);
  if (!fs.existsSync(file)) {
    const e = new Error('Theme not found.');
    e.status = 404;
    throw e;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before =
    TIERS.reduce((n, t) => n + ((raw.tiers && raw.tiers[t]) || []).length, 0) +
    (Array.isArray(raw.facts) ? raw.facts.length : 0);

  const { theme, report } = sanitizeTheme(raw, raw.label);
  // Upgrade legacy 3-tier themes: if the Expert tier is empty, split tier 3 so
  // the theme gains a real fourth tier (adult Expert vocabulary). No-op for
  // themes that already have four tiers.
  const beforeT4 = theme.tiers['4'].length;
  theme.tiers = pf.upgradeToFourTiers(theme.tiers);
  const tier4Added = theme.tiers['4'].length - beforeT4;
  const payload = {
    id: raw.id || slugify(id),
    label: theme.label,
    category: theme.category,
    tags: theme.tags,
    audiences: theme.audiences,
    tiers: theme.tiers,
    facts: theme.facts || [],
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const after = report.total + report.factCount;
  report.counts = { 1: theme.tiers['1'].length, 2: theme.tiers['2'].length, 3: theme.tiers['3'].length, 4: theme.tiers['4'].length };
  return { id: payload.id, report, removed: Math.max(0, before - after), tier4Added };
}

/** Normalize a tier entry's word for comparison. */
function entryWord(e) {
  return String((typeof e === 'string' ? e : (e && e.word)) || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/**
 * Remove specific words and/or facts from a saved theme, writing the file back.
 * @returns {{ id, counts: {1,2,3}, factCount, removedWords, removedFacts }}
 */
function removeFromTheme(id, { words = [], facts = [] } = {}) {
  const file = themeFile(id);
  if (!fs.existsSync(file)) {
    const e = new Error('Theme not found.');
    e.status = 404;
    throw e;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dropWords = new Set((words || []).map((w) => entryWord(w)).filter(Boolean));
  const dropFacts = new Set((facts || []).map((f) => String(f).trim()).filter(Boolean));

  let removedWords = 0;
  const tiers = raw.tiers || {};
  for (const t of TIERS) {
    const before = (tiers[t] || []).length;
    tiers[t] = (tiers[t] || []).filter((e) => !dropWords.has(entryWord(e)));
    removedWords += before - tiers[t].length;
  }
  raw.tiers = tiers;

  let removedFacts = 0;
  if (Array.isArray(raw.facts)) {
    const before = raw.facts.length;
    raw.facts = raw.facts.filter((f) => !dropFacts.has(String(f).trim()));
    removedFacts = before - raw.facts.length;
  }

  fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return {
    id: raw.id || slugify(id),
    counts: { 1: (tiers['1'] || []).length, 2: (tiers['2'] || []).length, 3: (tiers['3'] || []).length, 4: (tiers['4'] || []).length },
    factCount: Array.isArray(raw.facts) ? raw.facts.length : 0,
    removedWords,
    removedFacts,
  };
}

module.exports = {
  generateTheme,
  generateCategory,
  sanitizeTheme,
  saveTheme,
  deleteTheme,
  cleanTheme,
  removeFromTheme,
  slugify,
};
