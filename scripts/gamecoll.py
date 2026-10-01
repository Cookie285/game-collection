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
COVERS = DATA / "covers.json"                    # IGDB cover ids (public), written by `covers`
COVER_OVERRIDES = DATA / "covers-overrides.toml"  # hand fixes for wrong / missing covers
TARGETS_DIR = DATA / "targets"   # every *.toml in here is loaded (one file per source/platform)
SERIES_DIR = DATA / "series"
RULES = DATA / "rules.toml"      # collecting rules as data: ids, rationale, auto-tagging patterns
DECISIONS = DATA / "decisions.toml"  # open questions + decision log (OPEN-QUESTIONS.md is generated from it)
OPEN_QUESTIONS = ROOT / "OPEN-QUESTIONS.md"
REVIEWS = ROOT / "reviews"         # dated review reports (what changed in the world since the last check)
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
    s = re.sub(r"[™®©]", "", s or "")  # before NFKD, which would turn ™ into "TM"
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ")
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


def header_lines(path: Path, header: str) -> list[int]:
    """1-based line numbers of every `header` table line (e.g. [[target]]) — same order as tomllib's arrays."""
    return [i for i, ln in enumerate(path.read_text(encoding="utf-8").splitlines(), 1) if ln.strip() == header]


def load_targets() -> list[dict]:
    out = []
    for f in toml_files(TARGETS_DIR):
        lines = header_lines(f, "[[target]]")
        for i, t in enumerate(load_toml(f).get("target", [])):
            t.setdefault("_file", f.stem)
            t["_src"] = (f.relative_to(ROOT).as_posix(), lines[i] if i < len(lines) else 0)
            out.append(t)
    return out


def load_series() -> list[dict]:
    out = []
    for f in toml_files(SERIES_DIR):
        s_lines, e_lines = iter(header_lines(f, "[[series]]")), iter(header_lines(f, "[[series.entry]]"))
        rel = f.relative_to(ROOT).as_posix()
        for s in load_toml(f).get("series", []):
            s["_src"] = (rel, next(s_lines, 0))
            for e in s.get("entry", []):
                e["_src"] = (rel, next(e_lines, 0))
            out.append(s)
    return out


# ---------------------------------------------------------------- rules (the "why")
MATCH_FIELDS = ("title", "note", "plan", "group", "state", "verify", "platforms")


def load_rules() -> dict:
    d = load_toml(RULES)
    lines = header_lines(RULES, "[[rule]]") if RULES.exists() else []
    rules = d.get("rule", [])
    for i, r in enumerate(rules):
        r.setdefault("status", "adopted")
        r.setdefault("platform", "all")
        r["_src"] = (RULES.relative_to(ROOT).as_posix(), lines[i] if i < len(lines) else 0)
        r["_rx"] = {k: re.compile(v, re.I) for k, v in r.get("match", {}).items()}
    return {"rules": rules, "platforms": d.get("platform", []), "steps": d.get("step", [])}


def matches(item: dict, rx: dict) -> bool:
    """Does any compiled `match` pattern hit the item's field of the same name?"""
    for k, r in rx.items():
        v = item.get(k, "")
        if r.search("\n".join(v) if isinstance(v, list) else str(v or "")):
            return True
    return False


def rules_for(item: dict, rules: list[dict]) -> list[str]:
    """Rule ids for a target / series entry: automatic `match` hits + explicit `rules`, minus `not_rules`."""
    ids = [r["id"] for r in rules if matches(item, r["_rx"])]
    ids += [i for i in item.get("rules", []) if i not in ids]
    drop = set(item.get("not_rules", []))
    return [i for i in ids if i not in drop]


# ---------------------------------------------------------------- decisions (open questions + log)
DECISION_KINDS = {"decision": "Decisions", "research": "Research / verify", "clz-fix": "CLZ data fixes"}


def load_decisions() -> list[dict]:
    if not DECISIONS.exists():
        return []
    lines = header_lines(DECISIONS, "[[decision]]")
    out = load_toml(DECISIONS).get("decision", [])
    for i, d in enumerate(out):
        d.setdefault("kind", "decision")
        d.setdefault("status", "open")
        d.setdefault("area", "all")
        d["_src"] = (DECISIONS.relative_to(ROOT).as_posix(), lines[i] if i < len(lines) else 0)
        d["_rx"] = {k: re.compile(v, re.I) for k, v in d.get("match", {}).items()}
    return out


def decision_links(d: dict, targets: list[dict]) -> list[int]:
    """Indexes of the targets a decision is about: listed titles + `match` patterns."""
    keys = {norm(t) for t in d.get("targets", [])}
    return [i for i, t in enumerate(targets) if norm(t["title"]) in keys or (d["_rx"] and matches(t, d["_rx"]))]


# ---------------------------------------------------------------- note structure
NOTE_KINDS = [  # (kind, pattern on a note segment) — first match wins
    ("decision", r"^(Decision|Decide|Recommendation|suggestion)\b|\bRecommendation:"),
    ("alternatives", r"^Other versions?:|^(PS|Switch|Xbox|PC)( \d)? = |\bvs\b"),
    ("owned", r"\bown(ed)? on|Already owned|You (only )?own|Covered by|makes .* surplus|On my wish list"),
    ("verify", r"^Verify|\bverify\b|^Check\b|\bcheck (whether|if|for)|marked '\?'|\?$"),
    ("condition", r"only if|cheap|when on sale|pricey|rising prices|good price|expensive|Keep for shelf"),
    ("fact", r"D2D|Disc-to-Digital|Xbox Store:|Delisted|Backward compatible|Not backward|scope layer|PAL|NTSC|"
             r"\b(19|20)\d\d\b|Release date|release|No physical|disc exists|No Xbox disc|code-in-box|Game-Key Card|"
             r"Limited Run|exclusive|ported|remaster"),
]
NOTE_RX = [(k, re.compile(p, re.I)) for k, p in NOTE_KINDS]
DATE_RX = re.compile(r"\b(20\d\d-\d\d-\d\d)\b")


def note_parts(note: str) -> list[dict]:
    """Split a free-text note into labelled parts: decision · alternatives · owned · verify · condition · fact · reason."""
    parts = []
    for seg in (x.strip() for x in re.split(r" · ", note or "")):
        if not seg:
            continue
        # "Decision: A; B; suggestion: …" stays one part, other '; '-lists are split
        pieces = [seg] if re.match(r"(Decision|Decide)\b", seg) else [p.strip() for p in re.split(r"; ", seg)]
        for piece in pieces:
            if not piece:
                continue
            kind = next((k for k, rx in NOTE_RX if rx.search(piece)), "reason")
            part = {"kind": kind, "text": piece.rstrip(".") if piece.endswith(".") and piece.count(".") == 1 else piece}
            m = DATE_RX.search(piece)
            if m:
                part["date"] = m.group(1)
            parts.append(part)
    return parts


# ---------------------------------------------------------------- format matrix (which version exists where)
FORMATS = {"disc", "cart", "gkc", "code", "digital", "steam", "owned", "none"}
NINTENDO = FAMILIES["nintendo"]
PLAN_NAMES = {
    "PlayStation 5": r"\bPS5\b", "PlayStation 4": r"\bPS4\b", "PlayStation 3": r"\bPS3\b", "PlayStation 2": r"\bPS2\b",
    "PlayStation": r"\bPS1\b", "Nintendo Switch 2": r"Switch 2", "Nintendo Switch": r"Switch(?! 2)", "Xbox Series X|S": r"Series X|Xbox\b",
    "Xbox One": r"Xbox\b", "Xbox 360": r"360|Xbox\b", "Xbox": r"Xbox\b", "PC": r"Steam|\bPC\b",
}
JRPG_SERIES = (r"\bJRPG|turn-based RPG|Tales of|Persona|Final Fantasy|Dragon Quest|Trails|Atelier|\bYs\b|Star Ocean|"
               r"Kingdom Hearts|Xenoblade|Metaphor|Shin Megami|Ni no Kuni|Bravely|Octopath|Wild ARMs|Suikoden|Neptunia")
KEY_PLATFORM = [  # "X = …" keys used in notes → canonical platform
    (r"^switch\s*2$", "Nintendo Switch 2"), (r"^switch\s*1?$", "Nintendo Switch"), (r"^ps\s*5$|^ps$", "PlayStation 5"),
    (r"^ps\s*4$", "PlayStation 4"), (r"^xbox( series( x)?)?$", "Xbox Series X|S"), (r"^pc$", "PC"),
]


def value_format(v: str) -> str | None:
    v = v.lower()
    if re.search(r"game-key card|\bgkc\b", v):
        return "gkc"
    if re.search(r"^no\b|not released|only rumou?red|under consideration|\blater\b", v):
        return "none"
    if re.search(r"digital|download only", v):
        return "digital"
    if re.search(r"\bcart\b|physical", v):
        return "cart"
    if re.search(r"\bdisc\b", v):
        return "disc"
    return None


def derive_formats(t: dict, owned: set[str]) -> dict:
    """Which formats exist on which platform, from explicit `versions`, the plan text, notes and the collection.
    Returns {platform: [{f, src, text}]}; src = explicit · note · plan · owned · assumed."""
    F: dict[str, list] = defaultdict(list)
    note, plan = t.get("note", ""), t.get("plan", "")

    def add(p, f, src, text=""):
        if f == "none":  # a platform with nothing released: drop assumed / planned physical formats
            F[p] = [x for x in F[p] if x["src"] in ("explicit", "owned")]
        elif any(x["f"] == "none" and x["src"] in ("explicit", "note") for x in F[p]) and src in ("plan", "assumed"):
            return
        if src in ("note", "explicit") and f not in ("owned", "digital", "steam"):
            F[p] = [x for x in F[p] if x["src"] != "assumed"]  # real information replaces guesses
        if not any(x["f"] == f for x in F[p]):
            F[p].append({"f": f, "src": src, "text": text})

    planned = [p for p in (expand_platforms(t.get("platforms")) or set()) if p in PLATFORM_ORDER]
    planned = sorted(planned, key=PLATFORM_ORDER.index) if len(planned) <= 3 else []
    lp = plan.lower()
    plan_digital = re.search(r"digital|store sale|game pass|steam sale", lp)
    plan_code = "code-in-box" in lp
    # the plan text usually names one platform ("PS5 disc; used …") — it only describes that one
    named = [p for p in planned if re.search(PLAN_NAMES.get(p, "$^"), plan, re.I)]
    for p in planned:
        phys = "cart" if p in NINTENDO else "disc"
        if named and p not in named:
            add(p, phys, "assumed")
        elif plan_digital and not plan_code:
            add(p, "digital", "plan", plan)
            if p in ("Xbox 360", "Xbox"):
                add(p, "disc", "assumed")  # BC titles were released on disc
        elif plan_code:
            add(p, "code", "plan", plan)
        elif plan:
            add(p, phys, "plan", plan)
        else:
            add(p, phys, "assumed")
    xbox_planned = [p for p in planned if p in FAMILIES["xbox"]] or ["Xbox Series X|S"]
    for seg in re.split(r" · |; (?=[A-Z])", note):
        m = re.match(r"\s*(Other versions?|Decision):\s*(.*)", seg)
        if m:
            for item in re.split(r"; |, (?=(?:Switch|PS|Xbox|PC|No)\b)", m.group(2)):
                kv = re.match(r"\s*([A-Za-z]+(?: \d)?(?:/[A-Za-z]+(?: \d)?)*)\b[^=]*?=\s*(.+)", item)
                if kv:
                    for key in kv.group(1).split("/"):
                        key, val = key.strip(), kv.group(2)
                        f = value_format(val)
                        plat = next((pl for rx, pl in KEY_PLATFORM if re.match(rx, key, re.I)), None)
                        if plat == "Nintendo Switch" and re.search(r"switch 2", val, re.I):
                            plat = "Nintendo Switch 2"
                        elif plat == "Nintendo Switch" and re.search(r"switch 1", val, re.I):
                            plat = "Nintendo Switch"
                        if plat == "PlayStation 5" and re.search(r"\bps4\b", val, re.I):
                            plat = "PlayStation 4"
                        if plat and f:
                            add(plat, f, "note", item.strip())
                else:
                    for rx, plat, f in ((r"^No Switch\b", "Nintendo Switch", "none"), (r"^No Switch\b", "Nintendo Switch 2", "none"),
                                        (r"^PC later|^No PC", "PC", "none"), (r"^Switch 2\b.*(rumou?red|consideration)", "Nintendo Switch 2", "none"),
                                        (r"^Switch 1 has a cart", "Nintendo Switch", "cart")):
                        if re.search(rx, item.strip(), re.I):
                            add(plat, f, "note", item.strip())
    rules = [
        (r"owned on Steam|\bown on Steam|also on Steam", lambda: add("PC", "steam", "note", "owned on Steam")),
        (r"No Xbox disc exists", lambda: [add(p, "none", "note", "No Xbox disc exists") for p in ("Xbox Series X|S", "Xbox One")]),
        (r"PS5 disc only|a PS5 (Day One )?disc (also )?exists", lambda: add("PlayStation 5", "disc", "note", "PS5 disc exists")),
        (r"Xbox Series X disc exists", lambda: add("Xbox Series X|S", "disc", "note", "Xbox Series X disc exists")),
        (r"code-in-box", lambda: [add(p, "code", "note", "code-in-box") for p in xbox_planned]),
        (r"code-in-box \(no disc|no disc,", lambda: [add(p, "none", "note", "no disc") or add(p, "code", "note", "code-in-box") for p in xbox_planned]),
        (r"Xbox Store: Digital", lambda: [add(p, "digital", "note", "Xbox Store: Digital") for p in xbox_planned]),
        (r"No physical release", lambda: [add(p, "none", "note", "No physical release") or add(p, "digital", "note", "digital only") for p in planned]),
        (r"no Switch version|\bNo Switch\b(?! 2)", lambda: [add(p, "none", "note", "no Switch version") for p in ("Nintendo Switch", "Nintendo Switch 2")]),
        (r"Never ported to PC|No PC version", lambda: add("PC", "none", "note", "not on PC")),
    ]
    for rx, fn in rules:
        if re.search(rx, note, re.I):
            fn()
    for p in owned:
        add(p, "owned", "owned", "in the collection")
    for p, v in (t.get("versions") or {}).items():
        p = canon_platform(p)
        F[p] = [x for x in F[p] if x["src"] == "owned"]
        for f in ([v] if isinstance(v, str) else v):
            F[p].append({"f": f, "src": "explicit", "text": "versions ="})
    return {p: v for p, v in F.items() if v}


def target_flags(t: dict, rule_ids: list[str]) -> dict:
    """Facts the platform-suggestion engine needs beyond the format matrix."""
    txt = " ".join(str(t.get(k, "")) for k in ("title", "note", "group", "plan"))
    return {k: v for k, v in {
        "jrpg": t.get("jrpg", bool(re.search(JRPG_SERIES, txt))),
        "shooter": t.get("shooter", "shooter-console" in rule_ids),
        "msfp": t.get("msfp", bool({"xbox-first-party-scope", "ms-games-on-ps5-disc", "no-xbox-disc-out-of-scope"} & set(rule_ids))),
        "delisted": bool(re.search(r"[Dd]elisted|DISC ONLY|Never digital", t.get("note", ""))),
        "upgrade": bool(re.search(r"Upgrade", t.get("group", ""))),
        "bc": bool(re.search(r"360 BC|OG Xbox BC", t.get("group", ""))),
        "off": t.get("not_rules", []),  # rules switched off for this target = documented exceptions
    }.items() if v}


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

    # --- rules (why)
    if RULES.exists():
        R = load_rules()
        by_rule = defaultdict(list)
        for t, st, _ in tstate:
            for i in rules_for(t, R["rules"]):
                by_rule[i].append((t, st))
        parts = [GEN_NOTE, "# Rules & strategy\n",
                 "Curated in [`data/rules.toml`](../data/rules.toml) — long form in [RULES.md](../RULES.md). "
                 "Targets are linked to rules automatically (the rule's `match` patterns) or by `rules = [...]` "
                 "on the target.\n"]
        for p in R["platforms"]:
            parts.append(f"- **{p['name']}** — {p.get('role', '')}")
        parts.append("")
        fams = [("all", "General")] + [(p["id"], p["name"]) for p in R["platforms"]]
        for fam, fam_name in fams:
            rs = [r for r in R["rules"] if r["platform"] == fam]
            if not rs:
                continue
            parts.append(f"## {fam_name}\n")
            for r in rs:
                ts = by_rule.get(r["id"], [])
                c = Counter(st for _, st in ts)
                tag = " _(suggested, not adopted)_" if r["status"] == "suggested" else \
                    " _(retired)_" if r["status"] == "retired" else ""
                parts.append(f"### {r['short']} `{r['id']}`{tag}\n")
                parts.append(r["summary"] + "\n")
                if r.get("rationale"):
                    parts.append(f"_Why:_ {r['rationale']}\n")
                if r.get("precedents"):
                    parts.append("_Precedents:_ " + " · ".join(r["precedents"]) + "\n")
                parts.append(f"{len(ts)} targets — " + " · ".join(f"{ICON[k]} {c[k]}" for k in ("open", "ordered", "done", "skip")) + "\n")
                open_ts = sorted((t for t, st in ts if st == "open"), key=lambda t: norm(t["title"]))
                if open_ts:
                    rows_md = [[t["title"], ", ".join(t.get("platforms", [])), t.get("priority", "medium"), t.get("state", "")]
                               for t in open_ts]
                    parts.append(f"<details><summary>{len(open_ts)} open</summary>\n\n"
                                 + md_table(["Title", "Platform", "Prio", "State"], rows_md) + "\n\n</details>\n")
        (VIEWS / "rules.md").write_text("\n".join(parts) + "\n", encoding="utf-8")

    # --- open questions (generated from data/decisions.toml)
    if DECISIONS.exists():
        ds = load_decisions()
        areas = {"all": "General", "nintendo": "Nintendo", "pc": "PC", "playstation": "PlayStation", "xbox": "Xbox"}
        parts = [GEN_NOTE, "# Open questions\n",
                 "Generated from [`data/decisions.toml`](data/decisions.toml) — edit there (options, recommendation; "
                 "`status = \"decided\"` + `outcome` when decided). Also on the web app's **Decisions** page.\n"]
        for kind, kind_name in DECISION_KINDS.items():
            open_ = [d for d in ds if d["kind"] == kind and d["status"] == "open"]
            if not open_:
                continue
            parts.append(f"## {kind_name} ({len(open_)})\n")
            for area, area_name in areas.items():
                sub = sorted((d for d in open_ if d["area"] == area), key=lambda d: d.get("due") or "9999")
                if not sub:
                    continue
                if kind == "decision":
                    parts.append(f"### {area_name}\n")
                for d in sub:
                    due = f" _(due {d['due']})_" if d.get("due") else ""
                    opts = " / ".join(o["label"] for o in d.get("option", []))
                    line = f"- [ ] **{d['question']}**{due}"
                    if opts:
                        line += f" — options: {opts}"
                    if d.get("recommendation"):
                        line += f" — suggestion: {d['recommendation']}"
                    elif d.get("context") and not opts:
                        line += f" — {d['context']}"
                    parts.append(line)
                parts.append("")
        log = [d for d in ds if d["status"] in ("decided", "dropped")]
        if log:
            parts.append(f"## Decision log ({len(log)})\n")
            for d in sorted(log, key=lambda d: d.get("decided") or "", reverse=True):
                when = d.get("decided") or "earlier"
                parts.append(f"- ✅ {when} — **{d['question']}** → {d.get('outcome', d['status'])}")
            parts.append("")
        OPEN_QUESTIONS.write_text("\n".join(parts) + "\n", encoding="utf-8")

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


def repo_url() -> str:
    """https://github.com/owner/repo — from the Actions environment, else the git remote; '' if unknown."""
    import os
    import subprocess
    if os.environ.get("GITHUB_REPOSITORY"):
        return f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{os.environ['GITHUB_REPOSITORY']}"
    try:
        url = subprocess.run(["git", "-C", str(ROOT), "remote", "get-url", "origin"],
                             capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""
    m = re.search(r"github\.com[:/]([^/]+/[^/]+?)(\.git)?$", url)
    return f"https://github.com/{m.group(1)}" if m else ""


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
    covers, cover_ov = load_covers(), cover_overrides()
    games = [{**{k: r[k] for k in FIELDS if r[k] and k != "source"}, "note": note_for(r, ann),
              "family": family_of(r["platform"]), "cover": cover_for(r["title"], r["platform"], covers, cover_ov)}
             for r in sorted(rows, key=sort_key)]
    R = load_rules()
    rules = R["rules"]
    src = lambda x: {"path": x["_src"][0], "line": x["_src"][1]}
    targets = []
    raw_targets = load_targets()
    for t in raw_targets:
        st, hits = eval_target(t, rows)
        targets.append({
            "title": t["title"], "platforms": t.get("platforms", []), "priority": t.get("priority", "medium"),
            "group": t.get("group", ""), "state": t.get("state", ""), "plan": t.get("plan", ""),
            "note": t.get("note", ""), "verify": t.get("verify", ""), "file": t["_file"], "status": st,
            "hits": [hit(h) for h in hits],
            "elsewhere": sorted(have_by_title.get(norm(t["title"]), set()) - {h["platform"] for h in hits}),
            "rules": (rids := rules_for(t, rules)), "src": src(t), "parts": note_parts(t.get("note", "")),
            "cover": cover_for(t["title"], next(iter(sorted(expand_platforms(t.get("platforms")) or [], key=lambda x: PLATFORM_ORDER.index(x)
                                                               if x in PLATFORM_ORDER else 99)), ""), covers, cover_ov),
            "formats": derive_formats(t, have_by_title.get(norm(t["title"]), set())), "flags": target_flags(t, rids),
            "exclusive": exclusivity(t, covers),
            **{k: t[k] for k in ("why", "alternatives", "condition", "max_price", "facts", "checked") if k in t},
        })
    series = []
    for s in load_series():
        series.append({
            "name": s["name"], "description": s.get("description", ""), "platforms": s.get("platforms", []),
            "rules": rules_for({**s, "note": s.get("description", "")}, rules), "src": src(s),
            "entries": [{"title": e["title"], "year": e.get("year", ""), "note": e.get("note", ""),
                         "verify": e.get("verify", ""), "optional": bool(e.get("optional")), "status": st,
                         "hits": [hit(h) for h in hits], "rules": rules_for(e, rules), "src": src(e)}
                        for e, st, hits in series_results(s, rows)],
        })
    plats = sorted({r["platform"] for r in rows},
                   key=lambda p: (PLATFORM_ORDER.index(p) if p in PLATFORM_ORDER else 99, p))
    out = {
        "updated": dt.date.today().isoformat(),
        "platforms": [{"name": p, "family": family_of(p), "slug": slug(p)} for p in plats],
        "games": games, "targets": targets, "series": series,
        "rules": [{k: v for k, v in r.items() if not k.startswith("_") and k != "match"} | {"src": src(r)} for r in rules],
        "strategies": R["platforms"], "steps": R["steps"], "repo": repo_url(),
        "decisions": [{k: v for k, v in d.items() if not k.startswith("_") and k != "match"}
                      | {"src": src(d), "target_ids": decision_links(d, raw_targets)} for d in load_decisions()],
        "changelog": CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else "",
        "cleanup": cleanup_groups(),
        "reviews": [{"date": f.stem, "md": f.read_text(encoding="utf-8")}
                    for f in sorted(REVIEWS.glob("*.md"), reverse=True)] if REVIEWS.exists() else [],
    }
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"exported {len(games)} games, {len(targets)} targets, {len(series)} series → {dest}")


# ---------------------------------------------------------------- misc commands
# ---------------------------------------------------------------- careful TOML edits (keep comments and layout)
def toml_str(v) -> str:
    import json
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(toml_str(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{toml_str(k) if not re.fullmatch(r'[A-Za-z0-9_-]+', k) else k} = {toml_str(x)}"
                                for k, x in v.items()) + " }"
    return json.dumps(str(v), ensure_ascii=False)


def edit_entry(path: Path, header: str, key: str, value: str, set_: dict | None = None,
               append: dict | None = None) -> None:
    """Edit the array-of-tables entry `header` (e.g. "[[target]]") whose `key = value`: set keys (replace or insert)
    and append text to string keys (joined with ' · '). Raises if the entry isn't found exactly once."""
    lines = path.read_text(encoding="utf-8").split("\n")
    starts = [i for i, ln in enumerate(lines) if ln.strip() == header]
    hits = []
    for n, st in enumerate(starts):
        end = next((j for j in range(st + 1, len(lines)) if lines[j].startswith("[")), len(lines))
        if any(re.match(rf"{re.escape(key)}\s*=\s*{re.escape(toml_str(value))}\s*$", lines[j]) for j in range(st + 1, end)):
            hits.append((st, end))
    if len(hits) != 1:
        raise SystemExit(f"{path.name}: {len(hits)} entries with {key} = {value!r} (need exactly 1)")
    st, end = hits[0]
    while end > st + 1 and not lines[end - 1].strip():
        end -= 1
    data = tomllib.loads("\n".join(["[[x]]"] + lines[st + 1:end]))["x"][0]
    for k, v in (append or {}).items():
        old = data.get(k, "")
        set_ = dict(set_ or {}, **{k: f"{old} · {v}" if old else v})
    for k, v in (set_ or {}).items():
        idx = next((j for j in range(st + 1, end) if re.match(rf"{re.escape(k)}\s*=", lines[j])), None)
        if v is None:
            if idx is not None:
                del lines[idx]
                end -= 1
            continue
        line = f"{k} = {toml_str(v)}"
        if idx is None:
            lines.insert(end, line)
            end += 1
        else:
            lines[idx] = line
    text = "\n".join(lines)
    tomllib.loads(text)  # never write a broken file
    path.write_text(text, encoding="utf-8")


def append_entry(path: Path, header: str, fields: dict, after: tuple[str, str] | None = None) -> None:
    """Add a new entry at the end of the file, or right after the table whose `after = (key, value)` (for series
    entries: after the last entry of that series)."""
    text = path.read_text(encoding="utf-8")
    block = "\n".join([header] + [f"{k} = {toml_str(v)}" for k, v in fields.items() if v not in (None, "", [])])
    if after is None:
        text = text.rstrip("\n") + "\n\n" + block + "\n"
    else:
        lines = text.split("\n")
        at = next(i for i, ln in enumerate(lines) if re.match(rf"{re.escape(after[0])}\s*=\s*{re.escape(toml_str(after[1]))}\s*$", ln))
        nxt = next((j for j in range(at + 1, len(lines)) if lines[j].strip() == "[[series]]"), len(lines))
        while nxt > at and not lines[nxt - 1].strip():
            nxt -= 1
        lines[nxt:nxt] = ["", *block.split("\n")]
        text = "\n".join(lines)
    tomllib.loads(text)
    path.write_text(text, encoding="utf-8")


def cmd_decide(args) -> None:
    """Record a decision: status = decided, decided = date, outcome (used by the issue form Action too)."""
    ids = {d["id"] for d in load_decisions()}
    if args.id not in ids:
        sys.exit(f"unknown decision id {args.id!r}")
    status = "dropped" if args.drop else "decided"
    edit_entry(DECISIONS, "[[decision]]", "id", args.id,
               set_={"status": status, "decided": args.date or dt.date.today().isoformat(), "outcome": args.outcome})
    print(f"{args.id}: {status} — {args.outcome}")


def cmd_ask(args) -> None:
    """Add a question the user asked (issue form "❓ Ask a question") as an open decision; answered in the next review."""
    ids = {d["id"] for d in load_decisions()}
    did = f"q-{args.issue}" if args.issue else args.id
    if not did or not re.fullmatch(r"[a-z0-9-]+", did):
        sys.exit("need --issue N or --id kebab-case-id")
    if did in ids:
        sys.exit(f"{did} already exists")
    if args.area not in ("all", "nintendo", "pc", "playstation", "xbox") or args.kind not in DECISION_KINDS:
        sys.exit("bad --area / --kind")
    append_entry(DECISIONS, "[[decision]]", {
        "id": did, "question": " ".join(args.question.split())[:200], "area": args.area, "kind": args.kind,
        "asked": args.date or dt.date.today().isoformat(), "issue": args.issue or None,
        "context": " ".join(args.context.split())[:4000] if args.context else None})
    print(f"{did}: added — {args.question}")


# ---------------------------------------------------------------- review agenda (what to re-check after an import)
# plans that end in a store licence ("Disc-to-Digital" is a disc, not a digital buy)
DIGITAL_PLAN_RX = re.compile(r"(?<!to-)\bdigital|Xbox Store|eShop|PS Store|PlayStation Store|\bSteam\b", re.I)
RUMOUR_RX = re.compile(r"rumou?r|under consideration|announced\?|\blater\b|no (release )?date|TBA|upcoming|"
                       r"re-test|after GA|not confirmed|unconfirmed|reportedly", re.I)


def review_agenda(days_ahead: int = 120, stale_days: int = 30) -> str:
    """Markdown checklist of everything that can have changed in the world since the data was written."""
    today = dt.date.today()
    rows = load_collection()
    targets = load_targets()
    ds = load_decisions()
    R = load_rules()["rules"]
    st = {id(t): eval_target(t, rows)[0] for t in targets}
    open_t = [t for t in targets if st[id(t)] in ("open", "ordered")]
    prio = {"high": 0, "medium": 1, "low": 2, "someday": 3}
    by_prio = lambda ts: sorted(ts, key=lambda t: (prio.get(t.get("priority", "medium"), 9), norm(t["title"])))
    tl = lambda t: f"**{t['title']}** [{', '.join(t.get('platforms', []))}] {t.get('priority', 'medium')}" + \
        (f", {t['state']}" if t.get("state") else "") + f" — `{t['_src'][0]}:{t['_src'][1]}`"
    out = [f"## Agenda (generated {today.isoformat()})\n",
           "Generated by `python3 scripts/gamecoll.py review`. Research each item (release dates, platforms, "
           "physical formats, store status), update the data, and record findings below with sources.\n"]

    def sec(title, items, hint=""):
        out.append(f"### {title} ({len(items)})\n")
        if hint:
            out.append(f"_{hint}_\n")
        out.extend(f"- [ ] {i}" for i in items) if items else out.append("- nothing")
        out.append("")

    # 0. questions the user asked that have no answer yet
    sec("Questions you asked — answer first",
        [f"**{d['question']}** (`{d['id']}`, asked {d['asked']}" + (f", issue #{d['issue']}" if d.get("issue") else "") + ")"
         for d in ds if d["status"] == "open" and d.get("asked") and not d.get("recommendation")],
        "Research, then fill context, options (pros / cons) and recommendation; reply on the issue and close it.")
    # 1. decisions with a date soon (release dates, pre-order windows)
    due = sorted((d for d in ds if d["status"] == "open" and d.get("due")), key=lambda d: d["due"])
    sec("Decisions with a date", [f"{d['due']} — **{d['question']}** (`{d['id']}`)" +
                                  (" ⚠️ passed" if d["due"] < today.isoformat() else "")
                                  for d in due if (dt.date.fromisoformat(d["due"]) - today).days <= days_ahead],
        "Still on that date? Platforms / formats unchanged (Game-Key Card vs full cart, disc on Xbox)?")
    # 2. watching / pre-ordered / undecided targets
    sec("Watching, pre-ordered or undecided (high / medium)",
        [tl(t) for t in by_prio(open_t) if t.get("state") in ("watching", "preordered", "undecided")
         and t.get("priority", "medium") in ("high", "medium")],
        "New release dates, delays, new platform versions, price drops, pre-order status.")
    # 3. rumours and things that were 'not yet' when written
    sec("Rumours, 'later', 'no date', re-tests",
        [tl(t) + f" — “{m.group(0)}”" for t in by_prio(open_t)
         for m in [RUMOUR_RX.search(t.get("note", "") + " " + t.get("plan", ""))] if m],
        "Has the rumour been confirmed / denied, the date announced, the re-test done?")
    # 4. research questions from decisions.toml
    sec("Open research questions", [f"**{d['question']}** (`{d['id']}`)" for d in ds
                                    if d["status"] == "open" and d["kind"] == "research"])
    # 5. stale dated facts
    stale = []
    for t in open_t:
        for p in note_parts(t.get("note", "")):
            if p.get("date") and (today - dt.date.fromisoformat(p["date"])).days > stale_days:
                stale.append(tl(t) + f" — {p['text']}")
    sec(f"Dated facts older than {stale_days} days", stale)
    # 5b. delisting watch: targets planned as digital / store purchases disappear when delisted
    sec("Delisting watch — planned digital buys",
        [tl(t) + f" — {t.get('plan', '')}" for t in by_prio(open_t) if DIGITAL_PLAN_RX.search(t.get("plan", ""))],
        "Announced delistings (delistedgames.com Watch List + platform news, Push Square's monthly 'delisted or "
        "disabled' list, Pure Xbox): if one of these is leaving the store, note the date and add a dated decision "
        "(buy digitally before the date, or switch to disc). Also check delistings of owned or targeted games' "
        "digital versions (→ disc only) and server shutdowns of online-only targets.")
    # 6. verify flags on important targets
    sec("Marked to verify (high / medium)", [tl(t) + f" — ❓ {t['verify']}" for t in by_prio(open_t)
                                             if t.get("verify") and t.get("priority", "medium") in ("high", "medium")])
    # 7. important targets where only the planned platform is known
    have = defaultdict(set)
    for r in rows:
        if r["status"] in HAVE:
            have[norm(r["title"])].add(r["platform"])
    thin = [t for t in by_prio(open_t) if t.get("priority") == "high"
            and len(derive_formats(t, have.get(norm(t["title"]), set()))) < 2]
    sec("High priority, other platforms unknown", [tl(t) for t in thin],
        "Check other versions (Switch 2 cart or Game-Key Card? Xbox disc? PC?) and add `versions = { … }`.")
    # 8. series: new entries / remasters announced?
    series = load_series()
    sec("Series to scan for new entries, remasters or ports",
        [f"**{s['name']}** ({', '.join(s.get('platforms', []))}) — {len(s.get('entry', []))} entries" for s in series],
        "New mainline entry, remaster or collection announced? Add it to the series and, if it fits the rules, as a target.")
    # 9. platform-level news
    sec("Platform-level news", [
        "Switch 2: new full-cart vs Game-Key Card policy changes; big third-party ports announced",
        "PlayStation: next-gen / disc-drive news (rule `no-next-playstation`), Intergalactic date",
        "Xbox: Disc-to-Digital general availability and results; Xbox Store delistings (360 / OG BC); first-party games coming to PS5 / Switch 2",
        "PC: Steam versions of targets that are 'not on PC' yet",
    ])
    return "\n".join(out)


def cmd_review(args) -> None:
    agenda = review_agenda(args.days)
    if not args.write:
        print(agenda)
        return
    REVIEWS.mkdir(exist_ok=True)
    path = REVIEWS / f"{dt.date.today().isoformat()}.md"
    if path.exists():
        sys.exit(f"{path.relative_to(ROOT)} exists already — edit it, or delete it to start over")
    last = CHANGELOG.read_text(encoding="utf-8").split("\n## ")[1].split("\n", 1)[0] if CHANGELOG.exists() and "\n## " in CHANGELOG.read_text(encoding="utf-8") else "—"
    path.write_text("\n".join([
        f"# Collection review — {dt.date.today().isoformat()}\n",
        f"Import: {last}\n",
        "## Summary\n", "_What changed and what needs a decision — filled in after the research._\n",
        "## Changes made\n", "| Item | Change | Source |", "|---|---|---|", "",
        "## Needs your decision\n", "- \n",
        "## Sources\n", "- \n",
        agenda,
    ]) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} — fill in Summary / Changes / Sources")


# ---------------------------------------------------------------- IGDB covers (build-time only, secrets never leave Actions)
IGDB_PLATFORMS = {  # canonical platform → IGDB platform id (only used to rank candidates)
    "PC": 6, "PlayStation": 7, "PlayStation 2": 8, "PlayStation 3": 9, "PlayStation 4": 48, "PlayStation 5": 167,
    "PSP": 38, "PlayStation Vita": 46, "Xbox": 11, "Xbox 360": 12, "Xbox One": 49, "Xbox Series X|S": 169,
    "Nintendo Switch": 130, "Nintendo Switch 2": 508, "Wii U": 41, "Wii": 5, "GameCube": 21, "Nintendo 64": 4,
    "Super Nintendo": 19, "NES": 18, "Nintendo 3DS": 37, "Nintendo DS": 20, "Game Boy Advance": 24,
    "Game Boy Color": 22, "Game Boy": 33,
}
# IGDB platform ids → console family, for "console exclusive" (PC, Mac, Linux, mobile, web, VR headsets don't count)
IGDB_FAMILY = {
    **dict.fromkeys([7, 8, 9, 48, 167, 38, 46, 165, 390], "playstation"),
    **dict.fromkeys([11, 12, 49, 169], "xbox"),
    **dict.fromkeys([4, 5, 18, 19, 20, 21, 22, 24, 33, 37, 41, 47, 51, 58, 87, 99, 130, 137, 159, 306, 416, 508], "nintendo"),
}
IGDB_NOT_CONSOLE = {6, 3, 14, 34, 39, 82, 170, 74, 92, 163, 162, 384, 385, 386, 471, 52, 55, 405}
EXCLUSIVE_VALUES = {"playstation", "xbox", "nintendo", "other", "multi"}


def exclusivity(t: dict, covers: dict) -> str:
    """"playstation" / "xbox" / "nintendo" / "other" = on one console family only (PC ignored), "multi" = several
    console families, "" = not known. A target's own `exclusive = "…"` wins over the IGDB platform list."""
    if t.get("exclusive"):
        return t["exclusive"]
    plat = next(iter(sorted(expand_platforms(t.get("platforms")) or [],
                            key=lambda x: PLATFORM_ORDER.index(x) if x in PLATFORM_ORDER else 99)), "")
    hit = covers.get(cover_key(t["title"], plat)) or covers.get(cover_key(t["title"]))
    ids = (hit or {}).get("plats")
    if not ids:
        return ""
    fams = {IGDB_FAMILY.get(i, "other") for i in ids if isinstance(i, int) and i not in IGDB_NOT_CONSOLE}
    return "" if not fams else next(iter(fams)) if len(fams) == 1 else "multi"


IMAGE_ID_RX = re.compile(r"^[a-z0-9]{2,32}$")  # IGDB image ids; anything else is rejected (no injection into URLs)
COVER_RETRY_DAYS = 90
COVER_CACHE_VERSION = 3  # bump to re-check every cached title (v3: stricter matching, no DLC / sequels)


def cover_key(title: str, platform: str = "") -> str:
    return f"{norm(title)}|{platform}"


def load_covers() -> dict:
    import json
    if not COVERS.exists():
        return {}
    data = json.loads(COVERS.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not v.get("image") or IMAGE_ID_RX.match(v["image"])}


def cover_overrides() -> dict:
    """cover_key → {"image": id} or {"none": True}; platform "" = every platform."""
    out = {}
    for c in load_toml(COVER_OVERRIDES).get("cover", []):
        img = c.get("image", "")
        if img and not IMAGE_ID_RX.match(img):
            raise SystemExit(f"{COVER_OVERRIDES.name}: bad image id {img!r} for {c.get('title')!r}")
        out[cover_key(c["title"], canon_platform(c["platform"]) if c.get("platform") else "")] = \
            {"none": True} if c.get("none") else {"image": img, "igdb_id": c.get("igdb_id")}
    return out


def cover_for(title: str, platform: str, covers: dict, overrides: dict) -> str | None:
    for k in (cover_key(title, platform), cover_key(title)):
        if k in overrides:
            return None if overrides[k].get("none") else overrides[k].get("image") or None
    hit = covers.get(cover_key(title, platform)) or covers.get(cover_key(title))
    return hit.get("image") if hit else None


ROMAN = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
         "xi": "11", "xii": "12", "xiii": "13", "xiv": "14", "xv": "15", "xvi": "16"}
EDITION_WORDS = {"the", "edition", "remastered", "remaster", "definitive", "complete", "goty", "game", "of", "year", "hd",
                 "deluxe", "ultimate", "collectors", "collector", "s", "standard", "launch", "day", "one", "for",
                 "bundle", "pack", "enhanced", "director", "cut", "anniversary"}  # never numbers: "2" is a sequel
PLATFORM_SUFFIX_RX = re.compile(r"\b(nintendo )?switch 2 edition\b|\bfor nintendo switch( 2)?\b|\bnintendo switch 2\b")
# IGDB game types that are never "the game on the shelf": DLC, expansion, mod, episode, season, pack, update
NOT_A_GAME_TYPES = {1, 2, 5, 6, 7, 13, 14}
NOT_A_GAME_RX = re.compile(r"\b(skin|costume|outfit|soundtrack|bonus content|dlc|season pass|persona set|avatar|"
                           r"wallpaper|artbook|art book|demo|beta|trial|upgrade pack|character pack|expansion pass)\b", re.I)


def title_words(s: str) -> list[str]:
    """norm() without platform suffixes, Roman numerals as digits: "Alan Wake II" == "Alan Wake 2"."""
    return [ROMAN.get(w, w) for w in PLATFORM_SUFFIX_RX.sub(" ", norm(s)).split()]


def rank_candidates(title: str, platform: str, candidates: list[dict]) -> tuple[dict | None, int]:
    """Pick the IGDB result that best matches a CLZ title + platform.
    Name score: 5 identical · 4 identical after numerals / edition words · 3 same words plus only edition words ·
    2 starts the same (not a sequel number) — accepted only on the right platform. +2 when the platform matches.
    DLC, skins, soundtracks etc. are never picked."""
    want, pid = title_words(title), IGDB_PLATFORMS.get(platform)
    core = lambda ws: [w for w in ws if w not in EDITION_WORDS]
    best, best_score, best_base = None, 0, 0
    for c in candidates:
        if not (c.get("cover") or {}).get("image_id"):
            continue
        if c.get("game_type") in NOT_A_GAME_TYPES or c.get("category") in NOT_A_GAME_TYPES:
            continue
        cname = c.get("name", "")
        if NOT_A_GAME_RX.search(cname) and not NOT_A_GAME_RX.search(title):
            continue
        have = title_words(cname)
        if norm(cname) == norm(title) or have == want:
            base = 5
        elif core(have) and core(have) == core(want):
            base = 4
        elif set(want) <= set(have) and set(have) - set(want) <= EDITION_WORDS:
            base = 3
        elif (have[:len(want)] == want and len(have) > len(want) and not have[len(want)].isdigit()) or \
                (want[:len(have)] == have and len(want) > len(have) and not want[len(have)].isdigit()):
            base = 2
        else:
            continue
        on_platform = bool(pid and pid in (c.get("platforms") or []))
        if base == 2 and not on_platform:
            continue
        score = base + (2 if on_platform else 0)
        if score > best_score:
            best, best_score, best_base = c, score, base
    return (best, best_score) if best else (None, 0)


def igdb_request(url: str, body: str, headers: dict) -> list:
    import json
    import urllib.request
    req = urllib.request.Request(url, data=body.encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def cmd_covers(args) -> None:
    """Look up IGDB covers for collection games and open targets. Needs TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET
    (GitHub Actions secrets). Only public cover ids are written to data/covers.json."""
    import json
    import os
    import time
    import urllib.error
    import urllib.parse
    cid, secret = os.environ.get("TWITCH_CLIENT_ID", ""), os.environ.get("TWITCH_CLIENT_SECRET", "")
    if not (cid and secret):
        print("covers: TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set — skipping (see README → Covers).")
        return
    tok = igdb_request("https://id.twitch.tv/oauth2/token?" + urllib.parse.urlencode(
        {"client_id": cid, "client_secret": secret, "grant_type": "client_credentials"}), "", {})
    token = tok["access_token"] if isinstance(tok, dict) else tok[0]["access_token"]
    headers = {"Client-ID": cid, "Authorization": f"Bearer {token}", "Accept": "application/json"}
    covers, overrides = load_covers(), cover_overrides()
    today = dt.date.today()
    wanted = {}
    for r in load_collection():
        wanted[cover_key(r["title"], r["platform"])] = (r["title"], r["platform"])
    rows = load_collection()
    for t in load_targets():
        if eval_target(t, rows)[0] in ("open", "ordered"):
            p = next(iter(sorted(expand_platforms(t.get("platforms")) or [], key=lambda x: PLATFORM_ORDER.index(x)
                                 if x in PLATFORM_ORDER else 99)), "")
            wanted.setdefault(cover_key(t["title"], p), (t["title"], p))
    todo = []
    for k, (title, plat) in wanted.items():
        if k in overrides or cover_key(title) in overrides:
            continue
        c = covers.get(k)
        current = c and c.get("v") == COVER_CACHE_VERSION  # older versions are re-checked, hits included
        fresh = current and (today - dt.date.fromisoformat(c.get("checked", "2000-01-01"))).days < COVER_RETRY_DAYS
        if current and (c.get("image") or fresh):
            continue
        todo.append((k, title, plat))
    todo = todo[: args.limit] if args.limit else todo
    print(f"covers: {len(wanted)} titles, {len(todo)} to look up (~{len(todo) // 3 // 60 + 1} min)")
    # One search per request: IGDB's multiquery endpoint ignores `fields` when `search` is used (returns ids only).
    # Rate limit is 4 requests / second → ~3.5 / s with the pause below; 429 answers are retried with a back-off.
    esc_q = lambda s: re.sub(r'[\\"]', " ", s)

    def search(q: str) -> list:
        body = f'search "{esc_q(q)}"; fields name,cover.image_id,platforms,game_type,category; limit 20;'
        for attempt in range(4):
            try:
                time.sleep(0.28)
                return igdb_request("https://api.igdb.com/v4/games", body, headers)
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 3:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                raise
        return []

    def simpler(title: str) -> str:  # "Game: Subtitle (Remastered)" → "Game Subtitle" for a second try
        t = re.sub(r"\(.*?\)|\[.*?\]|[-–:]?\s*(Nintendo Switch 2 Edition|for Nintendo Switch)\b", " ", title)
        t = re.sub(r"\b(remastered|remaster|definitive|complete|deluxe|game of the year|goty|hd|edition|collection)\b",
                   " ", t, flags=re.I)
        return re.sub(r"[^\w' ]+", " ", t).strip()

    why = Counter()
    for n, (k, title, plat) in enumerate(todo, 1):
        try:
            cands = search(title)
            best, score = rank_candidates(title, plat, cands)
            if not best and simpler(title) and simpler(title).lower() != title.lower():
                more = search(simpler(title))
                best, score = rank_candidates(title, plat, cands + more)
                cands = cands + more
        except Exception as e:  # network trouble: keep what we have, the next run continues
            print(f"covers: request failed ({e}) — stopping after {n - 1}")
            break
        img = best["cover"]["image_id"] if best else None
        if not best:
            why["no results" if not cands else "results without a cover" if not any((c.get("cover") or {}).get("image_id")
                                                                                     for c in cands) else "names too different"] += 1
        covers[k] = {"title": title, "platform": plat, "image": img if img and IMAGE_ID_RX.match(img) else None,
                     "igdb_id": best.get("id") if best else None, "name": best.get("name") if best else None,
                     "plats": [i for i in (best.get("platforms") or []) if isinstance(i, int)] if best else None,
                     "score": score, "checked": today.isoformat(), "v": COVER_CACHE_VERSION}
        if n % 100 == 0:  # save progress so a failure later doesn't lose it
            COVERS.write_text(json.dumps(dict(sorted(covers.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
            print(f"covers: {n}/{len(todo)} looked up")
    missing = sorted({c["igdb_id"] for c in covers.values() if isinstance(c.get("igdb_id"), int) and c.get("plats") is None})
    for i in range(0, len(missing), 500):  # release platforms for the console-exclusive filter
        ids = missing[i:i + 500]
        try:
            time.sleep(0.28)
            res = igdb_request("https://api.igdb.com/v4/games", f"fields platforms; where id = ({','.join(map(str, ids))}); limit 500;", headers)
        except Exception as e:
            print(f"covers: platform lookup failed ({e}) — the next run continues")
            break
        by_id = {g["id"]: [p for p in (g.get("platforms") or []) if isinstance(p, int)] for g in res if isinstance(g.get("id"), int)}
        for c in covers.values():
            if c.get("igdb_id") in by_id and c.get("plats") is None:
                c["plats"] = by_id[c["igdb_id"]]
    if missing:
        print(f"covers: release platforms for {sum(1 for c in covers.values() if c.get('plats') is not None)} matches")
    COVERS.write_text(json.dumps(dict(sorted(covers.items())), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    found = sum(1 for k in wanted if covers.get(k, {}).get("image"))
    if why:
        print("covers: not found — " + ", ".join(f"{v} {k}" for k, v in why.most_common()))
    print(f"covers: {found}/{len(wanted)} with a cover → {COVERS.relative_to(ROOT) if COVERS.is_relative_to(ROOT) else COVERS}")


# ---------------------------------------------------------------- buy-plan clean-up
DATE_TEXT_RX = re.compile(r"\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (20\d\d)\b|\b(20\d\d-\d\d-\d\d)\b")
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
NOT_COLLECTING_RX = re.compile(r"not collecting|not interested|doesn't sound interesting|shelf only|out of (disc )?scope|"
                               r"low value|not taken", re.I)


def text_dates(text: str) -> list[dt.date]:
    out = []
    for m in DATE_TEXT_RX.finditer(text or ""):
        try:
            out.append(dt.date.fromisoformat(m.group(4)) if m.group(4) else
                       dt.date(int(m.group(3)), MONTHS[m.group(2)[:3]], int(m.group(1))))
        except ValueError:
            pass
    return out


def cleanup_groups() -> list[dict]:
    """Buy-plan housekeeping: groups of target indexes (into load_targets()) with a suggested action."""
    rows, targets, today = load_collection(), load_targets(), dt.date.today()
    st = [eval_target(t, rows)[0] for t in targets]
    have = defaultdict(set)
    for r in rows:
        if r["status"] in HAVE:
            have[norm(r["title"])].add(r["platform"])
    open_ = [i for i, s in enumerate(st) if s in ("open", "ordered")]
    T = lambda i: targets[i]
    groups = [
        ("not-collecting", "Notes say “not collecting” but still open",
         "The note says it's out of scope (shelf only, not collecting, low value …) — probably `state = \"skip\"`.",
         [i for i in open_ if T(i).get("state") != "skip" and NOT_COLLECTING_RX.search(T(i).get("note", "") + " " + T(i).get("group", ""))]),
        ("released-watching", "Watching, but the date in the note has passed",
         "Released (or the date slipped) — buy, change to open, or update the date.",
         [i for i in open_ if T(i).get("state") in ("watching", "preordered") and
          (ds := text_dates(T(i).get("note", "") + " " + T(i).get("plan", ""))) and max(ds) < today]),
        ("decided-pending", "Question decided, target not updated",
         "The linked question in data/decisions.toml is decided — set the target's state / platform / plan to match.",
         sorted({i for d in load_decisions() if d["status"] == "decided" and d["kind"] == "decision"
                 for i in decision_links(d, targets) if i in open_ and T(i).get("state") in ("undecided", "watching")})),
        ("owned-elsewhere", "Open, but already owned on another platform",
         "One copy per game — drop it, or record why a second copy is wanted (`not_rules = [\"one-copy-newest-gen\"]`).",
         [i for i in open_ if not re.search("Upgrade", T(i).get("group", "")) and "one-copy-newest-gen" not in T(i).get("not_rules", [])
          and (have.get(norm(T(i)["title"]), set()) - set(expand_platforms(T(i).get("platforms")) or []))]),
        ("parked-suggestions", "Parked suggestions (someday)",
         "Suggestions that were never adopted — keep as ideas, promote, or skip in bulk (see the linked open questions).",
         [i for i in open_ if T(i).get("priority") == "someday" and re.search(r"^Suggested|; Suggested|· Suggested", T(i).get("note", ""))]),
        ("someday-no-reason", "Someday, without a reason",
         "Low-priority targets with (almost) no note — keep only if you can say why.",
         [i for i in open_ if T(i).get("priority") == "someday" and len(T(i).get("note", "")) < 25
          and not re.search(r"Suggested", T(i).get("note", ""))]),
        ("other-versions-unknown", "Important, but only the planned platform is known",
         "High / medium priority with no information about other platforms — check versions (wizard) and add `versions = { … }`.",
         [i for i in open_ if T(i).get("priority") in ("high", "medium")
          and len(derive_formats(T(i), have.get(norm(T(i)["title"]), set()))) < 2]),
    ]
    return [{"id": gid, "title": title, "action": action, "targets": idx} for gid, title, action, idx in groups]


def cmd_cleanup(args) -> None:
    targets = load_targets()
    groups = cleanup_groups()
    if args.apply:
        g = next((x for x in groups if x["id"] == args.apply), None)
        if not g or args.apply != "not-collecting":
            sys.exit("only `--apply not-collecting` (→ state = \"skip\") is automatic; the other groups need a decision per target")
        for i in g["targets"]:
            t = targets[i]
            edit_entry(ROOT / t["_src"][0], "[[target]]", "title", t["title"], set_={"state": "skip"})
            print(f"skip  {t['title']}")
        return
    for g in groups:
        print(f"\n## {g['title']} ({len(g['targets'])}) — `{g['id']}`\n{g['action']}")
        for i in g["targets"][: args.max]:
            t = targets[i]
            print(f"  - {t['title']} [{', '.join(t.get('platforms', []))}] {t.get('priority', 'medium')}"
                  f"{', ' + t['state'] if t.get('state') else ''} — {t['_src'][0]}:{t['_src'][1]}")
        if len(g["targets"]) > args.max:
            print(f"  … {len(g['targets']) - args.max} more")


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
    ok = check_rules() and ok
    ok = check_decisions() and ok
    for t in load_targets():
        if t.get("exclusive") and t["exclusive"] not in EXCLUSIVE_VALUES:
            print(f"ERROR target {t['title']!r}: exclusive = {t['exclusive']!r} — use one of {', '.join(sorted(EXCLUSIVE_VALUES))}")
            ok = False
        for p, v in (t.get("versions") or {}).items():
            for f in ([v] if isinstance(v, str) else v):
                if f not in FORMATS:
                    print(f"ERROR target {t['title']!r}: versions.{p} = {f!r} — use one of {', '.join(sorted(FORMATS))}")
                    ok = False
            if canon_platform(p) not in PLATFORM_ORDER:
                print(f"WARN target {t['title']!r}: versions: unknown platform {p!r}")
    sys.exit(0 if ok else 1)


def check_decisions() -> bool:
    if not DECISIONS.exists():
        return True
    try:
        ds = load_decisions()
    except (tomllib.TOMLDecodeError, re.error) as e:
        print(f"ERROR {DECISIONS.name}: {e}")
        return False
    ok = True
    rule_ids = {r["id"] for r in load_rules()["rules"]}
    titles = {norm(t["title"]) for t in load_targets()}
    ids = [d.get("id") for d in ds]
    for d in ds:
        where = f"{DECISIONS.name}: {d.get('id', '?')}"
        if not d.get("id") or not d.get("question"):
            print(f"ERROR {where}: needs id and question")
            ok = False
        if d["kind"] not in DECISION_KINDS or d["status"] not in ("open", "decided", "dropped"):
            print(f"ERROR {where}: kind must be {'/'.join(DECISION_KINDS)}, status open/decided/dropped")
            ok = False
        for i in d.get("rules", []):
            if i not in rule_ids:
                print(f"ERROR {where}: unknown rule id {i!r}")
                ok = False
        for t in d.get("targets", []):
            if norm(t) not in titles:
                print(f"WARN {where}: no buy-plan target titled {t!r}")
        if d["status"] == "decided" and not d.get("outcome"):
            print(f"WARN {where}: decided but no outcome")
    for dup in {i for i in ids if ids.count(i) > 1}:
        print(f"ERROR {DECISIONS.name}: duplicate id {dup!r}")
        ok = False
    print(f"decisions.toml: {len(ds)} entries · {sum(d['status'] == 'open' for d in ds)} open")
    return ok


def check_rules() -> bool:
    if not RULES.exists():
        return True
    try:
        R = load_rules()
    except (tomllib.TOMLDecodeError, re.error) as e:
        print(f"ERROR {RULES.name}: {e}")
        return False
    ok = True
    ids = [r.get("id") for r in R["rules"]]
    for r in R["rules"]:
        for k in ("id", "short", "summary"):
            if not r.get(k):
                print(f"ERROR {RULES.name}: rule {r.get('id', '?')} has no {k!r}")
                ok = False
        for k in r.get("match", {}):
            if k not in MATCH_FIELDS:
                print(f"ERROR {RULES.name}: rule {r['id']}: unknown match field {k!r} (use {', '.join(MATCH_FIELDS)})")
                ok = False
    for dup in {i for i in ids if ids.count(i) > 1}:
        print(f"ERROR {RULES.name}: duplicate rule id {dup!r}")
        ok = False
    known = set(ids)
    refs = [(f"strategy {p.get('id')}", p.get("rules", [])) for p in R["platforms"]]
    refs += [(f"step {s.get('question', '')[:30]!r}", s.get("rules", [])) for s in R["steps"]]
    refs += [(f"target {t['title']!r}", t.get("rules", []) + t.get("not_rules", [])) for t in load_targets()]
    for s in load_series():
        refs.append((f"series {s['name']!r}", s.get("rules", []) + s.get("not_rules", [])))
        refs += [(f"series entry {e['title']!r}", e.get("rules", []) + e.get("not_rules", [])) for e in s.get("entry", [])]
    for where, lst in refs:
        for i in lst:
            if i not in known:
                print(f"ERROR unknown rule id {i!r} in {where}")
                ok = False
    untagged = [t["title"] for t in load_targets() if not rules_for(t, R["rules"])]
    print(f"rules.toml: {len(ids)} rules · {len(untagged)} targets without a rule"
          + (f" ({', '.join(untagged[:5])}{' …' if len(untagged) > 5 else ''})" if untagged else ""))
    return ok


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
    p = sub.add_parser("covers", help="look up IGDB covers (needs TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET)")
    p.add_argument("--limit", type=int, default=0, help="look up at most N titles this run")
    p.set_defaults(fn=cmd_covers)
    p = sub.add_parser("cleanup", help="buy-plan housekeeping report (--apply not-collecting → state = skip)")
    p.add_argument("--apply", metavar="GROUP")
    p.add_argument("--max", type=int, default=15, help="targets listed per group")
    p.set_defaults(fn=cmd_cleanup)
    p = sub.add_parser("decide", help="record a decision in data/decisions.toml")
    p.add_argument("id")
    p.add_argument("--outcome", required=True)
    p.add_argument("--date", help="YYYY-MM-DD (default today)")
    p.add_argument("--drop", action="store_true", help="mark as dropped instead of decided")
    p.set_defaults(fn=cmd_decide)
    p = sub.add_parser("ask", help="add a question you want advice on to data/decisions.toml")
    p.add_argument("question")
    p.add_argument("--issue", type=int, help="GitHub issue number (id becomes q-<n>)")
    p.add_argument("--id", help="id when there is no issue")
    p.add_argument("--area", default="all")
    p.add_argument("--kind", default="decision")
    p.add_argument("--context", default="")
    p.add_argument("--date", help="YYYY-MM-DD (default today)")
    p.set_defaults(fn=cmd_ask)
    p = sub.add_parser("review", help="print the research agenda for a collection review (--write: start reviews/<date>.md)")
    p.add_argument("--write", action="store_true")
    p.add_argument("--days", type=int, default=120, help="look-ahead for dated decisions (default 120)")
    p.set_defaults(fn=cmd_review)
    p = sub.add_parser("export", help="write site/data.json for the web frontend")
    p.add_argument("out", nargs="?", default=str(ROOT / "site" / "data.json"))
    p.set_defaults(fn=cmd_export)
    args = ap.parse_args()
    if args.cmd == "import" and not (args.auto or args.csv):
        ap.error("import needs a CSV path or --auto")
    args.fn(args)


if __name__ == "__main__":
    main()
