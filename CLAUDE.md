# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Goals

A character builder for JUGGS (Jon's Universal Genre Gaming System), a classless, narrative-forward TTRPG written
by the user. It follows the same pattern as the user's Pathfinder builder (`C:\Users\jongo\Projects\pf1e-builder`):
rules data in plain JSON, and a static web app that builds characters from it.

- The user wrote these rules. When something in `source/` is unclear or two documents disagree, **ask the user;
  never guess.** Record every answer in `docs/DECISIONS.md` — that file overrides the source documents.
- The user is new to coding. Keep the app plain HTML/CSS/JavaScript with ES modules: no framework, no build
  step, no npm dependencies. Explain any new tool before asking them to install it.

## File layout

- `source/` — the user's rules documents (Word, HTML, PDF). Read-only; never edit.
  `source/JUGGS_Player_Book.docx` is the primary source (see `docs/DECISIONS.md`).
- `docs/DECISIONS.md` — the author's rulings on conflicts and open questions. Read it before changing rules.
- `data/*.json` — the rules data. Drafted once by `scripts/draft_data.py`, then **edited directly** (unlike the
  Pathfinder builder, the data is not regenerated). Every record has an `id`; open issues are listed in a
  record's `flags`.
- `scripts/` — `docx_reader.py` (reads .docx without extra libraries), `draft_data.py` (the one-time draft),
  `validate.py` (checks the data).

## Commands

With the environment variable `PYTHONUTF8=1` set (Windows would otherwise write non-ASCII text wrongly):

```
python scripts/validate.py data                 # check the data after any edit
python scripts/draft_data.py source drafts      # re-draft into a scratch folder to compare (never over data/)
```

- Needs Python 3.9+ with `beautifulsoup4`.
- `data/_report.md` is the first draft's report: record counts and every flag. Flags live on in the records
  themselves; `validate.py` prints how many are still open.
- `draft_data.py` refuses to write into an existing `data/` folder; draft to a scratch folder and compare by hand.

## Key rules

- IDs are namespaced by file, so names that repeat across kinds (Duelist is an Aptitude and a Specialty;
  Skirmisher, Shaper, Empath and Infiltrator are Roles and Specialties) never collide.
- Ability Score ids: `str tou agi int wil acu bel mor ser`. Domains: `body mind spirit`. Pools: `stamina mana
  resolve`.
- Hand-entered facts missing from the sources go in the override dicts at the top of `draft_data.py`, and after
  the draft, directly in the JSON.
- Commit only when the user asks.
