<!--
Paste this block into the target project's CLAUDE.md (or equivalent persistent
AI-instructions file). Fill in the bracketed placeholders. See
references/implementation-principle.md for the reasoning behind each rule.
-->

## Implementation principle (Architecture Driver method)

Code changes in this project are not made ad hoc. When implementing or modifying code:

1. **Before implementing**, cite which domain's Driver/ADR this change serves
   (see `docs/domains/<domain>.md`). If no relevant decision exists yet, write
   the minimum viable decision record first — alternatives considered,
   trade-off, reason — even if it's three sentences, before writing code.
2. **After implementing**, add an entry to [docs/process/progress-log.md](docs/process/progress-log.md)
   explaining *why* this was the right call given the project's existing
   architecture decisions — not a changelog of what was done. Update the
   relevant domain doc's ADR/verification-status table too.
3. **Commit messages cite the Driver/ADR id** (e.g. `ADR-<DOMAIN>-01`) so
   `git log` alone shows the reasoning trail.
4. If the domain hasn't been through a full Domain Cycle yet, don't wait for
   one before implementing — but still write the minimal Driver reasoning
   (alternatives + trade-off + decision) first.

Purpose: this project is developed with heavy AI assistance directed
conversationally. This rule lets whoever is steering the work understand
project state and direction in real time without reading every diff.
