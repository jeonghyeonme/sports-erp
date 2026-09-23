<!--
One file per domain, saved as docs/domains/<domain-name>.md.
Follow references/domain-cycle.md while filling this in — don't just fill in
headers without reading the reasoning behind the ordering and the Driver cap.
Delete this comment block once filled in.
-->

# Domain cycle — <Domain Name>

> **Status**: draft (<date>). Applies `process/domain-cycle.md`'s 11 steps.
> **Target code**: `<path(s) to the code this domain covers>`
> <!-- If migrating from an older doc, add a note here per doc-structure.md's migration section: what old file this supersedes, where it stands (superseded banner added / links pending / deleted). -->

## 0. Domain overview (user stories)

- As a <role>, I want to <do something>, so that <reason>.
- <more stories>

<!-- One or two sentences on how this domain's scope was decided — reproduced as-is, adjusted, or intentionally reduced from the source, and why. -->

## 1. Requirements reclassification

### Functional
| id | content |
|---|---|

### Quality
| id | content |
|---|---|

### Constraints
- <list>

### Invariants (non-negotiable)
1. **<rule>.** (<why this can't be traded off>)

## 2. Open questions resolved

| id | question | status | resolution |
|---|---|---|---|

## 3. Made verifiable

| item | target | source (measured/calculated/assumed) |
|---|---|---|

## 4. Architecture Drivers identified (cap: 2-5)

| # | Driver | why it shapes structure |
|---|---|---|

**Not promoted to a Driver (plain rules)**

| id | rule | reasoning | status |
|---|---|---|---|

## 5. Driver priority

<!-- Invariants first, then Drivers ordered by damage-if-wrong / hardest-to-reverse. -->

## 6. Current baseline

<!-- What happens today (or with the naive approach) per Driver, and why that's a problem. -->

## 7. Design questions (one per Driver)

1. <question>

## 8. Alternatives → trade-offs → decision

### Question 1: <topic>

| alternative | pros | cons |
|---|---|---|

**Decision**: <which, and why — cite priority/invariant>
**Cost**: <what's explicitly given up>

## 9. What's being given up (rollup)

- <list across all Drivers>

## 10. ADRs

### ADR-<DOMAIN>-01: <title>
- **Context**:
- **Alternatives considered**:
- **Decision**:
- **Consequences**: better — / cost — / remaining work —

## 11. Verification status (report honestly)

| item | status |
|---|---|

**Next actions (priority order)**:
1.

## 12. Carry-overs + doc housekeeping

- <items belonging to other domains>
- <migration-tracker entry, if applicable>
- Log entry added to `docs/process/progress-log.md`: yes/no

---

## Appendix A. Reference spec (result of the decisions above)

> This section reflects the decisions in §1-12. If it ever disagrees with them, fix this section — not the other way around.

### A-1. Data model
### A-2. Screens / interfaces
### A-3. API
### A-4. Permissions / access summary
### A-5. Implementation status
