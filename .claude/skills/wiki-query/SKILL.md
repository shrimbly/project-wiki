---
name: wiki-query
description: Answer a substantive question using the wiki, with citations, and file non-trivial answers back. Use when the user asks a real question about the project's content ("what happens when…", "which decisions touch…", "how does X relate to Y") rather than asking you to ingest or research. Reads the wiki first, falls back to sources, and turns analysis worth keeping into a new or updated page.
metadata:
  internal: true
---

# wiki-query

Answer from the wiki — and capture the answer if it's worth keeping.

## 1. Find the relevant pages

- Read `wiki/index.md` first to locate the pages the question touches, then drill
  into them. Follow cross-links.
- Check `wiki/open-questions.md` — the question may already be tracked as open.

## 2. Answer

- If the wiki holds the answer, give it and **cite the page(s)** (by name and
  viewer URL, e.g. `/wiki-concepts-foo/`).
- If the wiki is silent or thin, fall back to the `sources/` captures and
  synthesize — but say that you're reasoning from sources, and flag uncertainty.
- If the answer genuinely isn't in the material, say so plainly rather than
  inventing it. Offer to `/wiki-research` it.

## 3. File non-trivial answers back

If the answer is more than a lookup — a comparison, a connection across pages, an
analysis, a resolved ambiguity — it's wiki-worthy:

- Add a new `wiki/concepts/<name>.md` (or the right type), or update an existing
  page, with the synthesis. Cite the pages/sources it draws on.
- If the question exposed a real gap or contradiction, add it to
  `wiki/open-questions.md`.
- If it resolved an existing open question, fold it in and mark that question
  Resolved with a pointer.
- Update `wiki/index.md` if you added a page.

## 4. Log + commit (only if the wiki changed)

- If you wrote anything back, append a `## [YYYY-MM-DD] query | <topic>` entry to
  `log.md` and commit (push if a remote is configured).
- A pure lookup that changed nothing needs no log entry.

## Guardrail

Don't let "file it back" bloat the wiki. A one-off factual lookup stays in the
conversation; only durable synthesis earns a page.
