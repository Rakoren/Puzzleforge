# Scope: True Text-Wrap (paragraph reflow) in the Page Editor

**Status:** Proposed / not started
**Author:** PuzzleForge
**Related:** Home → Arrange → *Wrap Text* (currently ships layering-only:
*In Front of Puzzle* / *Behind Puzzle*)

---

## 1. What we mean by "reflow wrap"

MS Publisher's *Wrap Text* gallery — **None, Square, Tight, Top and Bottom,
Through, In Line with Text** — makes body text physically flow *around* an
object's outline. Today PuzzleForge only offers layering (front/behind),
because the editor's canvas is a set of independent, absolutely-positioned
boxes with no shared text flow for anything to wrap around.

This document scopes the work to add real reflow.

### Goal
A text box's text avoids the rectangle (or outline) of overlapping objects
that have a wrap mode set, on screen **and** in the exported PDF, identically.

### Non-goals (this scope)
- Multi-column newspaper flow / linked text boxes ("text overflows into the
  next box"). Separate feature.
- Wrapping around *another text box* (only images / shapes / tables / QR are
  wrap sources in v1).
- Reflowing the generated puzzle grid, word list, or clue block. Those are
  protected components, not free text.

---

## 2. Why this is non-trivial (the two hard constraints)

### Constraint A — there is no text flow
Every object renders as its own absolutely-positioned node:

- Editor: `.pf-node { transform: translate(x,y) rotate scale }` in
  `puzzleforge-web/public/editor.js` (`makeEl`, `applyElTf`).
- Print: `.pf-el { position:absolute; transform: … }` in
  `engine/components.js` (`composeParts` → `renderEl`).
- A text box is a single `.pf-textbox` div with a **fixed `width`** and
  `white-space:pre-wrap` (`engine/element-html.js`, `elementHtml`). Text wraps
  only inside its own box.

Because the wrap *source* (an image) and the wrap *target* (a text box) are
**sibling nodes in different stacking contexts**, native CSS `float` +
`shape-outside` cannot cross between them — floats only affect inline content
in the *same* block formatting context. So we must bring the exclusion *into*
each affected text box.

### Constraint B — editor and PDF must stay pixel-identical
The whole design rests on one shared renderer, `engine/element-html.js`, used
by both surfaces. The PDF path renders that HTML through **headless Chromium**
(Puppeteer). 

**This is the key enabling insight:** if wrap is expressed as pure
HTML/CSS that Chromium lays out, then the editor (Chromium on screen) and the
PDF (Chromium at print) compute the *same* line breaks automatically — parity
is free. Any approach that instead measures text in the browser and bakes in
pixel offsets would have to be re-run in the Node export and risks drift. **We
must keep wrap declarative (CSS/HTML), computed at render time, not
pre-baked.**

---

## 3. Approaches considered

### A. Float-shim + `shape-outside` (recommended)
Inside each text box, inject invisible **float spacer** `<div>`s at the top of
the flow, one per overlapping wrap object. Each shim is:
- floated left or right (whichever side the object sits on),
- sized to the object's intersection rectangle with the text box,
- offset down from the box top with `margin-top` (or a preceding vertical
  spacer) so text above the object is full-width.

For **Square / Top-and-Bottom** the shim is a plain rectangle. For **Tight /
Through** the shim carries `shape-outside: polygon(...)` (or `shape-outside:
url(alpha-mask)` for images) derived from the object's geometry, so text
hugs the true outline.

- **Pros:** pure CSS/HTML → automatic editor↔PDF parity; leans on Chromium's
  own line-breaker; no custom text layout engine; degrades gracefully
  (unknown mode → no shim → today's behavior).
- **Cons:** float shims are finicky with *multiple* objects stacked
  vertically in one box; `shape-outside` on floats is well-supported in
  Chromium but the polygon math for arbitrary rotated shapes is fiddly;
  right-aligned/justified text interacts oddly with floats.
- **Verdict:** best cost/parity ratio. Covers Square + Top-and-Bottom cleanly
  (the 90% cases), Tight/Through as a stretch.

### B. JS line-layout engine (rejected for v1)
Measure and break every line ourselves, positioning words to avoid exclusion
polygons.
- **Pros:** total control; handles any number of objects, rotation, complex
  outlines.
- **Cons:** we'd reimplement Chromium's text shaping (bidi, kerning,
  hyphenation, fallback fonts); must run *identically* in browser and Node —
  enormous parity surface; weeks of work and a permanent maintenance burden.
- **Verdict:** overkill. Only revisit if float-shims prove too limiting.

### C. Anchored inline object ("In Line with Text") (partial, separate)
Insert the object as an inline element *inside* the text at a character anchor,
so it moves with the text. This is a different data model (object anchored to a
text offset, not free-positioned) and only implements the *In Line with Text*
mode. Scope it as its own small follow-up, not part of the wrap-outline work.

---

## 4. Recommended plan (phased)

### Phase 0 — Data model + rectangular wrap (MVP)
- Add a `wrap` field to **image / shape / table / qr** elements:
  `{ mode: 'none'|'square'|'topbottom'|'tight'|'through', side:
  'both'|'left'|'right', pad: <px> }`. Absent ⇒ `none` (today's behavior).
- In `engine/element-html.js`, add a `wrapSources` context param to
  `elementHtml` (or a new `composeTextbox(e, wrapRects)` helper) so a text box
  can be rendered with a set of exclusion rectangles (in the text box's local
  coordinates).
- Add a per-page pass (shared helper, used by both editor `renderPage` and
  engine `composeParts`) that, for each text box, computes the list of
  overlapping wrap objects and their intersection rects, then feeds them to the
  renderer as float shims.
- Support **Square** and **Top-and-Bottom** only.
- **Deliverable:** text flows around an image rectangle, same on screen and in
  PDF.

### Phase 1 — Editor UX + z-order semantics
- Wire the existing **Wrap Text** dropdown to set `e.wrap.mode` on the
  selected object (replacing / joining the current front/behind items), with
  the full Publisher menu: None, Square, Tight, Top and Bottom, Through, plus
  the layering items kept as "In Front / Behind".
- Recompute wrap on move/resize/rotate of any wrap object or text box
  (hook into `moveTo` / `setScale` / `setRot` / `redrawTable`).
- Persist `wrap` in `snapshot`/`applySnap`, `pageStateOf`/`restoreState`, and
  the recipe schema (`server.js` element passthrough).
- **Deliverable:** usable, persistent wrap; survives save/reload and export.

### Phase 2 — Tight / Through (outline wrap)
- For **shapes**: derive a `shape-outside: polygon()` from the same geometry
  helpers used by `shapeSvg` (`regPoly`, `arrowPoints`, `starPoints`, …) — we
  already have the vertex math.
- For **images**: `shape-outside: url(<data-uri>)` using the image's alpha, or
  a user-adjustable bounding polygon.
- **Deliverable:** text hugs non-rectangular outlines.

### Phase 3 (optional / defer)
- **In Line with Text** (Approach C, anchored objects).
- **Edit Wrap Points** (draggable custom polygon) and **More Layout
  Options…** dialog.

---

## 5. Files that change

| File | Change |
|---|---|
| `engine/element-html.js` | Text renderer accepts exclusion rects → emits float shims (+ `shape-outside` in P2). New shared `wrapShimsFor(textbox, sources)` helper. |
| `engine/components.js` | `composeParts` runs the per-page wrap pass before rendering text boxes. |
| `puzzleforge-web/public/editor.js` | Wrap pass in `renderPage`; recompute on move/resize/rotate; wire dropdown; persist in snapshot/state. |
| `puzzleforge-web/public/editor.html` | Expand the Wrap Text menu to the full mode list. |
| `puzzleforge-web/server.js` | Pass `wrap` through recipe save/load (element allow-list ~line 1485). |
| `tests/` | New `wrap.test.js` (geometry/intersection + shim HTML), parity assertions. |

---

## 6. Risks & mitigations

- **Float-shim fragility with many objects** → cap v1 at rectangular wrap;
  document that heavily-overlapping stacks may not be exact (Publisher has the
  same practical limits).
- **Parity drift** → enforce the "declarative CSS only, no pre-baked pixel
  offsets" rule; add a test that renders the same page through the shared
  helper for both surfaces and diffs the emitted HTML.
- **Performance** on move (O(text boxes × wrap objects) per drag) → only
  recompute for the moved object's page, and throttle to `requestAnimationFrame`
  (the editor already batches redraws this way).
- **Rotated wrap objects** → v1 wraps the *axis-aligned bounding box* of a
  rotated object; true rotated-outline wrap is a P2/P3 refinement.

---

## 7. Rough effort

| Phase | Effort |
|---|---|
| 0 — model + Square/Top-Bottom | ~1–2 focused days |
| 1 — UX, persistence, live recompute | ~1 day |
| 2 — Tight/Through outlines | ~2–3 days (image alpha is the long pole) |
| 3 — In Line / Edit Points | separate, ~2–4 days each |

MVP that genuinely wraps text around an image (Phases 0+1) is the smallest
shippable slice: **~2–3 days**.

---

## 8. Decisions needed before starting

1. **v1 mode coverage** — ship Square + Top-and-Bottom first (recommended), or
   hold until Tight/Through are ready?
2. **Wrap source scope** — images only in v1, or images + shapes + tables?
3. **In Line with Text** — needed at all for puzzle books, or drop it?
4. **Rotated objects** — bounding-box wrap acceptable for v1?
