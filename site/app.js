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
const norm = (s) => String(s ?? "").replace(/[™®©]/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
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

// IGDB cover (image id checked again here; the build already rejects anything else) with the gradient card as fallback
const COVER_ID = /^[a-z0-9]{2,32}$/;
const coverUrl = (id, size = "t_cover_big") => `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`;
function coverHTML(g, extra = "") {
  const f = fam(g.family);
  const h = (f.hue + (hash(g.title) % 70) - 35 + 360) % 360;
  const letter = (g.title.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase();
  const st = g.status && g.status !== "owned" ? `<span class="badge-st">${pill(GAME_STATUS[g.status]?.label || g.status)}</span>` : "";
  const img = g.cover && COVER_ID.test(g.cover)
    ? `<img class="cv" src="${coverUrl(g.cover)}" alt="" loading="lazy" decoding="async" width="264" height="374" referrerpolicy="no-referrer">` : "";
  return `<div class="cover${img ? " has-img" : ""}" style="--h:${h};--fc:${f.color}">${img}
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
const ROUTES = { "": pageDashboard, collection: pageCollection, plan: pagePlan, strategy: pageStrategy, decisions: pageDecisions, series: pageSeries, changelog: pageChangelog };

function route() {
  const { route, params } = parseHash();
  if (modal.open) modal.close();
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
  d.rules = d.rules || [];
  d.rulesById = new Map(d.rules.map((r) => [r.id, r]));
  d.rules.forEach((r, i) => {
    r.idx = i;
    r.targets = d.targets.filter((t) => (t.rules || []).includes(r.id));
    r.entries = d.series.flatMap((s) => s.entries.filter((e) => (e.rules || []).includes(r.id)).map((e) => ({ s, e })));
    r.seriesTagged = d.series.filter((s) => (s.rules || []).includes(r.id));
    r.counts = { open: 0, ordered: 0, done: 0, skip: 0 };
    r.targets.forEach((t) => r.counts[t.status]++);
    r._n = norm([r.id, r.short, r.summary, r.rationale, ...(r.precedents || [])].join(" "));
  });
  // most specific rule first: a rule that decides few targets says more about this one than "gaps bought used"
  const specific = (a, b) => d.rulesById.get(a).targets.length - d.rulesById.get(b).targets.length;
  d.targets.forEach((t) => { t.rules = (t.rules || []).filter((id) => d.rulesById.has(id)).sort(specific); t._n += " " + norm(t.rules.join(" ")); });
  d.decisions = d.decisions || [];
  d.decisionsById = new Map(d.decisions.map((x) => [x.id, x]));
  d.targets.forEach((t) => (t.decisions = []));
  d.decisions.forEach((x, i) => {
    x.idx = i;
    x.targets = (x.target_ids || []).map((j) => d.targets[j]).filter(Boolean);
    if (x.status === "open") x.targets.forEach((t) => t.decisions.push(x.id));
    x._n = norm([x.id, x.question, x.context, x.recommendation, x.outcome, ...(x.option || []).map((o) => o.label)].join(" "));
  });
  d.targets.forEach((t) => (t.check = ruleCheck(t)));
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

    ${latestReviewHTML()}
    ${dueSoonHTML()}
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
  let observer;
  const S = {
    q: params.get("q") || "", st: params.get("st") ?? "open", prio: params.get("prio") || "",
    state: params.get("state") || "", fam: params.get("fam") || "", group: params.get("group") || "",
    by: params.get("by") || "prio", rule: params.get("rule") || "", dec: params.get("dec") || "", nf: params.get("nf") || "",
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
      <select id="rule" aria-label="Rule"><option value="">Any rule</option>${ruleOptions()}</select>
      <select id="nf" aria-label="Notes"><option value="">Any notes</option>${Object.entries(NOTE_FILTERS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
      <select id="dec" aria-label="Open question"><option value="">Any question</option>${D.decisions.filter((x) => x.status === "open" && x.targets.length).map((x) => `<option value="${esc(x.id)}">${esc(x.question.slice(0, 60))} (${x.targets.length})</option>`).join("")}</select>
      <select id="by" aria-label="Group by"><option value="prio">Group by priority</option><option value="group">Group by group</option><option value="rule">Group by rule</option><option value="none">No grouping</option></select>
      <span class="count" id="count"></span>
    </div>
    <div id="ruleNote"></div>
    <div id="results"></div>`;
  ["fam", "state", "group", "rule", "nf", "dec", "by"].forEach((k) => ($("#" + k, page).value = S[k]));

  const update = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => { const def = { st: "open", by: "prio" }[k] ?? ""; if (v !== def) p.set(k, v); });
    setParams(p);
    $$("#sts .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.s === S.st));
    $$("#prios .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.p === S.prio));
    const q = norm(S.q);
    const list = D.targets.filter((t) => (!q || t._n.includes(q)) && (!S.st || t.status === S.st) &&
      (!S.prio || t.priority === S.prio) && (!S.state || t.state === S.state) && (!S.fam || t.family === S.fam) &&
      (!S.group || (t.group || "Other") === S.group) && (!S.rule || t.rules.includes(S.rule)) &&
      (!S.dec || D.decisionsById.get(S.dec)?.targets.includes(t)) && (!S.nf || NOTE_FILTERS[S.nf]?.test(t)))
      .sort((a, b) => (PRIORITY[a.priority]?.rank ?? 9) - (PRIORITY[b.priority]?.rank ?? 9) || a.title.localeCompare(b.title));
    $("#count", page).innerHTML = `<b>${list.length}</b> targets`;
    const r = D.rulesById.get(S.rule);
    $("#ruleNote", page).innerHTML = r ? `<div class="card rule-banner" data-rule="${esc(r.id)}" style="--c:${ruleColor(r)}">
      <b>${esc(r.short)}</b>${r.status !== "adopted" ? " " + pill(r.status, "var(--warn)") : ""}<span>${esc(r.summary)}</span><span class="more-link">Rule details →</span></div>` : "";
    const res = $("#results", page);
    observer?.disconnect();
    if (!list.length) { res.innerHTML = `<div class="card empty-state"><div class="big">🛒</div>Nothing matches.</div>`; return; }
    const buckets = new Map();
    list.forEach((t) => {
      const ks = S.by === "prio" ? [t.priority] : S.by === "group" ? [t.group || "Other"] : S.by === "rule" ? (t.rules.length ? t.rules : ["(no rule)"]) : [""];
      ks.forEach((k) => { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(t); });
    });
    const keys = [...buckets.keys()];
    if (S.by === "group") keys.sort();
    if (S.by === "rule") keys.sort((a, b) => (D.rulesById.get(a)?.idx ?? 999) - (D.rulesById.get(b)?.idx ?? 999));
    const head = (k) => S.by === "prio" ? (PRIORITY[k]?.label || k) + " priority" : S.by === "rule" ? D.rulesById.get(k)?.short || k : k;
    // rendered in chunks while scrolling (like the collection): hundreds of cards at once crash iPhone Safari
    const queue = keys.flatMap((k) => buckets.get(k).map((t) => [k, t]));
    res.innerHTML = `<div id="groups"></div><div class="more" id="sentinel"></div>`;
    const groupsEl = $("#groups", res);
    let shown = 0, curKey = null, curList = null;
    const more = () => {
      const chunk = queue.slice(shown, shown + 40);
      shown += chunk.length;
      for (let i = 0; i < chunk.length;) {
        const k = chunk[i][0];
        if (k !== curKey || !curList) {
          curKey = k;
          groupsEl.insertAdjacentHTML("beforeend", `${k ? `<div class="group-head">${esc(head(k))} · ${buckets.get(k).length}</div>` : ""}<div class="targets"></div>`);
          curList = groupsEl.lastElementChild;
        }
        let j = i;
        while (j < chunk.length && chunk[j][0] === k) j++;
        curList.insertAdjacentHTML("beforeend", chunk.slice(i, j).map(([, t]) => targetHTML(t)).join(""));
        i = j;
      }
      if (shown >= queue.length) observer?.disconnect();
    };
    more();
    observer = new IntersectionObserver((es) => es[0].isIntersecting && more(), { rootMargin: "800px" });
    observer.observe($("#sentinel", res));
  };

  bindTargets(page);
  $("#q", page).addEventListener("input", (e) => { S.q = e.target.value; update(); });
  $("#sts", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.st = c.dataset.s; update(); } });
  $("#prios", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.prio = S.prio === c.dataset.p ? "" : c.dataset.p; update(); } });
  ["fam", "state", "group", "rule", "nf", "dec", "by"].forEach((k) => $("#" + k, page).addEventListener("change", (e) => { S[k] = e.target.value; update(); }));
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
        ${t.verify && t.status !== "done" ? pill("❓ verify", "var(--warn)") : ""}
        ${t.status === "open" ? t.decisions.map((id) => D.decisionsById.get(id)).filter((x) => x.targets.length <= 5).map((x) =>
          `<button class="q-pill" data-decision="${esc(x.id)}" title="${esc(x.question)}">⚖️ open question</button>`).join("") : ""}
        ${t.check?.state === "differs" ? `<span class="diff-pill" title="${esc(t.check.why)}">≠ rules</span>` : ""}</div>
      ${t.rules.length ? `<div class="row rules-row">${rulePills(t.rules, 3)}</div>` : ""}
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
// release databases: which physical versions exist, what's on the disc / cart, German cut or uncut
const RELEASE_SITES = [
  { label: "VGCollect", tip: "Physical releases per region and edition, box photos", url: (t, p) => ddg("vgcollect.com", t, p) },
  { label: "Does It Play?", tip: "Full game on the disc / cart, or does it need a download?", url: (t) => ddg("doesitplay.org", t) },
  { label: "MobyGames", tip: "Releases per platform and region, editions", url: (t) => `https://www.mobygames.com/search/?q=${enc(t)}&type=game` },
  { label: "PriceCharting", tip: "Editions and variants (with used prices)", url: (t, p) => `https://www.pricecharting.com/search-products?q=${enc(p ? `${t} ${SHOP_PLATFORM[p] || p}` : t)}&type=prices` },
  { label: "Schnittberichte", tip: "Is the German release cut?", url: (t) => `https://www.schnittberichte.com/svds.php?Page=Suche&String=${enc(t)}` },
];
const enc = (s) => encodeURIComponent(s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim());
// sites without a linkable search page: a site-restricted web search
const ddg = (site, t, p) => `https://duckduckgo.com/?q=${enc(`site:${site} "${t}"${p ? " " + (SHOP_PLATFORM[p] || p) : ""}`)}`;
function releaseBlock(title, platforms) {
  const p = platforms.length === 1 ? platforms[0] : "";
  return `<h3 style="margin:18px 0 8px;font-size:15px">🔎 Check releases <small style="color:var(--faint);font-weight:500">physical versions · what's on the disc · DLC · German cut</small></h3>
    <div class="shop-row">${RELEASE_SITES.map((s) => `<a class="shop" data-kind="info" href="${esc(s.url(title, p))}" target="_blank" rel="noopener noreferrer"
      title="${esc(s.tip)}">${esc(s.label)}</a>`).join("")}</div>`;
}
function bindTargets(root) {
  root.addEventListener("click", (e) => {
    if (e.target.closest("a[target=_blank], [data-rule], [data-decision], [data-ask]")) return; // external links / rule pills: not the target modal
    const t = e.target.closest("[data-target]"); if (t) openTarget(+t.dataset.target);
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.closest("a[target=_blank], [data-rule], [data-decision], [data-ask]")) return;
    const t = e.target.closest("[data-target]"); if (t && e.key === "Enter") openTarget(+t.dataset.target);
  });
}

/* ------------------------------------------------ rules & strategy */
const RULE_STATUS = {
  adopted: { label: "Adopted", color: "var(--good)" },
  suggested: { label: "Suggested — not decided", color: "var(--warn)" },
  retired: { label: "Retired", color: "var(--faint)" },
};
const RULE_SCOPES = [["all", "General"], ["nintendo", "Nintendo"], ["pc", "PC"], ["playstation", "PlayStation"], ["xbox", "Xbox"]];
const FILE_FAMILY = { playstation: "playstation", xbox: "xbox" };
const ruleColor = (r) => (r.platform === "all" ? "var(--accent)" : fam(r.platform).color);
const scopeLabel = (p) => (RULE_SCOPES.find(([k]) => k === p) || [p, p])[1];

function rulePills(ids, max = 99) {
  const rs = ids.map((id) => D.rulesById.get(id)).filter(Boolean);
  const shown = rs.slice(0, max).map((r) => `<button class="rule-pill${r.status !== "adopted" ? " tentative" : ""}" data-rule="${esc(r.id)}"
    style="--c:${ruleColor(r)}" title="${esc(r.summary)}">${esc(r.short)}</button>`);
  if (rs.length > max) shown.push(`<span class="rule-pill more">+${rs.length - max}</span>`);
  return shown.join("");
}
function ruleOptions() {
  return RULE_SCOPES.map(([k, label]) => {
    const rs = D.rules.filter((r) => r.platform === k);
    return rs.length ? `<optgroup label="${esc(label)}">${rs.map((r) => `<option value="${esc(r.id)}">${esc(r.short)} (${r.targets.length})</option>`).join("")}</optgroup>` : "";
  }).join("");
}
function srcLinks(src, fallback) {
  if (!src || !src.path) return fallback ? `<code>${esc(fallback)}</code>` : "";
  if (!D.repo) return `<code>${esc(src.path)}:${src.line}</code>`;
  return `<a class="src-link" href="${esc(D.repo)}/blob/main/${esc(src.path)}#L${src.line}" target="_blank" rel="noopener">📄 ${esc(src.path)}:${src.line}</a>
    <a class="src-link" href="${esc(D.repo)}/edit/main/${esc(src.path)}" target="_blank" rel="noopener" title="Opens GitHub's editor — jump to line ${src.line}">✏️ Edit on GitHub</a>`;
}
function whyHTML(ids, title = "Why this decision") {
  const rs = ids.map((id) => D.rulesById.get(id)).filter(Boolean);
  if (!rs.length) {
    return `<div class="why empty">🧭 <b>No rule linked yet.</b> Add <code>rules = ["…"]</code> to this target, or a <code>match</code> pattern to a rule in <code>data/rules.toml</code>.</div>`;
  }
  return `<div class="why"><div class="why-head">🧭 ${esc(title)}</div>${rs.map((r) => `
    <button class="why-row" data-rule="${esc(r.id)}" style="--c:${ruleColor(r)}">
      <span class="why-title">${esc(r.short)}${r.status !== "adopted" ? " " + pill("suggested", "var(--warn)") : ""}</span>
      <span class="why-text">${esc(r.summary)}</span></button>`).join("")}</div>`;
}
function stackBar(c) {
  const total = c.open + c.ordered + c.done + c.skip || 1;
  return `<div class="stack">${["done", "ordered", "open", "skip"].map((k) => c[k] ? `<span style="width:${(c[k] / total) * 100}%;background:${TARGET_STATUS[k].color}" title="${TARGET_STATUS[k].label}: ${c[k]}"></span>` : "").join("")}</div>`;
}
function ruleCard(r) {
  const n = r.targets.length, e = r.entries.length;
  return `<button class="card rule-card${r.status !== "adopted" ? " tentative" : ""}" data-rule="${esc(r.id)}" style="--c:${ruleColor(r)}">
    <div class="rule-top"><span class="rule-scope">${esc(scopeLabel(r.platform))}</span>${r.status !== "adopted" ? pill(RULE_STATUS[r.status]?.label || r.status, RULE_STATUS[r.status]?.color) : ""}</div>
    <h3>${esc(r.short)}</h3><p>${esc(r.summary)}</p>
    ${stackBar(r.counts)}
    <div class="sub">${plural(n, "target")}${n ? ` · ⬜ ${r.counts.open} · ✅ ${r.counts.done} · ➖ ${r.counts.skip}` : ""}${e ? ` · ${plural(e, "series entry").replace("entrys", "entries")}` : ""}</div></button>`;
}

function conflicts() {
  const byTitle = new Map();
  D.targets.forEach((t) => { const k = norm(t.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(t); });
  const inBoth = [...byTitle.values()].filter((ts) => new Set(ts.map((t) => t.file)).size > 1);
  const cross = D.targets.filter((t) => FILE_FAMILY[t.file] && t.family !== FILE_FAMILY[t.file] && t.status !== "skip");
  const ownedElsewhere = D.targets.filter((t) => t.status === "open" && t.elsewhere.length && !/upgrade/i.test(t.group));
  const tentative = D.targets.filter((t) => ["open", "ordered"].includes(t.status) && t.rules.some((id) => D.rulesById.get(id)?.status === "suggested"));
  const split = D.series.filter((s) => new Set(s.entries.flatMap((e) => e.hits.filter((h) => HAVE.has(h.status)).map((h) => platFamily(h.platform)))).size > 1);
  const undecided = D.targets.filter((t) => t.status === "open" && ["undecided", "watching"].includes(t.state));
  const untagged = D.targets.filter((t) => !t.rules.length);
  const differs = D.targets.filter((t) => t.check?.state === "differs");
  return { inBoth, cross, ownedElsewhere, tentative, split, undecided, untagged, differs };
}

function pageStrategy(page, params) {
  const S = { tab: params.get("tab") || "rules", scope: params.get("scope") || "", q: params.get("q") || "", status: params.get("status") || "", sort: params.get("sort") || "" };
  const C = conflicts();
  const nConf = C.differs.length + C.inBoth.length + C.cross.length + C.ownedElsewhere.length + C.tentative.length + C.split.length + C.untagged.length;
  page.innerHTML = `
    <div class="page-head"><div><h1>Strategy</h1><p>The rules behind every buy-plan decision — from <code>data/rules.toml</code>. Click a rule to see what it decides.</p></div>
      <div class="seg" id="tabs2"><button data-t="rules">📐 Rules</button><button data-t="path">🧭 Decision path</button><button data-t="wizard">🧮 Where to buy?</button><button data-t="cleanup">🧹 Clean-up <span class="badge">${(D.cleanup || []).reduce((n, g) => n + g.targets.length, 0)}</span></button><button data-t="conflicts">⚠️ Conflicts <span class="badge">${nConf}</span></button></div></div>
    <div class="strategies">${(D.strategies || []).map((p) => {
      const open = D.targets.filter((t) => t.family === p.id && t.status === "open").length;
      const owned = D.games.filter((g) => g.family === p.id && HAVE.has(g.status)).length;
      return `<div class="card strategy" data-scope="${esc(p.id)}" style="--c:${fam(p.id).color}">
        <div class="strategy-head"><h3>${esc(p.name)}</h3><span class="sub">${owned} owned · ${open} to buy</span></div>
        <p>${esc(p.role)}</p><div class="row rules-row">${rulePills(p.rules || [])}</div></div>`;
    }).join("")}</div>
    <div id="tabBody"></div>`;

  const body = $("#tabBody", page);
  const renderRules = () => {
    body.innerHTML = `<div class="card toolbar">
        <label class="search">⌕<input id="rq" type="search" placeholder="Search rules, rationale, precedents…" value="${esc(S.q)}"></label>
        <div class="chips" id="scopes"><button class="chip" data-s="">All</button>${RULE_SCOPES.map(([k, l]) => `<button class="chip" data-s="${k}" style="--c:${k === "all" ? "var(--accent)" : fam(k).color}">${l}</button>`).join("")}</div>
        <select id="rstatus" aria-label="Status"><option value="">Any status</option>${Object.entries(RULE_STATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select>
        <select id="rsort" aria-label="Sort"><option value="">Curated order</option><option value="targets">Most targets</option><option value="open">Most open</option></select>
        <span class="count" id="rcount"></span></div><div class="rule-grid" id="rgrid"></div>`;
    $("#rstatus", body).value = S.status;
    $("#rsort", body).value = S.sort;
    const upd = () => {
      sync();
      $$("#scopes .chip", body).forEach((c) => c.classList.toggle("on", c.dataset.s === S.scope));
      const q = norm(S.q);
      let rs = D.rules.filter((r) => (!q || r._n.includes(q)) && (!S.scope || r.platform === S.scope) && (!S.status || r.status === S.status));
      if (S.sort === "targets") rs = [...rs].sort((a, b) => b.targets.length - a.targets.length);
      if (S.sort === "open") rs = [...rs].sort((a, b) => b.counts.open - a.counts.open);
      $("#rcount", body).innerHTML = `<b>${rs.length}</b> rules`;
      $("#rgrid", body).innerHTML = rs.map(ruleCard).join("") || `<div class="card empty-state">No rules match.</div>`;
    };
    $("#rq", body).addEventListener("input", (e) => { S.q = e.target.value; upd(); });
    $("#scopes", body).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.scope = c.dataset.s; upd(); } });
    $("#rstatus", body).addEventListener("change", (e) => { S.status = e.target.value; upd(); });
    $("#rsort", body).addEventListener("change", (e) => { S.sort = e.target.value; upd(); });
    upd();
  };
  const renderPath = () => {
    sync();
    body.innerHTML = `<p class="lead">The order of questions behind a platform / version decision. Each step links to the rules that answer it.</p>
      <ol class="steps">${(D.steps || []).map((st, i) => `<li class="card step"><span class="step-n">${i + 1}</span>
        <div><h3>${esc(st.question)}</h3><div class="row rules-row">${rulePills(st.rules || [])}</div></div></li>`).join("")}</ol>`;
  };
  const section = (title, why, count, inner, open = false) => `<details class="card conflict"${open ? " open" : ""}>
    <summary><span class="c-title">${title}</span><span class="badge">${count}</span><span class="c-why">${why}</span></summary>
    <div class="c-body">${inner || `<p class="lead">Nothing here 🎉</p>`}</div></details>`;
  const renderConflicts = () => {
    sync();
    const crossBy = {};
    C.cross.forEach((t) => { const k = `${fam(FILE_FAMILY[t.file]).label} plan → ${t.family === "other" ? "mixed / any" : fam(t.family).label}`; (crossBy[k] = crossBy[k] || []).push(t); });
    const undecidedBy = {};
    C.undecided.forEach((t) => (t.rules.length ? t.rules : ["(no rule)"]).forEach((id) => (undecidedBy[id] = (undecidedBy[id] || 0) + 1)));
    const diffBy = {};
    C.differs.forEach((t) => { const r = [...t.check.trace].reverse().find((x) => D.rulesById.get(x.rule)); const k = r ? D.rulesById.get(r.rule).short : "other"; (diffBy[k] = diffBy[k] || []).push(t); });
    body.innerHTML = [
      section("🧮 Plan differs from the rules", "Where the rules engine would buy it somewhere else (or not at all). Each one is either an exception worth writing down or an outdated plan.", C.differs.length,
        Object.entries(diffBy).sort((a, b) => b[1].length - a[1].length).map(([k, ts]) => `<div class="group-head">Rules say: ${esc(k)} · ${ts.length}</div><div class="targets">${ts.map(targetHTML).join("")}</div>`).join(""), true),
      section("🔀 In both platform plans", "The PlayStation and Xbox chats both planned the same game — check that the two decisions agree.", C.inBoth.length,
        C.inBoth.map((ts) => `<div class="pair">${ts.map(targetHTML).join("")}</div>`).join("")),
      section("↪️ Decided for another platform", "A platform plan sends the game somewhere else (e.g. PlayStation plan → Switch, Xbox plan → PS5). These are the cross-strategy calls.", C.cross.length,
        Object.entries(crossBy).map(([k, ts]) => `<div class="group-head">${esc(k)} · ${ts.length}</div><div class="targets">${ts.map(targetHTML).join("")}</div>`).join("")),
      section("📀 Open, but already owned elsewhere", "Tension with “one copy per game” — still wanted, although another version is on the shelf.", C.ownedElsewhere.length,
        `<div class="targets">${C.ownedElsewhere.map(targetHTML).join("")}</div>`),
      section("🤔 Depends on a rule that isn't decided", "Open targets whose reasoning relies on a suggested rule — decide the rule and these follow.", C.tentative.length,
        `<div class="targets">${C.tentative.map(targetHTML).join("")}</div>`),
      section("🧩 Series split across platforms", "Owned entries of one series sit on different platform families.", C.split.length,
        `<div class="series-grid">${C.split.map(seriesCard).join("")}</div>`),
      section("⏳ Waiting for a decision", "Open targets marked undecided / watching, by rule — open one to review it in the buy plan.", C.undecided.length,
        `<div class="chips">${Object.entries(undecidedBy).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
          const r = D.rulesById.get(id);
          return `<a class="chip" style="text-decoration:none;--c:${r ? ruleColor(r) : "var(--faint)"}" href="#/plan?state=undecided&rule=${encodeURIComponent(r ? id : "")}">${esc(r ? r.short : id)} · ${n}</a>`;
        }).join("")}</div>`),
      section("🏷️ No rule linked", "Targets the rules don't explain yet — add <code>rules = [\"…\"]</code> or a <code>match</code> pattern.", C.untagged.length,
        `<div class="targets">${C.untagged.map(targetHTML).join("")}</div>`),
    ].join("");
  };
  const sync = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => { if (v && !(k === "tab" && v === "rules")) p.set(k, v); });
    setParams(p);
    $$("#tabs2 button", page).forEach((b) => b.classList.toggle("on", b.dataset.t === S.tab));
    $$(".strategy", page).forEach((c) => c.classList.toggle("on", S.tab === "rules" && c.dataset.scope === S.scope));
  };
  const renderWiz = () => { sync(); renderWizard(body, params); };
  const CLEAN_HINT = {
    "not-collecting": `Apply in one go: <code>python3 scripts/gamecoll.py cleanup --apply not-collecting</code> (sets <code>state = "skip"</code>) — or ask Claude to do it.`,
    "parked-suggestions": `The open questions <button class="linkish" data-decision="shooter-expansion">Shooter-console expansion</button>, <button class="linkish" data-decision="activision-blizzard">Activision / Blizzard</button> and <button class="linkish" data-decision="fallout-elder-scrolls">Fallout / Elder Scrolls</button> decide most of these.`,
    "other-versions-unknown": `Open one → <b>Try variations in the wizard</b>, or let the next review check them (it lists these under “other platforms unknown”).`,
  };
  const renderClean = () => {
    sync();
    const gs = D.cleanup || [];
    body.innerHTML = `<p class="lead">Housekeeping for the buy plan — nothing here changes on its own. Each group says what to do; open a target to see why it's listed.</p>` +
      gs.map((g) => section(`🧹 ${esc(g.title)}`, esc(g.action).replace(/`([^`]+)`/g, "<code>$1</code>"), g.targets.length,
        g.targets.length ? `${CLEAN_HINT[g.id] ? `<div class="howto card">${CLEAN_HINT[g.id]}</div>` : ""}<div class="targets">${g.targets.map((i) => targetHTML(D.targets[i])).join("")}</div>` : "",
        g.targets.length > 0 && g.targets.length <= 12)).join("");
  };
  const show = () => (S.tab === "path" ? renderPath : S.tab === "wizard" ? renderWiz : S.tab === "cleanup" ? renderClean : S.tab === "conflicts" ? renderConflicts : renderRules)();
  $("#tabs2", page).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.tab = b.dataset.t; show(); } });
  page.addEventListener("click", (e) => {
    if (e.target.closest("[data-rule], [data-decision], [data-ask], a")) return;
    const st = e.target.closest(".strategy");
    if (st) { S.tab = "rules"; S.scope = S.scope === st.dataset.scope ? "" : st.dataset.scope; show(); return; }
    const g = e.target.closest("[data-series]");
    if (g) openSeries(+g.dataset.series);
  });
  bindTargets(page);
  show();
}

function openRule(id) {
  const r = D.rulesById.get(id);
  if (!r) return;
  const st = RULE_STATUS[r.status] || RULE_STATUS.adopted;
  const byStatus = (k) => r.targets.filter((t) => t.status === k);
  const list = (k, open) => {
    const ts = byStatus(k);
    if (!ts.length) return "";
    const v = TARGET_STATUS[k];
    const shown = ts.slice(0, 40);
    return `<details class="rule-list"${open ? " open" : ""}><summary>${v.icon} ${v.label} · ${ts.length}</summary>
      <div class="targets">${shown.map(targetHTML).join("")}</div>
      ${ts.length > shown.length ? `<p><a href="#/plan?rule=${encodeURIComponent(r.id)}&st=${k}">All ${ts.length} in the buy plan →</a></p>` : ""}</details>`;
  };
  const entries = r.entries.length ? `<h3 class="mh">Series entries · ${r.entries.length}</h3><ul class="entries">${r.entries.slice(0, 30).map(({ s, e }) =>
    `<li class="${e.status}"><span>${(ENTRY_STATUS[e.status] || ENTRY_STATUS.open).icon}</span><div><b>${esc(e.title)}</b><div class="note">${esc(s.name)}${e.note ? " · " + esc(e.note) : ""}</div></div><span class="yr">${esc(e.year)}</span></li>`).join("")}</ul>` : "";
  const body = `<p class="rule-summary">${esc(r.summary)}</p>
    ${r.rationale ? `<p><b>Why:</b> ${esc(r.rationale)}</p>` : ""}
    ${(r.precedents || []).length ? `<h3 class="mh">Precedents</h3><ul class="precedents">${r.precedents.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="rule-stats">${stackBar(r.counts)}<div class="sub">${plural(r.targets.length, "target")} · ⬜ ${r.counts.open} open · 🕒 ${r.counts.ordered} ordered · ✅ ${r.counts.done} done · ➖ ${r.counts.skip} skipped</div></div>
    <div class="rule-actions"><a class="btn" href="#/plan?rule=${encodeURIComponent(r.id)}">Open ones in the buy plan →</a> ${askButton("rule", r.id)} ${srcLinks(r.src)}</div>
    ${questionsHTML(D.decisions.filter((x) => (x.rules || []).includes(r.id)).map((x) => x.id), "Questions about this rule", true)}
    ${r.seriesTagged.length ? `<h3 class="mh">Series</h3><div class="series-grid">${r.seriesTagged.map(seriesCard).join("")}</div>` : ""}
    ${r.targets.length ? `<h3 class="mh">Targets</h3>${list("open", true)}${list("ordered", true)}${list("done")}${list("skip")}` : ""}
    ${entries}`;
  showModal(`<div class="rule-ico" style="--c:${ruleColor(r)}">📐</div><div><h2>${esc(r.short)}</h2>
    <div class="row">${pill(scopeLabel(r.platform), ruleColor(r))}${pill(st.label, st.color)}<code class="rule-id">${esc(r.id)}</code></div></div>`, body);
}
// one delegated handler for rule / question / ask buttons anywhere (innermost element wins)
document.addEventListener("click", (e) => {
  if (!D || e.target.closest("a[href]")) return;
  const el = e.target.closest("[data-ask], [data-rule], [data-decision]");
  if (!el) return;
  e.preventDefault();
  if (el.dataset.ask) ask(el.dataset.ask);
  else if (el.dataset.rule) openRule(el.dataset.rule);
  else openDecision(el.dataset.decision);
});

/* ------------------------------------------------ notes, decisions, ask Claude */
const NOTE_KIND = {
  decision: { icon: "⚖️", label: "Decision notes" },
  alternatives: { icon: "🔁", label: "Other versions" },
  owned: { icon: "📀", label: "Already owned / covered" },
  condition: { icon: "💶", label: "Buy condition" },
  verify: { icon: "❓", label: "To verify" },
  fact: { icon: "📌", label: "Facts" },
  reason: { icon: "💬", label: "Reasoning / notes" },
};
const STALE_DAYS = 30;
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
const daysUntil = (iso) => Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000);
const partsOf = (t, kind) => (t.parts || []).filter((p) => p.kind === kind);
const NOTE_FILTERS = {
  alternatives: { label: "🔁 Has other versions", test: (t) => partsOf(t, "alternatives").length || t.alternatives },
  condition: { label: "💶 Has a buy condition", test: (t) => partsOf(t, "condition").length || t.condition || t.max_price },
  nolimit: { label: "💶 No price limit yet", test: (t) => /price limit not set/i.test(t.plan) && !t.max_price },
  verify: { label: "❓ Needs verifying", test: (t) => t.verify || partsOf(t, "verify").length },
  dated: { label: "📌 Has dated facts", test: (t) => (t.parts || []).some((p) => p.date) },
  stale: { label: `⚠️ Facts older than ${STALE_DAYS} days`, test: (t) => (t.parts || []).some((p) => p.date && daysSince(p.date) > STALE_DAYS) },
  question: { label: "⚖️ Linked to an open question", test: (t) => t.decisions.length },
  differs: { label: "🧮 Plan differs from the rules", test: (t) => t.check?.state === "differs" },
  thin: { label: "🧮 Only the planned platform known", test: (t) => ["open", "ordered"].includes(t.status) && t.check?.thin },
};
const DEC_KIND = { decision: "Decision", research: "Research", "clz-fix": "CLZ fix" };
const areaColor = (a) => (a === "all" ? "var(--accent)" : fam(a).color);

function notesHTML(t) {
  const groups = {};
  (t.parts || []).forEach((p) => (groups[p.kind] = groups[p.kind] || []).push(p));
  const explicit = [
    t.why && ["reason", t.why], t.condition && ["condition", t.condition],
    t.max_price && ["condition", `Max price: ${t.max_price} €`],
    t.alternatives && ["alternatives", typeof t.alternatives === "string" ? t.alternatives : Object.entries(t.alternatives).map(([k, v]) => `${k}: ${v}`).join(" · ")],
    ...(t.facts || []).map((f) => ["fact", f]),
  ].filter(Boolean);
  explicit.forEach(([k, text]) => (groups[k] = groups[k] || []).unshift({ kind: k, text, date: k === "fact" ? t.checked : undefined }));
  const order = ["decision", "reason", "alternatives", "owned", "condition", "fact", "verify"];
  const rows = order.filter((k) => groups[k]).map((k) => `<div class="np"><div class="np-k">${NOTE_KIND[k].icon} ${NOTE_KIND[k].label}</div>
    <ul>${groups[k].map((p) => {
      const age = p.date ? daysSince(p.date) : null;
      const badge = age == null ? "" : ` <span class="age${age > STALE_DAYS ? " stale" : ""}" title="as of ${esc(p.date)}">${age > STALE_DAYS ? "⚠️ " : ""}${age} days old</span>`;
      return `<li>${esc(p.text)}${badge}</li>`;
    }).join("")}</ul></div>`);
  if (!rows.length) return "";
  return `<div class="notes-grid">${rows.join("")}</div>
    ${t.note ? `<details class="raw"><summary>Raw note</summary><p>${esc(t.note)}</p></details>` : ""}`;
}

function questionsHTML(ids, title = "Open questions", all = false) {
  const xs = ids.map((id) => D.decisionsById.get(id)).filter((x) => x && (all || x.status === "open"));
  if (!xs.length) return "";
  return `<div class="why qs"><div class="why-head">⚖️ ${esc(title)}</div>${xs.map((x) => `
    <button class="why-row" data-decision="${esc(x.id)}" style="--c:${areaColor(x.area)}">
      <span class="why-title">${esc(x.question)}${x.status !== "open" ? " " + pill(x.status, "var(--good)") : ""}${x.due ? " " + dueBadge(x.due) : ""}</span>
      <span class="why-text">${esc(x.status === "open" ? x.recommendation || (x.option || []).map((o) => o.label).join(" · ") || x.context || "" : x.outcome || "")}</span></button>`).join("")}</div>`;
}

function dueBadge(due) {
  const n = daysUntil(due);
  const cls = n < 0 ? "over" : n <= 14 ? "soon" : "";
  return `<span class="due ${cls}" title="${esc(due)}">${n < 0 ? `${-n} days overdue` : n === 0 ? "today" : `in ${n} days`}</span>`;
}

function latestReviewHTML() {
  const r = (D.reviews || [])[0];
  if (!r) return "";
  const sum = (r.md.split(/^## Summary\s*$/m)[1] || "").split(/^## /m)[0];
  const items = sum.split("\n").filter((l) => /^- /.test(l)).slice(0, 5);
  return `<h2 class="section-title">🔎 Latest review <small>${esc(r.date)} · <a href="#/changelog?tab=reviews&r=${r.date}">full report →</a></small></h2>
    <div class="card md review-card">${mdToHtml(items.join("\n"))}</div>`;
}
function dueSoonHTML() {
  const open = D.decisions.filter((x) => x.status === "open" && x.kind === "decision");
  if (!open.length) return "";
  const dated = open.filter((x) => x.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  return `<h2 class="section-title">⚖️ Decisions <small>${open.length} open · <a href="#/decisions">all →</a></small></h2>
    <div class="grid grid-2">${(dated.length ? dated : open.slice(0, 4)).map((x) => `<button class="card due-card" data-decision="${esc(x.id)}" style="--c:${areaColor(x.area)}">
      <div class="d-top">${pill(x.area === "all" ? "General" : fam(x.area).label, areaColor(x.area))}${x.due ? dueBadge(x.due) : ""}</div>
      <b>${esc(x.question)}</b>${x.recommendation ? `<span>💡 ${esc(x.recommendation)}</span>` : ""}</button>`).join("")}</div>`;
}

function optionsHTML(x) {
  const opts = x.option || [];
  if (!opts.length) return "";
  return `<div class="options">${opts.map((o) => `<div class="option"><b>${esc(o.label)}</b>
    ${(o.pros || []).map((p) => `<div class="pro">✓ ${esc(p)}</div>`).join("")}${(o.cons || []).map((c) => `<div class="con">✗ ${esc(c)}</div>`).join("")}</div>`).join("")}</div>`;
}

function decisionCard(x) {
  const decided = x.status !== "open";
  return `<article class="card decision${decided ? " decided" : ""}" data-decision="${esc(x.id)}" style="--c:${areaColor(x.area)}" tabindex="0">
    <div class="d-top">${pill(x.area === "all" ? "General" : fam(x.area).label, areaColor(x.area))}${x.kind !== "decision" ? pill(DEC_KIND[x.kind], "var(--faint)") : ""}
      ${decided ? pill(`✅ ${x.decided || "decided earlier"}`, "var(--good)") : x.due ? dueBadge(x.due) : ""}</div>
    <h3>${esc(x.question)}</h3>
    ${x.context ? `<p class="d-ctx">${esc(x.context)}</p>` : ""}
    ${decided ? `<div class="outcome">→ ${esc(x.outcome || x.status)}</div>` : ""}
    ${!decided && x.recommendation ? `<div class="reco">💡 ${esc(x.recommendation)}</div>` : ""}
    ${decided ? "" : optionsHTML(x)}
    <div class="d-foot">${x.targets.length ? `<span class="d-n">🎯 ${plural(x.targets.length, "target")}</span>` : ""}${rulePills(x.rules || [], 3)}</div></article>`;
}

function pageDecisions(page, params) {
  const S = { tab: params.get("tab") || "open", area: params.get("area") || "", q: params.get("q") || "", sort: params.get("sort") || "" };
  const TABS = {
    open: { label: "⚖️ Open decisions", test: (x) => x.status === "open" && x.kind === "decision" },
    research: { label: "🔎 Research", test: (x) => x.status === "open" && x.kind === "research" },
    "clz-fix": { label: "🛠️ CLZ fixes", test: (x) => x.status === "open" && x.kind === "clz-fix" },
    log: { label: "📜 Decision log", test: (x) => x.status !== "open" },
  };
  page.innerHTML = `
    <div class="page-head"><div><h1>Decisions</h1><p>Open questions with their options, and a log of what was decided — from <code>data/decisions.toml</code>.</p></div>
      <div class="seg" id="dtabs">${Object.entries(TABS).map(([k, v]) => `<button data-t="${k}">${v.label} <span class="badge">${D.decisions.filter(v.test).length}</span></button>`).join("")}</div></div>
    <div class="card toolbar">
      <label class="search">⌕<input id="dq" type="search" placeholder="Search questions, options…" value="${esc(S.q)}"></label>
      <div class="chips" id="dareas"><button class="chip" data-a="">All</button>${RULE_SCOPES.map(([k, l]) => `<button class="chip" data-a="${k}" style="--c:${areaColor(k)}">${l}</button>`).join("")}</div>
      <select id="dsort" aria-label="Sort"><option value="">Due date first</option><option value="targets">Most targets</option><option value="file">File order</option></select>
      <span class="count" id="dcount"></span>
    </div>
    <div class="howto card" id="howto"></div>
    <div class="decision-grid" id="dres"></div>`;
  $("#dsort", page).value = S.sort;
  const update = () => {
    const p = new URLSearchParams();
    Object.entries(S).forEach(([k, v]) => { if (v && !(k === "tab" && v === "open")) p.set(k, v); });
    setParams(p);
    $$("#dtabs button", page).forEach((b) => b.classList.toggle("on", b.dataset.t === S.tab));
    $$("#dareas .chip", page).forEach((c) => c.classList.toggle("on", c.dataset.a === S.area));
    const q = norm(S.q);
    let xs = D.decisions.filter((x) => TABS[S.tab].test(x) && (!S.area || x.area === S.area) && (!q || x._n.includes(q)));
    if (S.tab === "log") xs.sort((a, b) => (b.decided || "").localeCompare(a.decided || ""));
    else if (!S.sort) xs.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.idx - b.idx);
    else if (S.sort === "targets") xs.sort((a, b) => b.targets.length - a.targets.length);
    $("#dcount", page).innerHTML = `<b>${xs.length}</b> ${S.tab === "log" ? "decided" : "open"}`;
    $("#howto", page).innerHTML = S.tab === "log"
      ? `📜 Decided questions, newest first. Precedents from before this repo show as “decided earlier”.`
      : `✍️ <b>To decide:</b> open a question → <b>Edit on GitHub</b> → set <code>status = "decided"</code>, <code>decided = "YYYY-MM-DD"</code> and <code>outcome</code>; then update the targets' <code>state</code> / <code>plan</code>. Stuck? <b>🤖 Ask Claude</b> copies a prompt with all the context.`;
    $("#dres", page).innerHTML = xs.map(decisionCard).join("") || `<div class="card empty-state"><div class="big">🎉</div>Nothing here.</div>`;
  };
  $("#dtabs", page).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { S.tab = b.dataset.t; update(); } });
  $("#dareas", page).addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) { S.area = c.dataset.a; update(); } });
  $("#dq", page).addEventListener("input", (e) => { S.q = e.target.value; update(); });
  $("#dsort", page).addEventListener("change", (e) => { S.sort = e.target.value; update(); });
  page.addEventListener("keydown", (e) => { const c = e.target.closest("article[data-decision]"); if (c && e.key === "Enter") openDecision(c.dataset.decision); });
  update();
}

function openDecision(id) {
  const x = D.decisionsById.get(id);
  if (!x) return;
  const decided = x.status !== "open";
  const shown = x.targets.slice(0, 40);
  const body = `${x.context ? `<p>${esc(x.context)}</p>` : ""}
    ${decided ? `<div class="outcome big">→ ${esc(x.outcome || x.status)}</div>` : ""}
    ${!decided && x.recommendation ? `<div class="reco">💡 <b>Suggestion:</b> ${esc(x.recommendation)}</div>` : ""}
    ${optionsHTML(x)}
    ${(x.rules || []).length ? whyHTML(x.rules, "Rules involved") : ""}
    ${x.targets.length ? `<h3 class="mh">Targets this decides · ${x.targets.length}</h3><div class="targets">${shown.map(targetHTML).join("")}</div>
      ${x.targets.length > shown.length ? `<p><a href="#/plan?dec=${encodeURIComponent(x.id)}&st=">All ${x.targets.length} in the buy plan →</a></p>` : ""}` : ""}
    ${decided ? "" : `<div class="howto card">✍️ <b>Decided?</b> ${D.repo ? `<a class="btn" style="margin:6px 0" target="_blank" rel="noopener" href="${esc(D.repo)}/issues/new?template=decide.yml&title=${encodeURIComponent("Decide: " + x.id)}&decision_id=${encodeURIComponent(x.id)}">⚖️ Record it on GitHub</a><br>` : ""}
      Opens a short form (works on the phone); an Action writes <code>status</code>, <code>decided</code> and <code>outcome</code> for <code>${esc(x.id)}</code> into <code>data/decisions.toml</code>. Then update the targets above — or edit the file directly.</div>`}
    <div class="rule-actions">${askButton("decision", x.id)} ${srcLinks(x.src)}</div>`;
  showModal(`<div class="rule-ico" style="--c:${areaColor(x.area)}">⚖️</div><div><h2>${esc(x.question)}</h2>
    <div class="row">${pill(x.area === "all" ? "General" : fam(x.area).label, areaColor(x.area))}${pill(DEC_KIND[x.kind], "var(--faint)")}
    ${decided ? pill(`✅ ${x.decided || "decided earlier"}`, "var(--good)") : pill("open", "var(--warn)")}${x.due ? dueBadge(x.due) : ""}<code class="rule-id">${esc(x.id)}</code></div></div>`, body);
}

/* ---- Ask Claude: builds a prompt with the full context, copies it and opens claude.ai */
function askButton(kind, id) {
  return `<button class="btn ask" data-ask="${kind}:${esc(String(id))}" title="Copies a prompt with all the context and opens Claude">🤖 Ask Claude</button>`;
}
const ruleLines = (ids) => ids.map((id) => D.rulesById.get(id)).filter(Boolean)
  .map((r) => `- ${r.short}${r.status !== "adopted" ? " (suggested, not adopted)" : ""}: ${r.summary}`).join("\n");
const CONTEXT = "I collect physical video games (PC via Steam only; Nintendo, PlayStation, Xbox on disc/cart). My collecting rules and buy plan live in a GitHub repo; below is the relevant extract.";
function promptTarget(t) {
  const owned = [...new Set(t.hits.filter((h) => HAVE.has(h.status)).map((h) => h.platform)), ...t.elsewhere];
  const qs = t.decisions.map((id) => D.decisionsById.get(id)).filter(Boolean);
  return [CONTEXT, "", `## Buy-plan target: ${t.title}`,
    `Planned platform(s): ${t.platforms.join(", ") || "any"} · priority: ${t.priority} · status: ${t.status}${t.state ? " · state: " + t.state : ""}`,
    t.plan && `Plan: ${t.plan}`, t.group && `Group: ${t.group}`,
    owned.length && `Already owned on: ${owned.join(", ")}`,
    t.note && `Notes: ${t.note}`, t.verify && `To verify: ${t.verify}`,
    "", "## Rules applied", ruleLines(t.rules) || "(none linked)",
    qs.length && "\n## Open questions about it\n" + qs.map((x) => `- ${x.question}${x.recommendation ? " — current suggestion: " + x.recommendation : ""}`).join("\n"),
    "", "## What I'd like",
    "Check whether this decision is still right under my rules. Point out rules that conflict, anything that needs verifying, and recommend: keep / change platform / change priority or state / skip. End with the exact TOML changes (priority, state, plan, note) I should make.",
  ].filter((v) => v || v === "").join("\n");
}
function promptDecision(x) {
  return [CONTEXT, "", `## Open question: ${x.question}`, x.context && `Context: ${x.context}`, x.due && `Due / release: ${x.due}`,
    x.recommendation && `Current suggestion: ${x.recommendation}`,
    (x.option || []).length && "\n## Options\n" + x.option.map((o) => `- ${o.label}${(o.pros || []).length ? " | pros: " + o.pros.join("; ") : ""}${(o.cons || []).length ? " | cons: " + o.cons.join("; ") : ""}`).join("\n"),
    "", "## Rules involved", ruleLines(x.rules || []) || "(none linked)",
    x.targets.length && `\n## Buy-plan targets it decides (${x.targets.length})\n` + x.targets.slice(0, 25).map((t) => `- ${t.title} [${t.platforms.join(", ")}] ${t.priority}${t.state ? ", " + t.state : ""}${t.plan ? " — " + t.plan : ""}`).join("\n"),
    "", "## What I'd like",
    "Help me decide. Weigh the options against my rules (and say if a rule should change), flag facts I should verify first, give a clear recommendation, and write the outcome line plus any TOML changes for the affected targets.",
  ].filter((v) => v || v === "").join("\n");
}
function promptRule(r) {
  const open = r.targets.filter((t) => t.status === "open");
  return [CONTEXT, "", `## Collecting rule: ${r.short} (${r.id}, ${r.status})`, `Rule: ${r.summary}`, r.rationale && `Why: ${r.rationale}`,
    (r.precedents || []).length && `Precedents: ${r.precedents.join("; ")}`,
    `It currently decides ${r.targets.length} targets (${r.counts.open} open, ${r.counts.done} done, ${r.counts.skip} skipped).`,
    open.length && "\n## Some open targets under this rule\n" + open.slice(0, 20).map((t) => `- ${t.title} [${t.platforms.join(", ")}] ${t.priority}`).join("\n"),
    "", "## What I'd like",
    "Review this rule: is it still sensible, too broad or too narrow, and does it conflict with my other platform strategies? Suggest a sharper wording and any exceptions worth writing down.",
  ].filter((v) => v || v === "").join("\n");
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 5000);
}
async function askClaude(text) {
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch (e) {
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.appendChild(ta); ta.select();
    try { copied = document.execCommand("copy"); } catch (e2) { /* ignore */ }
    ta.remove();
  }
  const url = "https://claude.ai/new" + (text.length < 6000 ? "?q=" + encodeURIComponent(text) : "");
  window.open(url, "_blank", "noopener");
  toast(copied ? "📋 Prompt copied — opening Claude. If it isn't pre-filled, paste it (Ctrl/⌘ + V)." : "Opening Claude — copying failed, the prompt is pre-filled in the URL.");
}
function ask(spec) {
  const i = spec.indexOf(":"), kind = spec.slice(0, i), id = spec.slice(i + 1);
  const text = kind === "target" ? promptTarget(D.targets[+id]) : kind === "decision" ? promptDecision(D.decisionsById.get(id)) : promptRule(D.rulesById.get(id));
  askClaude(text);
}

/* ------------------------------------------------ format matrix + rules engine ("where should I buy this?") */
const FORMAT = {
  disc: { icon: "💿", label: "Disc" }, cart: { icon: "🎴", label: "Cart" }, gkc: { icon: "🔑", label: "Game-Key Card" },
  code: { icon: "🎟️", label: "Code in box" }, digital: { icon: "☁️", label: "Digital" }, steam: { icon: "💻", label: "Owned on Steam" },
  owned: { icon: "📀", label: "Owned" }, none: { icon: "✖", label: "Not released" },
};
const SRC_LABEL = { explicit: "versions", note: "from note", plan: "plan", owned: "collection", assumed: "assumed" };
const NEWEST = {
  nintendo: ["Nintendo Switch 2", "Nintendo Switch", "Wii U", "Wii", "GameCube", "Nintendo 64", "Super Nintendo", "NES", "Nintendo 3DS", "Nintendo DS", "Game Boy Advance", "Game Boy Color", "Game Boy"],
  playstation: ["PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "PlayStation", "PlayStation Vita", "PSP"],
  xbox: ["Xbox Series X|S", "Xbox One", "Xbox 360", "Xbox"],
};
const MATRIX_PLATS = ["Nintendo Switch 2", "Nintendo Switch", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "PC"];
const VERDICT = {
  buy: { label: "Buy", color: "var(--good)" }, "cheap-only": { label: "Only if cheap", color: "var(--warn)" },
  "case-by-case": { label: "Case by case", color: "var(--accent-2)" }, digital: { label: "Digital", color: "var(--playstation)" },
  code: { label: "Code-in-box", color: "var(--warn)" }, gkc: { label: "Game-Key Card only", color: "var(--warn)" },
  owned: { label: "Already owned", color: "var(--faint)" }, unknown: { label: "Not enough info", color: "var(--faint)" },
};

// F = { platform: ["disc", "gkc", …] } · flags = { jrpg, shooter, msfp, delisted, upgrade, bc }
function suggest(F, flags = {}) {
  const has = (p, f) => (F[p] || []).includes(f);
  const find = (fam, fs) => NEWEST[fam].find((p) => fs.some((f) => has(p, f)));
  const trace = [], step = (rule, text) => trace.push({ rule, text });
  const off = new Set(flags.off || []), use = (rule) => !off.has(rule);  // not_rules = documented exceptions
  if (off.size) step("", `Exceptions for this game (not_rules): ${[...off].map((id) => D?.rulesById?.get(id)?.short || id).join(", ")}.`);
  const owned = Object.keys(F).filter((p) => has(p, "owned"));
  if (owned.length && !flags.upgrade && use("one-copy-newest-gen")) {
    step("one-copy-newest-gen", `Already owned on ${owned.map(shortPlat).join(", ")} — one copy per game.`);
    return { pick: { platform: owned[0], format: "owned" }, verdict: "owned", trace };
  }
  const swCart = NEWEST.nintendo.find((p) => has(p, "cart") || has(p, "disc"));
  const swGkc = NEWEST.nintendo.find((p) => has(p, "gkc"));
  const psDisc = find("playstation", ["disc"]), xbDisc = find("xbox", ["disc"]);
  let pick = null, alt = null, verdict = "buy";
  if (flags.shooter && xbDisc && use("shooter-console")) {
    pick = xbDisc; step("shooter-console", `Shooter series → Xbox disc (${shortPlat(xbDisc)}), even before Nintendo.`);
  } else if (flags.msfp && xbDisc && use("xbox-first-party-scope")) {
    pick = xbDisc; step("xbox-first-party-scope", `Microsoft first-party → Xbox disc (${shortPlat(xbDisc)}).`);
    if (["Xbox Series X|S", "Xbox One"].includes(xbDisc)) step("disc-to-digital", "The disc carries a Disc-to-Digital licence.");
  } else if (flags.msfp && psDisc === "PlayStation 5") {
    pick = psDisc; step("ms-games-on-ps5-disc", "Microsoft game without an Xbox disc → PS5 disc.");
  } else if (swCart && use("switch-first")) {
    pick = swCart; step("switch-first", `A real Nintendo cart exists (${shortPlat(swCart)}) → Nintendo first.`);
  } else if (swGkc && flags.jrpg && use("gkc-not-physical")) {
    pick = swGkc; alt = psDisc || xbDisc; verdict = "case-by-case";
    step("gkc-not-physical", `JRPG whose only Nintendo version is a Game-Key Card → case by case${alt ? `: Game-Key Card or ${shortPlat(alt)} disc` : ""}.`);
  } else if (psDisc || xbDisc) {
    if (swGkc) step("gkc-not-physical", `${shortPlat(swGkc)} only has a Game-Key Card — that doesn't count as physical.`);
    pick = psDisc || xbDisc;
    step(psDisc ? "ps-exclusives-and-disc-worthy" : "platform-priority", psDisc ? `PlayStation disc (${shortPlat(psDisc)}).` : `Only Xbox has a disc (${shortPlat(xbDisc)}).`);
  } else if (swGkc) {
    pick = swGkc; verdict = "gkc"; step("gkc-not-physical", "Only a Game-Key Card exists — buy it only as an exception.");
  } else {
    const other = Object.keys(F).find((p) => has(p, "disc") || has(p, "cart"));
    const code = Object.keys(F).find((p) => has(p, "code")), dig = Object.keys(F).find((p) => has(p, "digital"));
    if (other) { pick = other; step("physical-first", `Physical version on ${shortPlat(other)}.`); }
    else if (code) { pick = code; verdict = "code"; step("code-in-box", "Only a code-in-box: sealed, EU box, at or below the store sale price."); }
    else if (dig || has("PC", "steam")) {
      pick = dig || "PC"; verdict = has("PC", "steam") && !dig ? "owned" : "digital";
      step("physical-first", "No physical version — digital is the fallback.");
      if (flags.msfp) step("digital-only-game-pass", "Digital-only Microsoft game → Game Pass first; Xbox Store (Play Anywhere) if keeping.");
    } else {
      step("", "Not enough format information — add `versions = { … }` to the target (or use the wizard).");
      return { pick: null, verdict: "unknown", trace };
    }
  }
  if (["Xbox 360", "Xbox"].includes(pick) && has(pick, "digital") && use("bc-digital-unless-delisted")) {
    if (flags.delisted) step("bc-digital-unless-delisted", "Delisted from the store → the disc is the only way.");
    else { verdict = "digital"; step("bc-digital-unless-delisted", "Backward-compatible and still listed → buy it digitally in an Xbox Store sale."); }
  }
  if (has("PC", "steam") && verdict === "buy" && use("steam-owned-only-cheap")) { verdict = "cheap-only"; step("steam-owned-only-cheap", "Already owned on Steam → only if the price is really good."); }
  const format = verdict === "owned" && has(pick, "steam") ? "steam" : verdict === "digital" ? "digital" : verdict === "code" ? "code" : (F[pick] || []).find((f) => ["disc", "cart", "gkc"].includes(f)) || "disc";
  return { pick: { platform: pick, format }, alt, verdict, trace };
}

const formatsOf = (t) => Object.fromEntries(Object.entries(t.formats || {}).map(([p, v]) => [p, v.map((x) => x.f).filter((f) => f !== "none")]));
function plannedOf(t) {
  const ps = targetPlatforms(t);
  return ps;
}
// compare the rules' suggestion with the target's plan
function ruleCheck(t) {
  const s = suggest(formatsOf(t), t.flags || {});
  const known = Object.values(t.formats || {}).filter((v) => v.some((x) => x.src !== "assumed")).length;
  const thin = Object.keys(t.formats || {}).length < 2;
  const planned = plannedOf(t);
  // what kind of purchase the plan text describes: physical, digital, or "either" ("disc if delisted, else digital")
  const lp = (t.plan || "").toLowerCase();
  const pd = /digital|store sale|game pass|steam sale/.test(lp), pp = !lp || /disc|cart|physical|used|new\b|pre-?order|limited run|netgames|code-in-box/.test(lp);
  const planKind = pd && pp ? "either" : pd ? "digital" : "physical";
  let state = "unknown", why = "";
  if (!["open", "ordered"].includes(t.status)) state = "n/a";
  else if (!s.pick || !planned.length) state = "unknown";
  else if (s.verdict === "owned" && s.pick.format === "owned") { state = "differs"; why = "the rules say you already own it"; }
  else {
    const hit = planned.includes(s.pick.platform) || (s.alt && planned.includes(s.alt));
    const fmtOk = planKind === "either" || s.verdict === "case-by-case" || (s.verdict === "digital") === (planKind === "digital");
    state = hit && fmtOk ? "agrees" : "differs";
    if (!hit) why = `the rules pick ${shortPlat(s.pick.platform)}, the plan says ${planned.map(shortPlat).join(" / ")}`;
    else if (!fmtOk) why = s.verdict === "digital" ? "the rules say digital, the plan says physical" : "the rules say physical, the plan says digital";
  }
  return { ...s, state, why, thin, known };
}

function matrixHTML(F, pick, editable = false) {
  const plats = [...new Set([...MATRIX_PLATS, ...Object.keys(F)])]
    .sort((a, b) => (PLATFORM_ORDER_JS.indexOf(a) + 99) % 999 - (PLATFORM_ORDER_JS.indexOf(b) + 99) % 999);
  return `<div class="matrix">${plats.map((p) => {
    const cells = F[p] || [];
    const on = pick && pick.platform === p;
    const content = cells.length ? cells.map((x) => {
      const f = FORMAT[x.f] || { icon: "", label: x.f };
      return `<span class="fmt fmt-${x.f}${x.src === "assumed" ? " assumed" : ""}" title="${esc(x.text || "")}">${f.icon} ${f.label}<small>${esc(SRC_LABEL[x.src] || x.src || "")}</small></span>`;
    }).join("") : `<span class="fmt unknown">? unknown</span>`;
    return `<div class="mx-row${on ? " pick" : ""}"><span>${platPill(p)}</span><span>${content}</span><span class="m-pick">${on ? "◀ rules" : ""}</span></div>`;
  }).join("")}</div>`;
}
const PLATFORM_ORDER_JS = ["PC", ...NEWEST.nintendo, ...NEWEST.playstation, ...NEWEST.xbox];

function traceHTML(trace) {
  return `<ol class="trace">${trace.map((s) => `<li>${s.rule && D.rulesById.get(s.rule) ? rulePills([s.rule]) : ""} <span>${esc(s.text)}</span></li>`).join("")}</ol>`;
}
function verdictHead(s) {
  const v = VERDICT[s.verdict] || VERDICT.unknown;
  const f = s.pick ? FORMAT[s.pick.format] || { icon: "", label: s.pick.format } : null;
  return `${s.pick ? `<span class="sugg-main">${f.icon} ${esc(shortPlat(s.pick.platform || ""))} · ${esc(f.label)}</span>` : `<span class="sugg-main">—</span>`}
    ${pill(v.label, v.color)}${s.alt ? ` <span class="sub">or ${esc(shortPlat(s.alt))} disc</span>` : ""}`;
}
function ruleCheckHTML(t) {
  const c = t.check || ruleCheck(t);
  const badge = c.state === "agrees" ? pill("✓ matches the plan", "var(--good)") : c.state === "differs" ? pill("≠ differs from the plan", "var(--bad)") : "";
  return `<div class="why check ${c.state}"><div class="why-head">🧮 Where the rules would buy it</div>
    <div class="sugg">${verdictHead(c)} ${badge}</div>
    ${c.state === "differs" && c.why ? `<p class="check-why">Plan vs rules: ${esc(c.why)}. Either the plan is an exception worth writing down (as a note or a rule), or it's outdated.</p>` : ""}
    ${c.thin ? `<p class="check-why">⚠️ Only the planned platform is known — add <code>versions = { … }</code> (or check in the wizard) to test other platforms.</p>` : ""}
    <details class="matrix-d"${c.state === "differs" ? " open" : ""}><summary>Formats per platform & reasoning</summary>
      ${matrixHTML(t.formats || {}, c.pick)}${traceHTML(c.trace)}</details>
    <a class="btn" href="#/strategy?tab=wizard&t=${t.id}">🧮 Try variations in the wizard →</a></div>`;
}

/* ---- wizard: same engine, formats and flags set by hand */
const WIZ_FLAGS = [["jrpg", "JRPG"], ["shooter", "Shooter series"], ["msfp", "Microsoft first-party"], ["delisted", "Delisted from the Xbox Store"], ["upgrade", "Upgrade of an owned copy"]];
const WIZ_PLATS = ["Nintendo Switch 2", "Nintendo Switch", "PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "Xbox Series X|S", "Xbox One", "Xbox 360", "Xbox", "PC"];
const WIZ_OPTS = (p) => p === "PC" ? ["", "steam", "digital", "none"] : NEWEST.nintendo.includes(p) ? ["", "cart", "gkc", "digital", "owned", "none"] : ["", "disc", "code", "digital", "owned", "none"];
function renderWizard(body, params) {
  const t = params.get("t") != null ? D.targets[+params.get("t")] : null;
  body.innerHTML = `<p class="lead">Set which versions exist and the engine walks your rules — the same logic that checks every buy-plan target.
    ${t ? "" : "Start empty, or load a target:"}</p>
    <div class="card toolbar"><label class="search">🎯<input id="wt" list="wtl" placeholder="Load a buy-plan target…" value="${t ? esc(t.title) : ""}"></label>
      <datalist id="wtl">${D.targets.filter((x) => x.status === "open").map((x) => `<option value="${esc(x.title)}">`).join("")}</datalist>
      <button class="btn" id="wreset">Reset</button></div>
    <div class="wizard"><div class="card wiz-form">
      <h3>Versions</h3><div class="wiz-grid">${WIZ_PLATS.map((p) => `<label>${platPill(p)}<select data-p="${esc(p)}">${WIZ_OPTS(p).map((f) => `<option value="${f}">${f ? FORMAT[f].icon + " " + FORMAT[f].label : "—"}</option>`).join("")}</select></label>`).join("")}</div>
      <h3>About the game</h3><div class="wiz-flags">${WIZ_FLAGS.map(([k, l]) => `<label><input type="checkbox" data-f="${k}"> ${l}</label>`).join("")}</div>
    </div><div class="card wiz-out" id="wout"></div></div>`;
  const load = (tt) => {
    $$("select[data-p]", body).forEach((s) => {
      const fs = (tt?.formats?.[s.dataset.p] || []).map((x) => x.f).filter((f) => WIZ_OPTS(s.dataset.p).includes(f));
      s.value = fs.find((f) => f !== "owned") || fs[0] || "";
    });
    $$("input[data-f]", body).forEach((c) => (c.checked = !!tt?.flags?.[c.dataset.f]));
    body.dataset.tid = tt ? tt.id : "";
    run();
  };
  const run = () => {
    const F = {}, flags = {};
    $$("select[data-p]", body).forEach((s) => { if (s.value && s.value !== "none") F[s.dataset.p] = [s.value]; });
    $$("input[data-f]", body).forEach((c) => (flags[c.dataset.f] = c.checked));
    const s = suggest(F, flags);
    const tt = body.dataset.tid ? D.targets[+body.dataset.tid] : null;
    const planned = tt ? plannedOf(tt) : [];
    $("#wout", body).innerHTML = `<h3>Suggestion</h3><div class="sugg">${verdictHead(s)}</div>${traceHTML(s.trace)}
      ${tt ? `<div class="wiz-plan">Plan for <button class="linkish" data-target="${tt.id}">${esc(tt.title)}</button>: ${planned.map(shortPlat).join(" / ") || "any"} — ${esc(tt.plan || "no plan text")}
        ${s.pick && planned.length ? (planned.includes(s.pick.platform) || planned.includes(s.alt) ? pill("✓ matches", "var(--good)") : pill("≠ differs", "var(--bad)")) : ""}</div>` : ""}
      <p class="sub">To store versions for a target: <code>versions = { "PlayStation 5" = "disc", "Nintendo Switch 2" = "gkc" }</code> in its TOML entry.</p>`;
  };
  body.addEventListener("change", (e) => { if (e.target.matches("select[data-p], input[data-f]")) run(); });
  $("#wt", body).addEventListener("change", (e) => { const tt = D.targets.find((x) => x.title === e.target.value); if (tt) load(tt); });
  $("#wreset", body).addEventListener("click", () => { $("#wt", body).value = ""; load(null); });
  body.addEventListener("click", (e) => { const b = e.target.closest("button[data-target]"); if (b) openTarget(+b.dataset.target); });
  load(t);
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
function pageChangelog(page, params) {
  const reviews = D.reviews || [];
  const tab = params.get("tab") || (reviews.length ? "reviews" : "imports");
  const sel = reviews.find((r) => r.date === params.get("r")) || reviews[0];
  page.innerHTML = `<div class="page-head"><div><h1>Changelog</h1><p>CLZ imports (automatic) and collection reviews (what changed in the world — release dates, platforms, formats).</p></div>
      <div class="seg" id="ctabs"><button data-t="reviews">🔎 Reviews <span class="badge">${reviews.length}</span></button><button data-t="imports">📥 Imports</button></div></div>
    ${tab === "reviews" ? (reviews.length ? `<div class="chips" style="margin-bottom:14px">${reviews.map((r) => `<a class="chip${r === sel ? " on" : ""}" style="text-decoration:none" href="#/changelog?tab=reviews&r=${r.date}">${r.date}</a>`).join("")}</div>
      <div class="card md">${mdToHtml(sel.md)}</div>` : `<div class="card empty-state">No reviews yet — they're written when a CLZ export is reviewed.</div>`)
      : `<div class="card md">${mdToHtml(D.changelog.replace(/^# .*\n/, "")) || "<p>No imports yet.</p>"}</div>`}`;
  $$("#ctabs button", page).forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
  $("#ctabs", page).addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) location.hash = `#/changelog?tab=${b.dataset.t}`; });
}
// small Markdown renderer: headings, lists, checkboxes, tables, links, bold / italic / code
function mdToHtml(md) {
  const inline = (raw) => {
    const links = [];
    let s = raw.replace(/\[([^\]]+)\]\((https?:[^)\s]+|[^)\s]+\.md)\)/g, (_, t, u) => { links.push([t, u]); return `\u0000${links.length - 1}\u0000`; });
    s = esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => {
      const [t, u] = links[+i];
      const href = /^https?:/.test(u) ? u : D.repo ? `${D.repo}/blob/main/${u.replace(/^\.\.\//, "")}` : u;
      return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(t)}</a>`;
    });
  };
  // join wrapped lines: indented continuation of a list item, or consecutive paragraph lines
  const lines = [];
  const isBlock = (l) => /^\s*- |^#{1,4} |^\||^<!--/.test(l);
  for (const l of md.split("\n")) {
    const prev = lines.length ? lines[lines.length - 1] : "";
    if (l.trim() && !isBlock(l) && prev.trim() && !/^#{1,4} |^\|/.test(prev) && (/^\s+/.test(l) || !/^\s*- /.test(prev))) {
      lines[lines.length - 1] = prev + " " + l.trim();
    } else lines.push(l);
  }
  let out = "", list = null;
  const close = () => { if (list) { out += "</ul>"; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\|/.test(line)) {
      close();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
      const body = rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r));
      out += `<div class="table-wrap"><table><thead><tr>${cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    const li = line.match(/^(\s*)- (\[( |x)\] )?(.*)/);
    if (li && li[1].length && list) {  // nested item → indented li
      out += `<li class="sub">${inline(li[4])}</li>`;
      continue;
    }
    if (li) {
      if (!list) { out += "<ul>"; list = true; }
      const box = li[2] ? `<span class="box">${li[3] === "x" ? "☑" : "☐"}</span> ` : "";
      out += `<li class="${li[2] ? (li[3] === "x" ? "done" : "todo") : ""}">${box}${inline(li[4])}</li>`;
      continue;
    }
    close();
    const h = line.match(/^(#{1,4}) (.*)/);
    if (h) out += `<h${Math.min(h[1].length + 1, 4)}>${inline(h[2])}</h${Math.min(h[1].length + 1, 4)}>`;
    else if (line.trim() && !/^<!--/.test(line)) out += `<p>${inline(line)}</p>`;
  }
  close();
  return out;
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
  if (e.target.closest("a[target=_blank], [data-rule], [data-decision], [data-ask]")) return;
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
    : shopBlock(g.title, [g.platform])) + releaseBlock(g.title, [g.platform]) + relatedHTML(relatedFor(g.title), g.id);
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
    ["Verify", t.verify ? "❓ " + esc(t.verify) : ""],
    ["Owned on", t.hits.filter((h) => HAVE.has(h.status)).map((h) => platPill(h.platform)).join(" ")],
    ["Also owned", t.elsewhere.map(platPill).join(" ")],
    ["Source", srcLinks(t.src, `data/targets/${t.file}.toml`)],
  ]);
  const rel = relatedFor(t.title);
  rel.targets = rel.targets.filter((x) => x.id !== t.id);
  const shops = t.status === "done" ? "" : shopBlock(t.title, targetPlatforms(t), t.plan);
  const head = t.cover ? coverHTML({ title: t.title, family: t.family, platform: targetPlatforms(t)[0] || t.platforms[0] || "", cover: t.cover })
    : `<div style="font-size:40px;line-height:1">${st.icon}</div>`;
  showModal(`${head}<div><h2>${esc(t.title)}</h2><div class="row">${pill(st.label, st.color)}</div></div>`,
    whyHTML(t.rules) + questionsHTML(t.decisions) + (["open", "ordered"].includes(t.status) ? ruleCheckHTML(t) : "") + notesHTML(t) + body + askButton("target", t.id) + shops + releaseBlock(t.title, targetPlatforms(t)) + relatedHTML(rel));
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
  const head2 = `${(s.rules || []).length ? `<div class="row rules-row" style="margin-top:6px">${rulePills(s.rules)}</div>` : ""}
    <div style="margin-top:8px;font-size:13px">${srcLinks(s.src)}</div>`;
  showModal(`${ring(s.have, s.need, color)}<div><h2>${esc(s.name)}</h2><div class="row">${pill(`${s.have}/${s.need} physical`, color)}
    ${s.steam ? pill(`💻 ${s.steam} Steam`, "var(--pc)") : ""}${(s.platforms || []).map(platPill).join("")}</div>${head2}</div>`, body);
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
  const decs = D.decisions.filter((x) => x._n.includes(q)).slice(0, 4)
    .map((x) => ({ kind: "decision", id: x.id, label: x.question, sub: x.status, icon: "⚖️" }));
  const rules = D.rules.filter((r) => r._n.includes(q)).slice(0, 4)
    .map((r) => ({ kind: "rule", id: r.id, label: r.short, sub: r.summary.slice(0, 60), icon: "📐" }));
  pItems = [...games, ...series, ...rules, ...decs, ...targets];
  pRes.innerHTML = pItems.length ? pItems.map((it, i) => `<a data-i="${i}" class="${i === 0 ? "sel" : ""}"><span>${it.icon || ""}</span>
    <span><b>${esc(it.label)}</b> <span style="color:var(--muted);font-size:13px">${esc(it.sub)}</span></span>
    <span class="kind">${it.kind === "target" ? "buy plan" : it.kind}</span></a>`).join("") : `<div class="empty">No matches.</div>`;
}
function choosePalette(i) {
  const it = pItems[i]; if (!it) return;
  palette.close();
  ({ game: openGame, target: openTarget, series: openSeries, rule: openRule, decision: openDecision })[it.kind](it.id);
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

// a cover that fails to load falls back to the gradient card
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.classList.contains("cv")) { img.closest(".cover")?.classList.remove("has-img"); img.remove(); }
}, true);

/* ------------------------------------------------ boot */
fetch("data.json", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status + " " + r.statusText); return r.json(); })
  .then((d) => {
    D = d;
    prepare(D);
    const nCovers = D.games.filter((g) => g.cover).length + D.targets.filter((t) => t.cover).length;
    document.getElementById("foot").innerHTML = `Data updated ${esc(D.updated)} · generated from CLZ by <code>scripts/gamecoll.py export</code>${
      nCovers ? ` · Cover art: <a href="https://www.igdb.com" target="_blank" rel="noopener">IGDB</a>` : ""}`;
    window.addEventListener("hashchange", route);
    route();
  })
  .catch((err) => {
    app.innerHTML = `<div class="card error"><h2>Couldn't load data.json</h2><p>${esc(err.message)}</p>
      <p>Run <code>python3 scripts/gamecoll.py export</code> and serve the <code>site/</code> folder.</p></div>`;
  });
