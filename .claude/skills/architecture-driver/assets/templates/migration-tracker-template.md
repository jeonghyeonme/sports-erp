# Doc migration tracker

> Tracks moving old docs into the domains/architecture/process/overview
> structure (`references/doc-structure.md`). Default is merge-then-delete;
> "kept" is the exception and needs a stated reason. Don't execute deletions
> until the inbound-links column is empty — record progress here across
> sessions so this doesn't get lost.

## Tracking table

| domain | old file | handling | verdict | inbound links to fix before delete |
|---|---|---|---|---|

**Verdicts**: `merged → pending delete` (default) / `kept (exception)` — give the reason / `needs review`

## Deletion checklist (per old file)

1. Fix every file listed in "inbound links to fix" to point at the new domain doc.
2. Confirm no remaining references (a link-checker script over the docs tree works well for this).
3. Delete the old file.
4. Repeat the pattern for the next Domain Cycle.
