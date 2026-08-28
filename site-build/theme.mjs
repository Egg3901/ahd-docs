// Shared docs theme.
//
// The CSS and base JS below are the SAME bytes A House Divided's builder used
// when they lived inline in build.mjs — they were moved here verbatim so the
// satellite games in games.mjs render identically instead of drifting from a
// second copy. Anything genuinely new (the game switcher, the Ask launcher) is
// appended at the end of each block and marked as such.

export const css = `:root{
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
  header.top .links > a:not(.keep){display:none}
}
/* ---------- game switcher (shared: A House Divided + satellites) ---------- */
.gswitch{position:relative;flex-shrink:0}
.gswitch>button{display:flex;align-items:center;gap:.35rem;background:none;border:1px solid var(--line);cursor:pointer;
  font:inherit;font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--mut);padding:.32rem .55rem;border-radius:8px;line-height:1.1;white-space:nowrap}
.gswitch>button:hover{color:var(--crimson);border-color:var(--crimson);background:var(--panel)}
.gswitch>button .caret{width:0;height:0;border-top:4px solid currentColor;border-left:3.5px solid transparent;border-right:3.5px solid transparent;opacity:.75}
.gswitch .menu{position:absolute;top:calc(100% + .5rem);right:0;z-index:40;min-width:250px;
  max-width:calc(100vw - 1.5rem);
  background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:.35rem;display:none}
.gswitch.open .menu{display:block}
.gswitch .menu .mt{font-size:.63rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--mut);padding:.4rem .6rem .25rem}
.gswitch .menu a{display:flex;align-items:center;gap:.55rem;padding:.4rem .6rem;border-radius:8px;color:var(--ink);font-size:.86rem;font-weight:500}
.gswitch .menu a:hover{background:var(--code-bg);text-decoration:none}
.gswitch .menu a img{width:20px;height:20px;border-radius:5px;flex-shrink:0;object-fit:cover}
.gswitch .menu a.on{color:var(--crimson);font-weight:600}
.gswitch .menu a .tick{margin-left:auto;font-size:.8rem}

/* ---------- Ask launcher ---------- */
#ask-fab{position:fixed;right:14px;bottom:56px;z-index:35;border:1px solid var(--line);background:var(--panel);color:var(--mut);
  font-size:.78rem;font-weight:600;padding:.42rem .72rem;border-radius:20px;box-shadow:var(--shadow);cursor:pointer;
  display:flex;align-items:center;gap:.35rem;text-decoration:none}
#ask-fab:hover{color:var(--acc-link);border-color:var(--acc-link);text-decoration:none}
@media(max-width:520px){#ask-fab .lbl{display:none}#ask-fab{padding:.5rem;border-radius:50%}}
/* Phone header: the logo carries the brand, so the wordmark gives up its space
   to the search field and the switcher rather than all three fighting for it. */
@media(max-width:560px){
  header.top{gap:.45rem;padding:.5rem .7rem}
  header.top .name{display:none}
  .hsearch{margin:0 .2rem}
  .gswitch>button{padding:.3rem .45rem;letter-spacing:.08em}
}
`;

export const baseJs = `const mb=document.getElementById('menu-btn');
if(mb)mb.addEventListener('click',()=>document.body.classList.toggle('nav-open'));
const on=document.querySelector('nav.side a.on');if(on)on.scrollIntoView({block:'center'});
const heads=[...document.querySelectorAll('main h2[id],main h3[id]')];
const tocLinks=new Map([...document.querySelectorAll('aside.toc a')].map(a=>[a.getAttribute('href').slice(1),a]));
if(heads.length&&tocLinks.size){
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){
    tocLinks.forEach(a=>a.classList.remove('on'));
    const a=tocLinks.get(e.target.id);if(a)a.classList.add('on');}})},{rootMargin:'-10% 0px -80% 0px'});
  heads.forEach(h=>io.observe(h));}
var gs=document.querySelector('.gswitch');
if(gs){
  var gsb=gs.querySelector('button');
  gsb.addEventListener('click',function(e){e.stopPropagation();gs.classList.toggle('open');
    gsb.setAttribute('aria-expanded',gs.classList.contains('open')?'true':'false');});
  document.addEventListener('click',function(e){if(!gs.contains(e.target))gs.classList.remove('open');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')gs.classList.remove('open');});
}
`;

export const searchJs = String.raw`(function(){
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
})();`;

export const reportJs = String.raw`(function(){
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
})();`;


const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Rebase the search client for a game served under a sub-path.
 *
 * Only the index and the results page move: the embedder vendor bundle and the
 * model weights are ~40MB and stay at the site root, shared by every game, so a
 * satellite never ships a second copy of them.
 */
export function searchJsFor(base) {
  if (!base) return searchJs;
  return searchJs
    .replace("'/search-index.json'", `'${base}/search-index.json'`)
    .replace("location.href='/search.html?q='", `location.href='${base}/search.html?q='`);
}

/**
 * The header game switcher. `games` is ALL_GAMES; `activeSlug` marks the current
 * one. Every game's logo is served from its own docs root, so a game without its
 * own mark falls back to the Lakeside one at build time (see copyLogo).
 */
export function switcherHtml(games, activeSlug, extras = []) {
  const row = g => {
    const href = g.base ? `${g.base}/` : "/";
    const on = g.slug === activeSlug;
    return `<a href="${href}"${on ? ' class="on"' : ""}><img src="${g.base}/logo.png" alt="" loading="lazy">${escAttr(g.short)}${on ? '<span class="tick">&#10003;</span>' : ""}</a>`;
  };
  // Extras are docs that are not a game (the desktop client). They belong in the
  // menu so they can be found, under their own heading so the list still reads
  // as a list of games.
  const extraBlock = extras.length
    ? `<div class="mt">Desktop app</div>${extras.map(row).join("")}`
    : "";
  return `<div class="gswitch"><button type="button" aria-haspopup="true" aria-expanded="false" aria-label="Switch game">Games<span class="caret"></span></button>` +
    `<div class="menu"><div class="mt">Games</div>${games.map(row).join("")}${extraBlock}</div></div>`;
}

/** Floating "Ask" launcher. Deep-links to Ask with this game preselected. */
export function askFabHtml(askUrl) {
  return `<a id="ask-fab" href="${escAttr(askUrl)}" aria-label="Ask a question about this game">` +
    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>` +
    `</svg><span class="lbl">Ask</span></a>`;
}
