# The implementation principle

This is the part that makes the whole method visible in real time to someone directing AI coding conversationally ("vibe coding") rather than reading every diff. It's a standing rule, meant to be pasted into the target project's `CLAUDE.md` (or equivalent persistent AI-instructions file) so it survives across sessions — not something that only holds because one session happened to agree to it.

## The rule (paste into CLAUDE.md via `assets/templates/claude-md-block.md`)

1. **Before implementing**, cite which domain's Driver/ADR this change serves. If none exists yet (a newly discovered problem, something not covered by an existing cycle), write the minimum viable decision record first — alternatives considered, trade-off, reason — even if it's three sentences, before writing code. Do not write code first and explain afterward.
2. **After implementing**, add an entry to `docs/process/progress-log.md` — not "what was done," but "why this was the right call given the architecture's existing decisions." Update the relevant domain doc's ADR/verification-status table too.
3. **Commit messages cite the Driver/ADR id** so `git log` alone shows the reasoning trail without opening any docs.
4. If the change touches a domain that hasn't been through a full Domain Cycle yet, don't wait for one — but still write down the minimal Driver reasoning (alternatives + trade-off + decision) before coding. Waiting for a full cycle to justify implementation is worse than a lightweight, honest, three-line rationale done now.

## Why "before, not after"

The temptation, especially for an AI agent that can produce working code fast, is to implement first and rationalize second if asked. That produces code that *looks* justified after the fact without ever having actually weighed alternatives — the trade-off analysis becomes decoration rather than the thing that picked the approach. Requiring the citation or mini-decision *before* code exists forces the comparison to actually happen, and gives the person steering the work a checkpoint to redirect before code is written, not after it needs to be unwound.

## What the progress log is for, specifically

It is **not** a changelog ("added X, fixed Y"). Git history is already a changelog. The log entry answers a different question: *given everything decided so far, why was this the right next move, and what did it rest on?* Good entries read like a chain: "the previous cycle left question X open → we picked answer Y because Z → that changed the baseline for domain W → here's what that domain's cycle then found." A log of pure "what happened" doesn't help someone reconstruct that chain later; a log of "why, in context" does.

Each entry should be short (a few sentences to a paragraph) and should name concrete numbers or file references where they exist rather than vague claims ("found a gap" → "found the concurrency test for capacity limits was never written despite the fixture existing specifically for it"). Specificity is what makes the log actually useful to skim later instead of being generic filler nobody reads.

## Retrofitting an existing project

If the project already has commits/code without this trail, don't try to reconstruct history that wasn't recorded — start the practice from now, and say so plainly in the first log entry ("prior work in this codebase predates this method; starting the log here"). Don't fabricate a plausible-sounding backstory for old decisions.
