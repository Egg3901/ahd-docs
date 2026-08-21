import { marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pipeline, env } from "@xenova/transformers";

// ---------- semantic search: embedder config ----------
const MODEL_ID = "Xenova/bge-small-en-v1.5";
const XENOVA_CACHE = process.env.XENOVA_CACHE
  || "/root/projects/LSGD-ops-dash/node_modules/@xenova/transformers/.cache";
env.cacheDir = XENOVA_CACHE;
// Prefer the local cache; only reach the network if the model is not already present.
env.allowRemoteModels = !fs.existsSync(path.join(XENOVA_CACHE, MODEL_ID));

const SRC = process.env.DOCS_SRC || new URL("..", import.meta.url).pathname;
const GAME = process.env.GAME_REPO || "/root/projects/AHDGame";
const GAME_REF = process.env.GAME_REF || "origin/development";
const OUT = process.env.DOCS_OUT || "/srv/lakeside-docs";
const GAME_SITE = "https://www.ahousedividedgame.com";
const LOGO_SRC = `${GAME}/public/ahd-logo.png`;
const WIKI_JSON = "/tmp/wiki-pages.json";
const FILE_META_CACHE = new URL("./.file-meta-cache.json", import.meta.url).pathname;

// ---------- source: wiki seed (from the game repo) ----------
try {
  execSync(
    `node -e "const {register}=require('tsx/cjs/api');register();const {WIKI_SEED_PAGES}=require('./src/lib/seeds/wiki/pages');require('fs').writeFileSync('${WIKI_JSON}',JSON.stringify(WIKI_SEED_PAGES.map(p=>({slug:p.slug,title:p.title,description:p.description,category:p.category,content:p.content}))))"`,
    { cwd: GAME, stdio: "pipe" },
  );
} catch (e) {
  if (!fs.existsSync(WIKI_JSON)) throw new Error("wiki export failed and no cached JSON: " + e.message);
  console.warn("wiki export failed, using cached JSON");
}
const WIKI_PAGES = JSON.parse(fs.readFileSync(WIKI_JSON, "utf8"));

// ---------- AHDGame file manifest (for source-file chips) ----------
let GAME_HEAD = "";
let FILE_SET = new Set();
try {
  GAME_HEAD = execSync(`git -C "${GAME}" rev-parse "${GAME_REF}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  FILE_SET = new Set(
    execSync(`git -C "${GAME}" ls-tree -r --name-only "${GAME_REF}"`, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32e6 })
      .toString().split("\n").filter(Boolean),
  );
} catch (e) {
  console.warn("AHDGame file manifest unavailable:", e.message);
}
const isChipPath = p => {
  if (!p || !FILE_SET.has(p)) return false;
  if (p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("shared/") || p.startsWith("e2e/")) return true;
  return /\.(?:ts|tsx|mjs|js|json)$/.test(p);
};
const PATH_TOKEN_RE = /(?:src|scripts|shared|e2e)\/[A-Za-z0-9_./\[\]-]+(?:\.(?:ts|tsx|mjs|js|json|md))?|[A-Za-z0-9_.\[\]-]+(?:\/[A-Za-z0-9_.\[\]-]+)+\.(?:ts|tsx|mjs|js|json)/g;
const extractPaths = md => {
  const found = [];
  const seen = new Set();
  const add = p => {
    if (!p) return;
    p = p.replace(/\/+$/, "");
    if (seen.has(p) || !isChipPath(p)) return;
    seen.add(p);
    found.push(p);
  };
  for (const m of md.matchAll(/`([^`]+)`/g)) {
    add(m[1].trim());
    for (const tok of m[1].split(/[\s,;()]+/)) add(tok.trim());
  }
  for (const m of md.matchAll(PATH_TOKEN_RE)) add(m[0]);
  found.sort((a, b) => a.localeCompare(b));
  return found;
};
const relAge = iso => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 3600) return "just now";
  const hours = Math.round(sec / 3600);
  if (hours < 24) return hours + "h ago";
  const days = Math.round(sec / 86400);
  if (days < 14) return days + "d ago";
  if (days < 60) return Math.round(days / 7) + "w ago";
  if (days < 730) return Math.round(days / 30.44) + "mo ago";
  return Math.round(days / 365.25) + "y ago";
};

// ---------- grouping ----------
const WIKI_CATEGORY_LABELS = {
  "getting-started": "Getting Started", elections: "Elections", legislatures: "Legislatures",
  parties: "Parties", countries: "Countries", military: "Military & Conflict",
  economy: "Economy", advanced: "Advanced", resources: "Resources",
  commodities: "Commodities", iterations: "Iterations",
};
const WIKI_CATEGORY_ORDER = ["getting-started", "elections", "legislatures", "parties",
  "economy", "commodities", "military", "countries", "advanced", "resources", "iterations"];

const DESIGN_GROUPS = [
  ["Getting Started & Strategy", ["getting-started", "player-progression", "stats-actions", "meta-strategy", "min-maxing", "primary-general-tactics", "campaign-strategy", "party-building", "relocation"]],
  ["Elections & Campaigns", ["elections", "election-engine", "granular-electorate-as-shipped", "campaign-manager", "canvassing", "fundraising-ads", "demographics", "demographics-targeting", "archetype-approvals", "political-system-reg-support", "snap-elections", "vacancy-handling", "japan-elections", "uk-elections", "germany-elections", "contingent-election", "executive-term-limits", "statehood-admission", "live-election-results", "demographic-election-audit", "demographic-election-implementation-audit"]],
  ["Legislature & Parties", ["bills-legislation", "policy-system", "player-policies", "congress-leadership", "congress-speaker", "chamber-leadership-by-country", "caucuses", "party-whips", "parties", "party-influence", "party-slate", "party-leadership-authority", "coalitions", "legislation-system-completion-audit"]],
  ["Government & Executive", ["cabinet", "uk-cabinet", "parliamentary-government", "ruling-party-confidence", "uk-pm-no-confidence", "uk-devolution-policy", "uk-jp-devolved-executives", "government-approval", "state-level-power", "one-party-states-as-shipped", "constitutional-convention", "ministerial-orders"]],
  ["Economy & Finance", ["economic-systems", "capacity-economy-as-shipped", "monetary-system-as-shipped", "corporations", "corporate-mergers-and-acquisitions", "subsidiary-corporations", "stock-market", "corporate-bond-defaults", "sovereign-bonds", "imf-corporate-bailout", "imf-sovereign-facility", "commodities", "commodity-pricing-v2", "currency-exchange", "money-supply-and-quantitative-easing", "interbank-and-bank-resolution", "price-indexing-and-repricing", "national-budget", "budget-calculations", "subsidies", "tariffs", "labour", "pensions", "resources", "formula-deep-dive"]],
  ["Countries", ["china", "japan", "united-kingdom"]],
  ["World & Simulation", ["world-and-era-systems-as-shipped", "crisis-system", "national-metrics", "npp-system", "npp-opponents", "core-systems", "turn-processing", "conflict-system-as-shipped", "bloc-alignment-and-spheres", "defence-procurement"]],
  ["Platform", ["technical-architecture", "api-conventions", "api-middleware", "mail", "wiki", "wiki-system", "achievements", "achievements-service", "map-services", "loading-states", "moderator-accounts", "roadmap"]],
];
const ENGINEERING_GROUPS = [
  ["Architecture", ["repo-operating-map", "architecture-boundaries", "turn-processor-as-shipped", "type-and-schema-contracts", "seed-bootstrap-call-graph", "shadow-ledger", "performance-hotspots"]],
  ["Conventions", ["best-practices", "naming-and-organization", "comment-standards", "domain-reuse-guidelines", "shared-utility-guidelines", "ui-reuse-guidelines", "mongodb-access-guidelines", "api-route-checklist"]],
  ["Design System", ["design-system", "design-system-components", "design-system-themes"]],
  ["Workflow & Testing", ["developer-workflow", "test-architecture-and-gaps"]],
];
const API_GROUPS = [["Public API", ["public-v1", "client-integration"]]];

const EXCLUDE = new Set(["engineering/ai-development-workflow.md", "engineering/ai-skills-roadmap.md", "design/README.md"]);
const SCRUB = [
  [/For full session-by-session build history[^\n]*\n/g, ""],
  [/ The authoritative rules for code and git live in \[`claude\.md`\][^\n]*?root\./g, ""],
  [/For \*\*AI-specific\*\* investigation[^.]*\. /g, ""],
  [/`?\.design-bundle[\w./-]*`?/g, "the original design brief"],
  [/`?docs\/plans[\w./-]*`?/g, "the design archive"],
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugOf = f => f.replace(/\.md$/, "");
const anchor = t => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
const titleOf = (md, fallback) => {
  const m = md.match(/^#\s+(.+)$/m);
  return (m ? m[1] : fallback).replace(/[*`]/g, "").trim() || fallback;
};
const firstPara = md => {
  const body = md.replace(/^#\s+.+$/m, "").trim();
  const m = body.match(/^(?![#>\-|*`\d])([^\n]{40,})$/m);
  if (!m) return "";
  let t = m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
  return t.length > 150 ? t.slice(0, 147).replace(/\s+\S*$/, "") + "…" : t;
};

// ---------- jargon glossary ----------
// id -> { terms: surface forms to match, def, wiki?: Wikipedia article, more?: internal path }.
// Both game jargon and general/world jargon. Only the FIRST occurrence per page is wrapped.
const GLOSSARY = [
  // general / economics / math / political-science jargon
  { id: "taylor-rule", terms: ["Taylor rule"], def: "A monetary-policy guideline that sets the central-bank interest rate from how far inflation and output are from target.", wiki: "Taylor_rule" },
  { id: "manhattan-distance", terms: ["Manhattan distance", "taxicab distance"], def: "Distance measured along axes at right angles (sum of absolute coordinate differences), not a straight line.", wiki: "Taxicab_geometry" },
  { id: "okun", terms: ["Okun's law", "Okun coefficient"], def: "The empirical relationship between a country's unemployment rate and its GDP growth.", wiki: "Okun%27s_law" },
  { id: "phillips-curve", terms: ["Phillips curve"], def: "The inverse relationship between unemployment and inflation.", wiki: "Phillips_curve" },
  { id: "dhondt", terms: ["D'Hondt method", "D'Hondt"], def: "A highest-averages method for allocating seats in proportional-representation elections.", wiki: "D%27Hondt_method" },
  { id: "gini", terms: ["Gini coefficient", "Gini index"], def: "A 0-to-1 measure of inequality across a distribution (0 = perfectly equal).", wiki: "Gini_coefficient" },
  { id: "hhi", terms: ["Herfindahl-Hirschman index", "Herfindahl index", "HHI"], def: "A market-concentration measure: the sum of squared market shares of all firms.", wiki: "Herfindahl%E2%80%93Hirschman_index" },
  { id: "ipf", terms: ["iterative proportional fitting", "IPF", "raking"], def: "An algorithm that adjusts a table's cells to match known row and column totals; used to fit a synthetic electorate to census margins.", wiki: "Iterative_proportional_fitting" },
  { id: "cloture", terms: ["cloture"], def: "A procedure to end debate and force a vote, overcoming a filibuster.", wiki: "Cloture" },
  { id: "fptp", terms: ["first-past-the-post", "FPTP"], def: "A single-winner voting rule where the candidate with the most votes wins, no majority required.", wiki: "First-past-the-post_voting" },
  { id: "stv", terms: ["single transferable vote", "PR-STV", "STV"], def: "A proportional ranked-choice system that transfers surplus and eliminated votes to remaining candidates.", wiki: "Single_transferable_vote" },
  { id: "open-list", terms: ["open-list proportional representation", "open-list PR", "open list"], def: "Proportional representation where voters influence the order in which a party's candidates take seats.", wiki: "Open_list" },
  { id: "npv", terms: ["net present value", "NPV"], def: "The value today of a stream of future cash flows, discounted at a chosen rate.", wiki: "Net_present_value" },
  { id: "qe", terms: ["quantitative easing"], def: "A central bank creating money to buy assets (often bonds), raising the money supply to ease policy.", wiki: "Quantitative_easing" },
  { id: "efficiency-gap", terms: ["efficiency gap"], def: "A gerrymandering metric: the difference between the parties' wasted votes, divided by total votes.", wiki: "Efficiency_gap" },
  { id: "amortization", terms: ["amortization", "amortisation", "level annuity", "level-annuity"], def: "Paying off a debt in equal installments of principal-plus-interest over time.", wiki: "Amortization_(business)" },
  { id: "perpetuity", terms: ["perpetuity"], def: "A stream of identical cash flows that continues forever; its present value is payment divided by rate.", wiki: "Perpetuity" },
  { id: "reserve-requirement", terms: ["reserve requirement"], def: "The fraction of deposits a bank must hold rather than lend out.", wiki: "Reserve_requirement" },
  { id: "discount-window", terms: ["discount window"], def: "A central-bank facility that lends short-term funds to banks against collateral.", wiki: "Discount_window" },
  { id: "gotv", terms: ["get out the vote", "GOTV"], def: "Campaign activity aimed at raising turnout among a candidate's likely supporters.", wiki: "Get_out_the_vote" },
  { id: "soft-knee", terms: ["soft-knee", "soft knee"], def: "A curve that bends gradually rather than at a sharp threshold; here, price pressure is compressed smoothly past a ratio.", wiki: "Dynamic_range_compression#Soft_and_hard_knees" },
  { id: "coupon", terms: ["coupon rate", "coupon payment"], def: "The fixed interest a bond pays its holder, as a percent of face value.", wiki: "Coupon_(finance)" },
  { id: "kaitz", terms: ["Kaitz ratio", "Kaitz index"], def: "The ratio of the minimum wage to the median (or average) wage.", wiki: "Kaitz_index" },
  { id: "geometric-mean", terms: ["geometric mean"], def: "An average found by multiplying n values and taking the nth root; penalizes any single low input.", wiki: "Geometric_mean" },
  { id: "ev", terms: ["electoral college", "electoral votes"], def: "The US system where states cast electoral votes to elect the president rather than a direct national count.", wiki: "United_States_Electoral_College" },
  // game jargon (our terms) - link to the relevant wiki page
  { id: "npp", terms: ["Non-Player Politician", "NPPs", "NPP"], def: "Non-Player Politician: an AI-run politician or party that can hold office, vote, and campaign.", more: "/wiki/npps-overview.html" },
  { id: "swing-flow", terms: ["swing-flow", "swing flow"], def: "The live general-election vote model, where support flows between candidates rather than being allocated in fixed blocs.", more: "/design/election-engine.html" },
  { id: "granular-electorate", terms: ["granular electorate", "Layer-1 electorate", "Layer-1 census"], def: "The shipped electorate substrate: per-cell census groups (not the retired 12 archetypes) that carry the vote.", more: "/design/granular-electorate-as-shipped.html" },
  { id: "comingle", terms: ["comingle"], def: "The NPP-autonomy tiers (v2 and up) at which AI politicians act inside player-enabled countries alongside humans.", more: "/wiki/npp-autonomy.html" },
  { id: "plants-system", terms: ["plants system", "capacity economy"], def: "The shipped economy model where each sector is an owned set of plants with build/idle/mothball capacity that drives supply.", more: "/design/capacity-economy-as-shipped.html" },
  { id: "infamy", terms: ["infamy"], def: "A game stat that rises from attacks and norm-breaking; high infamy imposes penalties and scrutiny.", more: "/wiki/stats-actions.html" },
  { id: "political-influence", terms: ["Normalized Political Influence", "political influence"], def: "A politician's accumulated clout, spent on actions and weighed into election appeal.", more: "/wiki/stats-actions.html" },
];
const glossBySurface = new Map();
for (const g of GLOSSARY) for (const t of g.terms) glossBySurface.set(t.toLowerCase(), g.id);
const glossSurfaces = [...glossBySurface.keys()].sort((a, b) => b.length - a.length);
const GLOSS_RE = new RegExp("(?<![\\w-])(" + glossSurfaces.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\w-])", "gi");
const glossClient = Object.fromEntries(GLOSSARY.map(g => [g.id, { def: g.def, wiki: g.wiki || null, more: g.more || null }]));
// Wrap the first occurrence of each term in already-rendered HTML, skipping code/pre/a/headings.
const wrapGloss = html => {
  const used = new Set();
  let skip = 0;
  return html.split(/(<[^>]+>)/).map(part => {
    if (part[0] === "<") {
      if (/^<(pre|code|a|h[1-6]|script|style|button)[\s>]/i.test(part)) skip++;
      else if (/^<\/(pre|code|a|h[1-6]|script|style|button)>/i.test(part)) skip = Math.max(0, skip - 1);
      return part;
    }
    if (skip > 0 || !part.trim()) return part;
    return part.replace(GLOSS_RE, (m) => {
      const id = glossBySurface.get(m.toLowerCase());
      if (!id || used.has(id)) return m;
      used.add(id);
      return `<span class="gloss" data-g="${id}">${m}</span>`;
    });
  }).join("");
};

// ---------- assemble page list ----------
// page: {id, kind:'wiki'|'doc', section, group, file?, slug, title, desc, md, href}
const pages = [];

for (const cat of WIKI_CATEGORY_ORDER) {
  for (const w of WIKI_PAGES.filter(p => p.category === cat).sort((a, b) => a.title.localeCompare(b.title))) {
    pages.push({
      id: `w:${w.slug}`, kind: "wiki", section: "wiki",
      group: WIKI_CATEGORY_LABELS[cat] ?? cat, slug: w.slug,
      title: w.title, desc: w.description || "", md: w.content,
      href: `/wiki/${w.slug}.html`,
    });
  }
}

const DOC_SECTIONS = [
  { dir: "design", label: "Game Design", groups: DESIGN_GROUPS },
  { dir: "engineering", label: "Engineering", groups: ENGINEERING_GROUPS },
  { dir: "api", label: "API", groups: API_GROUPS },
];
for (const s of DOC_SECTIONS) {
  const groupOf = f => {
    const sl = slugOf(f);
    for (const [g, list] of s.groups) if (list.includes(sl)) return g;
    return "Other";
  };
  for (const f of fs.readdirSync(path.join(SRC, s.dir)).sort()) {
    if (!f.endsWith(".md") || EXCLUDE.has(`${s.dir}/${f}`)) continue;
    let md = fs.readFileSync(path.join(SRC, s.dir, f), "utf8");
    for (const [re, rep] of SCRUB) md = md.replace(re, rep);
    const fb = slugOf(f).replace(/-/g, " ");
    pages.push({
      id: `d:${s.dir}/${f}`, kind: "doc", section: s.dir,
      group: groupOf(f), slug: slugOf(f), file: f,
      title: titleOf(md, fb.charAt(0).toUpperCase() + fb.slice(1)),
      desc: firstPara(md), md,
      href: `/${s.dir}/${slugOf(f)}.html`,
    });
  }
}

// ---------- last-updated dates (git) ----------
// Map each wiki slug to its backing content/*.ts by parsing the page lists.
const wikiFileBySlug = new Map();
try {
  const dir = path.join(GAME, "src/lib/seeds/wiki/pages");
  for (const pf of fs.readdirSync(dir)) {
    if (!pf.endsWith(".ts") || pf.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(dir, pf), "utf8");
    const varToFile = new Map();
    for (const m of src.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*["']\.\.\/content\/(\w+)["']/g)) varToFile.set(m[1], m[2] + ".ts");
    for (const m of src.matchAll(/slug:\s*["']([\w-]+)["'][\s\S]*?content:\s*(\w+)/g)) {
      const f = varToFile.get(m[2]);
      if (f) wikiFileBySlug.set(m[1], f);
    }
  }
} catch (e) { console.warn("wiki file map failed:", e.message); }

const dateCache = new Map();
const gitDate = (dir, rel) => {
  const key = dir + "|" + rel;
  if (dateCache.has(key)) return dateCache.get(key);
  let d = "";
  try { d = execSync(`git -C "${dir}" log -1 --format=%cs -- "${rel}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
  dateCache.set(key, d);
  return d;
};
const commodityDate = () => {
  const a = gitDate(GAME, "src/lib/constants/commodities.ts");
  const b = gitDate(GAME, "src/lib/seeds/wiki/pages/commodities.ts");
  return a > b ? a : b;
};
for (const p of pages) {
  if (p.kind === "doc") p.updated = gitDate(SRC, `${p.section}/${p.file}`);
  else {
    const f = wikiFileBySlug.get(p.slug);
    p.updated = f ? gitDate(GAME, `src/lib/seeds/wiki/content/${f}`) : (p.slug.startsWith("commodity-") ? commodityDate() : "");
  }
}

// ---------- source-file chips: scan, freshness, wiki/design counterparts ----------
for (const p of pages) p.srcFiles = extractPaths(p.md || "");

let fileMetaCache = {};
try { fileMetaCache = JSON.parse(fs.readFileSync(FILE_META_CACHE, "utf8")); } catch {}
const fileMetaOf = {};
const allSrcFiles = [...new Set(pages.flatMap(p => p.srcFiles))];
let metaHits = 0;
for (const rel of allSrcFiles) {
  const key = rel + "@" + GAME_HEAD;
  if (fileMetaCache[key]) {
    fileMetaOf[rel] = fileMetaCache[key];
    metaHits++;
    continue;
  }
  let raw = "";
  try {
    raw = execSync(
      `git -C "${GAME}" log -1 --format='%cI%x09%h%x09%s' "${GAME_REF}" -- ":(literal)${rel}"`,
      { stdio: ["ignore", "pipe", "ignore"] },
    ).toString().trim();
  } catch {}
  const meta = { date: "", iso: "", sha: "", subject: "", pr: null };
  if (raw) {
    const tab = raw.indexOf("\t");
    const tab2 = raw.indexOf("\t", tab + 1);
    const iso = tab >= 0 ? raw.slice(0, tab) : raw;
    meta.iso = iso;
    meta.date = iso.slice(0, 10);
    meta.sha = tab2 > tab ? raw.slice(tab + 1, tab2) : "";
    meta.subject = tab2 > tab ? raw.slice(tab2 + 1) : "";
    const pr = meta.subject.match(/\(#(\d+)\)\s*$/);
    meta.pr = pr ? Number(pr[1]) : null;
  }
  fileMetaCache[key] = meta;
  fileMetaOf[rel] = meta;
}
if (GAME_HEAD) {
  const keep = {};
  for (const rel of allSrcFiles) {
    const key = rel + "@" + GAME_HEAD;
    if (fileMetaCache[key]) keep[key] = fileMetaCache[key];
  }
  try { fs.writeFileSync(FILE_META_CACHE, JSON.stringify(keep)); } catch (e) {
    console.warn("file meta cache write failed:", e.message);
  }
}
console.log(`source files: ${allSrcFiles.length} unique paths, ${metaHits} cache hits, head ${GAME_HEAD.slice(0, 12) || "?"}`);

const titleKey = t => t.toLowerCase()
  .replace(/\(.*?\)/g, " ")
  .replace(/\b(system design|as shipped|as-shipped|overview|player guide|government structure)\b/g, " ")
  .replace(/\bnpps\b/g, "npp")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const headTitle = t => titleKey(t.split(/[\u2014\u2013:]/)[0]);
const slugCore = s => s.replace(/\bnpps\b/g, "npp")
  .replace(/-as-shipped$/, "")
  .replace(/-(overview|guide|system|service|player-guide)$/, "");
const wikiPages = pages.filter(p => p.kind === "wiki");
const designPages = pages.filter(p => p.section === "design");
const wikiCores = new Map();
for (const w of wikiPages) {
  const c = slugCore(w.slug);
  wikiCores.set(c, (wikiCores.get(c) || 0) + 1);
}
const designCores = new Map();
for (const d of designPages) {
  const c = slugCore(d.slug);
  designCores.set(c, (designCores.get(c) || 0) + 1);
}
const pairScores = [];
for (const w of wikiPages) {
  for (const d of designPages) {
    let sc = 0;
    if (w.slug === d.slug) sc = 100;
    else {
      const tkW = titleKey(w.title), tkD = titleKey(d.title);
      if (tkW && tkW === tkD) sc = 92;
      else {
        const hW = headTitle(w.title), hD = headTitle(d.title);
        if (hW.length >= 4 && hW === hD) sc = 90;
        else {
          const cW = slugCore(w.slug), cD = slugCore(d.slug);
          if (cW.length >= 3 && cW === cD && (wikiCores.get(cW) || 0) === 1 && (designCores.get(cD) || 0) === 1) sc = 86;
        }
      }
    }
    if (sc >= 86) pairScores.push({ w, d, sc });
  }
}
pairScores.sort((a, b) => b.sc - a.sc || a.w.slug.localeCompare(b.w.slug));
const counterpartOf = new Map();
const usedW = new Set(), usedD = new Set();
for (const { w, d } of pairScores) {
  if (usedW.has(w.id) || usedD.has(d.id)) continue;
  usedW.add(w.id); usedD.add(d.id);
  counterpartOf.set(w.id, { href: d.href, title: d.title.replace(/[\u2014\u2013]/g, "-"), label: "Design doc", kind: "doc" });
  counterpartOf.set(d.id, { href: w.href, title: w.title.replace(/[\u2014\u2013]/g, "-"), label: "Player wiki", kind: "wiki" });
}
console.log(`counterparts: ${usedW.size} wiki/design pairs`);

const srcChipHtml = (rel, kind) => {
  const meta = fileMetaOf[rel] || {};
  const age = meta.iso ? relAge(meta.iso) : "";
  const ageSpan = age ? `<span class="src-age">${esc(age)}</span>` : "";
  return `<button type="button" class="src-chip ${kind}" data-path="${esc(rel)}">${esc(rel)}${ageSpan}</button>`;
};
const wrapSrc = (html, paths) => {
  if (!paths.length) return html;
  const set = new Set(paths);
  const wrapChunk = chunk => {
    chunk = chunk.replace(/<code>([^<]*)<\/code>/g, (m, inner) => {
      const p = inner.trim();
      return set.has(p) ? srcChipHtml(p, "inline") : m;
    });
    const sorted = [...paths].sort((a, b) => b.length - a.length);
    const re = new RegExp("(?<![\\w./\\[\\]-])(" + sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?![\\w./\\[\\]-])", "g");
    let skip = 0;
    return chunk.split(/(<[^>]+>)/).map(part => {
      if (part[0] === "<") {
        if (/^<(button|a|code|pre|h[1-6]|script|style)[\s>]/i.test(part)) skip++;
        else if (/^<\/(button|a|code|pre|h[1-6]|script|style)>/i.test(part)) skip = Math.max(0, skip - 1);
        return part;
      }
      if (skip > 0 || !part.trim()) return part;
      return part.replace(re, p => srcChipHtml(p, "inline"));
    }).join("");
  };
  return html.split(/(<pre[\s\S]*?<\/pre>)/).map(p => p.startsWith("<pre") ? p : wrapChunk(p)).join("");
};
const pageChipsHtml = p => {
  const counter = counterpartOf.get(p.id);
  const counterHtml = counter
    ? `<a class="counter-chip" href="${counter.href}"><span class="k ${counter.kind}">${esc(counter.label)}</span>${esc(counter.title)}</a>`
    : "";
  const srcRow = p.srcFiles.length
    ? `<div class="src-row"><span class="lbl">Source files</span>${p.srcFiles.map(f => srcChipHtml(f, "top")).join("")}</div>`
    : "";
  if (!counterHtml && !srcRow) return "";
  return `<div class="page-chips">${counterHtml}${srcRow}</div>`;
};
const pageSrcMeta = p => {
  const o = {};
  for (const f of p.srcFiles) {
    const m = fileMetaOf[f];
    if (m) o[f] = { date: m.date, sha: m.sha, subject: m.subject, pr: m.pr };
  }
  return o;
};

// ---------- cross-reference graph ----------
const byWikiSlug = new Map(pages.filter(p => p.kind === "wiki").map(p => [p.slug, p]));
const byDocFile = new Map(pages.filter(p => p.kind === "doc").map(p => [p.file, p]));
const byTitle = pages
  .filter(p => p.title.length >= 8 && p.title.trim().includes(" "))
  .map(p => ({ p, re: new RegExp(`\\b${p.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") }));

const outRefs = new Map(pages.map(p => [p.id, new Set()]));
for (const p of pages) {
  const add = t => { if (t && t.id !== p.id) outRefs.get(p.id).add(t.id); };
  for (const m of p.md.matchAll(/\/wiki\/([\w-]+)/g)) add(byWikiSlug.get(m[1]));
  for (const m of p.md.matchAll(/([\w-]+)\.md\b/g)) add(byDocFile.get(m[1] + ".md"));
  for (const { p: q, re } of byTitle) if (q.id !== p.id && re.test(p.md)) add(q);
}
const inRefs = new Map(pages.map(p => [p.id, new Set()]));
for (const [from, tos] of outRefs) for (const to of tos) inRefs.get(to).add(from);
const byId = new Map(pages.map(p => [p.id, p]));

// ---------- theme ----------
const css = `
:root{
  --navy:#0f2d5c;--navy-2:#123a75;--crimson:#b31942;
  --bg:#f7f8fb;--panel:#ffffff;--ink:#1a2333;--mut:#5b6b84;--line:#e3e8f1;
  --code-bg:#f1f4f9;--acc:#0f2d5c;--acc-link:#1355b4;--sidebar:#fcfdfe;
  --shadow:0 1px 2px rgba(15,45,92,.06),0 8px 24px -18px rgba(15,45,92,.25);
}
@media(prefers-color-scheme:dark){:root{
  --bg:#0d1524;--panel:#131e33;--ink:#e7edf7;--mut:#93a5c1;--line:#22314d;
  --code-bg:#1a2740;--acc:#7fb2f0;--acc-link:#7fb2f0;--sidebar:#101a2d;--crimson:#e8506f;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -18px rgba(0,0,0,.6);
}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:76px}
body{margin:0;font:15.5px/1.7 ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
a{color:var(--acc-link);text-decoration:none}a:hover{text-decoration:underline}

header.top{display:flex;align-items:center;gap:.7rem;padding:.55rem 1.2rem;border-bottom:1px solid var(--line);
  position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--panel) 88%,transparent);backdrop-filter:blur(10px)}
header.top img{width:34px;height:34px;border-radius:50%}
header.top .name{font-weight:700;font-size:1rem;color:var(--ink);letter-spacing:-.01em;white-space:nowrap}
header.top .name small{display:block;font-size:.68rem;font-weight:600;color:var(--crimson);letter-spacing:.14em;text-transform:uppercase;line-height:1.1}
header.top .links{margin-left:auto;display:flex;gap:1.1rem;font-size:.86rem;font-weight:500}
#menu-btn{display:none;margin-left:.2rem;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:8px;padding:.3rem .6rem;font-size:1rem;cursor:pointer}

.layout{display:grid;grid-template-columns:300px minmax(0,1fr);max-width:1500px;margin:0 auto}
.layout.with-toc{grid-template-columns:300px minmax(0,1fr) 220px}

nav.side{background:var(--sidebar);border-right:1px solid var(--line);padding:1rem .9rem 2rem;
  position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto;scrollbar-width:thin}
.hsearch{position:relative;flex:1;max-width:540px;margin:0 .4rem}
.hsearch input{width:100%;padding:.5rem .8rem .5rem 2.1rem;border:1px solid var(--line);border-radius:10px;
  background:var(--panel);color:var(--ink);font-size:.9rem;outline:none;transition:border-color .15s,box-shadow .15s}
.hsearch input:focus{border-color:var(--acc-link);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc-link) 18%,transparent)}
.hsearch .ico{position:absolute;left:.7rem;top:50%;transform:translateY(-50%);color:var(--mut);pointer-events:none;font-size:.95rem}
.hsearch .kbd{position:absolute;right:.6rem;top:50%;transform:translateY(-50%);color:var(--mut);font-size:.68rem;
  border:1px solid var(--line);border-radius:5px;padding:.05rem .35rem;pointer-events:none}
@media(max-width:640px){.hsearch .kbd{display:none}}
nav.side details.sec{margin-bottom:.4rem;border-radius:9px}
nav.side details.sec>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:.45rem;
  font-size:.74rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);padding:.5rem .55rem;border-radius:8px;user-select:none}
nav.side details.sec>summary:hover{background:var(--code-bg)}
nav.side details.sec>summary::before{content:"";width:0;height:0;border-left:5px solid var(--crimson);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s}
nav.side details.sec[open]>summary::before{transform:rotate(90deg)}
nav.side summary .n{margin-left:auto;font-weight:600;color:var(--mut);font-size:.7rem}
nav.side .grp{margin:.5rem 0 .2rem;padding:0 .55rem .1rem 1rem;font-size:.67rem;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--mut)}
nav.side a{display:block;color:var(--ink);font-size:.86rem;padding:.22rem .6rem .22rem 1.35rem;border-radius:7px;
  border-left:2px solid transparent;margin:.04rem 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
nav.side a:hover{background:var(--code-bg);text-decoration:none}
nav.side a.on{color:var(--crimson);font-weight:600;border-left-color:var(--crimson);background:color-mix(in srgb,var(--crimson) 7%,transparent)}
nav.side .miss{display:none}
#hs-panel{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:40;
  background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);max-height:72vh;overflow-y:auto}
#hs-panel.open{display:block}
a.sr{display:flex;gap:.6rem;padding:.55rem .8rem;border-bottom:1px solid var(--line);color:var(--ink);align-items:flex-start}
a.sr:last-child{border-bottom:0}
a.sr:hover,a.sr.act{background:var(--code-bg);text-decoration:none}
.sr-b{font-size:.56rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.14rem .4rem;border-radius:5px;
  white-space:nowrap;background:var(--code-bg);color:var(--mut);margin-top:.15rem;flex-shrink:0}
.sr-b.wiki{color:#199e70}.sr-b.doc{color:var(--acc-link)}
.sr-tx{display:flex;flex-direction:column;min-width:0}
.sr-tx b{font-size:.86rem;font-weight:600;white-space:normal}
.sr-tx b i{font-weight:400;color:var(--mut);font-style:normal}
.sr-tx mark,.sr-d mark{background:color-mix(in srgb,var(--crimson) 24%,transparent);color:inherit;border-radius:3px;padding:0 .1em}
.sr-d{font-size:.76rem;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.1rem}
.hs-foot,.hs-note,.hs-empty{padding:.6rem .85rem;color:var(--mut);font-size:.78rem}
.hs-foot{border-top:1px solid var(--line);position:sticky;bottom:0;background:var(--panel);cursor:pointer;font-weight:600;color:var(--acc-link)}
.hs-foot:hover{background:var(--code-bg)}
#report-fab{position:fixed;right:14px;bottom:14px;z-index:35;border:1px solid var(--line);background:var(--panel);color:var(--mut);
  font-size:.78rem;font-weight:600;padding:.42rem .72rem;border-radius:20px;box-shadow:var(--shadow);cursor:pointer;display:flex;align-items:center;gap:.35rem}
#report-fab:hover{color:var(--crimson);border-color:var(--crimson)}
#report-modal{position:fixed;inset:0;z-index:60;background:rgba(10,18,32,.55);display:flex;align-items:center;justify-content:center;padding:1rem}
#report-modal[hidden]{display:none}
#report-modal .rm-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);width:min(460px,94vw);padding:1.1rem 1.2rem}
.rm-head{font-weight:700;font-size:1.02rem;margin-bottom:.2rem;color:var(--ink)}
.rm-sub{font-size:.8rem;color:var(--mut);margin-bottom:.6rem}
.rm-l{display:block;font-size:.78rem;color:var(--mut);font-weight:600;margin:.6rem 0 .1rem}
#report-modal select,#report-modal textarea{width:100%;margin-top:.25rem;padding:.5rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:.88rem}
.rm-actions{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1rem}
.rm-ghost{background:var(--panel);border:1px solid var(--line);color:var(--ink);padding:.45rem .9rem;border-radius:8px;cursor:pointer;font:inherit;font-size:.85rem}
.rm-primary{background:var(--navy);border:1px solid var(--navy);color:#fff;padding:.45rem .9rem;border-radius:8px;cursor:pointer;font:inherit;font-size:.85rem;font-weight:600}
.rm-primary:hover{background:var(--navy-2)}.rm-primary:disabled{opacity:.6;cursor:default}
.rm-msg{font-size:.82rem;color:var(--acc-link);margin-top:.6rem;min-height:1em}
.results-wrap{max-width:840px;margin:0 auto}
.results-head h1{font-size:1.75rem;margin:.2rem 0 .35rem}
.results-head .meta{color:var(--mut);font-size:.9rem}
.results-search{position:relative;margin:1rem 0 1.5rem}
.results-search input{width:100%;padding:.7rem 1rem .7rem 2.5rem;border:1px solid var(--line);border-radius:12px;
  background:var(--panel);color:var(--ink);font-size:1.02rem;outline:none}
.results-search input:focus{border-color:var(--acc-link);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc-link) 18%,transparent)}
.results-search .ico{position:absolute;left:.9rem;top:50%;transform:translateY(-50%);color:var(--mut)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden;vertical-align:middle;margin-left:.5rem}
.seg button{border:0;background:var(--panel);color:var(--mut);font:inherit;font-size:.78rem;padding:.28rem .7rem;cursor:pointer}
.seg button.on{background:var(--crimson);color:#fff}
.rlist a.sr{border:1px solid var(--line);border-radius:11px;margin-bottom:.6rem;box-shadow:var(--shadow);padding:.75rem .95rem}

main{padding:2.4rem 3.2rem 3rem;min-width:0}
main .crumb{font-size:.78rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--crimson);margin-bottom:.4rem}
main .crumb .sep{color:var(--mut);margin:0 .35rem}
main h1{font-size:2.05rem;line-height:1.2;letter-spacing:-.02em;margin:.1rem 0 1rem;color:var(--ink)}
main .updated{font-size:.76rem;color:var(--mut);margin:-.6rem 0 1.4rem}
.gloss{border-bottom:1px dotted var(--acc-link);cursor:help;text-decoration:none}
.gloss:hover{border-bottom-style:solid}
#gloss-pop{display:none;position:absolute;z-index:70;max-width:320px;background:var(--panel);color:var(--ink);
  border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:.7rem .85rem;font-size:.84rem;line-height:1.5}
#gloss-pop.open{display:block}
#gloss-pop .gp-def{color:color-mix(in srgb,var(--ink) 92%,var(--mut))}
#gloss-pop .gp-links{margin-top:.5rem;display:flex;gap:.9rem;font-size:.8rem;font-weight:600}
#gloss-pop .gp-links a{color:var(--acc-link)}
#gloss-pop::after{content:"";position:absolute;top:-6px;left:var(--ax,16px);width:10px;height:10px;background:var(--panel);
  border-left:1px solid var(--line);border-top:1px solid var(--line);transform:rotate(45deg)}
main h2{font-size:1.35rem;letter-spacing:-.01em;margin:2.4rem 0 .8rem;padding-bottom:.35rem;border-bottom:1px solid var(--line)}
main h3{font-size:1.08rem;margin:1.8rem 0 .6rem}
main h2 a.anchor,main h3 a.anchor{color:var(--mut);opacity:0;margin-left:.4rem;font-weight:400}
main h2:hover a.anchor,main h3:hover a.anchor{opacity:1}
main p,main li{color:color-mix(in srgb,var(--ink) 92%,var(--mut))}
main li{margin:.25rem 0}
code{background:var(--code-bg);border:1px solid var(--line);border-radius:5px;padding:.08em .35em;font-size:.85em;font-family:ui-monospace,"Cascadia Code",Menlo,monospace}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:.95rem 1.1rem;overflow-x:auto;line-height:1.55}
pre code{border:0;background:none;padding:0;font-size:.83rem}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;margin:1rem 0}
th,td{border:1px solid var(--line);padding:.45rem .75rem;font-size:.87rem;text-align:left;vertical-align:top}
th{background:var(--code-bg);font-weight:600}
blockquote{margin:1.1rem 0;padding:.55rem 1.1rem;border-left:3px solid var(--crimson);background:var(--panel);border-radius:0 10px 10px 0;color:var(--mut);box-shadow:var(--shadow)}
blockquote p{margin:.3rem 0}
img{max-width:100%;border-radius:8px}
hr{border:0;border-top:1px solid var(--line);margin:2rem 0}

aside.toc{padding:2.6rem 1.1rem 2rem 0;font-size:.82rem;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto}
aside.toc .t{font-weight:700;font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);margin-bottom:.5rem}
aside.toc a{display:block;color:var(--mut);padding:.18rem 0 .18rem .7rem;border-left:2px solid var(--line);line-height:1.4}
aside.toc a:hover{color:var(--acc-link);text-decoration:none}
aside.toc a.on{color:var(--crimson);border-left-color:var(--crimson);font-weight:600}

.xrefs{margin-top:3rem;border-top:1px solid var(--line);padding-top:1.4rem}
.xrefs h2{border:0;margin:.2rem 0 .8rem;font-size:1.05rem}
.xrefs .cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
.xrefs .col .t{font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-bottom:.5rem}
.xrefs a.chip{display:flex;align-items:baseline;gap:.5rem;padding:.34rem .6rem;border:1px solid var(--line);border-radius:9px;
  margin-bottom:.4rem;background:var(--panel);color:var(--ink);font-size:.85rem;box-shadow:var(--shadow)}
.xrefs a.chip:hover{border-color:var(--acc-link);text-decoration:none}
.xrefs a.chip .k{font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0}
.xrefs a.chip .k.wiki{color:#199e70}.xrefs a.chip .k.doc{color:var(--acc-link)}
@media(max-width:700px){.xrefs .cols{grid-template-columns:1fr}}

.page-chips{margin:-.4rem 0 1.3rem}
.page-chips .counter-chip{display:inline-flex;align-items:baseline;gap:.4rem;padding:.2rem .6rem;border:1px solid var(--line);
  border-radius:8px;background:var(--panel);color:var(--ink);font-size:.84rem;margin:0 .4rem .55rem 0;box-shadow:var(--shadow)}
.page-chips .counter-chip:hover{border-color:var(--acc-link);text-decoration:none}
.page-chips .counter-chip .k{font-size:.68rem;font-weight:700;letter-spacing:.04em}
.page-chips .counter-chip .k.wiki{color:#199e70}.page-chips .counter-chip .k.doc{color:var(--acc-link)}
.src-row{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin:.15rem 0 .2rem}
.src-row .lbl{font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin-right:.2rem}
button.src-chip{font-family:ui-monospace,"Cascadia Code",Menlo,monospace;font-size:.78rem;background:var(--panel);color:var(--acc-link);
  border:1px solid var(--line);border-radius:7px;padding:.12rem .45rem;cursor:pointer;line-height:1.4;max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
button.src-chip:hover{border-color:var(--acc-link)}
button.src-chip .src-age{color:var(--mut);font-size:.68rem;margin-left:.35rem;font-family:ui-sans-serif,system-ui,sans-serif}
button.src-chip.inline{font-size:.85em;padding:.08em .35em;border-radius:5px;background:var(--code-bg);vertical-align:baseline;
  white-space:normal;overflow:visible;text-overflow:clip;line-height:inherit}
button.src-chip.inline .src-age{font-size:.72em}

#src-modal{position:fixed;inset:0;z-index:80;background:rgba(10,18,32,.55);display:flex;align-items:flex-start;justify-content:center;padding:3.5vh 1rem 1.5rem}
#src-modal[hidden]{display:none}
#src-modal .sm-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);
  width:min(980px,96vw);max-height:93vh;display:flex;flex-direction:column;overflow:hidden}
.sm-head{padding:.8rem 1rem .7rem;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:.35rem 1rem;align-items:flex-start}
.sm-path{font-family:ui-monospace,Menlo,monospace;font-size:.88rem;font-weight:600;color:var(--ink);word-break:break-all}
.sm-meta{font-size:.78rem;color:var(--mut);margin-top:.2rem;line-height:1.45}
.sm-meta a{font-weight:600}
.sm-actions{margin-left:auto;display:flex;gap:.5rem;align-items:center;flex-shrink:0}
.sm-gh{font-size:.82rem;font-weight:600;white-space:nowrap}
.sm-body{overflow:auto;flex:1;background:var(--code-bg);font-family:ui-monospace,"Cascadia Code",Menlo,monospace}
.sm-load{padding:1.2rem 1rem;color:var(--mut);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
.sm-line{display:flex;align-items:flex-start;min-height:1.45em;line-height:1.45}
.sm-line .ln{flex:0 0 3.4em;text-align:right;padding:0 .75em 0 .4em;color:var(--mut);font-size:.75rem;user-select:none;text-decoration:none}
.sm-line .ln:hover{color:var(--acc-link);text-decoration:none}
.sm-line code{border:0;background:none;padding:0 .9em 0 0;font-size:.8rem;white-space:pre;flex:1;min-width:0;color:var(--ink);border-radius:0}
.sm-line.on{background:color-mix(in srgb,var(--crimson) 14%,transparent)}
.sm-line.on .ln{color:var(--crimson);font-weight:700}
.sm-kw{color:#6d28d9}.sm-str{color:#0f766e}.sm-com{color:var(--mut);font-style:italic}.sm-num{color:#b45309}.sm-typ{color:#1d4ed8}
@media(prefers-color-scheme:dark){
  .sm-kw{color:#c4b5fd}.sm-str{color:#5eead4}.sm-num{color:#fbbf24}.sm-typ{color:#93c5fd}
}

.pager{display:flex;gap:1rem;margin-top:2rem}
.pager a{flex:1;border:1px solid var(--line);border-radius:12px;padding:.7rem 1rem;background:var(--panel);box-shadow:var(--shadow)}
.pager a:hover{border-color:var(--acc-link);text-decoration:none}
.pager .lbl{font-size:.72rem;color:var(--mut);letter-spacing:.08em;text-transform:uppercase}
.pager .nt{font-weight:600;color:var(--ink);font-size:.9rem}
.pager a.next{text-align:right}

.hero{padding:3.2rem 0 2rem;display:flex;align-items:center;gap:2rem}
.hero img{width:112px;height:112px;border-radius:50%;box-shadow:var(--shadow)}
.hero h1{font-size:2.4rem;margin:0 0 .5rem}
.hero p{max-width:58ch;margin:0;color:var(--mut);font-size:1.03rem}
.hero .cta{margin-top:1.1rem;display:flex;gap:.7rem;flex-wrap:wrap}
.hero .cta a{border-radius:9px;padding:.5rem 1rem;font-weight:600;font-size:.9rem;border:1px solid var(--line)}
.hero .cta a.primary{background:var(--navy);border-color:var(--navy);color:#fff}
.hero .cta a.primary:hover{background:var(--navy-2);text-decoration:none}
.hero .cta a.ghost{background:var(--panel);color:var(--ink)}
.hero .cta a.ghost:hover{border-color:var(--acc-link);text-decoration:none}

.home-sec{margin-top:1.6rem}
.home-sec>h2{font-size:1.3rem;margin:1.6rem 0 .2rem}
.home-sec .blurb{color:var(--mut);margin:.1rem 0 1rem}
.gwrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.9rem}
.gcard{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:1rem 1.1rem;box-shadow:var(--shadow)}
.gcard b{display:block;color:var(--acc);font-size:.95rem;margin-bottom:.45rem}
.gcard a{display:inline-block;font-size:.82rem;color:var(--mut);margin:.12rem .5rem .12rem 0}
.gcard a:hover{color:var(--acc-link)}
.gcard .more{color:var(--crimson);font-weight:600}

footer{color:var(--mut);font-size:.82rem;padding:2.4rem 0 .6rem;border-top:1px solid var(--line);margin-top:3.2rem;display:flex;gap:1.4rem;flex-wrap:wrap}

@media(max-width:1160px){.layout.with-toc{grid-template-columns:300px minmax(0,1fr)}aside.toc{display:none}}
@media(max-width:860px){
  .layout,.layout.with-toc{grid-template-columns:1fr}
  #menu-btn{display:block}
  nav.side{position:fixed;inset:52px auto 0 0;width:min(330px,86vw);z-index:15;transform:translateX(-102%);transition:transform .2s;box-shadow:var(--shadow)}
  body.nav-open nav.side{transform:none}
  main{padding:1.6rem 1.2rem}
  .hero{flex-direction:column;text-align:center;padding-top:2rem}.hero .cta{justify-content:center}
  header.top .links a:not(.keep){display:none}
}
`;

const js = `
const mb=document.getElementById('menu-btn');
if(mb)mb.addEventListener('click',()=>document.body.classList.toggle('nav-open'));
const on=document.querySelector('nav.side a.on');if(on)on.scrollIntoView({block:'center'});
const heads=[...document.querySelectorAll('main h2[id],main h3[id]')];
const tocLinks=new Map([...document.querySelectorAll('aside.toc a')].map(a=>[a.getAttribute('href').slice(1),a]));
if(heads.length&&tocLinks.size){
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
    tocLinks.forEach(a=>a.classList.remove('on'));
    const a=tocLinks.get(e.target.id);if(a)a.classList.add('on');}})},{rootMargin:'-10% 0px -80% 0px'});
  heads.forEach(h=>io.observe(h));}
`;

// Client search: always-on lexical (exact-phrase + all-terms ranking), plus an
// optional semantic re-rank once the bge embedder lazy-loads. Powers the header
// dropdown (5 quick hits + "see all") and the full /search results page.
const searchJs = String.raw`
(function(){
  var INDEX=null,VECS=null,extractor=null,modelState='cold',DIM=384,idxP=null;
  function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function reEsc(s){return s.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');}
  function b64ToI8(b){var bin=atob(b),a=new Int8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=(bin.charCodeAt(i)<<24)>>24;return a;}
  function toks(q){return q.toLowerCase().replace(/"/g,' ').split(/[^a-z0-9]+/).filter(Boolean);}
  function loadIndex(){ if(idxP) return idxP;
    idxP=fetch('/search-index.json').then(function(r){return r.json();}).then(function(j){
      INDEX=j.items; VECS=(INDEX[0]&&INDEX[0].v)?INDEX.map(function(it){return b64ToI8(it.v);}):null; return INDEX; });
    return idxP; }
  function lexical(q){
    var raw=q.toLowerCase().trim(), quoted=raw.length>1&&raw.charAt(0)==='"'&&raw.charAt(raw.length-1)==='"';
    var phrase=quoted?raw.slice(1,-1).trim():raw, terms=toks(phrase), out=[];
    for(var i=0;i<INDEX.length;i++){
      var it=INDEX[i],t=it.t.toLowerCase(),hd=(it.hd||'').toLowerCase(),tx=it.tx||(it.d||'').toLowerCase(),sc=0,all=terms.length>0;
      if(phrase.length>1){ if(t.indexOf(phrase)>=0)sc+=40; if(hd.indexOf(phrase)>=0)sc+=24; if(tx.indexOf(phrase)>=0)sc+=14; }
      for(var k=0;k<terms.length;k++){ var tm=terms[k],hit=0;
        if(t.indexOf(tm)>=0){sc+=6;hit=1;} if(hd.indexOf(tm)>=0){sc+=4;hit=1;} if(tx.indexOf(tm)>=0){sc+=2;hit=1;}
        if(!hit)all=false; }
      if(all)sc+=5;
      if(quoted){ var hasPhrase=t.indexOf(phrase)>=0||hd.indexOf(phrase)>=0||tx.indexOf(phrase)>=0; if(!hasPhrase)sc=0; }
      if(sc>0)out.push({i:i,sc:sc});
    }
    return out.sort(function(a,b){return b.sc-a.sc;});
  }
  function ensureModel(){ if(modelState!=='cold')return; modelState='loading';
    import('/vendor/transformers.min.js').then(function(T){
      T.env.allowRemoteModels=false; T.env.localModelPath='/models/';
      try{T.env.backends.onnx.wasm.wasmPaths='/vendor/ort/';T.env.backends.onnx.wasm.numThreads=1;}catch(e){}
      return T.pipeline('feature-extraction','Xenova/bge-small-en-v1.5',{quantized:true});
    }).then(function(ex){extractor=ex;modelState='ready';document.dispatchEvent(new Event('docsearch:model'));})
      .catch(function(e){modelState='failed';console.warn('semantic unavailable, lexical only',e);});
  }
  function semantic(q){
    return extractor('Represent this sentence for searching relevant passages: '+q,{pooling:'mean',normalize:true})
      .then(function(out){var qv=out.data,s=[];for(var i=0;i<INDEX.length;i++){var v=VECS[i],d=0;for(var k=0;k<DIM;k++)d+=qv[k]*(v[k]/127);s.push({i:i,sc:d});}return s;});
  }
  // Lexical relevance ranking. exact=true forces whole-query phrase matching.
  function search(q,exact){
    q=q.trim(); if(!q)return Promise.resolve([]);
    var qq=exact&&!(q.length>1&&q.charAt(0)==='"')?'"'+q+'"':q;
    return loadIndex().then(function(){ return lexical(qq).map(function(r){return r.i;}); });
  }
  function dedupe(ids,limit){ var seen={},rows=[]; for(var n=0;n<ids.length&&rows.length<limit;n++){var it=INDEX[ids[n]],key=it.h+it.a;if(seen[key])continue;seen[key]=1;rows.push(it);} return rows; }
  function hl(text,q){ var e=esc(text),ts=toks(q); if(!ts.length)return e;
    try{return e.replace(new RegExp('('+ts.map(reEsc).join('|')+')','ig'),'<mark>$1</mark>');}catch(_){return e;} }
  function href(it){return it.h+(it.a?('#'+it.a):'');}
  function row(it,q){ return '<a class="sr" href="'+href(it)+'"><span class="sr-b '+it.k+'">'+esc(it.s)+
    '</span><span class="sr-tx"><b>'+hl(it.t,q)+(it.hd?(' <i>› '+hl(it.hd,q)+'</i>'):'')+
    '</b><span class="sr-d">'+hl(it.d,q)+'</span></span></a>'; }
  function goResults(q){ if(q.trim())location.href='/search.html?q='+encodeURIComponent(q.trim()); }

  // ---- header dropdown ----
  var bar=document.querySelector('.hsearch input.docsearch-input');
  if(bar){
    var panel=document.createElement('div'); panel.id='hs-panel'; bar.parentNode.appendChild(panel);
    var lastIds=[], seq=0, act=-1;
    function close(){panel.classList.remove('open');act=-1;}
    function draw(){
      var rows=dedupe(lastIds,5);
      if(!rows.length){panel.innerHTML='<div class="hs-empty">No matches for “'+esc(bar.value)+'”</div>';panel.classList.add('open');return;}
      panel.innerHTML=rows.map(function(it){return row(it,bar.value);}).join('')+
        '<div class="hs-foot" data-all="1">See all results for “'+esc(bar.value.trim())+'” →</div>';
      panel.classList.add('open');act=-1;
    }
    function run(){ var q=bar.value; if(!q.trim()){close();return;} var my=++seq;
      search(q).then(function(ids){ if(my!==seq)return; lastIds=ids; draw(); }); }
    var t=null;
    bar.addEventListener('focus',function(){loadIndex();});
    bar.addEventListener('input',function(){clearTimeout(t);t=setTimeout(run,110);});
    bar.addEventListener('keydown',function(e){
      var links=panel.querySelectorAll('a.sr');
      if(e.key==='Enter'){ if(act>=0&&links[act]){location.href=links[act].getAttribute('href');}else{goResults(bar.value);} e.preventDefault(); }
      else if(e.key==='ArrowDown'){act=Math.min(act+1,links.length-1);paint(links);e.preventDefault();}
      else if(e.key==='ArrowUp'){act=Math.max(act-1,-1);paint(links);e.preventDefault();}
      else if(e.key==='Escape'){close();bar.blur();}
    });
    function paint(links){for(var i=0;i<links.length;i++)links[i].classList.toggle('act',i===act);}
    panel.addEventListener('mousedown',function(e){var f=e.target.closest('.hs-foot');if(f){goResults(bar.value);e.preventDefault();}});
    document.addEventListener('click',function(e){if(!panel.contains(e.target)&&e.target!==bar)close();});
  }

  // ---- results page ----
  var pageInput=document.querySelector('input.docsearch-input[data-mode="page"]');
  if(pageInput){
    var list=document.getElementById('results-list'), meta=document.getElementById('results-meta');
    var params=new URLSearchParams(location.search), q0=params.get('q')||''; pageInput.value=q0;
    var exactMode=false, pseq=0;
    function drawPage(){ var q=pageInput.value; if(!q.trim()){list.innerHTML='';meta.textContent='Type to search the docs.';return;}
      var my=++pseq; meta.textContent='Searching…';
      search(q,exactMode).then(function(ids){ if(my!==pseq)return;
        var rows=dedupe(ids,80);
        meta.innerHTML=rows.length?('<b>'+rows.length+'</b> result'+(rows.length===1?'':'s')+' for “'+esc(q.trim())+'”'):'No results for “'+esc(q.trim())+'”';
        list.innerHTML=rows.map(function(it){return row(it,q);}).join('');
      });
    }
    var pt=null;
    pageInput.addEventListener('input',function(){clearTimeout(pt);pt=setTimeout(function(){
      var u=new URL(location.href);u.searchParams.set('q',pageInput.value);history.replaceState(null,'',u);drawPage();
    },140);});
    pageInput.addEventListener('keydown',function(e){if(e.key==='Enter')e.preventDefault();});
    var seg=document.getElementById('mode-seg');
    if(seg)seg.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;
      exactMode=b.getAttribute('data-mode')==='exact';
      seg.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);}); drawPage();});
    loadIndex().then(function(){ drawPage(); });
    pageInput.focus();
  }
})();
`;

// "Report page issue" widget -> POST /api/report (collector service).
const reportJs = String.raw`
(function(){
  var fab=document.getElementById('report-fab'), modal=document.getElementById('report-modal');
  if(!fab||!modal) return;
  var reason=document.getElementById('rm-reason'), note=document.getElementById('rm-note'),
      send=document.getElementById('rm-send'), cancel=document.getElementById('rm-cancel'), msg=document.getElementById('rm-msg');
  function open(){modal.hidden=false;msg.textContent='';}
  function close(){modal.hidden=true;}
  fab.addEventListener('click',open);
  cancel.addEventListener('click',close);
  modal.addEventListener('click',function(e){if(e.target===modal)close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
  send.addEventListener('click',function(){
    send.disabled=true; msg.style.color='var(--acc-link)'; msg.textContent='Sending...';
    fetch('/api/report',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({page:fab.getAttribute('data-page')||location.pathname,url:location.href,reason:reason.value,note:(note.value||'').slice(0,2000)})})
      .then(function(r){return r.json();})
      .then(function(j){ if(j&&j.ok){msg.textContent='Thanks. Your report was logged.';note.value='';setTimeout(close,1500);}
        else {msg.style.color='var(--crimson)';msg.textContent=(j&&j.error)||'Could not send.';} })
      .catch(function(){msg.style.color='var(--crimson)';msg.textContent='Could not send. Try again later.';})
      .then(function(){send.disabled=false;});
  });
})();
`;

// Jargon glossary popover: click a dotted term -> definition + Wikipedia / internal link.
const glossJs = String.raw`
(function(){
  var GLOSSARY=__GLOSS__;
  var pop=document.getElementById('gloss-pop'); if(!pop) return;
  function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function hide(){pop.classList.remove('open');pop._for=null;}
  function show(el){
    var g=GLOSSARY[el.getAttribute('data-g')]; if(!g){return;}
    var links='';
    if(g.wiki) links+='<a href="https://en.wikipedia.org/wiki/'+g.wiki+'" target="_blank" rel="noopener">Wikipedia ↗</a>';
    if(g.more) links+='<a href="'+g.more+'">Read more</a>';
    pop.innerHTML='<div class="gp-def">'+esc(g.def)+'</div>'+(links?('<div class="gp-links">'+links+'</div>'):'');
    pop.classList.add('open');
    var r=el.getBoundingClientRect(), sx=window.scrollX, sy=window.scrollY;
    pop.style.left='0px'; pop.style.top='0px';
    var pw=pop.offsetWidth;
    var left=r.left+sx, maxLeft=sx+document.documentElement.clientWidth-pw-10;
    if(left>maxLeft) left=maxLeft; if(left<sx+8) left=sx+8;
    pop.style.left=left+'px'; pop.style.top=(r.bottom+sy+8)+'px';
    pop.style.setProperty('--ax', Math.max(10, Math.min(pw-20, (r.left+sx)-left+10))+'px');
  }
  document.addEventListener('click',function(e){
    var g=e.target.closest?e.target.closest('.gloss'):null;
    if(g){ e.preventDefault(); if(pop.classList.contains('open')&&pop._for===g){hide();} else {show(g);pop._for=g;} return; }
    if(!pop.contains(e.target)) hide();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')hide();});
  window.addEventListener('resize',hide);
})();
`.replace("__GLOSS__", JSON.stringify(glossClient));

// Live source-file viewer: fetch from GitHub raw at click time, highlight, line-link.
const srcJs = String.raw`
(function(){
  var RAW='https://raw.githubusercontent.com/Egg3901/AHDGame/main/';
  var GH='https://github.com/Egg3901/AHDGame/blob/main/';
  var PR='https://github.com/Egg3901/AHDGame/pull/';
  var modal=document.getElementById('src-modal'); if(!modal) return;
  var metaEl=document.getElementById('src-meta');
  var META={}; try{META=JSON.parse(metaEl?metaEl.textContent:'{}');}catch(e){}
  var body=document.getElementById('sm-body');
  var pathEl=document.getElementById('sm-path');
  var metaLine=document.getElementById('sm-fresh');
  var gh=document.getElementById('sm-gh');
  var closeBtn=document.getElementById('sm-close');
  var currentPath='', currentLine=0;
  var BQ=String.fromCharCode(96);
  function esc(s){return (s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function encodePath(p){return p.split('/').map(encodeURIComponent).join('/');}
  var KW=/^(abstract|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|null|of|return|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|with|yield|as|satisfies|keyof|infer|never|unknown|any|boolean|number|string|symbol|bigint|module|namespace|declare|readonly|public|private|protected|override)$/;
  function hiLine(s, st){
    var out='', i=0, n=s.length;
    if(st==='c'){
      var end=s.indexOf('*/');
      if(end<0) return {html:'<span class="sm-com">'+esc(s)+'</span>', state:'c'};
      out+='<span class="sm-com">'+esc(s.slice(0,end+2))+'</span>'; i=end+2; st='n';
    }
    function isIdent(c){return /[A-Za-z0-9_$]/.test(c);}
    while(i<n){
      var c=s.charAt(i), n2=s.slice(i,i+2);
      if(n2==='//'){ out+='<span class="sm-com">'+esc(s.slice(i))+'</span>'; i=n; break; }
      if(n2==='/*'){
        var end=s.indexOf('*/',i+2);
        if(end<0){ out+='<span class="sm-com">'+esc(s.slice(i))+'</span>'; i=n; st='c'; break; }
        out+='<span class="sm-com">'+esc(s.slice(i,end+2))+'</span>'; i=end+2; continue;
      }
      if(c==='"'||c==="'"||c===BQ){
        var q=c, j=i+1;
        while(j<n){
          if(s.charAt(j)==='\\'){ j+=2; continue; }
          if(s.charAt(j)===q){ j++; break; }
          j++;
        }
        out+='<span class="sm-str">'+esc(s.slice(i,j))+'</span>'; i=j; continue;
      }
      if(/[0-9]/.test(c)&&(i===0||!isIdent(s.charAt(i-1)))){
        var j=i+1; while(j<n&&/[0-9_.xXa-fA-F]/.test(s.charAt(j))) j++;
        out+='<span class="sm-num">'+esc(s.slice(i,j))+'</span>'; i=j; continue;
      }
      if(/[A-Za-z_$]/.test(c)){
        var j=i+1; while(j<n&&isIdent(s.charAt(j))) j++;
        var id=s.slice(i,j);
        var cls=KW.test(id)?'sm-kw':(/^[A-Z]/.test(id)?'sm-typ':'');
        out+=(cls?('<span class="'+cls+'">'+esc(id)+'</span>'):esc(id)); i=j; continue;
      }
      out+=esc(c); i++;
    }
    return {html:out, state:st};
  }
  function parseHash(){
    var h=(location.hash||'').replace(/^#/, '');
    if(!h||h.indexOf('file=')<0) return null;
    var file='', line=0;
    h.split('&').forEach(function(part){
      if(part.indexOf('file=')===0) file=decodeURIComponent(part.slice(5));
      else if(part.charAt(0)==='L') line=parseInt(part.slice(1),10)||0;
    });
    return file?{file:file,line:line}:null;
  }
  function setHash(path, line){
    var h='#file='+encodeURIComponent(path)+(line?('&L'+line):'');
    if(location.hash!==h) history.replaceState(null,'',location.pathname+location.search+h);
  }
  function open(path, line){
    currentPath=path; currentLine=line||0;
    pathEl.textContent=path;
    var m=META[path]||{};
    var fresh='';
    if(m.date){
      fresh='last touched '+esc(m.date);
      if(m.pr) fresh+=' in <a href="'+PR+m.pr+'" target="_blank" rel="noopener">#'+m.pr+'</a>';
      else if(m.sha) fresh+=' in '+esc(m.sha);
      if(m.subject){
        var sub=String(m.subject).replace(/\s*\(#\d+\)\s*$/,'');
        fresh+=' '+esc(sub);
      }
    }
    metaLine.innerHTML=fresh;
    gh.href=GH+encodePath(path)+(currentLine?('#L'+currentLine):'');
    modal.hidden=false;
    body.innerHTML='<div class="sm-load">Loading '+esc(path)+'...</div>';
    setHash(path, currentLine);
    fetch(RAW+encodePath(path)).then(function(r){
      if(!r.ok) throw new Error(r.status+' '+r.statusText);
      return r.text();
    }).then(function(text){
      var st='n', html='', lines=text.split('\n');
      for(var i=0;i<lines.length;i++){
        var r=hiLine(lines[i], st); st=r.state;
        var n=i+1, on=currentLine===n?' on':'';
        html+='<div class="sm-line'+on+'" id="L'+n+'"><a class="ln" href="#file='+encodeURIComponent(path)+'&L'+n+'">'+n+'</a><code>'+r.html+'</code></div>';
      }
      body.innerHTML=html;
      gh.href=GH+encodePath(path)+(currentLine?('#L'+currentLine):'');
      if(currentLine){
        var el=document.getElementById('L'+currentLine);
        if(el) el.scrollIntoView({block:'center'});
      }
    }).catch(function(e){
      body.innerHTML='<div class="sm-load">Could not load this file ('+esc(String(e.message||e))+'). <a href="'+GH+encodePath(path)+'" target="_blank" rel="noopener">View on GitHub</a></div>';
    });
  }
  function close(){
    modal.hidden=true;
    if((location.hash||'').indexOf('file=')>=0) history.replaceState(null,'',location.pathname+location.search);
  }
  document.addEventListener('click', function(e){
    var chip=e.target.closest?e.target.closest('button.src-chip'):null;
    if(chip){ e.preventDefault(); open(chip.getAttribute('data-path'), 0); return; }
    var ln=e.target.closest?e.target.closest('#src-modal a.ln'):null;
    if(ln){
      e.preventDefault();
      var n=parseInt(ln.textContent,10)||0;
      currentLine=n;
      setHash(currentPath, n);
      gh.href=GH+encodePath(currentPath)+'#L'+n;
      modal.querySelectorAll('.sm-line.on').forEach(function(x){x.classList.remove('on');});
      var row=document.getElementById('L'+n); if(row) row.classList.add('on');
      return;
    }
    if(e.target===modal) close();
  });
  if(closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'&&!modal.hidden){ e.preventDefault(); close(); } });
  var init=parseHash(); if(init) open(init.file, init.line);
})();
`;

// ---------- nav ----------
const NAV_SECTIONS = [
  { key: "wiki", label: "Player Wiki" },
  { key: "design", label: "Game Design" },
  { key: "engineering", label: "Engineering" },
  { key: "api", label: "API" },
];
const groupOrder = sec => {
  if (sec === "wiki") return WIKI_CATEGORY_ORDER.map(c => WIKI_CATEGORY_LABELS[c]);
  const g = { design: DESIGN_GROUPS, engineering: ENGINEERING_GROUPS, api: API_GROUPS }[sec].map(x => x[0]);
  return [...g, "Other"];
};
const navHtml = activeHref => NAV_SECTIONS.map(s => {
  const secPages = pages.filter(p => p.section === s.key);
  const open = secPages.some(p => p.href === activeHref) || !activeHref ? " open" : "";
  const inner = groupOrder(s.key).map(g => {
    const gp = secPages.filter(p => p.group === g);
    if (!gp.length) return "";
    return `<div class="grp">${esc(g)}</div>` + gp.map(p =>
      `<a href="${p.href}"${p.href === activeHref ? ' class="on"' : ""} data-t="${esc(p.title.toLowerCase())}">${esc(p.title)}</a>`).join("");
  }).join("");
  return `<details class="sec"${open}><summary>${s.label} <span class="n">${secPages.length}</span></summary>${inner}</details>`;
}).join("");

const shell = ({ title, body, activeHref, toc, desc, srcMeta }) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · A House Divided Docs</title>
<meta name="description" content="${esc(desc || "Player wiki, design, and engineering documentation for A House Divided.")}">
<meta property="og:title" content="${esc(title)} · A House Divided Docs">
<meta property="og:image" content="https://docs.lakesidegames.net/ahd-logo.png">
<link rel="icon" href="/ahd-logo.png"><style>${css}</style></head><body>
<header class="top">
  <button id="menu-btn" aria-label="Menu">☰</button>
  <a href="/" style="display:flex;align-items:center;gap:.7rem;text-decoration:none"><img src="/ahd-logo.png" alt="A House Divided">
  <span class="name">A House Divided<small>Documentation</small></span></a>
  <div class="hsearch">
    <span class="ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
    <input class="docsearch-input" type="search" placeholder="Search the docs…" autocomplete="off" spellcheck="false" aria-label="Search documentation">
    <span class="kbd">↵</span>
  </div>
  <span class="links"><a href="https://www.ahousedividedgame.com/changelog">Changelog</a></span>
</header>
<div class="layout${toc ? " with-toc" : ""}">
<nav class="side">${navHtml(activeHref)}</nav>
<main>${body}
<footer><span>© Lakeside Games</span><a href="https://github.com/Egg3901/AHDGame">Source on GitHub</a><a href="https://www.ahousedividedgame.com">ahousedividedgame.com</a></footer>
</main>
${toc || ""}</div>
<button id="report-fab" type="button" data-page="${esc(activeHref || "/")}" aria-label="Report an issue with this page"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15V4a1 1 0 0 1 1-1h11l-2 4 2 4H5a1 1 0 0 1-1-1z"/><path d="M4 22v-7"/></svg>Report page issue</button>
<div id="report-modal" role="dialog" aria-modal="true" aria-label="Report an issue" hidden>
  <div class="rm-card">
    <div class="rm-head">Report an issue with this page</div>
    <div class="rm-sub">Spotted something out of date or wrong? Let us know and we will fix it.</div>
    <label class="rm-l">What is the issue?
      <select id="rm-reason">
        <option value="stale">Out of date / stale</option>
        <option value="incorrect">Incorrect information</option>
        <option value="update-request">Requesting an update or more detail</option>
        <option value="other">Other</option>
      </select>
    </label>
    <label class="rm-l">Details (optional)
      <textarea id="rm-note" rows="4" placeholder="What did you notice, and what should it say?"></textarea>
    </label>
    <div class="rm-actions"><button type="button" id="rm-cancel" class="rm-ghost">Cancel</button><button type="button" id="rm-send" class="rm-primary">Send report</button></div>
    <div id="rm-msg" class="rm-msg"></div>
  </div>
</div>
<div id="gloss-pop"></div>
<div id="src-modal" role="dialog" aria-modal="true" aria-label="Source file" hidden>
  <div class="sm-card">
    <div class="sm-head">
      <div>
        <div class="sm-path" id="sm-path"></div>
        <div class="sm-meta" id="sm-fresh"></div>
      </div>
      <div class="sm-actions">
        <a id="sm-gh" class="sm-gh" href="https://github.com/Egg3901/AHDGame" target="_blank" rel="noopener">View on GitHub</a>
        <button type="button" id="sm-close" class="rm-ghost" aria-label="Close">Close</button>
      </div>
    </div>
    <div class="sm-body" id="sm-body"></div>
  </div>
</div>
<script type="application/json" id="src-meta">${JSON.stringify(srcMeta || {}).replace(/</g, "\\u003c")}</script>
<script>${js}</script><script>${searchJs}</script><script>${reportJs}</script><script>${glossJs}</script><script>${srcJs}</script></body></html>`;

// ---------- render ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(LOGO_SRC, path.join(OUT, "ahd-logo.png"));

marked.use({
  renderer: {
    heading(text, level) {
      if (level === 1) return "";
      const id = anchor(text);
      return `<h${level} id="${id}">${text}<a class="anchor" href="#${id}">#</a></h${level}>`;
    },
  },
});

const secLabel = p => p.kind === "wiki" ? "Player Wiki" : DOC_SECTIONS.find(s => s.dir === p.section)?.label ?? p.section;
const chip = id => {
  const t = byId.get(id);
  return `<a class="chip" href="${t.href}"><span class="k ${t.kind}">${t.kind === "wiki" ? "wiki" : "docs"}</span>${esc(t.title)}</a>`;
};
const xrefsHtml = p => {
  const outs = [...outRefs.get(p.id)].slice(0, 12);
  const ins = [...inRefs.get(p.id)].slice(0, 12);
  if (!outs.length && !ins.length) return "";
  return `<div class="xrefs"><h2>Connected pages</h2><div class="cols">
    <div class="col"><div class="t">References →</div>${outs.map(chip).join("") || '<span style="color:var(--mut);font-size:.85rem">None</span>'}</div>
    <div class="col"><div class="t">← Referenced by</div>${ins.map(chip).join("") || '<span style="color:var(--mut);font-size:.85rem">None</span>'}</div>
  </div></div>`;
};

for (let i = 0; i < pages.length; i++) {
  const p = pages[i];
  let html = marked.parse(p.md);
  html = html
    .replace(/href="\/wiki\/([\w-]+)"/g, (m, s) => byWikiSlug.has(s) ? `href="/wiki/${s}.html"` : `href="https://www.ahousedividedgame.com/wiki/${s}"`)
    .replace(/href="(\.\/)?([\w-]+)\.md(#[\w-]*)?"/g, (m, _d, name, h) =>
      byDocFile.has(name + ".md") ? `href="${byDocFile.get(name + ".md").href}${h || ""}"` : m)
    .replace(/href="\.\.\/(design|engineering|api)\/([\w-]+)\.md(#[\w-]*)?"/g, 'href="/$1/$2.html$3"')
    .replace(/href="(\/[^"]*)"/g, (m, href) => {
      const pathname = href.split(/[?#]/, 1)[0];
      if (pathname === "/" || pathname.endsWith(".html")) return m;
      return `href="${GAME_SITE}${href}"`;
    });
  html = wrapGloss(html);
  html = wrapSrc(html, p.srcFiles);
  const h2s = [...p.md.matchAll(/^##\s+(.+)$/gm)].map(m => m[1].replace(/[*`]/g, ""));
  const toc = h2s.length >= 2
    ? `<aside class="toc"><div class="t">On this page</div>${h2s.map(t => `<a href="#${anchor(t)}">${esc(t)}</a>`).join("")}</aside>`
    : null;
  const sameSec = pages.filter(q => q.section === p.section);
  const idx = sameSec.indexOf(p);
  const prev = sameSec[idx - 1], next = sameSec[idx + 1];
  const pager = `<div class="pager">${
    prev ? `<a href="${prev.href}"><div class="lbl">Previous</div><div class="nt">${esc(prev.title)}</div></a>` : "<span style='flex:1'></span>"}${
    next ? `<a class="next" href="${next.href}"><div class="lbl">Next</div><div class="nt">${esc(next.title)}</div></a>` : "<span style='flex:1'></span>"}</div>`;
  const updated = p.updated ? `<div class="updated">Last updated ${p.updated}</div>` : "";
  const body = `<div class="crumb">${esc(secLabel(p))}<span class="sep">/</span>${esc(p.group)}</div><h1>${esc(p.title)}</h1>${updated}${pageChipsHtml(p)}${html}${xrefsHtml(p)}${pager}`;
  const outPath = path.join(OUT, p.kind === "wiki" ? `wiki/${p.slug}.html` : `${p.section}/${p.slug}.html`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, shell({ title: p.title, body, activeHref: p.href, toc, desc: p.desc, srcMeta: pageSrcMeta(p) }));
}

// ---------- semantic search index ----------
const plain = s => s
  .replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ")
  .replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^[#>*_|\-\s]+/gm, " ").replace(/[#>*_|]/g, " ")
  .replace(/\s+/g, " ").trim();

// One chunk per H2/H3 section, plus the page intro. Each chunk becomes a
// separately-embedded, separately-linkable search result.
const chunkPage = p => {
  const chunks = [];
  let heading = "", anchorId = "", buf = [];
  const flush = () => {
    const body = plain(buf.join("\n"));
    if (body.length > 24 || heading) chunks.push({ heading, anchorId, body });
    buf = [];
  };
  for (const ln of p.md.split("\n")) {
    const h = ln.match(/^(##|###)\s+(.+)$/);
    if (h) { flush(); heading = h[2].replace(/[*`]/g, "").trim(); anchorId = anchor(heading); }
    else buf.push(ln);
  }
  flush();
  return chunks.length ? chunks : [{ heading: "", anchorId: "", body: plain(p.md) }];
};

const idxItems = [];
for (const p of pages) {
  for (const c of chunkPage(p)) {
    idxItems.push({
      p, c,
      text: `${p.title}. ${c.heading ? c.heading + ". " : ""}${c.body}`.slice(0, 1600),
    });
  }
}

// Semantic (in-browser embedding) is currently OFF: the 34MB client model was
// unreliable/slow in-browser. Lexical relevance + exact-phrase is the live engine.
// Flip SEMANTIC=true to re-enable embeddings (also re-enable the client model path).
const SEMANTIC = false;
let items;
if (SEMANTIC) {
  console.log(`embedding ${idxItems.length} chunks with ${MODEL_ID}…`);
  const extractor = await pipeline("feature-extraction", MODEL_ID, { quantized: true });
  const quant = f => { const b = Buffer.allocUnsafe(f.length); for (let i = 0; i < f.length; i++) { let v = Math.round(f[i] * 127); b[i] = (v > 127 ? 127 : v < -127 ? -127 : v) & 0xff; } return b.toString("base64"); };
  const BATCH = 32;
  items = [];
  for (let i = 0; i < idxItems.length; i += BATCH) {
    const batch = idxItems.slice(i, i + BATCH);
    const out = await extractor(batch.map(b => b.text), { pooling: "mean", normalize: true });
    for (let j = 0; j < batch.length; j++) {
      const { p, c } = batch[j];
      const vec = out.data.slice(j * 384, (j + 1) * 384);
      items.push({ h: p.href, a: c.anchorId, k: p.kind === "wiki" ? "wiki" : "doc", s: secLabel(p), t: p.title, hd: c.heading, d: (c.body || p.desc || "").slice(0, 200), tx: `${p.title} ${c.heading} ${c.body}`.toLowerCase().slice(0, 620), v: quant(vec) });
    }
  }
  const modelOut = path.join(OUT, "models", MODEL_ID);
  fs.mkdirSync(path.join(modelOut, "onnx"), { recursive: true });
  for (const rel of ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"]) fs.copyFileSync(path.join(XENOVA_CACHE, MODEL_ID, rel), path.join(modelOut, rel));
  const NM = new URL("./node_modules", import.meta.url).pathname;
  const vendorOut = path.join(OUT, "vendor");
  fs.mkdirSync(path.join(vendorOut, "ort"), { recursive: true });
  fs.copyFileSync(path.join(NM, "@xenova/transformers/dist/transformers.min.js"), path.join(vendorOut, "transformers.min.js"));
  const ORT_DIST = path.join(NM, "onnxruntime-web/dist");
  for (const f of fs.readdirSync(ORT_DIST)) if (f.endsWith(".wasm")) fs.copyFileSync(path.join(ORT_DIST, f), path.join(vendorOut, "ort", f));
} else {
  items = idxItems.map(({ p, c }) => ({ h: p.href, a: c.anchorId, k: p.kind === "wiki" ? "wiki" : "doc", s: secLabel(p), t: p.title, hd: c.heading, d: (c.body || p.desc || "").slice(0, 200), tx: `${p.title} ${c.heading} ${c.body}`.toLowerCase().slice(0, 620) }));
}
fs.writeFileSync(path.join(OUT, "search-index.json"), JSON.stringify({ dim: 384, semantic: SEMANTIC, items }));
console.log(`search index: ${items.length} chunks -> search-index.json (semantic=${SEMANTIC})`);

// ---------- homepage ----------
const homeSec = (key, label, blurb) => {
  const secPages = pages.filter(p => p.section === key);
  const cards = groupOrder(key).map(g => {
    const gp = secPages.filter(p => p.group === g);
    if (!gp.length) return "";
    const shown = gp.slice(0, 6);
    return `<div class="gcard"><b>${esc(g)}</b>${shown.map(p => `<a href="${p.href}">${esc(p.title)}</a>`).join("")}${
      gp.length > shown.length ? `<a class="more" href="${gp[0].href}">+${gp.length - shown.length} more</a>` : ""}</div>`;
  }).join("");
  return `<div class="home-sec"><h2>${label}</h2><p class="blurb">${blurb}</p><div class="gwrap">${cards}</div></div>`;
};
const home = `
<div class="hero"><img src="/ahd-logo.png" alt="A House Divided logo">
<div><h1>A House Divided Docs</h1>
<p>Everything about the multiplayer political and economic simulation, in one place: the player wiki, the design docs behind every mechanic, and the engineering guides for contributors.</p>
<div class="cta"><a class="primary" href="https://www.ahousedividedgame.com">Play the game</a>
<a class="ghost" href="https://github.com/Egg3901/AHDGame">Source on GitHub</a>
<a class="ghost" href="/api/public-v1.html">Public API</a></div></div></div>
${homeSec("wiki", "Player Wiki", "How to play: the same guides that ship inside the game, from your first character to advanced strategy.")}
${homeSec("design", "Game Design", "How every system works under the hood: elections, legislation, parties, the economy, and the world.")}
${homeSec("engineering", "Engineering", "Architecture, conventions, and contribution guides for the codebase.")}
${homeSec("api", "API", "The public REST API and client integration.")}`;
fs.writeFileSync(path.join(OUT, "index.html"), shell({ title: "Home", body: home, activeHref: "" }));

// ---------- search results page ----------
const searchPage = `<div class="results-wrap">
<div class="results-head"><h1>Search<span class="seg" id="mode-seg"><button data-mode="smart" class="on">Smart</button><button data-mode="exact">Exact</button></span></h1></div>
<div class="results-search">
  <span class="ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
  <input class="docsearch-input" data-mode="page" type="search" placeholder="Search the docs…" autocomplete="off" spellcheck="false" aria-label="Search documentation">
</div>
<div id="results-meta" style="color:var(--mut);font-size:.9rem;margin:.2rem 0 1.1rem"></div>
<div class="rlist" id="results-list"></div>
</div>`;
fs.writeFileSync(path.join(OUT, "search.html"), shell({ title: "Search", body: searchPage, activeHref: "", desc: "Search the A House Divided documentation and player wiki." }));

// ---------- sitemap + robots ----------
const BASE = "https://docs.lakesidegames.net";
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [`${BASE}/`, ...pages.map(p => BASE + p.href)].map(u => `<url><loc>${u}</loc></url>`).join("\n") +
  `\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

const edges = [...outRefs.values()].reduce((n, s) => n + s.size, 0);
console.log(`built ${pages.length} pages (${pages.filter(p => p.kind === "wiki").length} wiki, ${pages.filter(p => p.kind === "doc").length} docs), ${edges} cross-reference edges -> ${OUT}`);
