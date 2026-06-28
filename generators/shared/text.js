/**
 * Small text helpers shared by generators.
 *
 * singularizeForPrompt() turns a (possibly plural) theme word into a singular
 * form for "Draw a ___" prompts and bubble-letter pages, so a MERMAIDS word
 * yields "Draw a mermaid!". It is intentionally conservative: it never touches
 * the actual puzzle word (only the cosmetic prompt), keeps a safelist of words
 * that look plural but aren't, and leaves anything it isn't confident about
 * unchanged.
 */

// Words that end in "s" (or look plural) but should not be de-pluralized.
const KEEP = new Set([
  'bus', 'gas', 'lens', 'iris', 'axis', 'news', 'series', 'species',
  'glass', 'grass', 'class', 'brass', 'dress', 'press', 'chess', 'cross',
  'boss', 'loss', 'moss', 'mass', 'kiss', 'miss', 'glasses', 'scissors',
  'pants', 'jeans', 'clothes', 'octopus', 'walrus', 'cactus', 'platypus',
  'hippopotamus', 'virus', 'status', 'focus', 'circus', 'bonus', 'atlas',
  'canvas', 'compass', 'campus', 'christmas', 'princess', 'goddess',
  'address', 'business', 'witness', 'illness', 'success', 'cosmos', 'chaos',
]);

function singularizeForPrompt(word) {
  const w = String(word || '');
  if (w.length <= 3) return w; // too short to safely change (BUS, GAS)
  if (KEEP.has(w.toLowerCase())) return w;
  // berries -> berry, fairies -> fairy (consonant + "ies")
  if (/[^aeiou]ies$/i.test(w)) return w.slice(0, -3) + 'y';
  // foxes -> fox, dishes -> dish, buzzes -> buzz, churches -> church
  if (/(ses|xes|zes|ches|shes)$/i.test(w)) return w.slice(0, -2);
  // generic trailing "s": gods -> god, mermaids -> mermaid.
  // Skip "ss"/"us"/"is" (usually singular) and "ves" (irregular: elves -> elf,
  // knives -> knife — too error-prone, so leave the real plural word as-is).
  if (/s$/i.test(w) && !/(ss|us|is|ves)$/i.test(w)) return w.slice(0, -1);
  return w;
}

module.exports = { singularizeForPrompt };
