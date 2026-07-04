/**
 * Difficulty labels & tiers.
 *
 * The engine speaks in internal levels 1–4 only. What the *reader/buyer* sees is
 * presentation, and it depends on the book's audience:
 *
 *   Adult → industry labels people search Amazon for: Easy / Medium / Hard / Expert
 *   Kids  → age range is the primary label (parents & teachers shop by age),
 *           with the grade band as a secondary label.
 *
 * This module is the single source of truth for that mapping. Internal 1/2/3/4
 * never changes; only the label set swaps by audience.
 */

const LEVELS = [1, 2, 3, 4];

// Adult books: standard puzzle-market labels.
const ADULT = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert' };

// Kids books: age range (primary) + grade band (secondary).
const KIDS = {
  1: { label: 'Beginner', ages: '4–6', grade: 'Pre-K – K' },
  2: { label: 'Early Reader', ages: '6–8', grade: 'Grades 1–2' },
  3: { label: 'Growing Reader', ages: '8–10', grade: 'Grades 3–4' },
  4: { label: 'Independent', ages: '10–12', grade: 'Grades 5–6' },
};

// Lexile word-complexity ranges that guide kids vocabulary per tier.
const KIDS_LEXILE = {
  1: { min: null, max: 200, label: 'BR–200L' },
  2: { min: 200, max: 500, label: '200–500L' },
  3: { min: 500, max: 820, label: '500–820L' },
  4: { min: 820, max: 1100, label: '820–1100L' },
};

const clampLevel = (level) => Math.max(1, Math.min(4, Math.round(Number(level) || 1)));
const isKids = (audience) => String(audience || '').toLowerCase() === 'kids';

/** Full descriptor for a level under an audience. */
function difficultyTier(level, audience) {
  const lv = clampLevel(level);
  if (isKids(audience)) {
    const k = KIDS[lv];
    return { level: lv, audience: 'kids', label: k.label, ages: k.ages, grade: k.grade, lexile: KIDS_LEXILE[lv].label };
  }
  return { level: lv, audience: 'adult', label: ADULT[lv] };
}

/**
 * A single display string.
 *   adult          → "Expert"
 *   kids (long)    → "Independent · Ages 10–12 · Grades 5–6"
 *   kids (short)   → "Independent (10–12)"
 */
function difficultyLabel(level, audience, opts = {}) {
  const t = difficultyTier(level, audience);
  if (t.audience === 'adult') return t.label;
  if (opts.short) return `${t.label} (${t.ages})`;
  return `${t.label} · Ages ${t.ages} · ${t.grade}`;
}

/** Option list for a UI select, one entry per level, labelled for the audience. */
function levelOptions(audience) {
  return LEVELS.map((lv) => {
    const t = difficultyTier(lv, audience);
    return { value: lv, label: t.label, ages: t.ages || null, grade: t.grade || null };
  });
}

module.exports = { LEVELS, ADULT, KIDS, KIDS_LEXILE, clampLevel, isKids, difficultyTier, difficultyLabel, levelOptions };
