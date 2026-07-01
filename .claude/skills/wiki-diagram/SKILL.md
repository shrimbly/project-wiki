---
name: wiki-diagram
description: "Create and maintain mermaid diagram(s) in wiki/diagrams/. Use when the user wants a visual of the project. First understands the project, then asks what kind of diagram fits — entity/relationship, user flow, sequence, state/lifecycle, architecture, concept map — and builds the chosen one, kept in sync with the wiki. The viewer renders mermaid, so diagrams are browsable alongside the wiki."
metadata:
  internal: true
---

# wiki-diagram

Add or refresh a visual for the wiki. **Don't assume an entity diagram** — the right
kind of diagram depends on what the project is about, so understand it first, then let
the user pick the type. The viewer renders ` ```mermaid ` blocks, so diagrams live as
markdown in `wiki/diagrams/`.

## 1. Understand the project first

Read `wiki/index.md` and `wiki/overview.md`, and skim what the wiki actually contains
— `wiki/entities/`, `wiki/concepts/`, `wiki/decisions/`, any flow/persona pages, and
existing `wiki/diagrams/`. You're working out what this project really models (a
data/domain model? a set of user flows? an execution pipeline? a system architecture?
a lifecycle?) so the options you offer are grounded in the material, not generic.

If the user already named the diagram they want (or asked to refresh a specific one),
skip to step 3.

## 2. Ask what kind of diagram (interactive)

Propose the **3–4 diagram types that actually fit this project's material** and let the
user choose with `AskUserQuestion` (recommend the best fit first; they can pick
"Other"). Ground each option in the project — name the entities/flows it would show,
not just the abstract type ("a user-flow diagram of the freelancer install-gate path",
not "a flowchart"). Common types:

| Type | Shows | Good when the wiki has… | Mermaid |
| --- | --- | --- | --- |
| **Entity / relationship** | the nouns and how they connect | rich `entities/`, containment/ownership | `graph TD` or `erDiagram` |
| **User flow / journey** | the steps a persona takes to reach a goal | personas, flows, UX content | `flowchart LR` or `journey` |
| **Sequence** | interactions between actors/components over time | execution, protocols, APIs, request paths | `sequenceDiagram` |
| **State / lifecycle** | the states of a thing and its transitions | status fields, lifecycles, approvals | `stateDiagram-v2` |
| **Architecture / system** | components, layers, and boundaries | services, local/cloud split, integrations | `flowchart` with subgraphs |
| **Concept map** | how ideas relate (looser than a data model) | concept-heavy, few hard entities | `graph` or `mindmap` |
| **Timeline / roadmap** | phases or milestones over time | roadmaps, staged rollouts | `timeline` or `gantt` |

Also offer a **scope** choice where useful — a whole-model overview vs. one focused
flow/subsystem. A focused diagram usually beats one dense catch-all.

## 3. Build the chosen diagram

Create (or update) a page in `wiki/diagrams/` named for the diagram — e.g.
`entity-overview.md`, `onboarding-flow.md`, `run-sequence.md`, `asset-lifecycle.md`.
Use the mermaid dialect that matches the chosen type:

```markdown
---
title: <Diagram title>
type: diagram
status: living
sources: []
related:
  - index.md
---

## Summary
<one line: what this diagram shows and the angle it takes>

## Diagram

​```mermaid
<mermaid for the chosen type>
​```

## Legend
<only if node shapes / edge styles carry meaning>
```

Guidelines:
- Use node names that match the wiki page titles so readers can map diagram → page,
  and link the key nodes' pages beneath the diagram.
- Keep it legible — a focused diagram per flow/subsystem beats one unreadable graph.
- Add a legend whenever shapes or edge styles encode meaning (e.g. solid = structural
  containment, dotted = reference).

## 4. Keep it consistent with the pages

The diagram must not contradict the wiki. If drawing it surfaces something wrong or
missing on a page, fix the page (or add a `wiki/open-questions.md` entry) — don't let
the diagram and the prose disagree.

## 5. Index, log, commit

- Add/confirm the diagram in `wiki/index.md` under Diagrams (with its one-line summary).
- Append a `## [YYYY-MM-DD] diagram | <what changed>` entry to `log.md`.
- Commit (push if a remote is configured).
- Remind the user they can view it rendered in the viewer.

## Tip

Render-check the mermaid if you can (the viewer shows a red error box on syntax
errors). Common gotchas: node IDs with spaces (quote them), reserved words like `end`,
and mixing dialects. Match the fenced block's first keyword to the type
(`sequenceDiagram`, `stateDiagram-v2`, `flowchart LR`, `erDiagram`, `mindmap`,
`timeline`).
