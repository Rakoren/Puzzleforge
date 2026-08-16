/**
 * Brain-teaser bank. Family-friendly logic, math, word, and lateral-thinking
 * teasers tagged with a difficulty (1 easy → 4 hard) and a `kind` label.
 * Teachers can also supply their own via config.teasers.
 */
module.exports = [
  // --- difficulty 1 ---
  { q: 'If you have 3 apples and you take away 2, how many apples do you have?', a: '2 — the two you took.', kind: 'Trick', difficulty: 1 },
  { q: 'A farmer has 6 sheep. All but 4 run away. How many sheep are left?', a: '4.', kind: 'Trick', difficulty: 1 },
  { q: 'Which weighs more: a pound of feathers or a pound of bricks?', a: 'They weigh the same — one pound each.', kind: 'Trick', difficulty: 1 },
  { q: 'How many months of the year have 28 days?', a: 'All 12 of them.', kind: 'Trick', difficulty: 1 },
  { q: 'What number comes next: 2, 4, 6, 8, ___?', a: '10.', kind: 'Sequence', difficulty: 1 },
  { q: 'A red house is made of red bricks and a blue house of blue bricks. What is a greenhouse made of?', a: 'Glass.', kind: 'Lateral', difficulty: 1 },
  { q: 'What goes up when the rain comes down?', a: 'An umbrella.', kind: 'Lateral', difficulty: 1 },
  { q: 'You see a boat full of people, but there is not a single person on board. How?', a: 'Everyone on board is married (not single).', kind: 'Lateral', difficulty: 1 },
  { q: 'Fill in the pattern: 5, 10, 15, 20, ___', a: '25.', kind: 'Sequence', difficulty: 1 },

  // --- difficulty 2 ---
  { q: 'A rooster lays an egg on the very top of a barn roof. Which way does it roll?', a: 'Neither — roosters do not lay eggs.', kind: 'Trick', difficulty: 2 },
  { q: 'If there are 5 cookies and you take 3, how many do you have?', a: '3 — the ones you took.', kind: 'Trick', difficulty: 2 },
  { q: 'What number comes next: 1, 1, 2, 3, 5, 8, ___?', a: '13 (each number is the sum of the two before it).', kind: 'Sequence', difficulty: 2 },
  { q: 'Two fathers and two sons went fishing. Each caught one fish, but only three fish were caught. How?', a: 'They were a grandfather, his son, and his grandson — three people.', kind: 'Logic', difficulty: 2 },
  { q: 'I am an odd number. Take away one letter and I become even. What number am I?', a: 'Seven (remove the "s" to get "even").', kind: 'Word', difficulty: 2 },
  { q: 'Complete the pattern: 3, 6, 9, 12, ___', a: '15.', kind: 'Sequence', difficulty: 2 },
  { q: 'If two is company and three is a crowd, what are four and five?', a: 'Nine.', kind: 'Trick', difficulty: 2 },
  { q: 'What has a ring but no finger?', a: 'A telephone (or a bell).', kind: 'Lateral', difficulty: 2 },
  { q: 'A clock takes 5 seconds to strike 6 o’clock. How long does it take to strike 12?', a: '11 seconds — there are 11 gaps between 12 strikes.', kind: 'Logic', difficulty: 2 },

  // --- difficulty 3 ---
  { q: 'A bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How much is the ball?', a: '5 cents (the bat is $1.05).', kind: 'Math', difficulty: 3 },
  { q: 'If it takes 5 machines 5 minutes to make 5 widgets, how long do 100 machines take to make 100 widgets?', a: '5 minutes.', kind: 'Math', difficulty: 3 },
  { q: 'A snail is at the bottom of a 10-foot well. Each day it climbs 3 feet and each night slips back 2. How many days to get out?', a: '8 days.', kind: 'Math', difficulty: 3 },
  { q: 'What is the next number: 1, 4, 9, 16, 25, ___?', a: '36 (the square numbers).', kind: 'Sequence', difficulty: 3 },
  { q: 'How many times can you subtract 5 from 25?', a: 'Once — after that you are subtracting from 20.', kind: 'Trick', difficulty: 3 },
  { q: 'If you overtake the runner in 2nd place, what place are you in?', a: '2nd place.', kind: 'Logic', difficulty: 3 },
  { q: 'Three positive whole numbers give the same answer whether you add them or multiply them. What are they?', a: '1, 2, and 3 (1+2+3 = 1×2×3 = 6).', kind: 'Math', difficulty: 3 },
  { q: 'There are 3 boxes: apples, oranges, and both. Every label is wrong. Taking one fruit from one box, which box do you pick to fix all the labels?', a: 'The box labeled "both" — it must hold only one kind, which reveals the rest.', kind: 'Logic', difficulty: 3 },
  { q: 'A six-letter word I know: remove one letter and twelve remains. What is it?', a: 'Dozens (remove the "s" and it says "dozen").', kind: 'Word', difficulty: 3 },

  // --- difficulty 4 ---
  { q: 'Three light switches downstairs each control one bulb upstairs. You may go upstairs only once. How do you tell which switch controls which bulb?', a: 'Turn switch 1 on for a few minutes, then off; turn switch 2 on; go up. Lit = 2, off but warm = 1, off and cold = 3.', kind: 'Logic', difficulty: 4 },
  { q: 'A man pushes his car to a hotel and instantly loses all his money. What happened?', a: 'He is playing Monopoly.', kind: 'Lateral', difficulty: 4 },
  { q: 'The day before yesterday I was 25. Next year I will be 28. When is my birthday?', a: 'December 31 — the riddle is told on January 1.', kind: 'Logic', difficulty: 4 },
  { q: 'You have a 3-liter jug and a 5-liter jug. How do you measure exactly 4 liters?', a: 'Fill the 5 and pour into the 3 (2 left); empty the 3 and pour the 2 in; refill the 5 and top off the 3 — 4 liters remain in the 5.', kind: 'Logic', difficulty: 4 },
  { q: 'What comes next: O, T, T, F, F, S, S, ___?', a: 'E — the first letters of One, Two, Three… so Eight.', kind: 'Sequence', difficulty: 4 },
  { q: 'Using only addition, how can you add eight 8s to make 1000?', a: '888 + 88 + 8 + 8 + 8 = 1000.', kind: 'Math', difficulty: 4 },
  { q: 'What comes next: J, F, M, A, M, J, ___?', a: 'J — the first letters of the months, so July.', kind: 'Sequence', difficulty: 4 },
  { q: 'A is the brother of B. B is the brother of C. C is the father of D. How is D related to A?', a: 'D is A’s niece or nephew.', kind: 'Logic', difficulty: 4 },
  { q: 'A grandmother, two mothers, and two daughters went shopping. They spent $9, three dollars each. How is that possible?', a: 'There were only three people: a grandmother, her daughter, and her granddaughter.', kind: 'Logic', difficulty: 4 },
];
