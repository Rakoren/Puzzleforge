/**
 * Engine orchestration — generate().
 *
 * Drives the puzzle lifecycle for a single puzzle:
 *
 *   module.generate(config) → module.validate(puzzle) → module.solve(puzzle)
 *
 * Retries up to MAX_ATTEMPTS on validation failure (or a retryable generation
 * error), then throws with a descriptive reason. The caller always receives a
 * valid puzzle or a clear error — never a silently broken one.
 *
 * The returned object is the Standard Puzzle Object:
 *   { id, type, difficulty, theme, title, instructions, data, solution, meta }
 */
const crypto = require('crypto');
const { getModule } = require('../generators/registry');
const { MAX_ATTEMPTS, acceptThreshold } = require('../config/defaults');

function generate(config = {}, opts = {}) {
  if (!config.type) {
    throw new Error('engine.generate: config.type is required');
  }
  const mod = getModule(config.type);
  const maxAttempts = opts.maxAttempts || MAX_ATTEMPTS;
  const threshold = opts.threshold != null ? opts.threshold : acceptThreshold(config.type);

  const failures = [];
  let lastWarnings = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let candidate;
    try {
      candidate = mod.generate(config);
    } catch (err) {
      if (err.retryable) {
        failures.push(`attempt ${attempt}: generate failed (${err.message})`);
        continue;
      }
      throw err; // config-level error — retrying won't help
    }

    const result = mod.validate(candidate);
    lastWarnings = result.warnings || [];

    if (!result.valid) {
      failures.push(`attempt ${attempt}: ${result.errors.join('; ')}`);
      continue;
    }
    if (result.score < threshold) {
      failures.push(
        `attempt ${attempt}: score ${result.score.toFixed(2)} below threshold ${threshold}`
      );
      continue;
    }

    // Independently verify the solution before accepting. The solver is the
    // source of truth for the answer key.
    const solved = mod.solve(candidate);
    if (solved.missing && solved.missing.length) {
      failures.push(
        `attempt ${attempt}: solver could not locate ${solved.missing.join(', ')}`
      );
      continue;
    }

    return {
      id: crypto.randomUUID(),
      type: candidate.type,
      difficulty: candidate.difficulty,
      theme: candidate.theme || null,
      title: candidate.title,
      instructions: candidate.instructions,
      data: candidate.data,
      solution: candidate.solution,
      meta: {
        generatedAt: Date.now(),
        attempts: attempt,
        validationScore: Number(result.score.toFixed(3)),
        warnings: result.warnings || [],
      },
    };
  }

  const reason = failures.length ? failures[failures.length - 1] : 'unknown';
  const err = new Error(
    `engine.generate: failed to produce a valid "${config.type}" puzzle after ` +
      `${maxAttempts} attempts. Last failure: ${reason}`
  );
  err.failures = failures;
  err.warnings = lastWarnings;
  throw err;
}

module.exports = { generate };
