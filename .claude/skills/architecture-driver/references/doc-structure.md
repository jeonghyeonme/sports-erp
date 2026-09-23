# Doc structure: four kinds of content, four homes

Documentation sprawl usually happens because different *kinds* of content end up mixed in the same file or folder, so nobody can tell what's safe to edit, what's load-bearing, and what's stale. This method separates content by kind, not by when it was written.

```
docs/
  overview/       business/product context — why the project exists, who it's for, glossary
  domains/        one file per domain/feature area — the Domain Cycle's output (see domain-cycle.md)
  architecture/   cross-cutting facts and rules that don't belong to one domain
                  (shared numeric constants, security rules that apply everywhere,
                   performance/availability targets, data-lifecycle rules, compliance)
  process/        how the project works, not what it builds — this skill's own templates,
                  the requirements-classification output, the progress log
```

Anything that doesn't fit — design systems, presentation decks, formal deliverables the project must hand off unmodified — keeps its own existing home; don't force it into this structure.

## Why domain docs are one file, not a spec-file/decisions-file split

It's tempting to split "what this domain is" (spec: data model, API, screens) from "why it's built this way" (decisions: ADRs) into two files. Resist that. Two files invites the question "which one is current" the moment they drift, and they will drift, because the spec changes as decisions change (see `domain-cycle.md`'s note on why decisions come before the spec, not after). One file per domain, spec as the last section, keeps a single source of truth per domain.

## Migrating an existing project's docs into this structure

Don't do a big-bang rewrite. As each domain goes through the Domain Cycle:
1. Pull that domain's existing reference material (data model, API, screens, old decision narrative) into the new domain doc, per `domain-cycle.md`'s ordering.
2. Mark the old file **superseded** with a banner pointing at the new one — don't delete yet.
3. Find every other file that links to the old one. Deletion has to wait until those links are repaired, or other docs end up pointing at a dead/stale file.
4. Once links are repaired, delete the old file. Keep a small tracking table (which old file → which new file → which inbound links still need fixing) so this doesn't get lost across sessions — `assets/templates/migration-tracker-template.md`.

Default to **merge-then-delete**, not merge-then-keep-both. A file kept "just in case" after its content has been merged elsewhere is exactly the kind of drift risk this structure exists to eliminate. Keep the old file only when it genuinely doesn't fit anywhere in the new structure (e.g. a cross-project reference doc, a formal deliverable) — and say explicitly why when that happens.

## Cross-domain leakage

If a domain doc starts accumulating rules that clearly apply to every domain (a security rule, a performance target, a data rule), that's a signal it belongs in `architecture/` instead. Route it there and have the domain doc reference it, rather than letting every domain redefine the same rule slightly differently.
