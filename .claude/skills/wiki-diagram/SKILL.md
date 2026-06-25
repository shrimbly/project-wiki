---
name: wiki-diagram
description: Create and maintain mermaid diagram(s) of the project's model in wiki/diagrams/. Use when entities or key relationships have changed (e.g. after an ingest), when the user wants a visual model, or when the diagram has drifted from the entity/concept pages. The viewer renders mermaid, so the diagram is browsable alongside the wiki.
---

# wiki-diagram

Keep a visual model of the wiki in sync with its pages. The viewer renders
` ```mermaid ` code blocks, so diagrams live as markdown in `wiki/diagrams/`.

## 1. Read the model

- Enumerate the entities from `wiki/entities/*.md` and the key cross-cutting ideas
  from `wiki/concepts/*.md`.
- Extract relationships from each page's body and `related:` frontmatter:
  containment ("a Workspace holds Projects"), references, derivations, and any
  permission/ownership edges the model cares about.
- Note which relationships are **structural** (ownership/containment) vs.
  **non-structural** (references, soft links) — you'll style them differently.

## 2. Write or update the diagram page

Maintain `wiki/diagrams/entity-overview.md` (add more focused diagrams as separate
pages if the model gets large — e.g. a permissions diagram, a lifecycle diagram).

```markdown
---
title: Entity Overview
type: diagram
status: living
sources: []
related:
  - index.md
---

## Summary
Top-down view of the entities in the model and how they relate. The spine of the
entity layer; kept in sync with the entity pages.

## Diagram

​```mermaid
graph TD
  Workspace -->|holds| Project
  Project -->|contains| Asset
  %% solid = structural containment; dotted = non-structural reference
  Asset -.->|references| Model
​```

## Legend
- **Solid arrow** — structural (ownership / containment).
- **Dotted arrow** — non-structural (reference / soft link).
```

Guidelines:
- Use clear node names matching the entity page titles so readers can map diagram
  → page.
- Pick the mermaid layout that fits (`graph TD` for hierarchy, `erDiagram` for
  data-model cardinality, `flowchart`/`sequenceDiagram` for flows).
- Keep it legible — if it's getting dense, split into multiple focused diagrams
  rather than one unreadable graph.
- Add a legend whenever edge styles carry meaning.

## 3. Keep it consistent

The diagram must not contradict the pages. If drawing it surfaces a relationship
that's wrong or missing on a page, fix the page (or open a `wiki/open-questions.md`
entry) — don't let the diagram and prose disagree.

## 4. Index, log, commit

- Add/confirm the diagram in `wiki/index.md` under Diagrams.
- Append a `## [YYYY-MM-DD] diagram | <what changed>` entry to `log.md`.
- Commit (push if a remote is configured).
- Remind the user they can view it rendered at `localhost:4321` via the viewer.

## Tip

Render-check the mermaid before committing if you can (the viewer shows a red
error box on syntax errors). Common gotchas: node IDs with spaces (quote them),
and reserved words like `end`.
