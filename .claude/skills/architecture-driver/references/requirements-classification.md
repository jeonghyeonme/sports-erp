# Requirements classification and domain priority

Two jobs, done once at the start of a project (or once per major new requirements source added later): turn a raw requirements document into a classified sentence-by-sentence table, then map those sentences onto the project's feature areas ("domains") and rank the domains so nobody has to tackle all of them at equal depth simultaneously.

## Part A: classify the requirements source

Work from the actual source document (RFP, PRD, spec, ticket epic — whatever it is), not from memory or summary. If it's a PDF or similarly locked format, extract the full text first; don't work from a skim.

For every distinct requirement sentence, record:
- **id** — short, stable (e.g. `F01`, `Q03`)
- **type** — Functional / Quality / Constraint / Process (things about *how the project is run*, not what the system does — deadlines, sign-off steps, deliverable formats; these matter but aren't architecture-relevant) / Background (business context that isn't a requirement itself but explains *why* others exist)
- **verifiable today?** — ○ (already pass/fail-able as written) / △ (has a number but missing the condition that would make it testable — e.g. a percentage with no measurement window) / × (currently unfalsifiable)
- **open question id**, if the sentence is ambiguous (cross-reference into Part A's own open-questions list, see below)

Tally the ○/△/× split per type at the end. It's common — and worth stating plainly to the user, it's diagnostic, not a defect in the source — for quality requirements to skew heavily toward × while functional requirements skew toward ○. That split is itself a finding: it means the source is clear about *what* to build and silent about *how well*, which is exactly the gap this method's later steps (design-constants, domain-cycle step 3) are for.

### Open questions

For every ambiguous sentence, don't invent a silent default. Record:
- what's ambiguous and why
- what it would change if answered one way vs. another (this determines whether it's worth resolving now or can wait)
- a temporary assumption + reasoning, explicitly labeled as unconfirmed
- who could actually confirm it (a real stakeholder, or "the project owner, next domain cycle")

Group these by how much they change the architecture: questions that would change the data model or module boundaries need answering before Driver identification in any domain they touch; questions that only affect a validation message can wait indefinitely.

## Part B: map to domains and prioritize

List the project's feature areas / domains (however the codebase or team already names them — don't invent new names if working ones exist). For each domain, pull in the requirement ids from Part A that belong to it, plus any that are genuinely cross-cutting (see below).

Rank each domain **high / medium / low** using three tests, in this order of weight:
1. Does the requirements source **explicitly emphasize** this (repeated, called out in parentheses, described as a differentiator, flagged as the reason the project exists)?
2. Is it **directly tied to a project invariant** (see `domain-cycle.md` step 1) — the kind of rule that, if it breaks, isn't a bug but a contract violation?
3. Is it **directly tied to a real risk to the project or business** (revenue, legal exposure, a stated failure mode in the requirements source)?

If a domain hits any of these, it's high. Domains hitting none of them by default land low — that's fine and expected; a project of nine domains commonly nets 3-4 high, 2-3 medium, 2-3 low.

**Sanity check this ranking against anything the project already treats as non-negotiable** (existing guardrails, an architecture doc's invariant list). If the high-priority set lines up with what the project already protects most fiercely, that's a good sign the ranking criteria are sound rather than arbitrary — say so, it's worth pointing out to the user as validation.

### What doesn't belong to any one domain

Some requirement ids won't fit a single domain no matter how you slice it:
- performance/availability targets that span the whole system
- security/privacy rules that apply everywhere personal data lives
- UI/UX consistency rules
- data-lifecycle rules (retention, audit trail) that apply to every entity
- legal/compliance constraints tied to the business as a whole, not one feature
- the Background-type sentences from Part A (they explain *why*, they don't belong to a *what*)
- Process-type sentences (they govern how the project is run, not the architecture)

Pull these into a separate table and route them to `docs/architecture/` (the cross-cutting home — see `doc-structure.md`) instead of forcing them into a domain. Trying to own them from inside one domain doc means every other domain re-derives the same rule differently.

## Sequencing the work

Recommend running the full Domain Cycle (`domain-cycle.md`) only on high-priority domains first, medium/low next if there's appetite, and treat this as an explicit, stated decision — not something the user has to ask for. If the user later says the depth is unsustainable across all domains, the answer is almost always "tier harder, not abandon rigor" — see the pushback section in `../SKILL.md`.
