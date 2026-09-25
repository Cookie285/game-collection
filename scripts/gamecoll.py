#!/usr/bin/env python3
"""
gamecoll — tiny, dependency-free toolkit for the game-collection repo.

  python scripts/gamecoll.py import <clz_export.csv> [--merge] [--no-archive]
  python scripts/gamecoll.py import --auto        # newest CSV in imports/ (used by GitHub Action)
  python scripts/gamecoll.py render               # regenerate views/ + README summary
  python scripts/gamecoll.py find <text>          # quick search in the collection
  python scripts/gamecoll.py check                # validate data/targets/ + data/series/

Source of truth:
  data/collection.csv  <- generated from the CLZ Games CSV export (do not hand-edit, re-import instead)
  data/targets/*.toml  <- hand-curated gaps / buy plans (matched automatically against the collection)
  data/series/*.toml   <- hand-curated series checklists (CoD, Battlefield, Halo, God of War, ...)
  data/annotations.csv <- curated per-game notes (also on Steam, surplus, upgrade candidate …)

Requires Python 3.11+ (tomllib). No third-party packages.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import re
import shutil
import sys
import tomllib
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
VIEWS = ROOT / "views"
IMPORTS = ROOT / "imports"
ARCHIVE = IMPORTS / "archive"
COLLECTION = DATA / "collection.csv"
TARGETS_DIR = DATA / "targets"   # every *.toml in here is loaded (one file per source/platform)
SERIES_DIR = DATA / "series"
ANNOTATIONS = DATA / "annotations.csv"  # curated notes per game (Steam, surplus, upgrade …) – survive re-imports
CHANGELOG = ROOT / "CHANGELOG.md"
README = ROOT / "README.md"

FIELDS = [
    "title", "platform", "edition", "status", "format", "region", "completeness",
    "condition", "release_date", "publisher", "developer", "genre", "barcode",
    "purchase_date", "purchase_price", "store", "added_date", "notes", "clz_index", "source",
]

# ---------------------------------------------------------------- CLZ header mapping (EN + DE)
HEADER_ALIASES = {
    "title": ["title", "titel", "name", "game", "game title", "spiel"],
    "platform": ["platform", "plattform", "system", "console", "konsole"],
    "edition": ["edition", "ausgabe", "version"],
    "status": ["collection status", "sammlungsstatus", "status", "owner status"],
    "format": ["format", "media", "media type", "medium", "medientyp"],
    "region": ["region"],
    "completeness": ["completeness", "complete", "vollständigkeit", "vollstaendigkeit"],
    "condition": ["condition", "zustand"],
    "release_date": ["release date", "release year", "erscheinungsdatum", "erscheinungsjahr",
                     "veröffentlichungsdatum", "year", "jahr"],
    "publisher": ["publisher", "herausgeber", "verlag"],
    "developer": ["developer", "entwickler"],
    "genre": ["genre", "genres"],
    "barcode": ["barcode", "upc", "ean", "upc/ean", "strichcode"],
    "purchase_date": ["purchase date", "kaufdatum", "purchased", "gekauft am"],
    "purchase_price": ["purchase price", "kaufpreis", "price paid", "bezahlt"],
    "store": ["purchase store", "store", "kaufort", "gekauft bei", "händler", "haendler", "shop"],
    "added_date": ["added date", "date added", "hinzugefügt am", "hinzugefuegt am", "hinzugefügt"],
    "notes": ["notes", "notizen", "personal notes", "my notes", "anmerkungen", "kommentar"],
    "clz_index": ["index", "clz index", "id", "item id"],
}

STATUS_MAP = {
    "owned": ["in collection", "in sammlung", "owned", "collection", "besitze ich", "im besitz"],
    "wishlist": ["wish list", "wishlist", "wunschliste", "wanted"],
    "ordered": ["on order", "ordered", "pre-order", "preorder", "pre-ordered", "bestellt", "vorbestellt"],
    "for_sale": ["for sale", "zu verkaufen", "zum verkauf"],
    "sold": ["sold", "verkauft", "not in collection", "nicht in sammlung"],
}
STATUS_LABEL = {"owned": "Owned", "wishlist": "Wishlist", "ordered": "Ordered", "for_sale": "For sale",
                "sold": "Sold", "other": "Other"}
HAVE = {"owned", "for_sale"}  # counts as "I have it"

# ---------------------------------------------------------------- platforms
PLATFORM_CANON = [
    # (regex on lowercased raw platform, canonical name)
    (r"series\s*x|series\s*s|xbox series", "Xbox Series X|S"),
    (r"xbox\s*one", "Xbox One"),
    (r"xbox\s*360", "Xbox 360"),
    (r"^(microsoft\s+)?xbox( original)?$|^og xbox$", "Xbox"),
    (r"(playstation|ps)\s*5", "PlayStation 5"),
    (r"(playstation|ps)\s*4", "PlayStation 4"),
    (r"(playstation|ps)\s*3", "PlayStation 3"),
    (r"(playstation|ps)\s*2", "PlayStation 2"),
    (r"^(sony\s+)?(playstation|ps1|psx|ps one|psone)( 1)?$", "PlayStation"),
    (r"vita", "PlayStation Vita"),
    (r"psp|playstation portable", "PSP"),
    (r"game\s*boy\s*advance|^gba$", "Game Boy Advance"),
    (r"game\s*boy\s*colou?r|^gbc$", "Game Boy Color"),
    (r"game\s*boy|^gb$", "Game Boy"),
    (r"nintendo\s*64|^n64$", "Nintendo 64"),
    (r"super nintendo|^snes$", "Super Nintendo"),
    (r"^(nintendo entertainment system|nes)$", "NES"),
    (r"switch\s*2", "Nintendo Switch 2"),
    (r"switch", "Nintendo Switch"),
    (r"wii\s*u", "Wii U"),
    (r"^(nintendo\s+)?wii$", "Wii"),
    (r"gamecube", "GameCube"),
    (r"3ds", "Nintendo 3DS"),
    (r"^(nintendo\s+)?ds$", "Nintendo DS"),
    (r"^pc|windows|steam", "PC"),
]
PLATFORM_ORDER = [
    "PC", "Nintendo Switch 2", "Nintendo Switch", "Wii U", "Wii", "GameCube", "Nintendo 64", "Super Nintendo", "NES",
    "Nintendo 3DS", "Nintendo DS", "Game Boy Advance", "Game Boy Color", "Game Boy",
    "PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "PlayStation", "PlayStation Vita", "PSP",
    "Xbox Series X|S", "Xbox One", "Xbox 360", "Xbox",
]
FAMILIES = {
    "xbox": {"Xbox Series X|S", "Xbox One", "Xbox 360", "Xbox"},
    "xbox-modern": {"Xbox Series X|S", "Xbox One"},
    "playstation": {"PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "PlayStation",
                    "PlayStation Vita", "PSP"},
    "nintendo": {"Nintendo Switch 2", "Nintendo Switch", "Wii U", "Wii", "GameCube", "Nintendo 64", "Super Nintendo",
                 "NES", "Nintendo 3DS", "Nintendo DS", "Game Boy Advance", "Game Boy Color", "Game Boy"},
    "pc": {"PC"},
    "any": set(),  # special: every platform
}


def canon_platform(raw: str) -> str:
    s = (raw or "").strip()
    low = s.lower()
    for pat, name in PLATFORM_CANON:
        if re.search(pat, low):
            return name
    return s or "Unknown"


def family_of(platform: str) -> str:
    for fam in ("xbox", "playstation", "nintendo", "pc"):
        if platform in FAMILIES[fam]:
            return fam
    return "other"


def expand_platforms(spec: list[str] | None) -> set[str] | None:
    """Turn ['xbox', 'PlayStation 5'] into a set of canonical platforms. None = any platform."""
    if not spec:
        return None
    out: set[str] = set()
    for p in spec:
        p = p.strip()
        key = p.lower()
        if key == "any":
            return None
        if p in PLATFORM_ORDER:          # exact platform name wins ("PlayStation" = PS1, "Xbox" = original Xbox)
            out.add(p)
        elif p == key and key in FAMILIES:  # families are lowercase: xbox, playstation, nintendo, pc
            out |= FAMILIES[key]
        else:
            out.add(canon_platform(p))
    return out


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---------------------------------------------------------------- title normalisation / matching
def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[™®©]", "", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def matcher(entry: dict):
    """Build a predicate(title) from an entry with title / aliases / regex."""
    keys = {norm(entry["title"])} | {norm(a) for a in entry.get("aliases", [])}
    rx = re.compile(entry["regex"], re.I) if entry.get("regex") else None

    def match(title: str) -> bool:
        if rx:
            return bool(rx.search(title)) or bool(rx.search(norm(title)))
        return norm(title) in keys

    return match


def find_matches(entry: dict, rows: list[dict], default_platforms=None) -> list[dict]:
    plats = expand_platforms(entry.get("platforms", default_platforms))
    m = matcher(entry)
    return [r for r in rows if (plats is None or r["platform"] in plats) and m(r["title"])]


# ---------------------------------------------------------------- IO
def read_text_any(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            txt = raw.decode(enc)
            if enc == "utf-16" and "\x00" in txt:
                continue
            return txt
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1")


def sniff_reader(text: str) -> csv.DictReader:
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        first = sample.splitlines()[0] if sample else ""
        dialect = csv.excel
        if first.count(";") > first.count(","):
            class _Semi(csv.excel):
                delimiter = ";"
            dialect = _Semi
    return csv.DictReader(io.StringIO(text), dialect=dialect)


def map_headers(headers: list[str]) -> dict[str, str]:
    """canonical field -> source header"""
    lookup = {h.strip().lower(): h for h in headers if h}
    mapping: dict[str, str] = {}
    for field, aliases in HEADER_ALIASES.items():
        for a in aliases:
            if a in lookup:
                mapping[field] = lookup[a]
                break
    return mapping


def norm_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    if not s:
        return "owned"
    for key, vals in STATUS_MAP.items():
        if s in vals:
            return key
    for key, vals in STATUS_MAP.items():
        if any(v in s for v in vals):
            return key
    return "other"


def parse_clz(path: Path, source: str) -> list[dict]:
    reader = sniff_reader(read_text_any(path))
    headers = reader.fieldnames or []
    mp = map_headers(headers)
    missing = [f for f in ("title", "platform") if f not in mp]
    if missing:
        sys.exit(f"ERROR: could not find column(s) {missing} in {path.name}. Headers seen: {headers}\n"
                 f"Add them to the CLZ export field list (Title + Platform are required).")
    rows = []
    for rec in reader:
        r = {f: (rec.get(mp[f]) or "").strip() if f in mp else "" for f in FIELDS}
        if not r["title"]:
            continue
        r["platform"] = canon_platform(r["platform"])
        r["status"] = norm_status(r["status"]) if "status" in mp else "owned"
        r["source"] = source
        rows.append(r)
    unmapped = [h for h in headers if h and h not in mp.values()]
    if unmapped:
        print(f"note: ignored CLZ columns: {', '.join(unmapped)}")
    return rows


def load_collection() -> list[dict]:
    if not COLLECTION.exists():
        return []
    with COLLECTION.open(encoding="utf-8", newline="") as f:
        return [{k: (row.get(k) or "") for k in FIELDS} for row in csv.DictReader(f)]


def save_collection(rows: list[dict]) -> None:
    rows = sorted(rows, key=sort_key)
    with COLLECTION.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def sort_key(r: dict):
    p = r["platform"]
    po = PLATFORM_ORDER.index(p) if p in PLATFORM_ORDER else len(PLATFORM_ORDER)
    return (po, p, norm(r["title"]), r["edition"].lower())


def load_toml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("rb") as f:
        return tomllib.load(f)


def toml_files(d: Path) -> list[Path]:
    return sorted(d.glob("*.toml")) if d.exists() else []


def load_targets() -> list[dict]:
    out = []
    for f in toml_files(TARGETS_DIR):
        for t in load_toml(f).get("target", []):
            t.setdefault("_file", f.stem)
            out.append(t)
    return out


def load_series() -> list[dict]:
    return [s for f in toml_files(SERIES_DIR) for s in load_toml(f).get("series", [])]


def load_annotations() -> dict[tuple[str, str], str]:
    """(norm title, canonical platform) -> note ; platform '' = any platform"""
    if not ANNOTATIONS.exists():
        return {}
    out = {}
    with ANNOTATIONS.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r.get("title"):
                p = canon_platform(r["platform"]) if r.get("platform") else ""
                out[(norm(r["title"]), p)] = r.get("note", "").strip()
    return out


def note_for(r: dict, ann: dict) -> str:
    parts = [r["notes"], ann.get((norm(r["title"]), r["platform"]), ""), ann.get((norm(r["title"]), ""), "")]
    return " · ".join(p for p in parts if p)


# ---------------------------------------------------------------- import + diff
def row_key(r: dict) -> str:
    return f"{norm(r['title'])}|{r['platform']}|{norm(r['edition'])}"


def label(r: dict) -> str:
    ed = f" ({r['edition']})" if r["edition"] else ""
    return f"{r['title']}{ed} — {r['platform']}"


def diff(old: list[dict], new: list[dict]) -> dict:
    by_old = defaultdict(list)
    by_new = defaultdict(list)
    for r in old:
        by_old[row_key(r)].append(r)
    for r in new:
        by_new[row_key(r)].append(r)
    added, removed, changed = [], [], []
    for k in by_new.keys() | by_old.keys():
        o, n = by_old.get(k, []), by_new.get(k, [])
        oc = Counter(r["status"] for r in o)
        nc = Counter(r["status"] for r in n)
        if not o:
            added += n
            continue
        if not n:
            removed += o
            continue
        if oc != nc:
            # pair up status transitions
            lost = list((oc - nc).elements())
            gained = list((nc - oc).elements())
            for a, b in zip(lost, gained):
                changed.append((n[0], a, b))
            extra_new = gained[len(lost):]
            extra_old = lost[len(gained):]
            added += [dict(n[0], status=s) for s in extra_new]
            removed += [dict(o[0], status=s) for s in extra_old]
    # same game re-tagged to another platform (e.g. One -> Series X): report as a move, not add+remove
    moved = []
    for r in list(removed):
        tk = (norm(r["title"]), norm(r["edition"]))
        for a in added:
            if (norm(a["title"]), norm(a["edition"])) == tk and family_of(a["platform"]) == family_of(r["platform"]):
                moved.append((a, r["platform"]))
                added.remove(a)
                removed.remove(r)
                break
    return {"added": added, "removed": removed, "changed": changed, "moved": moved}


def write_changelog(d: dict, src_name: str, baseline: bool, totals: Counter) -> str:
    today = dt.date.today().isoformat()
    lines = [f"## {today} — CLZ import `{src_name}`", ""]
    tot = ", ".join(f"{STATUS_LABEL.get(k, k)}: {v}" for k, v in sorted(totals.items()))
    lines.append(f"Totals after import — {tot}")
    lines.append("")
    if baseline:
        lines.append("Baseline import: replaced the seed data with the full CLZ export.")
    else:
        def block(title, items):
            if not items:
                return
            lines.append(f"**{title}** ({len(items)})")
            lines.extend(items)
            lines.append("")
        block("Added", [f"- {label(r)} · {STATUS_LABEL.get(r['status'], r['status'])}"
                        for r in sorted(d["added"], key=sort_key)])
        block("Status changed", [f"- {label(r)}: {STATUS_LABEL.get(a, a)} → {STATUS_LABEL.get(b, b)}"
                                 for r, a, b in sorted(d["changed"], key=lambda x: sort_key(x[0]))])
        block("Platform changed", [f"- {label(r)} (was {old_p})"
                                   for r, old_p in sorted(d["moved"], key=lambda x: sort_key(x[0]))])
        block("Removed", [f"- {label(r)} · was {STATUS_LABEL.get(r['status'], r['status'])}"
                          for r in sorted(d["removed"], key=sort_key)])
        if not (d["added"] or d["changed"] or d["removed"] or d["moved"]):
            return "No changes — changelog not touched.\n"
    entry = "\n".join(lines).rstrip() + "\n"
    head = "# Changelog\n\nNewest first. Written automatically by `scripts/gamecoll.py import`.\n\n"
    body = CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else head
    if body.startswith(head):
        body = head + entry + "\n" + body[len(head):]
    else:
        body = head + entry + "\n" + body
    CHANGELOG.write_text(body, encoding="utf-8")
    return entry


def cmd_import(args) -> None:
    if args.auto:
        cands = sorted((p for p in IMPORTS.glob("*.csv")), key=lambda p: p.stat().st_mtime)
        if not cands:
            print("No CSV in imports/ — nothing to do.")
            return
        paths = cands  # process all, oldest first
    else:
        paths = [Path(args.csv)]
    for path in paths:
        old = load_collection()
        new = parse_clz(path, source=args.source)
        baseline = bool(old) and all(r["source"] == "seed" for r in old)
        if args.merge:
            keys = {row_key(r) for r in new}
            new = new + [r for r in old if row_key(r) not in keys]
        d = diff(old, new)
        save_collection(new)
        totals = Counter(r["status"] for r in new)
        entry = write_changelog(d, path.name, baseline, totals)
        print(entry)
        if not args.no_archive and path.resolve().parent == IMPORTS.resolve():
            ARCHIVE.mkdir(parents=True, exist_ok=True)
            dest = ARCHIVE / f"{dt.date.today().isoformat()}_{path.name}"
            shutil.move(str(path), dest)
            print(f"archived → {dest.relative_to(ROOT)}")
    render()


# ---------------------------------------------------------------- rendering
def md_table(headers: list[str], rows: list[list[str]]) -> str:
    esc = lambda s: str(s).replace("|", "\\|").replace("\n", " ")
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    out += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


GEN_NOTE = "<!-- generated by scripts/gamecoll.py — do not edit by hand -->\n"
ICON = {"done": "✅", "ordered": "🕒", "open": "⬜", "skip": "➖", "steam": "💻"}
STEAM_RX = re.compile(r"(owned )?on steam|\+ steam", re.I)


def eval_target(t: dict, rows: list[dict]) -> tuple[str, list[dict]]:
    hits = find_matches(t, rows)
    have = [r for r in hits if r["status"] in HAVE]
    if have:
        return "done", have
    ordered = [r for r in hits if r["status"] == "ordered"]
    if ordered or t.get("state") in ("preordered", "ordered"):
        return "ordered", ordered
    if t.get("state") == "skip":
        return "skip", []
    return "open", hits


def render() -> None:
    rows = load_collection()
    targets = load_targets()
    series = load_series()
    ann = load_annotations()
    VIEWS.mkdir(exist_ok=True)
    (VIEWS / "platforms").mkdir(exist_ok=True)
    for old in (VIEWS / "platforms").glob("*.md"):
        old.unlink()

    today = dt.date.today().isoformat()
    by_plat = defaultdict(list)
    for r in rows:
        by_plat[r["platform"]].append(r)
    plats = sorted(by_plat, key=lambda p: (PLATFORM_ORDER.index(p) if p in PLATFORM_ORDER else 99, p))

    # --- per-platform lists
    for p in plats:
        rs = sorted(by_plat[p], key=sort_key)
        parts = [GEN_NOTE, f"# {p}\n"]
        for st in ("owned", "for_sale", "ordered", "wishlist", "sold", "other"):
            sub = [r for r in rs if r["status"] == st]
            if not sub:
                continue
            parts.append(f"## {STATUS_LABEL[st]} ({len(sub)})\n")
            parts.append(md_table(
                ["Title", "Edition", "Format", "Region", "Completeness", "Purchased", "Notes"],
                [[r["title"], r["edition"], r["format"], r["region"], r["completeness"],
                  r["purchase_date"], note_for(r, ann)] for r in sub]))
            parts.append("")
        (VIEWS / "platforms" / f"{slug(p)}.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    # --- targets / gaps
    tstate = [(t, *eval_target(t, rows)) for t in targets]
    rows_by_title = defaultdict(list)
    for r in rows:
        rows_by_title[norm(r["title"])].append(r)
    prio_order = {"high": 0, "medium": 1, "low": 2, "someday": 3}
    pkey = lambda x: (prio_order.get(x[0].get("priority", "medium"), 9), x[0].get("group", ""), norm(x[0]["title"]))

    def trow(t, hits, st, with_group=True):
        plats_s = ", ".join(t.get("platforms", [])) or "any"
        got = "; ".join(sorted({h["platform"] for h in hits})) if st == "done" else ""
        state = t.get("state", "") if st == "open" else ""
        r = [t["title"], plats_s, t.get("priority", "medium")]
        if with_group:
            r.append(t.get("group", ""))
        note = got or t.get("note", "")
        if st != "done":
            elsewhere = sorted({r["platform"] for r in rows_by_title.get(norm(t["title"]), []) if r["status"] in HAVE})
            if elsewhere:
                note = f"📀 owned on {', '.join(elsewhere)}" + (f" · {note}" if note else "")
        if t.get("verify") and st != "done":
            note = f"❓ {t['verify']}" + (f" · {note}" if note else "")
        return r + [state, t.get("plan", ""), note]

    H = ["Title", "Platform", "Prio", "Group", "State", "Plan / where", "Owned on / note"]
    Hg = [h for h in H if h != "Group"]
    parts = [GEN_NOTE, "# Gaps & buy plan\n",
             "Curated in [`data/targets/`](../data/targets/). A target flips to ✅ automatically "
             "as soon as a matching game shows up as *In Collection* in a CLZ import.\n",
             "Legend: ⬜ open · 🕒 ordered / pre-ordered · ✅ done · ➖ skipped\n"]
    counts = Counter(st for _, st, _ in tstate)
    parts.append(" · ".join(f"{ICON[k]} {counts[k]} {k}" for k in ("open", "ordered", "done", "skip")) + "\n")
    parts.append("📀 = same title already owned on another platform (one copy per game!)\n")
    open_ = sorted([(t, h) for t, s, h in tstate if s == "open"], key=pkey)
    focus = [(t, h) for t, h in open_ if t.get("state") in ("undecided", "watching")
             and t.get("priority", "medium") in ("high", "medium")]
    high = [(t, h) for t, h in open_ if t.get("priority") == "high" and t.get("state") not in ("undecided", "watching")]
    if focus:
        parts.append(f"## 🤔 Decide / watch ({len(focus)})\n")
        parts.append(md_table(H, [trow(t, h, "open") for t, h in focus]) + "\n")
    if high:
        parts.append(f"## 🎯 High priority ({len(high)})\n")
        parts.append(md_table(H, [trow(t, h, "open") for t, h in high]) + "\n")
    parts.append(f"## ⬜ Open by group ({len(open_)})\n")
    groups = defaultdict(list)
    for t, h in open_:
        groups[t.get("group", "") or "Other"].append((t, h))
    for g in sorted(groups):
        parts.append(f"### {g} ({len(groups[g])})\n")
        parts.append(md_table(Hg, [trow(t, h, "open", False) for t, h in groups[g]]) + "\n")
    for st, title in (("ordered", "Ordered / pre-ordered"), ("done", "Done"), ("skip", "Skipped")):
        sub = sorted([(t, h) for t, s, h in tstate if s == st], key=pkey)
        if not sub:
            continue
        tbl = md_table(H, [trow(t, h, st) for t, h in sub])
        if st == "ordered":
            parts.append(f"## {ICON[st]} {title} ({len(sub)})\n\n{tbl}\n")
        else:
            parts.append(f"## {ICON[st]} {title} ({len(sub)})\n\n<details><summary>show</summary>\n\n{tbl}\n\n</details>\n")
    (VIEWS / "gaps.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    # --- series
    parts = [GEN_NOTE, "# Series trackers\n",
             "Curated in [`data/series/`](../data/series/). ✅ owned · 🕒 ordered · ⬜ missing · "
             "💻 only on Steam · ➖ not needed (optional / covered elsewhere / no disc)\n"]
    series_summary = []
    for s in series:
        res = series_results(s, rows)
        need = [x for x in res if not x[0].get("optional")]
        have = sum(1 for x in need if x[1] == "done")
        steam = sum(1 for x in need if x[1] == "steam")
        series_summary.append((s["name"], have, len(need), steam))
        st_s = f" (+{steam} 💻 Steam)" if steam else ""
        parts.append(f"## {s['name']} — {have}/{len(need)}{st_s}\n")
        if s.get("description"):
            parts.append(s["description"] + "\n")
        tbl = []
        for e, st, hits in res:
            where = ", ".join(sorted({f"{h['platform']}" + (f" ({h['edition']})" if h['edition'] else "")
                                      for h in hits})) if st in ("done", "ordered") else ""
            note = where or e.get("note", "")
            if e.get("verify") and st != "done":
                note = f"❓ {e['verify']}" + (f" · {note}" if note else "")
            tbl.append([ICON[st], e["title"], e.get("year", ""), note])
        parts.append(md_table(["", "Title", "Year", "Owned on / note"], tbl))
        parts.append("")
    (VIEWS / "series.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    # --- wishlist (from CLZ) + preorders
    wl = sorted([r for r in rows if r["status"] in ("wishlist", "ordered")], key=sort_key)
    parts = [GEN_NOTE, "# CLZ wishlist & orders\n",
             "Straight from the CLZ export (status *Wish List* / *On Order*). "
             "The curated plan with priorities lives in [gaps.md](gaps.md).\n"]
    if wl:
        parts.append(md_table(["Status", "Title", "Platform", "Edition", "Notes"],
                              [[STATUS_LABEL[r["status"]], r["title"], r["platform"], r["edition"], r["notes"]]
                               for r in wl]))
    else:
        parts.append("_Nothing on the CLZ wishlist yet._")
    (VIEWS / "wishlist.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    # --- overview + README summary
    counts = {p: Counter(r["status"] for r in by_plat[p]) for p in plats}
    tbl = [[f"[{p}](platforms/{slug(p)}.md)", counts[p]["owned"] + counts[p]["for_sale"], counts[p]["ordered"],
            counts[p]["wishlist"]] for p in plats]
    tot = Counter(r["status"] for r in rows)
    tbl.append(["**Total**", f"**{tot['owned'] + tot['for_sale']}**", f"**{tot['ordered']}**",
                f"**{tot['wishlist']}**"])
    open_t = sum(1 for _, s, _ in tstate if s == "open")
    ord_t = sum(1 for _, s, _ in tstate if s == "ordered")
    done_t = sum(1 for _, s, _ in tstate if s == "done")
    seed = rows and all(r["source"] == "seed" for r in rows)
    ov = [GEN_NOTE, "# Overview\n", f"_Updated {today}._\n"]
    if seed:
        ov.append("> ⚠️ Seed data (reconstructed from chat notes). Import a full CLZ export to replace it.\n")
    ov += ["## By platform\n", md_table(["Platform", "Owned", "Ordered", "Wishlist"], tbl), "",
           "## Buy plan\n", f"⬜ {open_t} open · 🕒 {ord_t} ordered · ✅ {done_t} done — see [gaps.md](gaps.md)\n",
           "## Series\n",
           md_table(["Series", "Physical", "💻 Steam only"],
                    [[n, f"{h}/{t}" + (" ✅" if h == t and t else ""), st or ""] for n, h, t, st in series_summary]),
           ""]
    (VIEWS / "overview.md").write_text("\n".join(ov) + "\n", encoding="utf-8")

    readme_block = "\n".join(ov[2:]).replace("## ", "### ").replace("# Overview\n", "").replace("](platforms/", "](views/platforms/") \
        .replace("](gaps.md)", "](views/gaps.md)")
    if README.exists():
        txt = README.read_text(encoding="utf-8")
        a, b = "<!-- summary:start -->", "<!-- summary:end -->"
        if a in txt and b in txt:
            pre, rest = txt.split(a, 1)
            _, post = rest.split(b, 1)
            README.write_text(pre + a + "\n" + readme_block.strip() + "\n" + b + post, encoding="utf-8")
    print(f"rendered views for {len(rows)} rows, {len(targets)} targets, {len(series)} series")


# ---------------------------------------------------------------- JSON export (web frontend)
def series_results(s: dict, rows: list[dict]) -> list[tuple[dict, str, list[dict]]]:
    res = []
    for e in s.get("entry", []):
        e2 = dict(e)
        e2.setdefault("platforms", s.get("platforms"))
        st, hits = eval_target(e2, rows)
        if e.get("optional") and st == "open":
            st = "skip"
        elif st == "open" and STEAM_RX.search(e.get("note", "")):
            st = "steam"
        res.append((e, st, hits))
    return res


def cmd_export(args) -> None:
    """Write everything the web frontend needs into one JSON file (default: site/data.json)."""
    import json
    rows = load_collection()
    ann = load_annotations()
    have_by_title = defaultdict(set)
    for r in rows:
        if r["status"] in HAVE:
            have_by_title[norm(r["title"])].add(r["platform"])
    hit = lambda h: {"title": h["title"], "platform": h["platform"], "edition": h["edition"], "status": h["status"]}
    games = [{**{k: r[k] for k in FIELDS if r[k] and k != "source"}, "note": note_for(r, ann),
              "family": family_of(r["platform"])} for r in sorted(rows, key=sort_key)]
    targets = []
    for t in load_targets():
        st, hits = eval_target(t, rows)
        targets.append({
            "title": t["title"], "platforms": t.get("platforms", []), "priority": t.get("priority", "medium"),
            "group": t.get("group", ""), "state": t.get("state", ""), "plan": t.get("plan", ""),
            "note": t.get("note", ""), "verify": t.get("verify", ""), "file": t["_file"], "status": st,
            "hits": [hit(h) for h in hits],
            "elsewhere": sorted(have_by_title.get(norm(t["title"]), set()) - {h["platform"] for h in hits}),
        })
    series = []
    for s in load_series():
        series.append({
            "name": s["name"], "description": s.get("description", ""), "platforms": s.get("platforms", []),
            "entries": [{"title": e["title"], "year": e.get("year", ""), "note": e.get("note", ""),
                         "verify": e.get("verify", ""), "optional": bool(e.get("optional")), "status": st,
                         "hits": [hit(h) for h in hits]} for e, st, hits in series_results(s, rows)],
        })
    plats = sorted({r["platform"] for r in rows},
                   key=lambda p: (PLATFORM_ORDER.index(p) if p in PLATFORM_ORDER else 99, p))
    out = {
        "updated": dt.date.today().isoformat(),
        "platforms": [{"name": p, "family": family_of(p), "slug": slug(p)} for p in plats],
        "games": games, "targets": targets, "series": series,
        "changelog": CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else "",
    }
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"exported {len(games)} games, {len(targets)} targets, {len(series)} series → {dest}")


# ---------------------------------------------------------------- misc commands
def cmd_find(args) -> None:
    q = norm(" ".join(args.text))
    hits = [r for r in load_collection() if q in norm(r["title"]) or q in norm(r["edition"])]
    for r in sorted(hits, key=sort_key):
        print(f"{STATUS_LABEL.get(r['status'], r['status']):9} {label(r)}")
    if not hits:
        print("no match")
    for t in load_targets():
        if q in norm(t["title"]):
            st, _ = eval_target(t, load_collection())
            print(f"target    {ICON[st]} {t['title']} [{', '.join(t.get('platforms', []))}] {t.get('plan', '')}")


def cmd_check(_args) -> None:
    ok = True
    known = set(PLATFORM_ORDER) | set(FAMILIES)
    for path, key in [(f, "target") for f in toml_files(TARGETS_DIR)] + [(f, "series") for f in toml_files(SERIES_DIR)]:
        try:
            d = load_toml(path)
        except tomllib.TOMLDecodeError as e:
            print(f"ERROR {path.name}: {e}")
            ok = False
            continue
        items = d.get(key, [])
        if key == "series":
            items = [e for s in items for e in s.get("entry", [])]
        if key == "series":
            plats_lists = [s.get("platforms", []) for s in d.get("series", [])] + [e.get("platforms", []) for e in items]
        else:
            plats_lists = [it.get("platforms", []) for it in items]
        for pl in plats_lists:
            for p in pl:
                if p.lower() not in known and canon_platform(p) not in known:
                    print(f"WARN {path.name}: unknown platform {p!r}")
        for it in items:
            if "title" not in it:
                print(f"ERROR {path.name}: entry without title: {it}")
                ok = False
            if it.get("regex"):
                try:
                    re.compile(it["regex"])
                except re.error as e:
                    print(f"ERROR {path.name}: bad regex in {it['title']}: {e}")
                    ok = False
        print(f"{path.parent.name}/{path.name}: {len(items)} entries")
    sys.exit(0 if ok else 1)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("import", help="import a CLZ Games CSV export")
    p.add_argument("csv", nargs="?")
    p.add_argument("--auto", action="store_true", help="process CSV files dropped into imports/")
    p.add_argument("--merge", action="store_true",
                   help="partial export: update/add rows but keep games that are not in the file")
    p.add_argument("--no-archive", action="store_true")
    p.add_argument("--source", default="clz", help="label stored in the source column (default: clz)")
    p.set_defaults(fn=cmd_import)
    sub.add_parser("render").set_defaults(fn=lambda a: render())
    p = sub.add_parser("find")
    p.add_argument("text", nargs="+")
    p.set_defaults(fn=cmd_find)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    p = sub.add_parser("export", help="write site/data.json for the web frontend")
    p.add_argument("out", nargs="?", default=str(ROOT / "site" / "data.json"))
    p.set_defaults(fn=cmd_export)
    args = ap.parse_args()
    if args.cmd == "import" and not (args.auto or args.csv):
        ap.error("import needs a CSV path or --auto")
    args.fn(args)


if __name__ == "__main__":
    main()
