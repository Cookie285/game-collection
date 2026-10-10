# 🎮 Game Collection

Central, Excel-free home for my physical game collection — PC · Nintendo · PlayStation · Xbox.
[CLZ Games](https://www.clz.com/games) stays the place where I scan and catalogue; this repo turns its CSV export into
browsable lists, a buy plan with priorities and series trackers, with a full history in git.

**🌐 Web app:** `https://cookie285.github.io/game-collection/` — dashboard, searchable cover grid, filterable buy plan,
series progress rings, a **Strategy** page with the rules behind every decision, a **Decisions** page for open questions, `/` for global search, and one-click searches on Geizhals (new) and rebuy / eBay / medimops (used)
for every open target. Rebuilt automatically on every push (see [Web frontend](#web-frontend)).

| View | What's in it |
|---|---|
| [Overview](views/overview.md) | counts per platform, buy-plan and series progress |
| [Gaps & buy plan](views/gaps.md) | curated targets — auto-ticked when a game shows up in CLZ |
| [Series trackers](views/series.md) | ~50 series: CoD, Battlefield, Halo, God of War, Final Fantasy, Trails, Yakuza … (💻 = only on Steam) |
| [CLZ wishlist & orders](views/wishlist.md) | everything marked *Wish List* / *On Order* in CLZ |
| [Per platform](views/platforms/) | full list per console |
| [Rules](RULES.md) | how I decide which platform / version to buy |
| [Rules & strategy](views/rules.md) | every rule from `data/rules.toml` with the targets it decides |
| [Open questions](OPEN-QUESTIONS.md) | pending decisions, things to verify, CLZ data fixes + decision log (generated from `data/decisions.toml`) |
| [Changelog](CHANGELOG.md) | what changed with every import |

## Summary

<!-- summary:start -->
_Updated 2026-10-10._

### By platform

| Platform | Owned | Ordered | Wishlist |
|---|---|---|---|
| [PC](views/platforms/pc.md) | 1 | 0 | 0 |
| [Nintendo Switch 2](views/platforms/nintendo-switch-2.md) | 41 | 0 | 0 |
| [Nintendo Switch](views/platforms/nintendo-switch.md) | 400 | 0 | 0 |
| [Wii U](views/platforms/wii-u.md) | 12 | 0 | 0 |
| [Nintendo 64](views/platforms/nintendo-64.md) | 7 | 0 | 0 |
| [Nintendo 3DS](views/platforms/nintendo-3ds.md) | 6 | 0 | 0 |
| [Nintendo DS](views/platforms/nintendo-ds.md) | 6 | 0 | 0 |
| [Game Boy Advance](views/platforms/game-boy-advance.md) | 18 | 0 | 0 |
| [Game Boy Color](views/platforms/game-boy-color.md) | 5 | 0 | 0 |
| [Game Boy](views/platforms/game-boy.md) | 7 | 0 | 0 |
| [PlayStation 5](views/platforms/playstation-5.md) | 63 | 2 | 0 |
| [PlayStation 4](views/platforms/playstation-4.md) | 51 | 0 | 0 |
| [PlayStation 3](views/platforms/playstation-3.md) | 103 | 1 | 0 |
| [PlayStation 2](views/platforms/playstation-2.md) | 5 | 0 | 0 |
| [PlayStation](views/platforms/playstation.md) | 17 | 0 | 0 |
| [PlayStation Vita](views/platforms/playstation-vita.md) | 4 | 0 | 0 |
| [PSP](views/platforms/psp.md) | 10 | 0 | 0 |
| [Xbox Series X\|S](views/platforms/xbox-series-x-s.md) | 23 | 0 | 0 |
| [Xbox One](views/platforms/xbox-one.md) | 59 | 1 | 0 |
| [Xbox 360](views/platforms/xbox-360.md) | 19 | 2 | 3 |
| [Xbox](views/platforms/xbox.md) | 3 | 0 | 2 |
| **Total** | **860** | **6** | **5** |

### Buy plan

⬜ 410 open · 🕒 3 ordered · ✅ 104 done — see [gaps.md](views/gaps.md)

### Series

| Series | Physical | 💻 Steam only |
|---|---|---|
| The Legend of Zelda | 7/7 ✅ |  |
| Super Mario | 10/10 ✅ |  |
| Mario RPGs | 5/5 ✅ |  |
| Metroid | 2/3 |  |
| Fire Emblem | 2/3 |  |
| Xenoblade | 5/6 |  |
| Kirby | 3/4 |  |
| Pokémon | 12/14 |  |
| Donkey Kong | 4/4 ✅ |  |
| Pikmin | 4/4 ✅ |  |
| Luigi's Mansion | 2/2 ✅ |  |
| Splatoon | 3/3 ✅ |  |
| Bayonetta | 3/4 |  |
| God of War | 3/11 | 1 |
| Uncharted | 5/5 ✅ |  |
| The Last of Us | 2/2 ✅ |  |
| Ratchet & Clank | 4/10 |  |
| Resistance | 2/3 |  |
| Killzone | 3/4 |  |
| inFamous | 0/4 |  |
| Marvel's Spider-Man (Insomniac) | 3/4 |  |
| Horizon | 2/3 |  |
| Ghost of … | 2/2 ✅ |  |
| Sly Cooper | 3/4 |  |
| Jak and Daxter | 3/3 ✅ |  |
| LittleBigPlanet | 2/4 |  |
| Team Ico | 0/3 |  |
| Gravity Rush | 0/2 |  |
| Death Stranding | 1/2 | 1 |
| Quantic Dream (PlayStation) | 1/3 |  |
| FromSoftware Souls | 2/7 | 1 |
| Resident Evil | 9/12 |  |
| Silent Hill | 1/11 |  |
| Metal Gear | 7/9 | 2 |
| Final Fantasy | 12/20 | 3 |
| Kingdom Hearts | 1/7 |  |
| Tales of | 6/10 | 1 |
| Trails (The Legend of Heroes) | 7/14 | 3 |
| Star Ocean | 4/6 |  |
| NieR / Drakengard | 1/5 | 2 |
| Persona | 1/5 | 1 |
| Like a Dragon (Yakuza) | 0/10 | 8 |
| Devil May Cry | 0/5 | 1 |
| Nioh | 3/3 ✅ |  |
| Ninja Gaiden (3D) | 4/4 ✅ |  |
| Assassin's Creed | 8/14 | 1 |
| Tomb Raider | 4/14 | 3 |
| Mass Effect | 3/4 | 1 |
| Dragon Age | 2/4 | 2 |
| Star Wars Jedi | 0/2 | 2 |
| Mafia | 1/4 | 1 |
| Red Dead | 1/2 | 1 |
| Grand Theft Auto | 2/6 |  |
| Senran Kagura | 0/2 |  |
| Harry Potter | 8/10 | 1 |
| Ace Combat | 1/7 |  |
| Call of Duty | 22/23 |  |
| Battlefield | 10/10 ✅ |  |
| Halo | 10/11 |  |
| Gears of War | 8/8 ✅ |  |
| Forza Motorsport | 4/4 ✅ |  |
| Forza Horizon | 6/6 ✅ |  |
| Fable | 0/4 |  |
| Titanfall | 2/2 ✅ |  |
| State of Decay | 2/3 |  |
<!-- summary:end -->

## Updating from CLZ

**1. Export from CLZ Games** as CSV — the whole collection, not a filtered view.
Required fields: **Title, Platform**. Strongly recommended: **Collection Status** (so wishlist / on-order items are
recognised), **Edition, Region, Format, Completeness, Purchase Date, Notes**. Optional: Barcode, Publisher, Developer,
Release Date, Genre, Purchase Price, Purchase Store, Added Date, Index.
English *and* German column names are recognised; comma, semicolon and tab separators all work.

**2a. From anywhere (phone / browser):** open the repo on GitHub → `imports/` → *Add file → Upload files* → drop the CSV → commit.
The **CLZ import** GitHub Action runs, updates `data/collection.csv`, regenerates all views, prepends an entry to
[CHANGELOG.md](CHANGELOG.md) (added / removed / status changes such as *Wishlist → Owned*) and moves the CSV to
`imports/archive/`. Refresh after ~1 minute.

**2b. Locally:**

```bash
python3 scripts/gamecoll.py import ~/Downloads/clz_games.csv          # full export → replaces collection
python3 scripts/gamecoll.py import partial.csv --merge                 # partial export → update/add only
python3 scripts/gamecoll.py find halo                                   # quick search
python3 scripts/gamecoll.py render                                      # re-render after editing targets/series
git add -A && git commit -m "CLZ import" && git push
```

Python 3.11+ only, no packages to install.

## Editing the plan

- **`data/targets/*.toml`** — gaps / things to buy (one file per area: `playstation.toml`, `xbox.toml`, `nintendo.toml`, add more freely):
  platform(s), priority, group, where to buy, `state` (`preordered` / `undecided` / `watching` / `skip`), `note`, `verify`.
  A target is ticked ✅ automatically once CLZ has a matching game *In Collection* on an allowed platform.
- **`data/rules.toml`** — the collecting rules as data (id, summary, rationale, precedents, per-platform strategy,
  decision path). Each rule's `match` patterns link it to targets / series entries automatically; add
  `rules = ["id"]` (or `not_rules`) on a target or series to link or unlink by hand. The web app's **Strategy** page
  shows rules, the decision path and cross-platform conflicts; `check` reports unknown rule ids and untagged targets.
- **`data/decisions.toml`** — open questions and the decision log: question, options with pros / cons, current
  recommendation, due date, the rules involved and the targets it decides (`targets = [...]` titles or `match`
  patterns). When decided: `status = "decided"`, `decided = "YYYY-MM-DD"`, `outcome = "…"`. `OPEN-QUESTIONS.md` is
  generated from it; the web app's **Decisions** page shows it, with **🤖 Ask Claude** to get a second opinion.
- Optional structured fields on a target, shown separately in the web app: `why`, `condition`, `max_price`,
  `alternatives` (text or `{ "Switch 2" = "Game-Key Card" }`), `facts = [...]` + `checked = "YYYY-MM-DD"`.
  Existing free-text notes are split into these parts automatically (decision · other versions · owned · condition ·
  facts · verify), dated facts show their age.
- **Format matrix & rules check** — for every open target the web app works out which versions exist per platform
  (from the plan, the notes — “Other versions: Switch 2 = Game-Key Card”, “No Xbox disc exists”, “owned on Steam” — and
  the collection), runs the platform rules on it and shows where the rules would buy it, flagging plans that differ.
  Add `versions = { "PlayStation 5" = "disc", "Nintendo Switch 2" = "gkc" }` (disc · cart · gkc · code · digital ·
  steam · none) to state versions explicitly, `not_rules = ["id"]` to record a deliberate exception, and
  `jrpg` / `shooter` / `msfp = true|false` to correct the engine's guesses. **Strategy → Where to buy?** runs the
  same engine on any combination you enter.
- **Console exclusives** — the Buy plan's and the Collection's *🔒 Console exclusives* filter and badge use the
  release platforms IGDB lists for each game (saved by the Covers workflow); PC, Mac, mobile and VR don't count, so
  PlayStation + PC is still a PlayStation exclusive. For owned games the console you own it on always counts (guards
  against a wrong IGDB match), and a buy-plan target's `exclusive` also corrects owned copies of the same title. Correct a target by hand with `exclusive = "playstation"` (· `xbox` · `nintendo` · `other` ·
  `multi`).
- **Xbox Play Anywhere** — `play_anywhere = true` on a target means the Xbox One / Series version includes the Windows
  PC version (one licence); `false` = checked, no Play Anywhere; missing = not checked yet. The Buy plan shows a
  *🖥️ Play Anywhere* badge and has a filter for it. It's a fact only — it doesn't change any plan (open question
  `play-anywhere`). Whether a disc converts via Disc-to-Digital goes in the note.
- **`data/series/*.toml`** — series checklists. Use `aliases` for compilations that cover an entry
  (e.g. *Modern Warfare Trilogy* covers CoD 4 / MW2 / MW3, *God of War Collection* covers GoW I + II).
  An entry whose note says "on Steam" shows as 💻 instead of ⬜.
- **`data/annotations.csv`** — per-game notes that CLZ doesn't hold (also on Steam, surplus, upgrade candidate …).
  Shown in the platform lists and kept across imports.
- Platforms: exact names (`"Xbox 360"`, `"PlayStation 5"`, `"PlayStation"` = PS1, `"Xbox"` = original Xbox,
  `"Nintendo Switch 2"`, `"Game Boy Advance"` …) or **lowercase** families: `xbox`, `xbox-modern` (One + Series),
  `playstation`, `nintendo`, `pc`, `any`.
- Editing any of these on GitHub also triggers the Action and re-renders the views.

`data/collection.csv` is generated — don't hand-edit it; change the game in CLZ and re-import.

## Reviews — what changed in the world

The buy plan depends on facts that change: release dates, new platform versions (Switch 2 cart vs Game-Key Card,
Xbox discs), rumours, store delistings, Disc-to-Digital. Whenever you give Claude (Claude Code on this repo) a new CLZ
export — or ask "what changed?" — it follows the `collection-review` playbook
([`.claude/skills/collection-review/SKILL.md`](.claude/skills/collection-review/SKILL.md)):

1. import the export (privacy check first — the repo is public; `--merge` if the export has no *Collection Status*),
2. `python3 scripts/gamecoll.py review --write` → a research agenda in `reviews/<date>.md` (dated decisions, watched /
   undecided targets, rumours, stale facts, verify flags, series to scan, platform news),
3. research each item on the web, update targets / series / decisions with sources (new games in tracked series are
   added as *suggestions* — you decide),
4. write the report (summary · changes with sources · what needs your decision) and open a PR.

Reports show on the web app's **Changelog → Reviews** tab and the latest one on the dashboard.

**Recording a decision from the phone:** on the web app, open a question → **⚖️ Record it on GitHub** → a short issue
form. The *Record decision* Action (only for issues you open) writes `status`, `decided` and `outcome` into
`data/decisions.toml`, re-renders and closes the issue. Locally: `python3 scripts/gamecoll.py decide <id> --outcome "…"`.

**Asking for advice:** Decisions page → **❓ Ask a question** → a short issue form (question in the title, area,
details). The *Record question* Action (only for issues you open) adds it to `data/decisions.toml` as an open
question marked 🙋 *waiting for an answer*. The next review (monthly, or "answer my open questions" in a Claude
session) researches it, fills in facts, options and a recommendation, replies on the issue and closes it — you still
decide with ⚖️ *Record it on GitHub*. Locally: `python3 scripts/gamecoll.py ask "…" --id <slug> --area xbox`.

**Monthly review:** a scheduled Claude routine runs the same playbook on the 1st of every month (no export needed)
and opens a PR with the report — merge it or comment on it.

## Buy-plan clean-up

**Strategy → 🧹 Clean-up** (or `python3 scripts/gamecoll.py cleanup`) lists housekeeping: targets whose notes say
"not collecting" but are still open, "watching" games whose date has passed, decided questions whose targets weren't
updated, open targets already owned elsewhere, parked "someday" suggestions, and important targets whose other
platforms are unknown. Nothing changes on its own; `cleanup --apply not-collecting` sets those to `state = "skip"`.

## Covers (IGDB)

Box art comes from [IGDB](https://www.igdb.com) — **switched off until two secrets exist**:

1. Log in at [dev.twitch.tv/console](https://dev.twitch.tv/console) → *Register Your Application* (name: anything,
   OAuth redirect: `http://localhost`, category: *Application Integration*) → copy the **Client ID**, create a
   **Client Secret**.
2. Repo → *Settings → Secrets and variables → Actions → New repository secret*: `TWITCH_CLIENT_ID` and
   `TWITCH_CLIENT_SECRET`.
3. *Actions → Covers → Run workflow* (afterwards it runs weekly and after every import).

How it stays safe: the secrets only exist inside the *Covers* Action (never in the site, the repo or a PR from a
fork); the Action stores only public IGDB image ids in `data/covers.json` (validated, so nothing can be injected);
browsers load the images straight from `images.igdb.com`, and the page's Content-Security-Policy allows images only
from there. Wrong or missing covers: `data/covers-overrides.toml`. Performance: the first run needs ~6–8 minutes
(one search per title, IGDB allows 4 requests / second), later runs only look up new titles; the site lazy-loads covers as you scroll and falls back
to the drawn cards when an image is missing.

## Checks on pull requests

The **CI** workflow runs on every PR: `gamecoll.py check`, Python unit tests (`tests/test_gamecoll.py`), the web-app
build, a JavaScript syntax check and the rules-engine tests (`tests/engine.test.js`). A red ✗ means: don't merge yet.
Locally: `python3 -m unittest discover -s tests && node tests/engine.test.js`.

## Web frontend

`site/` is a static, dependency-free web app (plain HTML/CSS/JS, no build step) published with GitHub Pages.
The **Web frontend** Action runs `scripts/gamecoll.py export` to build `site/data.json` from the same data as the
Markdown views, then deploys `site/`. It runs on every push to `main` that touches `data/`, `scripts/` or `site/`,
and after each **CLZ import** run.

One-time setup: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.

Local preview:

```bash
python3 scripts/gamecoll.py export          # writes site/data.json (git-ignored)
python3 -m http.server -d site 8000         # open http://localhost:8000
```

## Layout

```
data/collection.csv      generated from CLZ (source of truth for what I own)
data/annotations.csv     curated per-game notes (Steam, surplus …)
data/targets/*.toml      curated buy plan
data/rules.toml          curated rules / platform strategy (the "why")
data/decisions.toml      open questions + decision log (→ OPEN-QUESTIONS.md)
data/series/*.toml       curated series checklists
views/                   generated Markdown (don't edit)
imports/                 drop CLZ CSV exports here; processed ones move to imports/archive/
scripts/gamecoll.py      importer / renderer / search / JSON export / review agenda / decide
reviews/                 dated collection reviews (what changed, sources, what to decide)
tests/                   unit tests (Python) + rules-engine tests (Node), run by the CI workflow
data/covers*.{json,toml} IGDB cover ids (generated) + hand fixes
site/                    web frontend (GitHub Pages)
.github/workflows/       automatic import on upload + Pages deploy
```
