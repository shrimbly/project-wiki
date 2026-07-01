---
name: new-project-wiki
description: "Start a project-wiki — an agent-maintained knowledge base that turns scattered material (documents, meeting notes, web pages, research) into a durable, cross-linked wiki the agent builds, keeps current, and can answer questions from. This skill creates a new project-wiki in its own folder next to your current project and walks you through setting it up. Use when someone wants to start a fresh wiki or knowledge base for a topic — e.g. 'start a new project wiki', 'set up a knowledge base for X', 'new wiki project'."
license: MIT
metadata:
  homepage: https://github.com/shrimbly/project-wiki
---

# new-project-wiki

## Why a project-wiki?

A **project-wiki** turns scattered, messy inputs — documents, meeting transcripts,
web pages, design files, pasted notes — into a durable, cross-linked knowledge base
that an agent builds and keeps current. Every source is captured faithfully, then
synthesized into interlinked pages — the key entities, concepts, decisions, and open
questions — that you can browse and comment on in a local viewer. Once it exists, you
mostly just ask the agent questions and it stitches answers across the whole thing.
It's a good fit for designing a system, researching a domain, capturing decisions and
their rationale, or getting people up to speed on something complex.

## What this skill does

Sets up a brand-new project-wiki in its own folder next to your current project, then
runs an interactive setup: it names and configures the wiki, brands its viewer, and
optionally pulls in any starting material you already have — so you end with a
ready-to-use knowledge base.

> **Heads-up:** this downloads a copy of the public `project-wiki` starter repo into a
> new folder beside your current project and sets it up there. It only reads a public
> GitHub repo and works inside the new folder — it never changes or pushes your current
> project.

The starter repo it pulls from (point this at your own copy if you have one):

```
TEMPLATE_URL = https://github.com/shrimbly/project-wiki
```

## 1. Resolve where the new project goes

The new project is created as a **sibling of the current project**:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"   # current project root
PARENT="$(dirname "$ROOT")"                                   # sibling location
```

## 2. Name the wiki (interactive)

Ask what the wiki is about — usually the project or topic it will document
(e.g. "Billing System Redesign").

**Encourage naming it `<Project> Wiki` — with "wiki" on the end.** This folder is the
*wiki for* the project, not the project itself, so the name should keep the two
distinct (you don't want a `billing-system-redesign` wiki repo sitting next to the
actual `billing-system-redesign` project and getting confused for it). So:

- **Wiki name:** `<Project> Wiki` — e.g. "Billing System Redesign Wiki".
- **Directory slug:** kebab-case with a `-wiki` suffix — e.g. `billing-system-redesign-wiki`.
  That's the new directory name; the destination is `$PARENT/<slug>`.

If the name the user gives already ends in "wiki", don't double it up. Confirm the
final name and the full destination path before creating anything. If `$PARENT/<slug>`
already exists, stop and ask for a different name (never clone over an existing
directory).

You only need the name here — the description, audience, deliverable, and starting
material are gathered by the setup flow in step 5. Don't ask for them twice.

## 3. Clone the starter into the sibling directory

```bash
git clone "$TEMPLATE_URL" "$PARENT/<slug>"
cd "$PARENT/<slug>"
git remote rename origin upstream    # template becomes 'upstream'; no origin yet
```

Renaming `origin` → `upstream` keeps the link to the template (so improvements can
be pulled later with `git fetch upstream && git merge upstream/main`) and leaves
the new project ready for the user to wire their own `origin` when they publish.

**Sanity-check the clone looks like a fresh project-wiki** before proceeding: its
`README.md` starts with `# project-wiki`, and `wiki/` contains only `index.md`,
`overview.md`, and `open-questions.md`. If it's anything else, stop and report rather
than running setup on it.

The directory is already named `<slug>`, so there's no manual rename to do. Leave
internal branding (viewer title, the `CLAUDE.md` Project block, seed pages) to the
setup flow — don't hand-edit them here.

## 4. Run the setup flow against the new project

Execute the template's own setup runbook, but targeted at the new directory: read
`$PARENT/<slug>/.claude/skills/wiki-setup/SKILL.md` and follow it, operating on
**absolute paths** under `$PARENT/<slug>` (you are not `cd`'d into it as a Claude
Code project, so use full paths for every Read/Write/Edit).

- Reuse the project name from step 2 — don't re-ask it.
- Setup gathers the description / audience / deliverable / owner, brands the viewer
  (`viewer/src/lib/site.config.ts`), fills the `CLAUDE.md` + `AGENTS.md`
  placeholders, seeds `wiki/overview.md` etc., ingests any starting material the
  user provides, writes the first `log.md` entry, and makes the initial commit.

## 5. Report + next steps

Tell the user:
- the new project path (`$PARENT/<slug>`),
- that `upstream` points at the template (`git fetch upstream && git merge
  upstream/main` to pull template updates),
- how to publish it: `git remote add origin <url> && git push -u origin main`, or
  `gh repo create <slug> --private --source=. --push`,
- how to run the viewer: `cd viewer && npm install && npm run dev` → `http://localhost:4321/`,
- that they can keep feeding it with `/wiki-ingest` and deepen it with `/wiki-research`.

## Notes

- The template is public, so the clone needs no authentication.
- This skill lives in two places: globally (runnable from any project) and inside
  the template itself, so every forked project can fork again.
- This creates only a local repo — it does not create or push to any remote for the
  new project. Publishing is the user's call (see step 5).
