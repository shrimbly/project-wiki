---
name: wiki-ingest
description: Capture a new source into the wiki. Use whenever reference material arrives — a Notion page, a Figma file, a meeting transcript, a web page or article, a local file (PDF/markdown/doc), an image or diagram, or pasted notes. Faithfully captures it into sources/, then fans the new information out across the wiki and logs the change.
---

# wiki-ingest

Turn one piece of external material into (a) a faithful capture in `sources/` and
(b) updates across every `wiki/` page it touches. Read `CLAUDE.md` for the
source-file and wiki-page conventions; `_templates/source.md` is the capture shape.

## 1. Identify the source and pick the right fetcher

Ask the user for the material if they haven't given it. **Always pull fresh —
don't paraphrase from memory.** Route by type:

| Material | How to fetch |
| --- | --- |
| Notion URL | Notion MCP (read the page + its sub-pages). |
| Figma / FigJam URL | Figma MCP (`get_design_context` / `get_figjam` / screenshot). |
| Meeting / call | Fireflies MCP (`search` then `get_transcript` / `get_summary`), or read a provided transcript file / paste. |
| Web page / article | WebFetch (or WebSearch to locate it first). |
| Local file (PDF, md, docx-as-text, image) | Read the file. |
| Pasted text / verbal notes | Use what the user gave; `url:` becomes "pasted" or "verbal". |

If a preferred MCP isn't configured, fall back (e.g. WebFetch for a Notion link
the MCP can't reach) and note the degraded fetch in the capture.

## 2. Capture faithfully into `sources/`

- Choose a slug: `<type>-<topic>` — `notion-permissions`, `meeting-2026-05-08-kickoff`,
  `web-competitor-pricing`, `doc-prd-v2`, `figjam-flows`.
- Write `sources/<slug>.md` from `_templates/source.md`. Frontmatter: `title`,
  `url` (canonical link / path / "pasted"), `type`, `fetched: <today>`, `parent:`
  if it hangs off another source.
- Body: record claims **as the source states them**, verbatim where wording
  matters. For meetings, attribute speakers and separate decisions from
  discussion. Do **not** editorialize or resolve conflicts here.
- Fill the `## Conflicts / open questions` section with anything that contradicts
  existing sources, is ambiguous, or is missing.
- If the source has images/diagrams worth keeping, save them under
  `sources/assets/` and reference them.

## 3. Update the sources index

Add (or update) a one-line pointer in `sources/INDEX.md`, grouped sensibly with
the others. Replace the "no sources yet" placeholder if present.

## 4. Fan out into the wiki — the important part

A single source usually touches **3–10 wiki pages**. Work through it:

- **Entities** — new noun in the model? Create `wiki/entities/<name>.md` from
  `_templates/wiki-page.md`. Existing entity affected? Update it.
- **Concepts** — new cross-cutting idea → `wiki/concepts/<name>.md`. Update
  existing concept pages whose claims this source confirms, extends, or challenges.
- **Decisions** — did this source record a choice being made? Capture it as
  `wiki/decisions/<name>.md` (use `_templates/decision.md`). If it supersedes an
  earlier decision, link both ways and update the old one's status.
- **Open questions** — every conflict/ambiguity from step 2 becomes an entry in
  `wiki/open-questions.md` with a stable `#slug` anchor. If this source *answers*
  an existing open question, fold the answer into the right page and move the
  question to Resolved with a pointer.
- **Overview** — if the source shifts the big picture, update `wiki/overview.md`.

On every page you touch: **cite this source** (in `sources:` frontmatter and the
`## Sources` section), and cross-link related pages with viewer URLs
(`/wiki-entities-foo/`, `/<source-slug>/`).

## 5. Keep the index + diagram honest

- Update `wiki/index.md` if you added pages (link + one-line summary, in the right
  group).
- If you added/removed entities or changed key relationships, consider running
  `/wiki-diagram` so the model diagram stays in sync.

## 6. Log + commit

- Append a `## [YYYY-MM-DD] ingest | <source title>` entry to `log.md`
  summarizing what was captured and which wiki pages changed.
- Commit (and push if a remote is configured).

## Notes

- **Big Notion trees:** capture sub-pages as their own `sources/` files with
  `parent:` set, mirroring the hierarchy, rather than flattening everything into one.
- **Transcripts:** prioritize decisions, assignments, and disagreements over
  chronological detail. Note who owns each follow-up.
- **Re-ingesting an updated source:** edit the existing `sources/<slug>.md` in
  place (bump `fetched`), then re-fan-out, paying attention to claims that
  *changed* (those may invalidate wiki content — flag superseded material).
