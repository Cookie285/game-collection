// Runs the real rules engine from site/app.js in Node (no browser): node tests/engine.test.js
const fs = require("fs"), vm = require("vm"), assert = require("assert");
const any = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : any), apply: () => any, set: () => true });
const ctx = { document: any, window: any, localStorage: any, matchMedia: () => ({ matches: false }), fetch: () => new Promise(() => {}),
  history: any, location: { hash: "" }, requestAnimationFrame: () => 0, performance: { now: () => 0 }, console,
  HTMLImageElement: function () {}, IntersectionObserver: function () { return any; }, URLSearchParams };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../site/app.js", "utf8"), ctx);
const s = (F, flags = {}) => vm.runInContext(`suggest(${JSON.stringify(F)}, ${JSON.stringify(flags)})`, ctx);
const cases = [
  ["JRPG, Switch 2 only a Game-Key Card → case by case", s({ "Nintendo Switch 2": ["gkc"], "PlayStation 5": ["disc"] }, { jrpg: true }),
    (r) => r.verdict === "case-by-case" && r.pick.platform === "Nintendo Switch 2" && r.alt === "PlayStation 5"],
  ["non-JRPG, Game-Key Card → PS5 disc", s({ "Nintendo Switch 2": ["gkc"], "PlayStation 5": ["disc"] }), (r) => r.pick.platform === "PlayStation 5"],
  ["real Switch cart → Switch", s({ "Nintendo Switch": ["cart"], "PlayStation 5": ["disc"] }), (r) => r.pick.platform === "Nintendo Switch"],
  ["shooter beats Nintendo-first", s({ "Nintendo Switch": ["cart"], "Xbox Series X|S": ["disc"] }, { shooter: true }), (r) => r.pick.platform === "Xbox Series X|S"],
  ["MS game without Xbox disc → PS5", s({ "PlayStation 5": ["disc"] }, { msfp: true }), (r) => r.pick.platform === "PlayStation 5"],
  ["BC title still listed → digital", s({ "Xbox 360": ["disc", "digital"] }), (r) => r.verdict === "digital"],
  ["BC title delisted → disc", s({ "Xbox 360": ["disc", "digital"] }, { delisted: true }), (r) => r.verdict === "buy" && r.pick.format === "disc"],
  ["owned on Steam → only if cheap", s({ "PlayStation 5": ["disc"], PC: ["steam"] }), (r) => r.verdict === "cheap-only"],
  ["already owned → owned", s({ "PlayStation 3": ["owned"], "Xbox 360": ["disc"] }), (r) => r.verdict === "owned"],
  ["not_rules one-copy → buy anyway", s({ "PlayStation 3": ["owned"], "Xbox 360": ["disc"] }, { off: ["one-copy-newest-gen"] }), (r) => r.pick.platform === "Xbox 360"],
  ["nothing known → unknown", s({}), (r) => r.verdict === "unknown"],
];
let failed = 0;
for (const [name, r, ok] of cases) {
  const pass = ok(r);
  if (!pass) failed++;
  console.log(`${pass ? "✓" : "✗"} ${name}${pass ? "" : " — got " + JSON.stringify({ verdict: r.verdict, pick: r.pick, alt: r.alt })}`);
}
assert.strictEqual(failed, 0, `${failed} engine case(s) failed`);
