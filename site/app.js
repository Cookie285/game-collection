/* Game Collection — static web frontend. Reads data.json (built by `scripts/gamecoll.py export`). */
"use strict";

const FAMILY = {
  nintendo: { label: "Nintendo", color: "var(--nintendo)", hue: 356 },
  playstation: { label: "PlayStation", color: "var(--playstation)", hue: 222 },
  xbox: { label: "Xbox", color: "var(--xbox)", hue: 125 },
  pc: { label: "PC", color: "var(--pc)", hue: 265 },
  other: { label: "Other", color: "var(--other)", hue: 200 },
};
const GAME_STATUS = {
  owned: { label: "Owned", color: "var(--good)", icon: "✅" },
  for_sale: { label: "For sale", color: "var(--accent-2)", icon: "🏷️" },
  ordered: { label: "Ordered", color: "var(--warn)", icon: "🕒" },
  wishlist: { label: "Wishlist", color: "var(--accent)", icon: "⭐" },
  sold: { label: "Sold", color: "var(--faint)", icon: "💸" },
  other: { label: "Other", color: "var(--faint)", icon: "•" },
};
const TARGET_STATUS = {
  open: { label: "Open", color: "var(--accent)", icon: "⬜" },
  ordered: { label: "Ordered", color: "var(--warn)", icon: "🕒" },
  done: { label: "Done", color: "var(--good)", icon: "✅" },
  skip: { label: "Skipped", color: "var(--faint)", icon: "➖" },
};
const ENTRY_STATUS = {
  done: { label: "Owned", icon: "✅" },
  ordered: { label: "Ordered", icon: "🕒" },
  open: { label: "Missing", icon: "⬜" },
  steam: { label: "Steam only", icon: "💻" },
  skip: { label: "Not needed", icon: "➖" },
};
const PRIORITY = {
  high: { label: "High", color: "var(--bad)", rank: 0 },
  medium: { label: "Medium", color: "var(--warn)", rank: 1 },
  low: { label: "Low", color: "var(--playstation)", rank: 2 },
  someday: { label: "Someday", color: "var(--faint)", rank: 3 },
};
const HAVE = new Set(["owned", "for_sale"]);
const PLATFORM_FAMILY_WORDS = {
  xbox: "xbox", "xbox-modern": "xbox", playstation: "playstation", nintendo: "nintendo", pc: "pc",
};

let D = null; // data.json
const app = document.getElementById("app");

/* ------------------------------------------------ helpers */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[™®©]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fam = (f) => FAMILY[f] || FAMILY.other;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n, w) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
const platFamily = (name) => D.platformFamily[name] || (PLATFORM_FAMILY_WORDS[name] ?? "other");

function pill(text, color) {
  return `<span class="pill" style="--c:${color}">${esc(text)}</span>`;
}
const SPEC_LABEL = { xbox: "Any Xbox", "xbox-modern": "Xbox One / Series", playstation: "Any PlayStation",
  nintendo: "Any Nintendo", pc: "PC", any: "Any platform" };
function platPill(p) {
  return pill(SPEC_LABEL[p] || p, fam(platFamily(p)).color);
}
function shortPlat(p) {
  return ({
    "Nintendo Switch 2": "Switch 2", "Nintendo Switch": "Switch", "Nintendo 64": "N64", "Nintendo 3DS": "3DS",
    "Nintendo DS": "DS", "Game Boy Advance": "GBA", "Game Boy Color": "GBC", "PlayStation 5": "PS5",
    "PlayStation 4": "PS4", "PlayStation 3": "PS3", "PlayStation 2": "PS2", "PlayStation": "PS1",
    "PlayStation Vita": "Vita", "Xbox Series X|S": "Series X|S", "Super Nintendo": "SNES",
  })[p] || p;
}

function coverHTML(g, extra = "") {
  const f = fam(g.family);
  const h = (f.hue + (hash(g.title) % 70) - 35 + 360) % 360;
  const letter = (g.title.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase();
  const st = g.status !== "owned" ? `<span class="badge-st">${pill(GAME_STATUS[g.status]?.label || g.status)}</span>` : "";
  return `<div class="cover" style="--h:${h};--fc:${f.color}">
    <div class="band">${esc(shortPlat(g.platform))}</div>${st}
    <div class="initial">${esc(letter)}</div>
    <div class="t">${esc(g.title)}</div>${extra}
  </div>`;
}

function countUp(root = document) {
  $$("[data-count]", root).forEach((el) => {
    const target = +el.dataset.count;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || target < 10) { el.textContent = target.toLocaleString(); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
// animate bar widths / rings after insertion
function grow(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$("[data-w]", root).forEach((el) => (el.style.width = el.dataset.w + "%"));
    $$("[data-flex]", root).forEach((el) => (el.style.flexGrow = el.dataset.flex));
    $$("[data-off]", root).forEach((el) => (el.style.strokeDashoffset = el.dataset.off));
    $$("[data-dash]", root).forEach((el) => (el.style.strokeDasharray = el.dataset.dash));
  }));
}

/* ------------------------------------------------ routing */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { route: path || "", params: new URLSearchParams(qs || "") };
}
function setParams(params) {
  const { route } = parseHash();
  const qs = params.toString();
  history.replaceState(null, "", `#/${route}${qs ? "?" + qs : ""}`);
}
const ROUTES = { "": pageDashboard, collection: pageCollection, plan: pagePlan, series: pageSeries, changelog: pageChangelog };

function route() {
  const { route, params } = parseHash();
  const fn = ROUTES[route] || pageDashboard;
  $$("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.route === (ROUTES[route] ? route : "")));
  app.innerHTML = "";
  const page = document.createElement("div");
  page.className = "page";
  app.appendChild(page);
  fn(page, params);
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------ derived data */
function prepare(d) {
  d.platformFamily = Object.fromEntries(d.platforms.map((p) => [p.name, p.family]));
  d.games.forEach((g, i) => { g.id = i; g._n = norm(g.title + " " + (g.edition || "")); });
  d.targets.forEach((t, i) => { t.id = i; t._n = norm(t.title + " " + t.group + " " + t.plan + " " + t.note); });
  d.series.forEach((s, i) => {
    s.id = i;
    const need = s.entries.filter((e) => !e.optional);
    s.have = need.filter((e) => e.status === "done").length;
    s.need = need.length;
    s.steam = need.filter((e) => e.status === "steam").length;
    s.ordered = need.filter((e) => e.status === "ordered").length;
    s.family = familyOfSpec(s.platforms);
    s._n = norm(s.name + " " + s.entries.map((e) => e.title).join(" "));
  });
  d.targets.forEach((t) => (t.family = familyOfSpec(t.platforms)));
  d.gamesByTitle = new Map();
  d.games.forEach((g) => {
    const k = norm(g.title);
    if (!d.gamesByTitle.has(k)) d.gamesByTitle.set(k, []);
    d.gamesByTitle.get(k).push(g);
  });
  return d;
}
function familyOfSpec(list) {
  const fams = new Set((list || []).map((p) => (PLATFORM_FAMILY_WORDS[p] ?? D.platformFamily[p] ?? guessFamily(p))));
  return fams.size === 1 ? [...fams][0] : "other";
}
function guessFamily(p) {
  const l = p.toLowerCase();
  if (l.includes("xbox")) return "xbox";
  if (l.includes("playstation") || l.startsWith("ps")) return "playstation";
  if (/switch|nintendo|wii|game ?boy|gamecube|3ds|\bds\b/.test(l)) return "nintendo";
  if (l === "pc" || l.includes("steam")) return "pc";
  return "other";
}

/* ------------------------------------------------ dashboard */
function pageDashboard(page) {
  const have = D.games.filter((g) => HAVE.has(g.status));
  const ordered = D.games.filter((g) => g.status === "ordered").length;
  const wish = D.games.filter((g) => g.status === "wishlist").length;
  const famCount = {};
  have.forEach((g) => (famCount[g.family] = (famCount[g.family] || 0) + 1));
  const famOrder = ["nintendo", "playstation", "xbox", "pc", "other"].filter((f) => famCount[f]);
  const tCount = { open: 0, ordered: 0, done: 0, skip: 0 };
  D.targets.forEach((t) => tCount[t.status]++);
  const seriesDone = D.series.filter((s) => s.need && s.have === s.need).length;

  const platCounts = D.platforms.map((p) => ({ ...p, n: have.filter((g) => g.platform === p.name).length })).filter((p) => p.n);
  const maxP = Math.max(...platCounts.map((p) => p.n), 1);

  const upNext = D.targets.filter((t) => t.status === "open" && t.priority === "high")
    .sort((a, b) => (a.state === "watching") - (b.state === "watching") || a.title.localeCompare(b.title)).slice(0, 6);
  const closest = D.series.filter((s) => s.need && s.have < s.need)
    .sort((a, b) => b.have / b.need - a.have / a.need || a.need - b.need).slice(0, 6);

  page.innerHTML = `
    <section class="card hero">
      <div>
        <h1><span class="grad" data-count="${have.length}">${have.length}</span> games<br>on the shelf</h1>
        <p>Physical collection across ${plural(platCounts.length, "platform")} — synced from CLZ, updated ${esc(D.updated)}.</p>
        <div class="fam-bar">${famOrder.map((f) => `<span data-flex="${famCount[f]}" style="flex:0 0 0;flex-grow:0;background:${fam(f).color}" title="${fam(f).label}: ${famCount[f]}"></span>`).join("")}</div>
        <div class="fam-legend">${famOrder.map((f) => `<a href="#/collection?fam=${f}" style="text-decoration:none"><span class="dot" style="background:${fam(f).color}"></span>${fam(f).label} <b>${famCount[f]}</b></a>`).join("")}</div>
        <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">
          <a class="btn primary" href="#/collection">Browse collection →</a>
          <a class="btn" href="#/plan?prio=high">🎯 High-priority buys</a>
        </div>
      </div>
      <div class="card pick" id="pick"></div>
    </section>

    <div class="stats" style="margin-top:14px">
      ${stat("Owned", have.length, `${plural(D.games.length, "row")} in CLZ`, "var(--good)", "#/collection?st=have")}
      ${stat("On order", ordered, "pre-orders & orders", "var(--warn)", "#/collection?st=ordered")}
      ${stat("Wishlist", wish, "marked in CLZ", "var(--accent)", "#/collection?st=wishlist")}
      ${stat("To buy", tCount.open, `of ${D.targets.length} planned targets`, "var(--accent-2)", "#/plan")}
      ${stat("Series done", seriesDone, `of ${D.series.length} trackers`, "var(--playstation)", "#/series")}
    </div>

    <div class="grid grid-2" style="margin-top:14px">
      <div>
        <h2 class="section-title">By platform <small>click to browse</small></h2>
        <div class="card bars">
          ${platCounts.map((p) => `<a class="bar-row" href="#/collection?plat=${encodeURIComponent(p.name)}">
            <span class="name">${esc(p.name)}</span>
            <span class="bar-track"><span data-w="${(p.n / maxP) * 100}" style="background:${fam(p.family).color}"></span></span>
            <span class="n">${p.n}</span></a>`).join("")}
        </div>
      </div>
      <div>
        <h2 class="section-title">Buy plan <small>${D.targets.length} curated targets</small></h2>
        <div class="card donut-wrap">${donut(tCount)}
          <div class="legend">${Object.entries(TARGET_STATUS).map(([k, v]) => `<a href="#/plan?st=${k}"><span><span class="dot" style="background:${v.color}"></span>${v.icon} ${v.label}</span><b>${tCount[k]}</b></a>`).join("")}</div>
        </div>
        <h2 class="section-title">Series closest to done</h2>
        <div class="card" style="padding:6px 8px">
          ${closest.map((s) => `<a class="bar-row" style="padding:8px 10px;grid-template-columns:1fr 110px 46px" href="#/series?open=${s.id}">
            <span class="name" style="color:var(--text)">${esc(s.name)}</span>
            <span class="bar-track"><span data-w="${pct(s.have, s.need)}" style="background:${fam(s.family).color}"></span></span>
            <span class="n">${s.have}/${s.need}</span></a>`).join("")}
        </div>
      </div>
    </div>

    <h2 class="section-title">🎯 Up next <small>high priority, still open</small></h2>
    <div class="targets">${upNext.map(targetHTML).join("") || `<div class="card empty-state">Nothing high-priority open 🎉</div>`}</div>
  `;
  bindTargets(page);
  renderPick($("#pick", page), have);
  countUp(page);
  grow(page);
}

function stat(label, n, sub, color, href) {
  return `<a class="card stat" href="${href}" style="--c:${color}"><div class="label">${label}</div>
    <div class="value" data-count="${n}">${n}</div><div class="sub">${esc(sub)}</div></a>`;
}

function donut(counts) {
  const order = ["done", "ordered", "open", "skip"];
  const total = order.reduce((a, k) => a + counts[k], 0) || 1;
  const r = 62, C = 2 * Math.PI * r;
  let acc = 0;
  const segs = order.map((k) => {
    const len = (counts[k] / total) * C;
    const s = `<circle r="${r}" cx="85" cy="85" stroke="${TARGET_STATUS[k].color}" stroke-dasharray="0 ${C}" data-dash="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 85 85)"><title>${TARGET_STATUS[k].label}: ${counts[k]}</title></circle>`;
    acc += len;
    return s;
  });
  return `<svg class="donut" viewBox="0 0 170 170">${segs.join("")}
    <text x="85" y="88" text-anchor="middle">${pct(counts.done, total)}%</text>
    <text class="small" x="85" y="108" text-anchor="middle">done</text></svg>`;
}

function renderPick(el, pool) {
  if (!pool.length) { el.innerHTML = ""; return; }
  const g = pool[Math.floor(Math.random() * pool.length)];
  el.innerHTML = `${coverHTML(g)}<div>
    <div class="label" style="color:var(--muted);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">🎲 Tonight's pick from the shelf</div>
    <h3 style="margin-top:6px">${esc(g.title)}</h3><p>${esc(g.platform)}</p>
    <button class="btn" id="reroll">Roll again</button> <button class="btn" id="pickOpen">Details</button></div>`;
  $(".cover", el).style.width = "96px";
  $(".cover", el).style.flex = "none";
  $("#reroll", el).onclick = () => renderPick(el, pool);
  $("#pickOpen", el).onclick = () => openGame(g.id);
}

/* ------------------------------------------------ collection */
function pageCollection(page, params) {
  const S = {
    q: params.get("q") || "", fam: params.get("fam") || "", plat: params.get("plat") || "",
    st: params.get("st") || "have", sort: params.get("sort") || "platform", view: params.get("view") || "grid",
  };
  const famKeys = ["nintendo", "playstation", "xbox", "pc"].filter((f) => D.games.some((g) => g.family === f));
  const statuses = ["owned", "for_sale", "ordered", "wishlist", "sold", "other"].filter((s) => D.games.some((g) => g.status === s));

  page.innerHTML = `
    <div class="page-head"><div><h1>Collection</h1><p>Everything in the CLZ export. Tap a game for details.</p></div></div>
    <div class="card toolbar">
      <label class="search">⌕<input id="q" type="search" placeholder="Search titles…" value="${esc(S.q)}"></label>
      <div class="chips" id="fams">
        <button class="chip" data-f="">All</button>
        ${famKeys.map((f) => `<button class="chip" data-f="${f}" style="--c:${fam(f).color}">${fam(f).label}</button>`).join("")}
      </div>
      <select id="plat" aria-label="Platform"><option value="">All platforms</option>${D.platforms.map((p) => `<option>${esc(p.name)}</option>`).join("")}</select>
      <select id="st" aria-label="Status">
        <option value="have">On the shelf</option><option value="">Any status</option>
        ${statuses.map((s) => `<option value="${s}">${GAME_STATUS[s].label}</option>`).join("")}
      </select>
      <select id="sort" aria-label="Sort"><option value="platform">By platform</option><option value="title">A → Z</option><option value="title-desc">Z → A</option><option value="random">Shuffle</option></select>
      <div class="seg" id="view"><button data-v="grid" title="Cover grid">▦</button><button data-v="list" title="List">☰</button></div>
      <span class="count" id="count"></span>
    </div>
    <div id="results"></div>`;

  $("#plat", page).value = S.plat;
  $("#st", page).value = S.st;
  $("#sort", page).value = S.sort;
  const shuffleSeed = Math.random();
  let observer;

  const update = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => {
      const def = { st: "have", sort: "platform", view: "grid" }[k] ?? "";
      if (v !== def) p.set(k, v);
    });
    setParams(p);
    $$("#fams .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.f === S.fam));
    $$("#view button", page).forEach((b) => b.classList.toggle("on", b.dataset.v === S.view));

    const q = norm(S.q);
    let list = D.games.filter((g) =>
      (!q || g._n.includes(q)) && (!S.fam || g.family === S.fam) && (!S.plat || g.platform === S.plat) &&
      (!S.st || (S.st === "have" ? HAVE.has(g.status) : g.status === S.st)));
    if (S.sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (S.sort === "title-desc") list = [...list].sort((a, b) => b.title.localeCompare(a.title));
    if (S.sort === "random") list = [...list].sort((a, b) => hash(a.title + shuffleSeed) - hash(b.title + shuffleSeed));
    $("#count", page).innerHTML = `<b>${list.length.toLocaleString()}</b> games`;

    const res = $("#results", page);
    observer?.disconnect();
    if (!list.length) {
      res.innerHTML = `<div class="card empty-state"><div class="big">🕹️</div>No games match. ${
        q ? `<p><a href="#/plan?q=${encodeURIComponent(S.q)}">Search the buy plan for “${esc(S.q)}” →</a></p>` : ""}</div>`;
      return;
    }
    let shown = 0;
    const PAGE = S.view === "grid" ? 90 : 200;
    if (S.view === "grid") {
      res.innerHTML = `<div class="covers" id="items"></div><div class="more" id="sentinel"></div>`;
    } else {
      res.innerHTML = `<div class="card table-wrap"><table><thead><tr><th>Title</th><th>Platform</th><th>Status</th><th>Notes</th></tr></thead><tbody id="items"></tbody></table></div><div class="more" id="sentinel"></div>`;
    }
    const items = $("#items", res);
    const more = () => {
      const chunk = list.slice(shown, shown + PAGE);
      shown += chunk.length;
      items.insertAdjacentHTML("beforeend", chunk.map(S.view === "grid" ? gameCard : gameRow).join(""));
      if (shown >= list.length) observer?.disconnect();
    };
    more();
    observer = new IntersectionObserver((es) => es[0].isIntersecting && more(), { rootMargin: "800px" });
    observer.observe($("#sentinel", res));
  };

  page.addEventListener("click", (e) => {
    const g = e.target.closest("[data-game]");
    if (g) openGame(+g.dataset.game);
  });
  $("#q", page).addEventListener("input", (e) => { S.q = e.target.value; update(); });
  $("#fams", page).addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    S.fam = c.dataset.f;
    if (S.plat && S.fam && platFamily(S.plat) !== S.fam) { S.plat = ""; $("#plat", page).value = ""; }
    update();
  });
  $("#plat", page).addEventListener("change", (e) => { S.plat = e.target.value; if (S.plat) S.fam = ""; update(); });
  $("#st", page).addEventListener("change", (e) => { S.st = e.target.value; update(); });
  $("#sort", page).addEventListener("change", (e) => { S.sort = e.target.value; update(); });
  $("#view", page).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.view = b.dataset.v; update(); } });
  update();
}

function gameCard(g) {
  return `<button class="game" data-game="${g.id}">${coverHTML(g)}<div class="meta">${esc(g.platform)}${g.note ? " · 📝" : ""}</div></button>`;
}
function gameRow(g) {
  const st = GAME_STATUS[g.status] || GAME_STATUS.other;
  return `<tr data-game="${g.id}" style="cursor:pointer"><td class="title">${esc(g.title)}${g.edition ? ` <span class="note">(${esc(g.edition)})</span>` : ""}</td>
    <td>${platPill(g.platform)}</td><td>${pill(st.label, st.color)}</td><td class="note">${esc(g.note || "")}</td></tr>`;
}

/* ------------------------------------------------ buy plan */
function pagePlan(page, params) {
  const S = {
    q: params.get("q") || "", st: params.get("st") ?? "open", prio: params.get("prio") || "",
    state: params.get("state") || "", fam: params.get("fam") || "", group: params.get("group") || "",
    by: params.get("by") || "prio",
  };
  const groups = [...new Set(D.targets.map((t) => t.group || "Other"))].sort();
  const states = [...new Set(D.targets.map((t) => t.state).filter(Boolean))].sort();
  const famKeys = ["nintendo", "playstation", "xbox", "pc", "other"].filter((f) => D.targets.some((t) => t.family === f));

  page.innerHTML = `
    <div class="page-head"><div><h1>Buy plan</h1><p>Curated targets — ticked ✅ automatically when the game shows up in CLZ. 📀 = already owned on another platform.</p></div></div>
    <div class="card toolbar">
      <label class="search">⌕<input id="q" type="search" placeholder="Search titles, notes, groups…" value="${esc(S.q)}"></label>
      <div class="chips" id="sts">
        ${Object.entries(TARGET_STATUS).map(([k, v]) => `<button class="chip" data-s="${k}" style="--c:${v.color}">${v.icon} ${v.label}</button>`).join("")}
        <button class="chip" data-s="">All</button>
      </div>
      <div class="chips" id="prios">${Object.entries(PRIORITY).map(([k, v]) => `<button class="chip" data-p="${k}" style="--c:${v.color}">${v.label}</button>`).join("")}</div>
      <select id="fam" aria-label="Family"><option value="">All systems</option>${famKeys.map((f) => `<option value="${f}">${f === "other" ? "Mixed / any" : fam(f).label}</option>`).join("")}</select>
      <select id="state" aria-label="State"><option value="">Any state</option>${states.map((s) => `<option>${esc(s)}</option>`).join("")}</select>
      <select id="group" aria-label="Group"><option value="">All groups</option>${groups.map((g) => `<option>${esc(g)}</option>`).join("")}</select>
      <select id="by" aria-label="Group by"><option value="prio">Group by priority</option><option value="group">Group by group</option><option value="none">No grouping</option></select>
      <span class="count" id="count"></span>
    </div>
    <div id="results"></div>`;
  ["fam", "state", "group", "by"].forEach((k) => ($("#" + k, page).value = S[k]));

  const update = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => { const def = { st: "open", by: "prio" }[k] ?? ""; if (v !== def) p.set(k, v); });
    setParams(p);
    $$("#sts .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.s === S.st));
    $$("#prios .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.p === S.prio));
    const q = norm(S.q);
    const list = D.targets.filter((t) => (!q || t._n.includes(q)) && (!S.st || t.status === S.st) &&
      (!S.prio || t.priority === S.prio) && (!S.state || t.state === S.state) && (!S.fam || t.family === S.fam) &&
      (!S.group || (t.group || "Other") === S.group))
      .sort((a, b) => (PRIORITY[a.priority]?.rank ?? 9) - (PRIORITY[b.priority]?.rank ?? 9) || a.title.localeCompare(b.title));
    $("#count", page).innerHTML = `<b>${list.length}</b> targets`;
    const res = $("#results", page);
    if (!list.length) { res.innerHTML = `<div class="card empty-state"><div class="big">🛒</div>Nothing matches.</div>`; return; }
    const buckets = new Map();
    list.forEach((t) => {
      const k = S.by === "prio" ? t.priority : S.by === "group" ? t.group || "Other" : "";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(t);
    });
    const keys = [...buckets.keys()];
    if (S.by === "group") keys.sort();
    res.innerHTML = keys.map((k) => `${k ? `<div class="group-head">${esc(S.by === "prio" ? (PRIORITY[k]?.label || k) + " priority" : k)} · ${buckets.get(k).length}</div>` : ""}
      <div class="targets">${buckets.get(k).map(targetHTML).join("")}</div>`).join("");
  };

  bindTargets(page);
  $("#q", page).addEventListener("input", (e) => { S.q = e.target.value; update(); });
  $("#sts", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.st = c.dataset.s; update(); } });
  $("#prios", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.prio = S.prio === c.dataset.p ? "" : c.dataset.p; update(); } });
  ["fam", "state", "group", "by"].forEach((k) => $("#" + k, page).addEventListener("change", (e) => { S[k] = e.target.value; update(); }));
  update();
}

function targetHTML(t) {
  const st = TARGET_STATUS[t.status];
  const pr = PRIORITY[t.priority] || { label: t.priority, color: "var(--faint)" };
  const right = t.status === "done" ? `Owned on ${esc([...new Set(t.hits.map((h) => h.platform))].join(", "))}` : esc(t.plan);
  return `<div class="card target" data-target="${t.id}" style="--c:${pr.color}" tabindex="0">
    <div class="ico">${st.icon}</div>
    <div><h3>${esc(t.title)}</h3>
      <div class="row">${(t.platforms.length ? t.platforms : ["any"]).map(platPill).join("")}${pill(pr.label, pr.color)}
        ${t.state && t.status === "open" ? pill(t.state, "var(--accent-2)") : ""}
        ${t.elsewhere.length && t.status !== "done" ? pill("📀 owned on " + t.elsewhere.map(shortPlat).join(", "), "var(--good)") : ""}
        ${t.verify && t.status !== "done" ? pill("❓ verify", "var(--warn)") : ""}</div>
      ${t.note ? `<div class="note">${esc(t.note)}</div>` : ""}</div>
    <div class="right">${right}${t.status === "open" ? `<div class="shops-inline">${shopChips(t.title, targetPlatforms(t)[0], t.plan)}</div>` : ""}</div></div>`;
}

/* ------------------------------------------------ shop search links */
const SHOPS = [
  { id: "geizhals", label: "Geizhals", kind: "new", url: (q) => `https://geizhals.de/?fs=${q}` },
  { id: "rebuy", label: "rebuy", kind: "used", url: (q) => `https://www.rebuy.de/kaufen/suchen?q=${q}` },
  { id: "ebay", label: "eBay", kind: "used", url: (q) => `https://www.ebay.de/sch/i.html?_nkw=${q}&_sacat=139973&LH_ItemCondition=3000` },
  { id: "medimops", label: "medimops", kind: "used", url: (q) => `https://www.medimops.de/produkte-C0/?fcIsSearch=1&searchparam=${q}` },
];
// how German shops name the platforms in listings
const SHOP_PLATFORM = {
  "Nintendo Switch 2": "Switch 2", "Nintendo Switch": "Switch", "Nintendo 64": "N64", "Nintendo 3DS": "3DS",
  "Nintendo DS": "Nintendo DS", "Game Boy Advance": "Game Boy Advance", "PlayStation 5": "PS5", "PlayStation 4": "PS4",
  "PlayStation 3": "PS3", "PlayStation 2": "PS2", "PlayStation": "PS1", "PlayStation Vita": "PS Vita",
  "Xbox Series X|S": "Xbox Series X", "Xbox": "Xbox Classic",
};
const SPEC_PLATFORMS = {
  "xbox-modern": ["Xbox Series X|S", "Xbox One"],
};
// concrete platforms a target / series entry can be bought for ([] = unspecific → search by title only)
function targetPlatforms(t) {
  const out = [];
  for (const p of t.platforms || []) {
    if (SPEC_PLATFORMS[p]) out.push(...SPEC_PLATFORMS[p]);
    else if (!PLATFORM_FAMILY_WORDS[p] && p !== "any") out.push(p);
    else return [];
  }
  return [...new Set(out)].slice(0, 4);
}
function shopQuery(title, platform) {
  const q = platform ? `${title} ${SHOP_PLATFORM[platform] || platform}` : title;
  return encodeURIComponent(q.replace(/[™®©:]/g, " ").replace(/\s+/g, " ").trim()).replace(/%20/g, "+");
}
// plan text decides which shop is highlighted: a named shop wins, else "used" → used shops, "new" → Geizhals
function preferredShops(plan) {
  const p = (plan || "").toLowerCase();
  const named = SHOPS.filter((s) => p.includes(s.id));
  if (named.length) return new Set(named.map((s) => s.id));
  if (/used|gebraucht/.test(p)) return new Set(SHOPS.filter((s) => s.kind === "used").map((s) => s.id));
  if (/\bnew\b|neu/.test(p)) return new Set(["geizhals"]);
  return new Set();
}
function shopChips(title, platform, plan) {
  const pref = preferredShops(plan);
  const q = shopQuery(title, platform);
  return SHOPS.map((s) => `<a class="shop${pref.has(s.id) ? " pref" : ""}" data-kind="${s.kind}" href="${s.url(q)}" target="_blank" rel="noopener noreferrer"
    title="${s.kind === "new" ? "Price comparison, new" : "Used copies"} — ${esc(s.label)}: ${esc(decodeURIComponent(q.replace(/\+/g, " ")))}">${esc(s.label)}</a>`).join("");
}
function shopBlock(title, platforms, plan) {
  const rows = (platforms.length ? platforms : [""]).map((p) => `<div class="shop-row">
    <span class="shop-plat">${p ? platPill(p) : pill("any platform")}</span><span class="shops">${shopChips(title, p, plan)}</span></div>`);
  return `<h3 style="margin:18px 0 8px;font-size:15px">🛒 Find it <small style="color:var(--faint);font-weight:500">Geizhals = new · rebuy / eBay / medimops = used</small></h3>
    <div class="shop-block">${rows.join("")}</div>`;
}
function bindTargets(root) {
  root.addEventListener("click", (e) => {
    if (e.target.closest("a.shop")) return; // shop links open in a new tab, not the modal
    const t = e.target.closest("[data-target]"); if (t) openTarget(+t.dataset.target);
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("a.shop")) return;
    const t = e.target.closest("[data-target]"); if (t && e.key === "Enter") openTarget(+t.dataset.target);
  });
}

/* ------------------------------------------------ series */
function pageSeries(page, params) {
  const S = { q: params.get("q") || "", show: params.get("show") || "", sort: params.get("sort") || "file" };
  page.innerHTML = `
    <div class="page-head"><div><h1>Series trackers</h1><p>✅ owned · 🕒 ordered · ⬜ missing · 💻 only on Steam · ➖ not needed</p></div></div>
    <div class="card toolbar">
      <label class="search">⌕<input id="q" type="search" placeholder="Search series or entries…" value="${esc(S.q)}"></label>
      <div class="chips" id="show"><button class="chip" data-v="">All</button><button class="chip" data-v="todo">In progress</button><button class="chip" data-v="done" style="--c:var(--good)">Complete</button></div>
      <select id="sort" aria-label="Sort"><option value="file">Curated order</option><option value="progress">Most complete</option><option value="missing">Most missing</option><option value="name">A → Z</option></select>
      <span class="count" id="count"></span>
    </div>
    <div class="series-grid" id="results"></div>`;
  $("#sort", page).value = S.sort;

  const update = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => { if (v && !(k === "sort" && v === "file")) p.set(k, v); });
    setParams(p);
    $$("#show .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.v === S.show));
    const q = norm(S.q);
    let list = D.series.filter((s) => (!q || s._n.includes(q)) &&
      (!S.show || (S.show === "done" ? s.have === s.need : s.have < s.need)));
    if (S.sort === "progress") list = [...list].sort((a, b) => b.have / (b.need || 1) - a.have / (a.need || 1));
    if (S.sort === "missing") list = [...list].sort((a, b) => (b.need - b.have) - (a.need - a.have));
    if (S.sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    $("#count", page).innerHTML = `<b>${list.length}</b> series`;
    $("#results", page).innerHTML = list.map(seriesCard).join("") || `<div class="card empty-state">No series match.</div>`;
    grow(page);
  };
  page.addEventListener("click", (e) => { const c = e.target.closest("[data-series]"); if (c) openSeries(+c.dataset.series); });
  $("#q", page).addEventListener("input", (e) => { S.q = e.target.value; update(); });
  $("#show", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.show = c.dataset.v; update(); } });
  $("#sort", page).addEventListener("change", (e) => { S.sort = e.target.value; update(); });
  update();
  if (params.get("open")) openSeries(+params.get("open"));
}

function ring(have, need, color) {
  const r = 27, C = 2 * Math.PI * r, k = need ? have / need : 0;
  return `<svg class="ring" viewBox="0 0 64 64"><circle class="track" r="${r}" cx="32" cy="32"/>
    <circle class="val" r="${r}" cx="32" cy="32" stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - k)}"/>
    <text x="32" y="37" text-anchor="middle">${Math.round(k * 100)}%</text></svg>`;
}
function seriesCard(s) {
  const complete = s.need && s.have === s.need;
  const color = complete ? "var(--good)" : fam(s.family).color;
  const extra = [s.ordered && `🕒 ${s.ordered}`, s.steam && `💻 ${s.steam} on Steam`].filter(Boolean).join(" · ");
  return `<button class="card series-card${complete ? " complete" : ""}" data-series="${s.id}" style="--c:${color}">
    ${ring(s.have, s.need, color)}
    <div style="min-width:0"><h3>${esc(s.name)} ${complete ? "🏆" : ""}</h3>
      <div class="sub">${s.have}/${s.need} physical${extra ? " · " + extra : ""}</div>
      <div class="pips">${s.entries.map((e) => `<span class="pip ${e.status}" title="${esc(e.title)}"></span>`).join("")}</div></div></button>`;
}

/* ------------------------------------------------ changelog */
function pageChangelog(page) {
  const md = D.changelog.replace(/^# .*\n/, "");
  page.innerHTML = `<div class="page-head"><div><h1>Changelog</h1><p>Written automatically with every CLZ import.</p></div></div>
    <div class="card md">${mdToHtml(md) || "<p>No imports yet.</p>"}</div>`;
}
function mdToHtml(md) {
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>");
  let out = "", inList = false;
  for (const line of md.split("\n")) {
    if (/^- /.test(line)) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(line.slice(2))}</li>`; continue; }
    if (inList) { out += "</ul>"; inList = false; }
    if (/^#{2,3} /.test(line)) out += `<h2>${inline(line.replace(/^#+ /, ""))}</h2>`;
    else if (line.trim()) out += `<p>${inline(line)}</p>`;
  }
  return out + (inList ? "</ul>" : "");
}

/* ------------------------------------------------ detail modals */
const modal = document.getElementById("modal");
function showModal(head, body) {
  $("#modalBody").innerHTML = `<div class="modal-inner"><div class="modal-head">${head}<button class="icon-btn close" aria-label="Close">✕</button></div>
    <div class="modal-body">${body}</div></div>`;
  $(".close", modal).onclick = () => modal.close();
  if (!modal.open) modal.showModal();
  $(".modal-body", modal).scrollTop = 0;
  grow(modal);
}
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
  if (e.target.closest("a.shop")) return;
  const g = e.target.closest("[data-game]"), t = e.target.closest("[data-target]"), s = e.target.closest("[data-series]");
  if (g) openGame(+g.dataset.game); else if (t) openTarget(+t.dataset.target); else if (s) openSeries(+s.dataset.series);
});

function relatedFor(title) {
  const k = norm(title);
  const targets = D.targets.filter((t) => norm(t.title) === k || t.hits.some((h) => norm(h.title) === k));
  const series = D.series.filter((s) => s.entries.some((e) => norm(e.title) === k || e.hits.some((h) => norm(h.title) === k)));
  return { copies: D.gamesByTitle.get(k) || [], targets, series };
}
function relatedHTML(rel, skipGame) {
  let h = "";
  const copies = rel.copies.filter((g) => g.id !== skipGame);
  if (copies.length) h += `<h3 style="margin:14px 0 8px;font-size:15px">Other copies</h3><div class="row" style="display:flex;gap:6px;flex-wrap:wrap">${copies.map((g) => `<a href="javascript:void 0" data-game="${g.id}" style="text-decoration:none">${platPill(g.platform)} ${pill(GAME_STATUS[g.status]?.label || g.status)}</a>`).join("")}</div>`;
  if (rel.targets.length) h += `<h3 style="margin:18px 0 8px;font-size:15px">In the buy plan</h3><div class="targets">${rel.targets.map(targetHTML).join("")}</div>`;
  if (rel.series.length) h += `<h3 style="margin:18px 0 8px;font-size:15px">Part of</h3><div class="series-grid">${rel.series.map(seriesCard).join("")}</div>`;
  return h;
}
function kv(pairs) {
  const rows = pairs.filter(([, v]) => v);
  return rows.length ? `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
}

function openGame(id) {
  const g = D.games[id];
  const st = GAME_STATUS[g.status] || GAME_STATUS.other;
  const body = kv([
    ["Edition", esc(g.edition)], ["Format", esc(g.format)], ["Region", esc(g.region)], ["Completeness", esc(g.completeness)],
    ["Condition", esc(g.condition)], ["Released", esc(g.release_date)], ["Publisher", esc(g.publisher)], ["Developer", esc(g.developer)],
    ["Genre", esc(g.genre)], ["Purchased", esc([g.purchase_date, g.store, g.purchase_price].filter(Boolean).join(" · "))],
    ["Notes", esc(g.note)],
  ]) + (HAVE.has(g.status) ? `<details class="shop-details"><summary>🛒 Look for another copy (upgrade / replacement)</summary>${shopBlock(g.title, [g.platform])}</details>`
    : shopBlock(g.title, [g.platform])) + relatedHTML(relatedFor(g.title), g.id);
  showModal(`${coverHTML(g)}<div><h2>${esc(g.title)}</h2><div class="row">${platPill(g.platform)}${pill(st.icon + " " + st.label, st.color)}</div></div>`,
    body || `<p style="color:var(--muted)">No extra details in CLZ for this one.</p>`);
  $(".modal-head .cover", modal).style.width = "90px";
}

function openTarget(id) {
  const t = D.targets[id];
  const st = TARGET_STATUS[t.status], pr = PRIORITY[t.priority] || { label: t.priority, color: "var(--faint)" };
  const body = kv([
    ["Platforms", (t.platforms.length ? t.platforms : ["any"]).map(platPill).join(" ")],
    ["Priority", pill(pr.label, pr.color)], ["Group", esc(t.group)], ["State", esc(t.state)], ["Plan", esc(t.plan)],
    ["Note", esc(t.note)], ["Verify", t.verify ? "❓ " + esc(t.verify) : ""],
    ["Owned on", t.hits.filter((h) => HAVE.has(h.status)).map((h) => platPill(h.platform)).join(" ")],
    ["Also owned", t.elsewhere.map(platPill).join(" ")],
    ["Source", `<code>data/targets/${esc(t.file)}.toml</code>`],
  ]);
  const rel = relatedFor(t.title);
  rel.targets = rel.targets.filter((x) => x.id !== t.id);
  const shops = t.status === "done" ? "" : shopBlock(t.title, targetPlatforms(t), t.plan);
  showModal(`<div style="font-size:40px;line-height:1">${st.icon}</div><div><h2>${esc(t.title)}</h2><div class="row">${pill(st.label, st.color)}</div></div>`,
    body + shops + relatedHTML(rel));
}

function openSeries(id) {
  const s = D.series[id];
  if (!s) return;
  const color = s.have === s.need ? "var(--good)" : fam(s.family).color;
  const body = `${s.description ? `<p style="color:var(--muted)">${esc(s.description)}</p>` : ""}
    <ul class="entries">${s.entries.map((e) => {
      const st = ENTRY_STATUS[e.status] || ENTRY_STATUS.open;
      const where = ["done", "ordered"].includes(e.status) ? [...new Set(e.hits.map((h) => h.platform + (h.edition ? ` (${h.edition})` : "")))].join(", ") : "";
      const note = [e.verify && e.status !== "done" ? "❓ " + e.verify : "", where || e.note].filter(Boolean).join(" · ");
      const g = e.hits.find((h) => HAVE.has(h.status));
      const gid = g && (D.gamesByTitle.get(norm(g.title)) || []).find((x) => x.platform === g.platform)?.id;
      return `<li class="${e.status}" title="${st.label}"><span>${st.icon}</span>
        <div><div ${gid != null ? `data-game="${gid}" style="cursor:pointer;font-weight:600"` : 'style="font-weight:600"'}>${esc(e.title)}${e.optional ? ' <span class="note">(optional)</span>' : ""}</div>
        ${note ? `<div class="note">${esc(note)}</div>` : ""}
        ${e.status === "open" ? `<div class="shops-inline">${shopChips(e.title, targetPlatforms({ platforms: s.platforms })[0], e.note)}</div>` : ""}</div>
        <span class="yr">${esc(e.year)}</span></li>`;
    }).join("")}</ul>`;
  showModal(`${ring(s.have, s.need, color)}<div><h2>${esc(s.name)}</h2><div class="row">${pill(`${s.have}/${s.need} physical`, color)}
    ${s.steam ? pill(`💻 ${s.steam} Steam`, "var(--pc)") : ""}${(s.platforms || []).map(platPill).join("")}</div></div>`, body);
}

/* ------------------------------------------------ command palette */
const palette = document.getElementById("palette");
const pIn = document.getElementById("paletteInput");
const pRes = document.getElementById("paletteResults");
let pSel = 0, pItems = [];
function openPalette() {
  pIn.value = "";
  renderPalette();
  palette.showModal();
  pIn.focus();
}
function renderPalette() {
  const q = norm(pIn.value);
  pSel = 0;
  if (!q) { pItems = []; pRes.innerHTML = `<div class="empty">Type to search ${plural(D.games.length, "game")}, ${plural(D.targets.length, "target")} and ${D.series.length} series.</div>`; return; }
  const score = (n) => (n.startsWith(q) ? 0 : n.includes(" " + q) ? 1 : 2);
  const games = D.games.filter((g) => g._n.includes(q)).sort((a, b) => score(a._n) - score(b._n)).slice(0, 8)
    .map((g) => ({ kind: "game", id: g.id, label: g.title, sub: g.platform, icon: GAME_STATUS[g.status]?.icon }));
  const series = D.series.filter((s) => norm(s.name).includes(q)).slice(0, 4)
    .map((s) => ({ kind: "series", id: s.id, label: s.name, sub: `${s.have}/${s.need}`, icon: "📚" }));
  const targets = D.targets.filter((t) => norm(t.title).includes(q)).slice(0, 6)
    .map((t) => ({ kind: "target", id: t.id, label: t.title, sub: t.platforms.join(", "), icon: TARGET_STATUS[t.status].icon }));
  pItems = [...games, ...series, ...targets];
  pRes.innerHTML = pItems.length ? pItems.map((it, i) => `<a data-i="${i}" class="${i === 0 ? "sel" : ""}"><span>${it.icon || ""}</span>
    <span><b>${esc(it.label)}</b> <span style="color:var(--muted);font-size:13px">${esc(it.sub)}</span></span>
    <span class="kind">${it.kind === "target" ? "buy plan" : it.kind}</span></a>`).join("") : `<div class="empty">No matches.</div>`;
}
function choosePalette(i) {
  const it = pItems[i]; if (!it) return;
  palette.close();
  ({ game: openGame, target: openTarget, series: openSeries })[it.kind](it.id);
}
pIn.addEventListener("input", renderPalette);
pIn.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    pSel = (pSel + (e.key === "ArrowDown" ? 1 : -1) + pItems.length) % (pItems.length || 1);
    $$("a", pRes).forEach((a, i) => a.classList.toggle("sel", i === pSel));
    $$("a", pRes)[pSel]?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter") { e.preventDefault(); choosePalette(pSel); }
});
pRes.addEventListener("click", (e) => { const a = e.target.closest("a[data-i]"); if (a) choosePalette(+a.dataset.i); });
palette.addEventListener("click", (e) => { if (e.target === palette) palette.close(); });
document.getElementById("searchBtn").onclick = openPalette;
document.addEventListener("keydown", (e) => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
  if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
    e.preventDefault();
    if (D && !palette.open) openPalette();
  }
});

/* ------------------------------------------------ theme */
document.getElementById("themeBtn").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("gc-theme", next); } catch (e) { /* storage unavailable */ }
};

/* ------------------------------------------------ boot */
fetch("data.json", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status + " " + r.statusText); return r.json(); })
  .then((d) => {
    D = d;
    prepare(D);
    document.getElementById("foot").innerHTML = `Data updated ${esc(D.updated)} · generated from CLZ by <code>scripts/gamecoll.py export</code>`;
    window.addEventListener("hashchange", route);
    route();
  })
  .catch((err) => {
    app.innerHTML = `<div class="card error"><h2>Couldn't load data.json</h2><p>${esc(err.message)}</p>
      <p>Run <code>python3 scripts/gamecoll.py export</code> and serve the <code>site/</code> folder.</p></div>`;
  });
