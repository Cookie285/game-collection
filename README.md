# 🎮 Game Collection

Central, Excel-free home for my physical game collection — PC · Nintendo · PlayStation · Xbox.
[CLZ Games](https://www.clz.com/games) stays the place where I scan and catalogue; this repo turns its CSV export into
browsable lists, a buy plan with priorities and series trackers, with a full history in git.

**🌐 Web app:** `https://cookie285.github.io/game-collection/` — dashboard, searchable cover grid, filterable buy plan,
series progress rings, `/` for global search. Rebuilt automatically on every push (see [Web frontend](#web-frontend)).

| View | What's in it |
|---|---|
| [Overview](views/overview.md) | counts per platform, buy-plan and series progress |
| [Gaps & buy plan](views/gaps.md) | curated targets — auto-ticked when a game shows up in CLZ |
| [Series trackers](views/series.md) | ~50 series: CoD, Battlefield, Halo, God of War, Final Fantasy, Trails, Yakuza … (💻 = only on Steam) |
| [CLZ wishlist & orders](views/wishlist.md) | everything marked *Wish List* / *On Order* in CLZ |
| [Per platform](views/platforms/) | full list per console |
| [Rules](RULES.md) | how I decide which platform / version to buy |
| [Open questions](OPEN-QUESTIONS.md) | pending decisions, things to verify, CLZ data fixes |
| [Changelog](CHANGELOG.md) | what changed with every import |

## Summary

<!-- summary:start -->
_Updated 2026-09-25._

### By platform

| Platform | Owned | Ordered | Wishlist |
|---|---|---|---|
| [PC](views/platforms/pc.md) | 1 | 0 | 0 |
| [Nintendo Switch 2](views/platforms/nintendo-switch-2.md) | 39 | 0 | 0 |
| [Nintendo Switch](views/platforms/nintendo-switch.md) | 400 | 0 | 0 |
| [Wii U](views/platforms/wii-u.md) | 12 | 0 | 0 |
| [Nintendo 64](views/platforms/nintendo-64.md) | 7 | 0 | 0 |
| [Nintendo 3DS](views/platforms/nintendo-3ds.md) | 6 | 0 | 0 |
| [Nintendo DS](views/platforms/nintendo-ds.md) | 6 | 0 | 0 |
| [Game Boy Advance](views/platforms/game-boy-advance.md) | 18 | 0 | 0 |
| [Game Boy Color](views/platforms/game-boy-color.md) | 5 | 0 | 0 |
| [Game Boy](views/platforms/game-boy.md) | 7 | 0 | 0 |
| [PlayStation 5](views/platforms/playstation-5.md) | 62 | 1 | 0 |
| [PlayStation 4](views/platforms/playstation-4.md) | 49 | 0 | 0 |
| [PlayStation 3](views/platforms/playstation-3.md) | 103 | 0 | 0 |
| [PlayStation 2](views/platforms/playstation-2.md) | 5 | 0 | 0 |
| [PlayStation](views/platforms/playstation.md) | 17 | 0 | 0 |
| [PlayStation Vita](views/platforms/playstation-vita.md) | 4 | 0 | 0 |
| [PSP](views/platforms/psp.md) | 10 | 0 | 0 |
| [Xbox Series X\|S](views/platforms/xbox-series-x-s.md) | 16 | 1 | 0 |
| [Xbox One](views/platforms/xbox-one.md) | 44 | 0 | 0 |
| [Xbox 360](views/platforms/xbox-360.md) | 13 | 0 | 3 |
| [Xbox](views/platforms/xbox.md) | 1 | 0 | 2 |
| **Total** | **825** | **2** | **5** |

### Buy plan

⬜ 405 open · 🕒 2 ordered · ✅ 72 done — see [gaps.md](views/gaps.md)

### Series

| Series | Physical | 💻 Steam only |
|---|---|---|
| God of War | 3/8 | 1 |
| Uncharted | 5/5 ✅ |  |
| The Last of Us | 2/2 ✅ |  |
| Ratchet & Clank | 4/10 |  |
| Resistance | 2/3 |  |
| Killzone | 3/4 |  |
| inFamous | 0/4 |  |
| Marvel's Spider-Man (Insomniac) | 2/3 |  |
| Horizon | 2/2 ✅ |  |
| Ghost of … | 2/2 ✅ |  |
| Sly Cooper | 3/4 |  |
| Jak and Daxter | 3/3 ✅ |  |
| LittleBigPlanet | 2/4 |  |
| Team Ico | 0/3 |  |
| Gravity Rush | 0/2 |  |
| Death Stranding | 1/2 | 1 |
| Quantic Dream (PlayStation) | 1/3 |  |
| FromSoftware Souls | 2/7 | 1 |
| Resident Evil | 9/11 |  |
| Silent Hill | 1/9 |  |
| Metal Gear | 7/9 | 2 |
| Final Fantasy | 12/19 | 3 |
| Kingdom Hearts | 1/6 |  |
| Tales of | 6/10 | 1 |
| Trails (The Legend of Heroes) | 6/13 | 3 |
| Star Ocean | 4/6 |  |
| NieR / Drakengard | 1/5 | 2 |
| Persona | 1/3 | 1 |
| Like a Dragon (Yakuza) | 0/10 | 8 |
| Devil May Cry | 0/5 | 1 |
| Nioh | 3/3 ✅ |  |
| Ninja Gaiden (3D) | 4/4 ✅ |  |
| Assassin's Creed | 8/14 | 1 |
| Tomb Raider | 4/12 | 3 |
| Mass Effect | 3/4 | 1 |
| Dragon Age | 2/4 | 2 |
| Star Wars Jedi | 0/2 | 2 |
| Mafia | 1/4 | 1 |
| Red Dead | 1/2 | 1 |
| Grand Theft Auto | 2/6 |  |
| Senran Kagura | 0/2 |  |
| Harry Potter | 8/9 | 1 |
| Call of Duty | 22/22 ✅ |  |
| Battlefield | 10/10 ✅ |  |
| Halo | 10/11 |  |
| Gears of War | 4/8 |  |
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

- **`data/targets/*.toml`** — gaps / things to buy (one file per area: `playstation.toml`, `xbox.toml`, add more freely):
  platform(s), priority, group, where to buy, `state` (`preordered` / `undecided` / `watching` / `skip`), `note`, `verify`.
  A target is ticked ✅ automatically once CLZ has a matching game *In Collection* on an allowed platform.
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
data/series/*.toml       curated series checklists
views/                   generated Markdown (don't edit)
imports/                 drop CLZ CSV exports here; processed ones move to imports/archive/
scripts/gamecoll.py      importer / renderer / search / JSON export
site/                    web frontend (GitHub Pages)
.github/workflows/       automatic import on upload + Pages deploy
```
