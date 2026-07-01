---
name: new-project-wiki
description: Fork the project-wiki knowledge-base template into a NEW sibling project and run its setup. Use when the user wants to start a fresh agent-maintained wiki / knowledge base for a new topic — "spin up a new project wiki", "fork the project wiki for X", "start a new knowledge base", "new wiki project". Clones the pure template into a sibling directory of the current project, rewires git, and runs the interactive wiki-setup flow.
---

# new-project-wiki

Start a brand-new [project-wiki](https://github.com/shrimbly/project-wiki) by
forking the canonical template into a **sibling directory** of wherever you're
working, then running its setup flow. Works from any project (this skill is
installed globally).

**Template (canonical, pure):** `https://github.com/shrimbly/project-wiki`
— a three-layer, agent-maintained knowledge base (faithful `sources/` → AI
synthesis `wiki/` → schema `CLAUDE.md`), with a local Astro viewer and its own
`wiki-*` skills. To fork a different template, change `TEMPLATE_URL` below.

```
TEMPLATE_URL = https://github.com/shrimbly/project-wiki
```

## 1. Resolve where the new project goes

The new project is created as a **sibling of the current project**:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"   # current project root
PARENT="$(dirname "$ROOT")"                                   # sibling location
```

## 2. Get the new project's name (interactive)

Ask the user for the project name (e.g. "Billing System Redesign"). Derive a
filesystem-safe **slug** (kebab-case, lowercase — e.g. `billing-system-redesign`);
that's the new directory name. The destination is `$PARENT/<slug>`.

Confirm the full destination path with the user before creating anything. If
`$PARENT/<slug>` already exists, stop and ask for a different name (never clone
over an existing directory).

You only need the name here — the description, audience, deliverable, and starting
material are gathered by the setup flow in step 5. Don't ask for them twice.

## 3. Fork the template into the sibling directory

```bash
git clone "$TEMPLATE_URL" "$PARENT/<slug>"
cd "$PARENT/<slug>"
git remote rename origin upstream    # template becomes 'upstream'; no origin yet
```

Renaming `origin` → `upstream` keeps the link to the template (so improvements can
be pulled later with `git fetch upstream && git merge upstream/main`) and leaves
the new project ready for the user to wire their own `origin` when they publish.

**Sanity-check the clone is the pure template** before proceeding: `README.md`
starts with `# project-wiki`, and `wiki/` contains only `index.md`, `overview.md`,
`open-questions.md`. If it's anything else, stop and report — do not run setup on a
non-pure clone.

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
