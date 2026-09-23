# Shared design constants

When multiple domains need the same underlying number — scale, load, concurrency, capacity — derive it **once**, in `docs/architecture/design-constants.md`, and have every domain cite it instead of re-deriving. This single file becomes the most re-read document in the project once two or three domains have used it; treat it as load-bearing, not a scratch note.

## Why this matters enough to be its own file

The first time a real numeric target is needed (e.g. "how much concurrent load should this handle"), it's tempting to either make up a round number or spend enormous effort producing one perfect figure. Both are wrong. The right move: build an honest derivation chain with a small number of real anchors, label every step by how solid it is, and accept the result is provisional. Redoing this derivation per-domain multiplies the wrong effort *and* produces inconsistent numbers across domains for the same underlying reality — worse than doing it once.

## How to derive one

1. **State what's actually given** (a stated user count, a known scale figure, an existing benchmark) — this is your only *measured* input, and there may be exactly one of these or none.
2. **Chain forward with named assumptions**, each with reasoning, never bare numbers. If a public statistic exists that's *adjacent* to what you need (not exact), use it as a bound and say explicitly why it's an upper/lower bound rather than the answer.
3. **Prefer a formula over a guess wherever one applies.** A concrete example that generalizes well: converting "how many people are present at once" into a number using **Little's Law** (`L = λW` — average number in a system equals arrival rate times average time spent) needs only an arrival rate and a dwell time as inputs, both of which are easier to reason about than "average concurrency" directly. Whenever the target quantity can be decomposed into a known formula plus a couple of estimable inputs, do that instead of estimating the target directly — it turns one hard guess into two easier ones and makes the reasoning inspectable.
4. **Label every step**: `measured` / `calculated` (state the formula) / `assumed` (state the reasoning). A reader should be able to tell at a glance which numbers to trust and which to revisit.
5. **Call out the weakest links explicitly**, in their own subsection — don't bury them in a table. These are exactly the inputs to revisit first if real data becomes available.
6. **Note what the number is *not*.** A common trap: deriving "average concurrent presence" and then using it directly as "concurrent system load," when the real load driver is something else entirely (e.g. a burst — everyone hitting refresh in the same ten seconds — rather than steady-state average). State plainly which downstream questions this number can and can't answer, so a later domain cycle doesn't misapply it.

## Reuse discipline

Keep a small "used by" table at the bottom of the file — which domain doc cited this, for what specific number, and whether they needed an additional derived ratio on top (e.g. converting "people present" into "requests per second" needs an extra usage-frequency multiplier that may not exist yet). If a domain needs a number this file doesn't have, extend the file — don't quietly derive a local one-off number inside the domain doc.

If a domain's real driver is a different shape entirely (e.g. a burst/spike scenario rather than steady-state average — ticket sales opening, a popular time slot filling up), say so explicitly and treat it as a separate, not-yet-derived quantity rather than force-fitting the steady-state number to it.
