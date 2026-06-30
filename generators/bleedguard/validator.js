/** Bleed-through guard page — validate(). Always valid; nothing to check. */
function validate() {
  return { valid: true, errors: [], warnings: [], score: 1 };
}

module.exports = { validate };
