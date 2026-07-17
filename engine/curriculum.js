'use strict';
/**
 * Curriculum presets + auto lesson-plan.
 *
 * Puzzle word lists are vocabulary & spelling practice, so the standards that
 * genuinely apply are the Common Core ELA **vocabulary acquisition** (L.x.4 /
 * L.x.5) and, for K–5, **foundational phonics / word-analysis** (RF.x.3)
 * standards. Each grade maps to the kids/adult difficulty ladder the engine
 * already uses, a grade-appropriate puzzle mix, and an objective template — so a
 * teacher can pick a grade + topic and get a ready-to-print, standards-labelled
 * lesson packet instead of assembling one puzzle at a time.
 *
 * This module is pure data + planning (no generation) — the plan it returns is
 * fed to the same packet assembler a hand-built packet uses.
 */

const RF = (g) => ({ code: `CCSS.ELA-LITERACY.RF.${g}.3`, text: `Know and apply grade-level phonics and word-analysis skills in decoding words.` });
const L4 = (g) => ({ code: `CCSS.ELA-LITERACY.L.${g}.4`, text: `Determine or clarify the meaning of unknown and multiple-meaning words.` });
const L5 = (g) => ({ code: `CCSS.ELA-LITERACY.L.${g}.5`, text: `Demonstrate understanding of word relationships and nuances in word meanings.` });

// grade → difficulty level follows the kids ladder (PreK-K=1, 1–2=2, 3–4=3,
// 5–6=4); `mix` is the puzzle types cycled to fill the packet, easiest first.
const GRADES = [
  { id: 'K', label: 'Kindergarten', audience: 'kids', level: 1, ages: '5–6', standards: [RF('K'), L4('K'), L5('K')], mix: ['wordsearch', 'wordscramble'] },
  { id: '1', label: 'Grade 1', audience: 'kids', level: 2, ages: '6–7', standards: [RF(1), L4(1), L5(1)], mix: ['wordsearch', 'wordscramble'] },
  { id: '2', label: 'Grade 2', audience: 'kids', level: 2, ages: '7–8', standards: [RF(2), L4(2), L5(2)], mix: ['wordsearch', 'wordscramble', 'crossword'] },
  { id: '3', label: 'Grade 3', audience: 'kids', level: 3, ages: '8–9', standards: [RF(3), L4(3), L5(3)], mix: ['wordsearch', 'wordscramble', 'crossword'] },
  { id: '4', label: 'Grade 4', audience: 'kids', level: 3, ages: '9–10', standards: [RF(4), L4(4), L5(4)], mix: ['wordsearch', 'crossword', 'wordscramble'] },
  { id: '5', label: 'Grade 5', audience: 'kids', level: 4, ages: '10–11', standards: [RF(5), L4(5), L5(5)], mix: ['wordsearch', 'crossword', 'wordscramble', 'cryptogram'] },
  { id: '6', label: 'Grade 6', audience: 'kids', level: 4, ages: '11–12', standards: [L4(6), L5(6)], mix: ['wordsearch', 'crossword', 'wordscramble', 'cryptogram'] },
  { id: 'adult', label: 'Adults / general', audience: 'adult', level: 2, ages: null, standards: [], mix: ['wordsearch', 'crossword', 'wordscramble', 'cryptogram'] },
];

const TYPE_LABELS = {
  wordsearch: 'Word Search', wordscramble: 'Word Scramble', crossword: 'Crossword',
  krisskross: 'Kriss-Kross', cryptogram: 'Cryptogram', numbersearch: 'Number Search', riddles: 'Riddles', brainteasers: 'Brain Teasers', mathpuzzles: 'Math Puzzles', xsudoku: 'X-Sudoku', minisudoku: 'Mini Sudoku', evenodd: 'Even-Odd Sudoku', kakuro: 'Kakuro',
};
const typeLabel = (t) => TYPE_LABELS[t] || String(t).replace(/\b\w/g, (c) => c.toUpperCase());

function gradeInfo(id) {
  return GRADES.find((g) => g.id === String(id)) || null;
}

/** Grades for the UI (safe, serializable). */
function listGrades() {
  return GRADES.map((g) => ({
    id: g.id, label: g.label, audience: g.audience, level: g.level, ages: g.ages,
    standards: g.standards.map((s) => ({ code: s.code, text: s.text })),
    mix: g.mix.slice(),
  }));
}

function objectiveFor(g, topic, typeLabels) {
  const list = typeLabels.length > 1
    ? `${typeLabels.slice(0, -1).join(', ')} and ${typeLabels[typeLabels.length - 1]}`
    : typeLabels[0];
  const phonics = g.level <= 2 ? ', applying phonics and word-analysis skills' : '';
  return `Students build ${g.label} vocabulary and spelling in the “${topic}” theme by completing ${list} puzzles${phonics}.`;
}

/**
 * Auto lesson-plan: grade + topic (+ count) → a full packet config ready for the
 * packet assembler. Chooses a grade-appropriate puzzle mix and difficulty, and
 * fills the cover title / objective / standards from the grade preset.
 * @returns {{ audience, level, answers, cover, pages }}
 */
function planLessonPacket({ grade, topic, count } = {}) {
  const g = gradeInfo(grade) || gradeInfo('3');
  const topicLabel = (String(topic || '').trim()) || 'this unit';
  const n = Math.max(1, Math.min(20, Math.round(Number(count) || g.mix.length)));
  const pages = [];
  for (let i = 0; i < n; i++) {
    const type = g.mix[i % g.mix.length];
    pages.push({ type, difficulty: g.level, label: `${typeLabel(type)} — ${topicLabel}` });
  }
  const typesUsed = [...new Set(pages.map((p) => typeLabel(p.type)))];
  return {
    audience: g.audience,
    level: g.level,
    answers: 'end',
    cover: {
      title: `${topicLabel} — ${g.label} Vocabulary Packet`,
      kicker: `${g.label} Lesson Packet`,
      objective: objectiveFor(g, topicLabel, typesUsed),
      standards: g.standards.map((s) => s.code).join(', '),
    },
    pages,
  };
}

module.exports = { listGrades, gradeInfo, planLessonPacket };
