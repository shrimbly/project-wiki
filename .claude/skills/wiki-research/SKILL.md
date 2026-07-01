---
name: wiki-research
description: Interactive, menu-driven research to deepen the wiki. Use when the user wants to investigate core concepts, fill gaps, validate assumptions, or study external references / competitors / standards / prior art. You survey the wiki, propose a menu of concrete research options, let the user choose which to pursue, then run them and fold the findings back in. Always presents options and lets the user steer — never auto-runs a big research dump.
metadata:
  internal: true
---

# wiki-research

Deepen the wiki through research the **user steers**. The defining feature of this
skill is the menu: you propose concrete, scoped research options and the user
picks. Don't run a sprawling investigation unprompted.

## 1. Survey the wiki for gaps

Read `wiki/index.md`, `wiki/overview.md`, and `wiki/open-questions.md`. Skim the
entity/concept pages relevant to what the user mentioned. Look for:

- **Open questions** that research could resolve.
- **Thin pages** — entities/concepts asserted but under-developed.
- **Undefined terms** used across pages but never pinned down.
- **External references** the project leans on — competitors, standards, prior
  art, libraries/APIs, domain background — that we've never actually studied.
- **Unvalidated assumptions** stated as fact with no source.

## 2. Build a research menu

Turn the gaps into **3–8 concrete research options**. Each option is one
investigable question, not a vague area. For each, note:

- the question (specific and answerable),
- why it matters / what it unblocks,
- where you'd look (web search/fetch, Context7 for library/API docs, a specific
  competitor or spec, an MCP source),
- the expected output (which `sources/` capture and/or `wiki/` page it produces).

Present the full menu to the user as a numbered list in your message so they see
everything.

## 3. Let the user choose (interactive)

Use `AskUserQuestion` (multiSelect) to let the user pick which options to run.
`AskUserQuestion` allows up to 4 options per question, so:

- If you have ≤4 candidates, offer them directly.
- If you have more, put the **highest-value 3–4** in the picker and tell the user
  the rest are in your numbered list above — they can select "Other" and name any
  by number, or ask you to re-surface a different batch.

Respect the user's scoping. If they narrow or redirect, follow it. If they add a
question you didn't list, take it.

## 4. Run the selected research

For each chosen option:

- Use the right tool: **WebSearch** to find, **WebFetch** to read, **Context7**
  for current library/framework/API docs, the relevant **MCP** for domain sources.
  Pull primary sources where you can; note when something is second-hand or
  uncertain.
- **Capture vs. synthesize — keep the layers separate:**
  - If the research yields durable external material worth preserving (a
    competitor's model, a spec, a key article), write a faithful capture in
    `sources/` (`type: research` or `type: web`), with the URLs consulted in
    frontmatter.
  - Then **synthesize** into the wiki: a `wiki/references/<name>.md` page for
    external/competitive captures, or update the relevant entity/concept/decision
    page with the findings. Cite the new source(s).
- If the research **answers an open question**, fold the answer into the right
  page and move the question to Resolved in `wiki/open-questions.md` with a pointer.
- If it **raises** new questions, add them to `wiki/open-questions.md`.

## 5. Update index, log, commit

- Update `wiki/index.md` for any new pages.
- Append a `## [YYYY-MM-DD] research | <topics>` entry to `log.md` listing what was
  investigated, what was concluded, and what's still open.
- Commit (and push if a remote is configured).

## 6. Offer another round

Briefly report what you found and ask whether to run more of the menu or surface a
fresh batch. Research is iterative — keep the loop tight and user-driven.

## Guardrails

- **Distinguish evidence from inference.** Mark confident findings vs. tentative
  reads. Don't launder a guess into the wiki as fact.
- **Cite everything.** Every research-derived claim links to the source it came
  from.
- **Stay scoped.** One menu, the user's picks, then back to them. Don't snowball
  a single question into an unbounded crawl.
