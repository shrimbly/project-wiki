# {{PROJECT_NAME}} — operating manual for agents

**The full operating manual is [`CLAUDE.md`](CLAUDE.md). Read it — everything
there applies regardless of which agent you are.** This file exists so that
Codex and other agents that look for `AGENTS.md` find their way in.

## The 30-second version

This is a **project-wiki**: a three-layer, agent-maintained knowledge base.

1. **`sources/`** — faithful captures of external material (one file per source,
   `url` in frontmatter). Mostly immutable. Don't synthesize here.
2. **`wiki/`** — the synthesis layer: interlinked entity / concept / decision /
   open-question pages. This is where understanding accumulates.
3. **`CLAUDE.md`** — the schema: conventions and operations.

The `viewer/` (Astro) renders both layers with inline annotations; `log.md` is
the append-only history; `annotations/` holds user comments — **read them each
session** (`ls annotations/*.json`).

## Skills as runbooks

The operations live as skills in `.claude/skills/<name>/SKILL.md`. If your agent
can invoke Claude Code skills, call them by name (`/wiki-ingest`). If not, **open
the matching `SKILL.md` and follow it as a step-by-step runbook** — they're
written to be readable that way.

- `wiki-setup` — first-time interactive bootstrap.
- `wiki-ingest` — capture a new source, then fan out into the wiki.
- `wiki-research` — interactive, menu-driven research to deepen the wiki.
- `wiki-publish` — publish curated core concepts as Notion document(s).
- `wiki-query` — answer a question; file non-trivial answers back.
- `wiki-lint` — health-check the wiki.
- `wiki-diagram` — keep the mermaid model diagram(s) current.

## Non-negotiables

- **Pull fresh from source.** Re-fetch; don't paraphrase from memory.
- **Synthesize in `wiki/`, not `sources/`.**
- **Every wiki claim cites a source.**
- **Cross-link with viewer URLs** (`/wiki-entities-foo/`, `/notion-bar/`), not
  relative `.md` paths.
- **Log every operation** in `log.md`; **commit at natural stopping points.**

See [`CLAUDE.md`](CLAUDE.md) for the source-file and wiki-page conventions in full.
