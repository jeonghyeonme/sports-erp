---
name: architecture-driver
description: Bootstraps a requirements-to-architecture working method into any codebase — classify raw requirements (functional/quality/constraint/invariant) → identify a small number (2-5) of Architecture Drivers that actually shape the structure → compare alternatives with numeric or reasoned trade-offs → record the decision as an ADR → verify it against real tests, and log the whole reasoning chain so a person directing AI coding conversationally ("vibe coding") can follow along in real time without reading every diff. Use this whenever the user wants to set up decision-tracking or ADR practice for a project, asks to turn a spec/RFP/PRD into architecture decisions, wants Claude to justify implementation choices before coding instead of just writing code, says things like "이 프로젝트에도 이 방법론 적용해줘", "요구사항을 Driver로 분석해줘", "왜 이렇게 구현했는지 기록을 남기고 싶다", "설계 결정 근거를 문서화하고 싶다", "bootstrap CLAUDE.md guardrails", or wants a domain-by-domain requirements breakdown with priority (high/medium/low) instead of tackling everything at once. Also use mid-project, on an existing codebase, whenever the user wants one feature area analyzed this way rather than the whole system.
---

# Architecture Driver Method

A repeatable way to go from **raw requirements** to **justified, verified code** — and to leave a trail a non-technical-tracking "vibe coder" can read to understand *why* the code looks the way it does, not just *what* it does.

It has two things this skill sets up, and two things it does repeatedly afterward:

**Set up once per project** (Bootstrap):
1. A `구현 작업 원칙` (implementation-principle) block in the project's `CLAUDE.md` (or equivalent AI-instructions file) — see `references/implementation-principle.md`.
2. A `docs/` split into `domains/` / `architecture/` / `process/` / `overview/` — see `references/doc-structure.md`.

**Repeat for each requirements source or feature area** (Domain Cycle):
3. Classify requirements and rank domains by priority so a large project doesn't get tackled all at once — `references/requirements-classification.md`.
4. Run the 11-step domain cycle (requirements → Drivers → alternatives → ADR → verification) — `references/domain-cycle.md`.

Read the relevant reference file before doing the corresponding work — don't try to hold all four in context at once. Templates to copy into the target project live in `assets/templates/`.

## Why this exists (tell the user this if they ask "why not just build it")

Left alone, an AI coding agent will happily implement things directly — pick an approach, write code, move on. That's fast, but the person steering it loses the ability to spot-check *whether the approach was right* without reading every diff. Two failure modes this method targets:

1. **No prioritization.** Asked to "handle edge cases thoroughly," an agent (or a person) will list edge cases without end, with no way to tell which ones matter. The fix is classifying requirements first and capping the number of Architecture Drivers per area at 2-5 — most requirements don't need a structural decision, only a rule.
2. **No trail.** Code changes happen, and six months later nobody (including the agent, in a fresh session) knows why. The fix is: cite the Driver/ADR *before* writing code, and log the reasoning *after* — see `references/implementation-principle.md`.

## Bootstrap (first time in a project)

If the project has no git repo / GitHub remote / CI yet, run `infra/bootstrap-checklist.md` first (it covers git init, GitHub connection via `infra/github-setup.md`, and CI) — the steps below assume that groundwork exists or isn't needed.

1. Ask the user for: what the project is, where its requirements live (a doc, a ticket, or just "figure it out from the code"), and roughly how many feature areas / domains it has.
2. Read `references/doc-structure.md` and create the `docs/` skeleton described there, adapted to the project's existing doc layout (don't force a rename of things that already work — see the "migrating an existing project" note in that file).
3. Read `references/implementation-principle.md` and insert the block from `assets/templates/claude-md-block.md` into the project's `CLAUDE.md` (create one if it doesn't exist), filling in the placeholders (log file path, domain doc path pattern).
4. Create `docs/process/progress-log.md` from `assets/templates/progress-log-template.md`. This is the running "why" log — see that reference file for what goes in it and what doesn't.
5. If the project has a requirements source (RFP, PRD, ticket backlog), go straight into the Domain Cycle below for classification. If not, skip straight to running a Domain Cycle on whatever feature area the user names.

## Domain Cycle (repeat per feature area)

1. **First time only**: read `references/requirements-classification.md`, classify the requirements source into a domain-priority map (high/medium/low), and save it under `docs/process/`. Recommend starting with high-priority domains only — say so explicitly, the same way you'd say "let's not boil the ocean."
2. For the domain being worked on now, read `references/domain-cycle.md` in full and follow its 11 steps. Use `assets/templates/domain-doc-template.md` as the file skeleton — one file per domain, user-story section first, reference spec appendix last (the template explains why in that order).
3. **The Driver-count discipline is the single most important thing to enforce**: 2-5 Architecture Drivers per domain, no more. Everything else that surfaces during classification becomes a plain rule in a "not promoted to Driver" table, not a full alternatives-comparison. If you notice yourself drafting a 6th Driver, that's a signal to either merge it into an existing one or demote it to a rule — say so to the user rather than quietly proceeding. Before finalizing the list, run the adversarial lens checklist in `domain-cycle.md` (time boundaries, concurrency, circumvention, human error, input boundaries) — this is what catches things like a systemic timezone bug or a data-attribution defect that "looks like a detail" on first read but isn't.
4. When shared numeric assumptions are needed (scale, load, capacity) and none exist yet, derive them once into `docs/architecture/design-constants.md` (see `references/design-constants.md` for how to label sources as measured/calculated/assumed) and have every domain reuse that file instead of re-deriving.
5. After the cycle, follow `references/implementation-principle.md`'s post-implementation steps: log an entry in `docs/process/progress-log.md`, and when code is actually written for this domain, cite the Driver/ADR id in the commit message.

## When the user pushes back on scope ("this is too much")

This has happened before and has a known answer: don't drop the rigor, narrow *where* it applies. Two levers, both documented in `references/requirements-classification.md`:
- Tier the domains (high/medium/low) and only run the full Domain Cycle on high-priority ones; everything else stays a lightweight rule table until it's promoted.
- Remind them the Driver cap (2-5) already does most of the work — most of a domain's requirements were never going to get the deep treatment anyway.

## What this skill does *not* do

It doesn't write the implementation code itself, and it doesn't replace a proper test suite. It produces the *reasoning artifact* (domain doc, ADRs, log entries) that should exist before and alongside implementation. Writing the actual code, and testing it, are normal Claude Code work guided by what the domain doc's ADRs decided — not something this skill automates away.
