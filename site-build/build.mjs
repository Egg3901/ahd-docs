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
const GAME = process.env.GAME_REPO || "../AHDGame";
const OUT = process.env.DOCS_OUT || "/srv/lakeside-docs";
const LOGO_SRC = `${GAME}/public/ahd-logo.png`;
const WIKI_JSON = "/tmp/wiki-pages.json";

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
  ["Elections & Campaigns", ["elections", "election-engine", "granular-electorate-as-shipped", "campaign-manager", "canvassing", "fundraising-ads", "demographics", "demographics-targeting", "archetype-approvals", "political-system-reg-support", "snap-elections", "vacancy-handling", "japan-elections", "uk-elections", "demographic-election-audit", "demographic-election-implementation-audit"]],
  ["Legislature & Parties", ["bills-legislation", "policy-system", "player-policies", "congress-leadership", "congress-speaker", "caucuses", "party-whips", "parties", "party-influence", "party-slate", "coalitions", "legislation-system-completion-audit"]],
  ["Government & Executive", ["cabinet", "uk-cabinet", "parliamentary-government", "ruling-party-confidence", "uk-pm-no-confidence", "uk-devolution-policy", "uk-jp-devolved-executives", "government-approval", "state-level-power", "one-party-states-as-shipped"]],
  ["Economy & Finance", ["economic-systems", "capacity-economy-as-shipped", "monetary-system-as-shipped", "corporations", "stock-market", "corporate-bond-defaults", "sovereign-bonds", "imf-corporate-bailout", "commodities", "commodity-pricing-v2", "currency-exchange", "price-indexing-and-repricing", "national-budget", "budget-calculations", "subsidies", "tariffs", "labour", "resources", "formula-deep-dive"]],
  ["Countries", ["china", "japan", "united-kingdom"]],
  ["World & Simulation", ["crisis-system", "national-metrics", "npp-system", "npp-opponents", "core-systems", "turn-processing", "conflict-system-as-shipped"]],
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

const shell = ({ title, body, activeHref, toc, desc }) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
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
${toc || ""}</div><script>${js}</script><script>${searchJs}</script></body></html>`;

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
    .replace(/href="\.\.\/(design|engineering|api)\/([\w-]+)\.md(#[\w-]*)?"/g, 'href="/$1/$2.html$3"');
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
  const body = `<div class="crumb">${esc(secLabel(p))}<span class="sep">/</span>${esc(p.group)}</div><h1>${esc(p.title)}</h1>${html}${xrefsHtml(p)}${pager}`;
  const outPath = path.join(OUT, p.kind === "wiki" ? `wiki/${p.slug}.html` : `${p.section}/${p.slug}.html`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, shell({ title: p.title, body, activeHref: p.href, toc, desc: p.desc }));
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
