---
name: collection-review
description: Import a new CLZ Games export and run a full collection review — re-check release dates, new platform versions (Switch 2 cart vs Game-Key Card, Xbox/PS5 discs), rumours, store/BC status, Disc-to-Digital, new series entries — then update targets, series and decisions and write a dated review report. Use whenever the user uploads or mentions a new CLZ export, or asks to "check what changed" / "review the collection".
---

# Collection review

The user collects physical games under the rules in `data/rules.toml` (long form: `RULES.md`). The buy plan
(`data/targets/*.toml`), series trackers (`data/series/*.toml`) and open questions (`data/decisions.toml`) were
researched once; the world moves on. A review brings them up to date. **Do every step; report honestly what was and
wasn't checked.**

## 1. Import the export (if one was provided)

1. Look at the CSV header first. The repo is **public** — if it contains purchase price, store, purchase date or
   personal notes, ask before committing those columns (or drop them).
2. `Collection Status` column present → full import: `python3 scripts/gamecoll.py import <file>`.
   Missing → the export only holds owned games: use `--merge` (a full import would delete wishlist / on-order rows)
   and tell the user to add *Collection Status* to the CLZ export fields next time.
3. Do a dry run in a scratch copy first if the diff could be large; read the changelog entry it prints — unexpected
   removals mean a partial export.
4. Tidy the changelog heading (upload file names get random prefixes). Don't commit the raw CSV.

## 2. Build the agenda

`python3 scripts/gamecoll.py review --write` → creates `reviews/<today>.md` with the checklist:
dated decisions, watching / pre-ordered / undecided targets, rumours and "later / no date" notes, research
questions, stale dated facts, verify flags, high-priority targets with unknown other platforms, all series, and
platform-level news. Also look at what the import changed (newly owned games tick targets and series; check
`views/gaps.md` "Done" and whether any open target is now owned elsewhere).

## 3. Research

Use WebSearch / WebFetch. Prefer publisher / platform-holder pages and established outlets (Nintendo Life,
Push Square, Pure Xbox, Eurogamer, VGC, IGN, GamesRadar, Gematsu); for Game-Key Card vs full cart check
Nintendo Life / retailer listings; for Xbox store status and backward compatibility check the Xbox store / BC list.
Work the agenda top to bottom; **questions the user asked come first** (see below). At minimum cover every **dated decision**, every **watching / pre-ordered / undecided
high-priority target**, every **rumour**, the **research questions** and **platform-level news**. **Delistings:** check announced store delistings and server shutdowns — [delistedgames.com](https://delistedgames.com/)
(Watch List + news, may be blocked for web fetch → use search results), Push Square's monthly "will be delisted or
disabled" list, Pure Xbox's Xbox delisting round-ups. Match them against the agenda's *Delisting watch* (targets
planned as digital / store buys: a delisting means buy before the date or switch to disc → add a dated decision),
against open disc targets and owned games (digital version gone → note "disc is the only way now"), and against
online-only targets (server shutdown → the disc stops working; note it). **Xbox Play Anywhere:** for open targets
whose game has an Xbox One / Series version and no `play_anywhere` yet (Buy plan filter *Play Anywhere not checked*),
check a batch (Xbox store page / Pure Xbox / Windows Central) and set `play_anywhere = true|false` plus a dated note
fact; note Disc-to-Digital too if an Xbox disc exists (publisher opted in?). Re-check `false` for new or updated games —
publishers add it later (Hogwarts Legacy 2025, Fallout 4 2025). Facts only: never change a plan for it unless the
user decided `play-anywhere`. Scan the series
for newly announced entries (quick search per franchise; batch obvious ones). Note the date and URL of every fact.

### Questions the user asked

Asked via the web app's **❓ Ask a question** button (issue form `ask.yml` → *Record question* Action →
`gamecoll.py ask`), or in chat ("add this as a question": run `python3 scripts/gamecoll.py ask "<question>" --id <slug>
--area <area> --context "<what they said>"`). They are open `[[decision]]` entries with `asked` (and `issue`) and no
`recommendation`. For each: research it like any agenda item, then fill `context` (facts with dates + sources),
`[[decision.option]]`s with pros / cons, `targets` (existing buy-plan titles it affects; add missing ones as
suggestions) and `recommendation`. Reply on the issue with a short answer + link to the Decisions page and close the
issue — the decision itself stays open until the user decides (⚖️ Record a decision form).

## 4. Update the data (never decide for the user)

- **Targets** (`data/targets/*.toml`): update `note` (append "· <fact> (checked YYYY-MM-DD)"), `plan`, `state`
  (`watching` → `preordered` only if the user said so), `platforms` when a new platform is relevant, and
  `versions = { "Xbox Series X|S" = "disc", "Nintendo Switch 2" = "gkc" }` for confirmed formats
  (disc · cart · gkc · code · digital · steam · none). Keep existing text; never delete the user's reasoning.
- **New games** announced that fit the rules (new entry in a tracked series, Microsoft first-party disc, JRPG with a
  real Switch cart, …): add a target with `state = "watching"` (not released yet) or `"undecided"` (platform choice open) and a note
  starting "Suggested (review YYYY-MM-DD):".
  Add new series entries to the tracker.
- **Decisions** (`data/decisions.toml`): update `context`, `due`, options (pros / cons) and `recommendation` with the
  new facts; add new questions a finding raises. Only set `status = "decided"` when the user decided.
- **Rules** (`data/rules.toml`): don't change rules; if a finding challenges one, add a decision question instead.
- Edit TOML with `gamecoll.edit_entry()` / `append_entry()` (keeps comments and layout, refuses to write broken
  TOML) rather than rewriting files. Never state a format (disc, cart) that you haven't found a source for.
- Then `python3 scripts/gamecoll.py check` (must pass) and `python3 scripts/gamecoll.py render`.

## 5. Report

Fill in `reviews/<today>.md`: **Summary** (the few things that matter), **Changes made** (table: item · change ·
source), **Needs your decision** (with the options and your recommendation), **Sources**, and tick the agenda items
that were checked (leave unchecked what wasn't — say so in the summary). The web app shows reviews on the Changelog
page.

## 6. Ship

Commit on the working branch (one commit for the import, one for the review is nice), push, open a PR, and give the
user a short summary: what changed in their collection, what changed in the world, what they need to decide.
