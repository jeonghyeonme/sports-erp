# The Domain Cycle (11 steps)

Run this once per domain / feature area. It's the same shape every time; only the content changes. Validated in production on a real capstone project (see `../README.md` for provenance) across four feature areas before being extracted into this skill.

**Output ordering matters and is not arbitrary** (see step 0 note below): decisions come first, the reference spec (data model, API, screens — whatever "what currently exists" means for this stack) comes last as an appendix. Getting this backwards is a mistake this method made once and corrected — see the note at the end of this file.

## 0. Domain overview (user stories / scenarios)

Before classifying anything, write down the raw scenarios this domain needs to satisfy — "as a <role>, I want to <do a thing>" or equivalent. This is the **one exception** to "reference material goes last": scenarios are an *input*, not a *result* of the decisions that follow, so they go at the very top of the domain doc. A reader with zero context needs this before they can make sense of Driver IDs.

## 1. Requirements reclassification

Sort every requirement sentence touching this domain into four buckets, not three:

- **Functional** — what it should do.
- **Quality** — how well (performance, security, usability...).
- **Constraint** — externally imposed limits (timeline, budget, must-use-X).
- **Invariant** (the bucket people forget) — rules that are **not negotiable**, ever, full stop. The test: could you trade this off against something else in a conversation with the stakeholder? If no — "a seat can never be double-booked," "a terminated account loses access this request, not eventually" — it's an invariant, not a quality target. Quality targets get negotiated; invariants get enforced.

If the project already has a set of cross-cutting invariants (e.g. from an architecture doc or CLAUDE.md-equivalent), check which of them this domain is the one that actually *implements*.

## 2. Resolve ambiguity

Requirements documents (RFPs, PRDs, tickets) are frequently vague on purpose or by accident — "handle payments somehow," "reasonably fast," "the usual security stuff." For each one relevant to this domain:

- If there's already a resolved answer elsewhere in the project (another domain doc, a prior decision), cite it and mark **already confirmed**.
- If not, and you can't actually ask the real stakeholder, don't silently pick a number. Record an **explicit assumption + the reasoning that produced it + who would need to confirm it**. Never present an assumption as a fact.

## 3. Make it verifiable

Turn anything vague into something with a pass/fail line. Numeric where possible. Every number needs a source label:
- **measured** — a real statistic, benchmark, or existing data.
- **calculated** — derived from measured/assumed inputs via a stated formula (prefer this over guessing — see `design-constants.md` for a worked example using a real formula instead of a vibe-based number).
- **assumed** — a placeholder with stated reasoning, flagged as needing confirmation.

Reuse shared numbers from `docs/architecture/design-constants.md` if they exist rather than re-deriving them here.

## 4. Identify Architecture Drivers — cap at 2-5

This is the step that prevents scope explosion. Out of everything classified above, pick **only the requirements that would change the actual structure** of the code depending on how they're answered — data model shape, concurrency strategy, module boundaries, external integration pattern. Everything else, however important operationally, is not a Driver.

Rule of thumb: if two reasonable engineers could look at this requirement and immediately agree on the implementation without discussion, it's not a Driver — put it in the "not promoted" rule table (step below) instead. A domain with 15 requirements might have only 2-3 real Drivers. That's expected, not a failure to find more.

You're also allowed to add a Driver the requirements source never mentioned, if domain experience says it matters (e.g. "the payment provider will eventually fail or time out" even if nobody asked for that) — just say explicitly that you added it and why.

**Requirements not promoted to a Driver** go in a flat table: id, rule, reasoning, current status (implemented / not implemented / needs a test). This is where most requirements end up, and that's fine — they don't need an alternatives comparison, just a documented rule.

## 5. Prioritize the Drivers

Invariants (step 1) always outrank everything. Beyond that, order by: which Driver, if decided wrong, causes the most damage or is hardest to reverse later.

## 6. Diagnose the current baseline

Before proposing anything, state plainly what happens today (or would happen with the naive/first-draft approach) for each Driver, and *why* that's a problem. If the codebase already has a partial fix or a documented failure mode, cite it — don't re-derive what's already known. This baseline is what motivates the Driver existing at all.

## 7. Turn each Driver into a design question

One question per Driver, phrased as "when X happens, what do we do?" Keep the total question count small (this naturally falls out of capping Drivers at 2-5).

## 8. Alternatives → trade-offs → decision

For each question: list 2-4 real alternatives (not a strawman and the "right" answer — alternatives someone could genuinely have picked), state the honest pros/cons of each, then decide using the priority order from step 5 as the tiebreaker. State explicitly what's being given up, not just what's being gained — a good decision here has a **stated cost**, not zero downsides.

If an alternative violates an invariant from step 1, say so and eliminate it on those grounds rather than on vague taste.

## 9. Roll up what's being given up

One consolidated list, across all Drivers in this domain, of what was traded away. This is the section a reviewer reads to sanity-check the whole cycle in ten seconds.

## 10. Record each decision as an ADR

Compact format, one per Driver:
```
### ADR-<DOMAIN>-<NN>: <short decision title>
- **Context**: what forced this decision (cite the baseline from step 6)
- **Alternatives considered**: A / B / C (one line each)
- **Decision**: which one, and the one-line reason (cite the priority/invariant it satisfied)
- **Consequences**: what got better / what's being given up / what's left to do
```

## 11. Verification status — report honestly

For every invariant and every ADR, state plainly: verified (cite the test), not verified (no test exists yet — this is not a failure to hide, it's information), or not verifiable yet (feature isn't built, or the environment can't exercise it — e.g. a concurrency decision in an in-memory mock can't be load-tested until a real datastore exists). **Never quietly upgrade "not verified" to "verified" because the logic looks obviously correct** — obviously-correct logic is exactly what untested code usually looks like right before it isn't.

If verification surfaces a place where documentation and code disagree (it will — this method exists partly to catch that), record it explicitly as a finding, not just a silent fix.

## 12. Carry-overs + doc housekeeping

- Anything discovered in this cycle that belongs to a *different* domain: note it, don't chase it now.
- If this domain is replacing older documentation, follow `doc-structure.md`'s merge rules.
- Append one paragraph to `docs/process/progress-log.md` per `implementation-principle.md` — this step is easy to skip and is the one that makes the whole method visible to someone not reading every file.

---

## Why the reference spec goes last, not first

Early on, the reference material (data model, API surface, screens — "what currently exists") got placed at the *top* of the domain doc, before the Driver analysis. That was wrong, and here's why, worth explaining to a user who asks: putting the existing spec first makes it read as ground truth that the analysis merely documents — but the whole point of the Driver analysis is that it can *change* what the spec should say. If the ordering implies the spec is fixed and the reasoning is commentary on it, you'll unconsciously avoid proposing changes that contradict the existing spec, which defeats the exercise. Decisions first, spec as an appendix labeled "the result of the above, not its constraint," makes the causality visually obvious. User stories are the one exception (step 0) because they're an input the decisions serve, not an output of them.
