/**
 * Message bank for cipher puzzles — short, upbeat, audience-safe phrases.
 * `difficulty` hints at length/vocabulary; callers can supply their own message
 * via config.message. Kept letters-and-spaces friendly so every cipher mode
 * (including Morse and A1Z26, which drop punctuation) reads cleanly.
 */
module.exports = [
  { text: 'KEEP GOING', difficulty: 1 },
  { text: 'YOU CAN DO IT', difficulty: 1 },
  { text: 'DREAM BIG', difficulty: 1 },
  { text: 'STAY CURIOUS', difficulty: 1 },
  { text: 'BE KIND TODAY', difficulty: 1 },
  { text: 'NEVER STOP LEARNING', difficulty: 1 },
  { text: 'PRACTICE MAKES PROGRESS', difficulty: 1 },
  { text: 'EVERY DAY IS A FRESH START', difficulty: 1 },
  { text: 'READING TAKES YOU EVERYWHERE', difficulty: 1 },
  { text: 'SMALL STEPS ADD UP', difficulty: 1 },
  { text: 'KINDNESS IS ALWAYS IN STYLE', difficulty: 2 },
  { text: 'MISTAKES HELP US LEARN AND GROW', difficulty: 2 },
  { text: 'CURIOSITY IS THE KEY TO DISCOVERY', difficulty: 2 },
  { text: 'GREAT THINGS TAKE TIME AND PATIENCE', difficulty: 2 },
  { text: 'A JOURNEY BEGINS WITH ONE STEP', difficulty: 2 },
  { text: 'COURAGE IS GROWN ONE CHOICE AT A TIME', difficulty: 2 },
  { text: 'LAUGHTER IS THE BEST MEDICINE', difficulty: 2 },
  { text: 'GOOD FRIENDS ARE LIKE STARS', difficulty: 2 },
  { text: 'A SMOOTH SEA NEVER MADE A SKILLED SAILOR', difficulty: 3 },
  { text: 'THE BEST WAY TO PREDICT THE FUTURE IS TO CREATE IT', difficulty: 3 },
  { text: 'IMAGINATION IS MORE IMPORTANT THAN KNOWLEDGE', difficulty: 3 },
  { text: 'IT ALWAYS SEEMS IMPOSSIBLE UNTIL IT IS DONE', difficulty: 3 },
  { text: 'WHAT WE THINK WE BECOME', difficulty: 3 },
  { text: 'FORTUNE FAVORS THE PREPARED MIND', difficulty: 3 },
  { text: 'THE JOURNEY IS THE REWARD', difficulty: 3 },
  { text: 'CREATIVITY TAKES COURAGE', difficulty: 3 },
];
