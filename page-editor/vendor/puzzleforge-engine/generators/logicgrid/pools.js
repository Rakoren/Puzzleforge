/**
 * Logic Grid — content pools.
 *
 * A logic-grid puzzle matches N people (the primary category) against N items
 * from each of several attribute categories. This file supplies the categories
 * and the phrasing used to turn a deduced fact into a natural-language clue.
 *
 * Each category provides:
 *   key    stable id used in the solution rows
 *   label  column heading in the printed table
 *   kind   'name' | 'noun' | 'ordinal'
 *   items  the pool of possible values (ordinal items are generated, not listed)
 *   subj   (value) => a noun phrase naming the entity with that value, e.g.
 *          "the cat owner" — used to build every clue sentence
 *   ordinal categories also provide { more, unit } for comparison clues
 *          ("older than", "2 years older than").
 */

// The primary category: who the puzzle is about. Proper-noun subjects.
const PEOPLE = {
  key: 'person',
  label: 'Person',
  kind: 'name',
  items: ['Amelia', 'Ben', 'Chloe', 'Diego', 'Emma', 'Finn', 'Grace', 'Hiro', 'Isla', 'Jack', 'Kira', 'Leo'],
  subj: (v) => v,
};

// Discrete attribute categories. Each subj() reads naturally in "X is Y." and
// "X is not Y." sentences.
const ATTRIBUTES = [
  { key: 'pet', label: 'Pet', kind: 'noun', items: ['cat', 'dog', 'rabbit', 'hamster', 'parrot', 'turtle'], subj: (v) => `the ${v} owner` },
  { key: 'drink', label: 'Drink', kind: 'noun', items: ['tea', 'coffee', 'juice', 'cocoa', 'water', 'lemonade'], subj: (v) => `the ${v} drinker` },
  { key: 'sport', label: 'Sport', kind: 'noun', items: ['soccer', 'tennis', 'chess', 'swimming', 'cycling', 'karate'], subj: (v) => `the ${v} player` },
  { key: 'color', label: 'Color', kind: 'noun', items: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'], subj: (v) => `the one in ${v}` },
  { key: 'hobby', label: 'Hobby', kind: 'noun', items: ['painting', 'reading', 'baking', 'gardening', 'photography', 'hiking'], subj: (v) => `the one who enjoys ${v}` },
  { key: 'city', label: 'City', kind: 'noun', items: ['Paris', 'Cairo', 'Tokyo', 'Lima', 'Oslo', 'Delhi'], subj: (v) => `the visitor to ${v}` },
  { key: 'snack', label: 'Snack', kind: 'noun', items: ['pretzels', 'popcorn', 'cookies', 'crackers', 'raisins', 'almonds'], subj: (v) => `the ${v} lover` },
  { key: 'flower', label: 'Flower', kind: 'noun', items: ['roses', 'tulips', 'daisies', 'lilies', 'orchids', 'sunflowers'], subj: (v) => `the grower of ${v}` },
];

// Ordinal categories: values are distinct numbers so clues can compare them
// ("older than", "on a higher floor than"). Generated to fit the grid size.
const ORDINALS = [
  { key: 'age', label: 'Age', kind: 'ordinal', more: 'older', unit: 'years', start: 8, step: 1, suffix: (v) => `${v}`,
    subj: (v) => `the ${v}-year-old` },
  { key: 'floor', label: 'Floor', kind: 'ordinal', more: 'higher', unit: 'floors', start: 1, step: 1, suffix: (v) => `${v}`,
    subj: (v) => `the resident of floor ${v}` },
  { key: 'medals', label: 'Medals', kind: 'ordinal', more: 'more', unit: 'medals', start: 1, step: 2, suffix: (v) => `${v}`,
    subj: (v) => `the winner of ${v} medals` },
];

module.exports = { PEOPLE, ATTRIBUTES, ORDINALS };
