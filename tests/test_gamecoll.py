"""Unit tests for scripts/gamecoll.py — stdlib only: python3 -m unittest discover -s tests"""
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import gamecoll as g  # noqa: E402


class Basics(unittest.TestCase):
    def test_norm_and_platforms(self):
        self.assertEqual(g.norm("Pokémon™ Yellow & Blue"), "pokemon yellow and blue")
        self.assertEqual(g.canon_platform("PS5"), "PlayStation 5")
        self.assertEqual(g.canon_platform("Nintendo Switch 2"), "Nintendo Switch 2")
        self.assertEqual(g.canon_platform("Xbox Series X"), "Xbox Series X|S")
        self.assertEqual(g.expand_platforms(["xbox-modern"]), {"Xbox Series X|S", "Xbox One"})
        self.assertIsNone(g.expand_platforms(["any"]))

    def test_status_mapping(self):
        self.assertEqual(g.norm_status("In Collection"), "owned")
        self.assertEqual(g.norm_status("Wunschliste"), "wishlist")
        self.assertEqual(g.norm_status(""), "owned")


class Notes(unittest.TestCase):
    def test_note_parts(self):
        kinds = [p["kind"] for p in g.note_parts(
            "Decision: Switch = Switch 2 Game-Key Card; PS = PS5 disc · owned on Steam (X) – only if very cheap · "
            "Other versions: Switch 2 = Game-Key Card · D2D (community, 2026-09-09): working · Verify EU disc")]
        self.assertEqual(kinds, ["decision", "owned", "alternatives", "fact", "verify"])
        dated = [p for p in g.note_parts("D2D (community, 2026-09-09): working") if p.get("date")]
        self.assertEqual(dated[0]["date"], "2026-09-09")

    def test_text_dates(self):
        self.assertEqual([str(d) for d in g.text_dates("out 6 Oct 2026, then 2027-02-23")], ["2026-10-06", "2027-02-23"])


class Formats(unittest.TestCase):
    def test_multi_platform_plan_only_names_one(self):
        t = {"title": "KH", "platforms": ["PlayStation 5", "Nintendo Switch 2"], "plan": "PS5 disc; new",
             "note": "Other versions: Switch 2 = Game-Key Card, ~131 GB download"}
        f = {p: [x["f"] for x in v] for p, v in g.derive_formats(t, set()).items()}
        self.assertEqual(f["PlayStation 5"], ["disc"])
        self.assertEqual(f["Nintendo Switch 2"], ["gkc"])  # the PS5 plan must not invent a Switch 2 cart

    def test_explicit_versions_and_owned(self):
        t = {"title": "X", "platforms": ["Xbox Series X|S"], "plan": "", "versions": {"PS5": "disc", "Xbox Series X|S": "none"}}
        f = g.derive_formats(t, {"PlayStation 4"})
        self.assertEqual([x["f"] for x in f["PlayStation 5"]], ["disc"])
        self.assertEqual([x["f"] for x in f["PlayStation 4"]], ["owned"])
        self.assertEqual([x["f"] for x in f["Xbox Series X|S"]], ["none"])

    def test_bc_digital_keeps_disc(self):
        t = {"title": "Blinx", "platforms": ["Xbox"], "plan": "digital, Xbox Store sale", "note": "Xbox Store: Digital"}
        f = {p: sorted(x["f"] for x in v) for p, v in g.derive_formats(t, set()).items()}
        self.assertEqual(f["Xbox"], ["digital", "disc"])


class TomlEdits(unittest.TestCase):
    def setUp(self):
        self.path = Path(tempfile.mkdtemp()) / "t.toml"
        self.path.write_text('# keep me\n[[target]]\ntitle = "A"\nnote = "one"  \n\n[[target]]\ntitle = "B"\n', encoding="utf-8")

    def test_append_and_set(self):
        g.edit_entry(self.path, "[[target]]", "title", "A", set_={"state": "skip"}, append={"note": "two"})
        text = self.path.read_text(encoding="utf-8")
        self.assertIn("# keep me", text)
        self.assertIn('note = "one · two"', text)
        self.assertIn('state = "skip"', text)
        self.assertEqual(g.tomllib.loads(text)["target"][1], {"title": "B"})

    def test_missing_entry_refused(self):
        with self.assertRaises(SystemExit):
            g.edit_entry(self.path, "[[target]]", "title", "C", set_={"state": "skip"})

    def test_append_entry_valid(self):
        g.append_entry(self.path, "[[target]]", {"title": 'Quote "me"', "platforms": ["PC"]})
        self.assertEqual(g.tomllib.loads(self.path.read_text(encoding="utf-8"))["target"][2]["title"], 'Quote "me"')


class AskQuestion(unittest.TestCase):
    def test_ask_adds_open_question_once(self):
        from types import SimpleNamespace as NS
        from unittest import mock
        path = Path(tempfile.mkdtemp()) / "decisions.toml"
        path.write_text('[[decision]]\nid = "old"\nquestion = "Q?"\narea = "all"\n', encoding="utf-8")
        args = NS(question='Which "X" games?\nsecond line', issue=12, id=None, area="xbox", kind="research",
                  context='Details with "quotes"', date="2026-09-29")
        with mock.patch.object(g, "DECISIONS", path), mock.patch.object(g, "ROOT", path.parent), redirect_stdout(io.StringIO()):
            g.cmd_ask(args)
            d = g.tomllib.loads(path.read_text(encoding="utf-8"))["decision"][1]
            self.assertEqual((d["id"], d["issue"], d["asked"], d["kind"]), ("q-12", 12, "2026-09-29", "research"))
            self.assertEqual(d["question"], 'Which "X" games? second line')
            with self.assertRaises(SystemExit):
                g.cmd_ask(args)  # same issue twice
            with self.assertRaises(SystemExit):
                g.cmd_ask(NS(**{**vars(args), "issue": 13, "area": "moon"}))


class DelistingWatch(unittest.TestCase):
    def test_digital_plans_only(self):
        rx = g.DIGITAL_PLAN_RX
        for plan in ["digital, Xbox Store sale (no key sellers for 360 titles)", "Steam sale only (no physical)",
                     "disc if delisted, else digital Xbox Store sale", "digital (free)"]:
            self.assertTrue(rx.search(plan), plan)
        for plan in ["Xbox disc (Disc-to-Digital)", "used disc, e.g. rebuy.de", "PS5 disc; used preferred", ""]:
            self.assertFalse(rx.search(plan), plan)


class Covers(unittest.TestCase):
    CANDS = [
        {"id": 1, "name": "Halo 3: ODST", "cover": {"image_id": "co1aaa"}, "platforms": [12]},
        {"id": 2, "name": "Halo 3", "cover": {"image_id": "co1bbb"}, "platforms": [12]},
        {"id": 3, "name": "Halo 3", "cover": {"image_id": "co1ccc"}, "platforms": [6]},
    ]

    def test_exact_name_and_platform_wins(self):
        best, score = g.rank_candidates("Halo 3", "Xbox 360", self.CANDS)
        self.assertEqual(best["id"], 2)
        self.assertGreaterEqual(score, 6)

    def test_unrelated_names_rejected(self):
        best, _ = g.rank_candidates("Fable", "Xbox 360", [{"id": 9, "name": "Fable Fortune", "cover": {"image_id": "co1x"}}])
        self.assertIsNone(best)

    def test_real_world_cases(self):
        c = lambda i, name, pl=(), **kw: {"id": i, "name": name, "cover": {"image_id": f"co{i}"}, "platforms": list(pl), **kw}
        pick = lambda title, plat, cands: (g.rank_candidates(title, plat, cands)[0] or {}).get("id")
        # DLC / skins / persona sets are never the game
        self.assertEqual(pick("Batman: Arkham Knight", "PlayStation 4",
                              [c(1, "Batman: Arkham Knight - 2008 Movie Batman Skin", [48]), c(2, "Batman: Arkham Knight", [6])]), 2)
        self.assertIsNone(pick("Persona 3 Reload", "Nintendo Switch 2", [c(3, "Persona 3 Reload: Persona 5 Royal Persona Set 1", [508])]))
        self.assertIsNone(pick("Control", "Xbox One", [c(4, "Control: Override", [49], game_type=1)]))
        # a sequel is not the game
        self.assertIsNone(pick("Forbidden Siren", "PlayStation 2", [c(5, "Forbidden Siren 2", [8])]))
        # Roman numerals and edition suffixes
        self.assertEqual(pick("Alan Wake 2", "PlayStation 5", [c(6, "Alan Wake II", [167])]), 6)
        self.assertEqual(pick("Diablo III: Ultimate Evil Edition", "PlayStation 4", [c(7, "Diablo III", [48])]), 7)
        self.assertEqual(pick("Moonlight Peaks - Nintendo Switch 2 Edition", "Nintendo Switch 2", [c(8, "Moonlight Peaks", [508])]), 8)
        # a longer official name is fine on the right platform, not on another one
        self.assertEqual(pick("Castlevania Requiem", "PlayStation 4",
                              [c(9, "Castlevania Requiem: Symphony of the Night & Rondo of Blood", [48])]), 9)
        self.assertIsNone(pick("Castlevania Requiem", "PlayStation 4",
                               [c(10, "Castlevania Requiem: Symphony of the Night & Rondo of Blood", [6])]))

    def test_image_id_validation(self):
        self.assertTrue(g.IMAGE_ID_RX.match("co1r7f"))
        for bad in ('co1"><script>', "../x", "CO1R7F", ""):
            self.assertFalse(g.IMAGE_ID_RX.match(bad))

    def test_override_none(self):
        ov = {g.cover_key("Halo 3"): {"none": True}}
        covers = {g.cover_key("Halo 3", "Xbox 360"): {"image": "co1bbb"}}
        self.assertIsNone(g.cover_for("Halo 3", "Xbox 360", covers, ov))
        self.assertEqual(g.cover_for("Halo 3", "Xbox 360", covers, {}), "co1bbb")


class CoverLookup(unittest.TestCase):
    """The whole `covers` command against a fake IGDB (no network, no secrets)."""

    def setUp(self):
        import json
        import os
        self.tmp = Path(tempfile.mkdtemp())
        self.saved = (g.COVERS, g.COVER_OVERRIDES, g.load_collection, g.load_targets, g.igdb_request, os.environ.copy())
        g.COVERS, g.COVER_OVERRIDES = self.tmp / "covers.json", self.tmp / "none.toml"
        g.load_collection = lambda: [dict.fromkeys(g.FIELDS, "") | {"title": t, "platform": p, "status": "owned"}
                                     for t, p in [("Halo 3", "Xbox 360"), ("Nothing Here", "PC"), ("Ids Only", "PC"),
                                                  ("Old Miss", "PC")]]
        g.load_targets = lambda: []
        os.environ.update(TWITCH_CLIENT_ID="id", TWITCH_CLIENT_SECRET="secret")
        # a v1 miss from the broken multiquery run must be retried
        g.COVERS.write_text(json.dumps({g.cover_key("Old Miss", "PC"): {"image": None, "checked": "2099-01-01", "score": 0}}))
        self.calls = []

        def fake(url, body, headers):
            self.calls.append((url, body))
            if "oauth2/token" in url:
                return {"access_token": "tok"}
            self.assertIn("/v4/games", url)            # never the multiquery endpoint
            self.assertEqual(headers["Authorization"], "Bearer tok")
            if '"Halo 3"' in body:
                return [{"id": 2, "name": "Halo 3", "cover": {"image_id": "co1bbb"}, "platforms": [12]}]
            if '"Ids Only"' in body:
                return [{"id": 5}]                      # what multiquery + search answered
            if '"Old Miss"' in body:
                return [{"id": 7, "name": "Old Miss", "cover": {"image_id": "co7old"}, "platforms": [6]}]
            return []
        g.igdb_request = fake

    def tearDown(self):
        import os
        g.COVERS, g.COVER_OVERRIDES, g.load_collection, g.load_targets, g.igdb_request, env = self.saved
        os.environ.clear()
        os.environ.update(env)

    def test_lookup(self):
        import io
        import json
        import time
        from contextlib import redirect_stdout
        from types import SimpleNamespace
        from unittest import mock
        out = io.StringIO()
        with mock.patch.object(time, "sleep", lambda s: None), redirect_stdout(out):
            g.cmd_covers(SimpleNamespace(limit=0))
        data = json.loads(g.COVERS.read_text())
        self.assertEqual(data[g.cover_key("Halo 3", "Xbox 360")]["image"], "co1bbb")
        self.assertEqual(data[g.cover_key("Old Miss", "PC")]["image"], "co7old")
        self.assertIsNone(data[g.cover_key("Ids Only", "PC")]["image"])
        self.assertTrue(all(v.get("v") == g.COVER_CACHE_VERSION for v in data.values()))
        log = out.getvalue()
        self.assertIn("2/4 with a cover", log)
        self.assertIn("results without a cover", log)
        self.assertIn("no results", log)
        self.assertNotIn("secret", log)                 # the secret never shows up in the output


class RepoData(unittest.TestCase):
    """The real data files load and link up."""

    def test_every_target_has_a_rule(self):
        rules = g.load_rules()["rules"]
        self.assertEqual([t["title"] for t in g.load_targets() if not g.rules_for(t, rules)], [])

    def test_decision_targets_exist(self):
        titles = {g.norm(t["title"]) for t in g.load_targets()}
        missing = [(d["id"], t) for d in g.load_decisions() for t in d.get("targets", []) if g.norm(t) not in titles]
        self.assertEqual(missing, [])

    def test_review_agenda_and_cleanup_build(self):
        self.assertIn("## Agenda", g.review_agenda())
        self.assertTrue(all("targets" in grp for grp in g.cleanup_groups()))


if __name__ == "__main__":
    unittest.main()
