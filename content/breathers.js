/**
 * Breather-page content — curated quotes and fun facts for adult "breather"
 * pages inserted between puzzle sets.
 *
 *   general — always-available fallback content
 *   byTheme — theme-matched facts keyed by theme id (used when the book's theme
 *             matches and "theme-matched" is on)
 *
 * Quotes are intentionally proverbs / common sayings with safe attributions to
 * avoid shipping misattributed quotes in a printed book. Facts are written to
 * be accurate and family-friendly.
 */

const general = {
  quotes: [
    { text: 'A journey of a thousand miles begins with a single step.', source: 'Chinese Proverb' },
    { text: 'Little by little, one travels far.', source: 'Proverb' },
    { text: 'Patience is bitter, but its fruit is sweet.', source: 'Proverb' },
    { text: "Where there's a will, there's a way.", source: 'Proverb' },
    { text: 'Slow and steady wins the race.', source: 'Aesop' },
    { text: 'Practice makes perfect.', source: 'Proverb' },
    { text: 'Well begun is half done.', source: 'Proverb' },
    { text: 'Every accomplishment starts with the decision to try.', source: 'Anonymous' },
    { text: 'Mistakes are proof that you are trying.', source: 'Anonymous' },
    { text: 'Curiosity is the key to learning.', source: 'Anonymous' },
    { text: 'A problem is just a puzzle waiting to be solved.', source: 'Anonymous' },
    { text: 'The best way to learn is to do.', source: 'Anonymous' },
  ],
  facts: [
    'Reading for just six minutes can reduce stress.',
    'Solving puzzles regularly helps keep your memory sharp.',
    'The dot over a lowercase "i" or "j" is called a tittle.',
    'The first crossword puzzle appeared in a newspaper in 1913.',
    'The longest common word you can type with only your left hand is "stewardesses."',
    'A group of pandas is called an embarrassment.',
    'The word "pen" comes from the Latin word for feather.',
    'The shortest war in history lasted about 38 minutes.',
    'A "jiffy" is a real unit of time.',
    'The word "puzzle" first appeared in English in the late 1500s.',
  ],
};

const byTheme = {
  animals: {
    facts: [
      'A group of flamingos is called a flamboyance.',
      'Octopuses have three hearts.',
      'A snail can sleep for up to three years.',
      'An ostrich’s eye is bigger than its brain.',
      'A group of owls is called a parliament.',
      'Honeybees communicate with each other by dancing.',
      'Cows are known to have best friends.',
      'Cats can make over 100 different sounds.',
    ],
  },
  ocean: {
    facts: [
      'The ocean holds about 97% of all the water on Earth.',
      'The blue whale is the largest animal that has ever lived.',
      'More than 80% of the ocean has never been explored.',
      'A starfish has no brain and no blood.',
      'Seahorses are the only fish that swim upright.',
      'The deepest point in the ocean is nearly 11 kilometers down.',
      'Some jellyfish can glow in the dark.',
      'An octopus can change color to blend into its surroundings.',
    ],
  },
  weather: {
    facts: [
      'A lightning bolt is hotter than the surface of the Sun.',
      'Snowflakes always have six sides.',
      'Thunder is the sound of lightning suddenly heating the air.',
      'A rainbow is really a full circle — we usually only see part of it.',
      'No two snowflakes are exactly alike.',
      'Raindrops are rounded, not tear-shaped.',
      'The fastest wind gust ever recorded was over 400 km/h.',
    ],
  },
  space: {
    facts: [
      'A day on Venus is longer than its year.',
      'The Sun makes up about 99.8% of the mass of our solar system.',
      'Footprints left on the Moon could last for millions of years.',
      'Jupiter is so big that all the other planets could fit inside it.',
      'Space is silent because there is no air to carry sound.',
      'There are more stars in the universe than grains of sand on Earth.',
      'Saturn is light enough that it would float in water.',
    ],
  },
  body: {
    facts: [
      'Babies are born with about 300 bones; adults have around 206.',
      'The human heart beats about 100,000 times a day.',
      'Your nose can remember about 50,000 different scents.',
      'The smallest bone in your body is inside your ear.',
      'You blink about 15 to 20 times every minute.',
      'Your brain uses about a fifth of your body’s energy.',
      'Your taste buds are replaced about every two weeks.',
    ],
  },
  food: {
    facts: [
      'Honey never spoils — jars thousands of years old are still edible.',
      'Carrots were originally purple, not orange.',
      'Bananas are berries, but strawberries are not.',
      'Apples float because they are about a quarter air.',
      'Cucumbers are about 95% water.',
      'Popcorn pops because water inside the kernel turns to steam.',
      'A pineapple can take about two years to grow.',
    ],
  },
  jobs: {
    facts: [
      'The word "salary" comes from "salt," once used to pay Roman soldiers.',
      '"Astronaut" comes from Greek words meaning "star sailor."',
      'A cooper is someone who makes barrels.',
      'A farrier is a person who fits horseshoes.',
      'Ada Lovelace is often called the first computer programmer, in the 1800s.',
      'A lexicographer is someone who writes dictionaries.',
      'Lighthouse keepers were once nicknamed "wickies."',
    ],
  },
  transport: {
    facts: [
      'Hot air balloons were the first way people flew.',
      'A Boeing 747 is made of around six million parts.',
      'Venice has no roads — only canals and boats.',
      'A ship’s speed is measured in knots.',
      'Early bicycles were called "velocipedes."',
      'Some passenger trains can travel over 350 km/h.',
      'The first cars were steered with levers, not wheels.',
    ],
  },
  sports: {
    facts: [
      'A golf ball has about 336 dimples.',
      'Basketball was invented using two peach baskets.',
      'A traditional soccer ball is made of 32 panels.',
      'A marathon is about 42 kilometers long.',
      'Boxing rings are actually square.',
      'The Olympic flame is lit using sunlight in Greece.',
      'Wrestling may be one of the oldest sports in the world.',
    ],
  },
};

module.exports = { general, byTheme };
