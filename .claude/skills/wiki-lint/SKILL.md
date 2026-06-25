---
name: wiki-lint
description: Health-check the wiki. Use periodically or on request to catch contradictions between pages, stale claims superseded by newer sources, orphan pages with no inbound links, important concepts mentioned in sources but lacking a page, missing cross-references, uncited claims, dangling links, and open questions that have since been resolved. Fixes the safe issues, reports the rest, and logs the pass.
---

# wiki-lint

Audit the wiki for drift and inconsistency. Read `CLAUDE.md` for the conventions
you're checking against.

## What to check

Walk `wiki/` (and cross-reference `sources/`) for:

1. **Contradictions** — two pages asserting incompatible things. The most
   important class; surface every one.
2. **Stale claims** — a wiki claim a newer source has superseded. Check `fetched`
   dates and decision supersession chains.
3. **Orphan pages** — a wiki page with no inbound links from any other page or the
   index. Either link it in or question whether it should exist.
4. **Missing pages** — a concept/entity referenced repeatedly across sources or
   wiki pages but with no page of its own.
5. **Missing cross-references** — pages that clearly relate but don't link each
   other (check `related:` both directions).
6. **Uncited claims** — wiki assertions with no `sources:` backing. Either find the
   source or flag the claim as unsupported.
7. **Dangling links** — viewer URLs (`/wiki-...-x/`, `/<source>/`) pointing at
   pages/sources that don't exist.
8. **Resolved-but-open** — entries in `wiki/open-questions.md` that other pages
   have since answered.
9. **Index drift** — pages missing from `wiki/index.md`, or index entries for
   pages that no longer exist.
10. **Stale annotations** — `annotations/*.json` whose `quote` no longer matches
    the underlying doc (the viewer shows these as orphaned); note any unaddressed
    user comments.

## How to run it

- Let the user scope it if they want ("just the entities", "everything"); default
  to a full pass.
- **Fix the safe, unambiguous issues directly**: add a missing cross-link, correct
  a dangling URL, move a resolved question, add a missing index entry, add a
  missing `sources:` reference you can verify.
- **Don't silently resolve judgment calls**: for contradictions and stale-vs-current
  ambiguities, present the conflict and the evidence and let the user decide (or
  open an entry in `wiki/open-questions.md`).

## Report + log + commit

- Give the user a structured report: what was found, what you fixed, what needs
  their call.
- Append a `## [YYYY-MM-DD] lint | <scope>` entry to `log.md` summarizing findings
  and fixes.
- Commit the fixes (push if a remote is configured).
