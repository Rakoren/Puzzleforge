/**
 * Trivia question bank. Family-friendly questions tagged with a category and a
 * difficulty (1-3). Teachers can also supply their own questions via config.
 */
module.exports = [
  // --- general / easy ---
  { q: 'How many days are there in a week?', a: 'Seven', category: 'general', difficulty: 1 },
  { q: 'What color do you get by mixing blue and yellow?', a: 'Green', category: 'general', difficulty: 1 },
  { q: 'How many legs does a spider have?', a: 'Eight', category: 'animals', difficulty: 1 },
  { q: 'What is the opposite of "hot"?', a: 'Cold', category: 'general', difficulty: 1 },
  { q: 'What shape has three sides?', a: 'A triangle', category: 'general', difficulty: 1 },
  { q: 'Which animal is known as the king of the jungle?', a: 'The lion', category: 'animals', difficulty: 1 },
  { q: 'How many cents are in a dollar?', a: 'One hundred', category: 'general', difficulty: 1 },
  { q: 'What do bees make?', a: 'Honey', category: 'animals', difficulty: 1 },
  { q: 'What season comes after winter?', a: 'Spring', category: 'general', difficulty: 1 },
  { q: 'What do you call a baby dog?', a: 'A puppy', category: 'animals', difficulty: 1 },

  // --- science / medium ---
  { q: 'What planet do we live on?', a: 'Earth', category: 'science', difficulty: 1 },
  { q: 'What gas do plants breathe in that people breathe out?', a: 'Carbon dioxide', category: 'science', difficulty: 2 },
  { q: 'What is the closest star to Earth?', a: 'The Sun', category: 'science', difficulty: 2 },
  { q: 'How many bones does an adult human have?', a: '206', category: 'science', difficulty: 3 },
  { q: 'What force pulls objects toward the Earth?', a: 'Gravity', category: 'science', difficulty: 2 },
  { q: 'What is H2O more commonly known as?', a: 'Water', category: 'science', difficulty: 2 },
  { q: 'What part of the plant grows underground?', a: 'The roots', category: 'science', difficulty: 1 },
  { q: 'What is the largest planet in our solar system?', a: 'Jupiter', category: 'science', difficulty: 2 },
  { q: 'At what temperature (Celsius) does water freeze?', a: '0 degrees', category: 'science', difficulty: 2 },
  { q: 'What do we call animals that eat only plants?', a: 'Herbivores', category: 'science', difficulty: 3 },

  // --- geography / medium-hard ---
  { q: 'What is the largest ocean on Earth?', a: 'The Pacific Ocean', category: 'geography', difficulty: 2 },
  { q: 'How many continents are there?', a: 'Seven', category: 'geography', difficulty: 2 },
  { q: 'What is the tallest mountain in the world?', a: 'Mount Everest', category: 'geography', difficulty: 3 },
  { q: 'Which country is shaped like a boot?', a: 'Italy', category: 'geography', difficulty: 2 },
  { q: 'What is the largest desert in the world?', a: 'The Antarctic (or Sahara, if hot deserts)', category: 'geography', difficulty: 3 },
  { q: 'What is the longest river in the world?', a: 'The Nile (or the Amazon)', category: 'geography', difficulty: 3 },
  { q: 'Which is the smallest planet in our solar system?', a: 'Mercury', category: 'science', difficulty: 3 },
  { q: 'What is the capital of France?', a: 'Paris', category: 'geography', difficulty: 2 },

  // --- words & numbers ---
  { q: 'What is 7 times 8?', a: '56', category: 'math', difficulty: 2 },
  { q: 'How many sides does a hexagon have?', a: 'Six', category: 'math', difficulty: 2 },
  { q: 'What is half of 50?', a: '25', category: 'math', difficulty: 1 },
  { q: 'What number comes after 99?', a: '100', category: 'math', difficulty: 1 },
  { q: 'How many minutes are in an hour?', a: 'Sixty', category: 'math', difficulty: 1 },
  { q: 'What is the first letter of the alphabet?', a: 'A', category: 'general', difficulty: 1 },
  { q: 'What do you call words that mean the same thing?', a: 'Synonyms', category: 'general', difficulty: 3 },
  { q: 'How many colors are in a rainbow?', a: 'Seven', category: 'general', difficulty: 2 },
];
