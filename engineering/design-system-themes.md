# Design System — Themes

Companion to [`design-system.md`](design-system.md). This document specifies every theme AHD ships: identity, when to use it, token table, and failure modes.

Source of truth: `src/app/globals.css`. User-facing selector: `src/app/settings/components/AppearanceSection.tsx`. Persistence + sync: `src/contexts/ThemeContext.tsx` → `/api/settings/theme`.

## Index

Dark themes:

- [`default`](#default) — warmed graphite, the canonical look.
- [`oled`](#oled) — true-black for AMOLED + night use.
- [`usa`](#usa) — patriotic navy/crimson/parchment.
- [`dark-pastel`](#dark-pastel) — purple + cyan neo.
- [`retro`](#retro) — green-phosphor CRT.
- [`solarized`](#solarized) — classic burnt-orange / teal.
- [`cloakroom`](#cloakroom) — warm dark, statesman.
- [`coldwar`](#coldwar) — amber-on-near-black, sit-room console.
- [`command-1953`](#command-1953) — phosphor CRT console, single-screen atmosphere.

Light themes:

- [`light`](#light) — slate-50 clean.
- [`pastel`](#pastel) — soft fuchsia.
- [`broadsheet`](#broadsheet) — editorial cream + ink.

## How a theme is applied

1. `ThemeProvider` (in `src/contexts/ThemeContext.tsx`) reads:
   - On **public / lightweight pages** (`/`, `/login`, `/register`, `/banned`, and paths in `isLightweightLayoutPath`): localStorage only. The landing always uses `default` regardless of preference — the `applyTheme` effect forces it for those paths.
   - On **in-game pages**: the shared `AuthDataContext` supplies `authUser.theme`; fallback is localStorage.
2. On change, the selected theme is written to:
   - `localStorage["ahd-theme"]`
   - `document.documentElement[data-theme]`
   - `PATCH /api/settings/theme` (persists to `User.theme` via `themeSchema` in `src/lib/api/schemas/settings.ts`)
3. All theme variables are scoped to `[data-theme="..."]` blocks on `:root`. Changing the attribute cascades instantly.

**Invariant:** Every theme block must define **every** variable in the Default block. A missing variable silently inherits from `:root`, which is the Default theme — this produces hybrid "mostly-broken" themes that pass smoke tests but look wrong on specific surfaces.

## Token columns used in every theme table below

| Token                                            | Meaning                           |
| ------------------------------------------------ | --------------------------------- |
| `--background`                                   | Page backdrop.                    |
| `--foreground`                                   | Primary text.                     |
| `--primary` / `--primary-dark`                   | CTA, destructive, live indicator. |
| `--secondary` / `--secondary-dark`               | Secondary CTA, info.              |
| `--muted`                                        | Labels, captions.                 |
| `--card` / `--card-border`                       | Card surface + 1px border.        |
| `--card-elevated` / `--card-muted`               | Elevation tiers.                  |
| `--success` / `--warning` / `--error` / `--info` | Semantic ramp.                    |

Full list of tokens per theme is in `src/app/globals.css`. Tables below show the decision-critical values.

---

## `default`

**Mood**: Warmed graphite with soft ivory text. Premium dark without the cool-blue dashboard vibe.
**Role**: Canonical look. Used for every public/marketing page regardless of user preference.
**Applied on unauthenticated routes**: yes.

| Token                                            | Value                                         |
| ------------------------------------------------ | --------------------------------------------- |
| `--background`                                   | `#14141c`                                     |
| `--foreground`                                   | `#e8e8ee`                                     |
| `--primary`                                      | `#dc2626`                                     |
| `--secondary`                                    | `#1d4ed8`                                     |
| `--muted`                                        | `#6b6b7a`                                     |
| `--card`                                         | `#1d1d2a`                                     |
| `--card-border`                                  | `#2a2a3d`                                     |
| `--card-elevated`                                | `#26263a`                                     |
| `--card-muted`                                   | `#11111a`                                     |
| `--success` / `--warning` / `--error` / `--info` | `#22c55e` / `#eab308` / `#ef4444` / `#3b82f6` |

**Rationale**: The former `#09090d` / `#111118` pairing read as a cold dashboard. `#14141c` bg / `#1d1d2a` card / `#2a2a3d` border gives cards visible separation without feeling "admin panel," and the softer `#e8e8ee` foreground is kinder on long sessions.

**Watch for**: Tailwind `text-white` and `text-slate-100` will still look fine against this background but skip the theme; use `text-foreground`.

---

## `oled`

**Mood**: True-black backdrop with cards barely lifted. Accents punched up to pop against the void.
**Role**: AMOLED screens and night play; also preferred by users sensitive to blue light.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#000000` |
| `--foreground`    | `#ffffff` |
| `--primary`       | `#ff3b3b` |
| `--secondary`     | `#4d8cff` |
| `--muted`         | `#7a7a8a` |
| `--card`          | `#070710` |
| `--card-border`   | `#242436` |
| `--card-elevated` | `#12121c` |
| `--success`       | `#2ee064` |
| `--warning`       | `#ffd60a` |
| `--error`         | `#ff5a5a` |
| `--info`          | `#4d8cff` |

**Rationale**: True `#000` eliminates the halo OLED screens produce around dim-gray backdrops. Card lifted only to `#070710` so content separates from bg without grey-washing the effect. `#242436` border is bright enough to register against pure black; any dimmer and cards vanish. Semantic ramp is shifted brighter across the board — Tailwind-500 colors read as grey-ish on true black.

**Watch for**: Any component that hard-codes `rgba(0,0,0,0.x)` overlays will be invisible. Replace with `rgba(255,255,255,0.x)` or use `--overlay`.

---

## `usa`

**Mood**: Refined patriotic palette — rich navy bg, crimson/slate accents, parchment foreground.
**Role**: Prestige / event / Independence-Day-flavored moments.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#0f1e38` |
| `--foreground`    | `#fffbeb` |
| `--primary`       | `#ef4444` |
| `--secondary`     | `#3b82f6` |
| `--muted`         | `#cbd5e1` |
| `--card`          | `#1e3a5f` |
| `--card-border`   | `#475569` |
| `--card-elevated` | `#264570` |
| `--card-muted`    | `#142848` |

**Watch for**: `text-slate-*` classes will fight the theme. Use `text-foreground` / `text-muted`.

---

## `light`

**Mood**: Slate-50 clean. High-contrast, professional.
**Role**: Day mode. Often used in conference rooms, projectors, high-ambient-light environments.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#f8fafc` |
| `--foreground`    | `#0f172a` |
| `--primary`       | `#dc2626` |
| `--secondary`     | `#2563eb` |
| `--muted`         | `#64748b` |
| `--card`          | `#ffffff` |
| `--card-border`   | `#e2e8f0` |
| `--card-elevated` | `#f1f5f9` |
| `--card-muted`    | `#f8fafc` |

**Watch for**: Any `text-white` in UI is illegible. Any hard-coded dark card bg (e.g. `bg-[#111118]`) will float as a black island. Audit components that use color-coded text (`text-red-400`, `text-green-400`) — Tailwind-400 reds/greens have low contrast on light bg; prefer `text-error` / `text-success` which resolve to `-muted` variants in Light.

---

## `pastel`

**Mood**: Soft fuchsia/violet, readable, approachable.
**Role**: Alt light. Players who find the default Light theme too stark.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#fdf4ff` |
| `--foreground`    | `#4a044e` |
| `--primary`       | `#d946ef` |
| `--secondary`     | `#8b5cf6` |
| `--muted`         | `#86198f` |
| `--card`          | `#ffffff` |
| `--card-border`   | `#e9d5ff` |
| `--card-elevated` | `#fae8ff` |
| `--card-muted`    | `#fdf4ff` |

**Watch for**: Primary is _fuchsia_, not crimson — the red/blue political duality is not present in this theme. UI that relies on red-for-destructive should resolve through `--error`, which stays red (`#e11d48`).

---

## `dark-pastel`

**Mood**: Deep purple surfaces with cyan accents. Neo without being gaudy.
**Role**: Alt dark for players who find Default too restrained.

| Token           | Value     |
| --------------- | --------- |
| `--background`  | `#0e0b18` |
| `--foreground`  | `#ede0ff` |
| `--primary`     | `#c084fc` |
| `--secondary`   | `#67e8f9` |
| `--muted`       | `#7c6fa0` |
| `--card`        | `#16112a` |
| `--card-border` | `#2a1f4a` |

**Watch for**: Like `pastel`, the political duality is absent. Primary/secondary are purple/cyan. Test live indicators — violet ping on violet bg is hard to see without the pulse.

---

## `retro`

**Mood**: Green-phosphor CRT terminal. Novelty.
**Role**: Novelty / nostalgic. Not recommended as a daily driver — semantic colors all collapse toward green.

| Token           | Value     |
| --------------- | --------- |
| `--background`  | `#0a0f0a` |
| `--foreground`  | `#b8e6b8` |
| `--primary`     | `#4af626` |
| `--secondary`   | `#26f6ce` |
| `--muted`       | `#5a8a5a` |
| `--card`        | `#0e160e` |
| `--card-border` | `#1a2e1a` |
| `--success`     | `#4af626` |
| `--warning`     | `#c8e626` |
| `--error`       | `#f64a26` |

**Watch for**: `--success` equals `--primary`. Any UI that renders Primary + Success chips side by side will look identical. This is a deliberate stylistic choice — do not "fix" by diverging the hex values.

---

## `solarized`

**Mood**: Ethan Schoonover's classic palette, warmed toward burnt orange.
**Role**: Devs who've used Solarized elsewhere and want parity.

| Token           | Value     |
| --------------- | --------- |
| `--background`  | `#002028` |
| `--foreground`  | `#eee8d5` |
| `--primary`     | `#d65d0e` |
| `--secondary`   | `#b58900` |
| `--muted`       | `#839496` |
| `--card`        | `#073642` |
| `--card-border` | `#2a4a40` |
| `--success`     | `#859900` |
| `--warning`     | `#cb4b16` |
| `--error`       | `#dc322f` |

**Solarized body + navbar gradient**: defined inline in `globals.css` — a warm 168° linear-gradient on body, a matching horizontal gradient on the sticky navbar. `command-1953` also overrides `body` (a radial + linear gradient plus a scanline/vignette shell, see below); every other theme keeps body as a solid `--background`.

---

## `cloakroom`

**Mood**: Warm dark, ivory-on-graphite. Oxblood primary + brass secondary.
**Role**: Statesman. Best on campaign/diplomacy/leadership screens where the vibe should feel deliberate and slow.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#12100e` |
| `--foreground`    | `#f5ecd8` |
| `--primary`       | `#9b2a2a` |
| `--secondary`     | `#c99a3d` |
| `--muted`         | `#8a7f6d` |
| `--card`          | `#1c1915` |
| `--card-border`   | `#2a2620` |
| `--card-elevated` | `#252016` |
| `--card-muted`    | `#0e0c0a` |
| `--success`       | `#8ea65a` |
| `--warning`       | `#d4a244` |
| `--error`         | `#b9452e` |
| `--info`          | `#b58763` |

**Rationale**: The political duality (red + blue) is replaced with oxblood (`#9b2a2a`) + brass (`#c99a3d`) — warmer, more 19th-century. Reads as "the room where decisions are made," not "admin dashboard."

**Watch for**: `--info` is brown-ish, not blue. UI that depends on `bg-info/10` for "informational" callouts should visually audit — a brass tint on brown reads very different from blue-on-grey.

---

## `broadsheet`

**Mood**: Cream paper, deep ink, single crimson accent. Editorial day mode.
**Role**: Day mode for players who want a read-like-a-newspaper experience. Also useful for accessibility — the contrast ratios are higher than Light.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#f3efe6` |
| `--foreground`    | `#1a1614` |
| `--primary`       | `#8c1c1c` |
| `--secondary`     | `#1e3a5f` |
| `--muted`         | `#6b6258` |
| `--card`          | `#fbf8f0` |
| `--card-border`   | `#d6cfbd` |
| `--card-elevated` | `#ffffff` |
| `--card-muted`    | `#efeadd` |
| `--success`       | `#4a7c2f` |
| `--warning`       | `#a66b16` |
| `--error`         | `#a83232` |

**Watch for**: Same light-theme audit as `light` — `text-white`, dark card bgs, and low-contrast Tailwind color utilities all break. The cream cards on cream bg rely on the `#d6cfbd` border for separation; any UI that drops the border (`border-none` as a reset) will make cards disappear.

---

## `coldwar`

**Mood**: Amber on near-black. Sit-room console at night, grown-up version of "green terminal."
**Role**: Novelty with gravitas. Good for crisis/war-room surfaces; less appropriate for civilian screens.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#0a0906` |
| `--foreground`    | `#f5c46a` |
| `--primary`       | `#ff7849` |
| `--secondary`     | `#6fa8dc` |
| `--muted`         | `#7a6430` |
| `--card`          | `#12100a` |
| `--card-border`   | `#2a2416` |
| `--card-elevated` | `#1a1610` |
| `--success`       | `#86d978` |
| `--warning`       | `#ffc14d` |
| `--error`         | `#ff5a3c` |

**Rationale**: The CRT-green "retro" trope is already taken by `retro`. Cold War gets amber (`#f5c46a` fg) on near-black, with a salmon-orange primary and slate-blue secondary — it reads like a SitRoom console at 2am without being cartoony.

**Watch for**: Foreground is amber, not white. Any component that assumes white text (`text-white`, `text-slate-50`) will look wrong. Use `text-foreground` everywhere.

---

## `command-1953`

**Mood**: Single-screen phosphor console — SAGE consoles, early radar, industrial control rooms. Green-on-near-black with scanlines and a vignette shell around the viewport.
**Role**: Novelty with the heaviest atmosphere of any theme. Best on dense game screens where the shell effects can sit above the content without blocking it.

| Token             | Value     |
| ----------------- | --------- |
| `--background`    | `#050805` |
| `--foreground`    | `#b8ffad` |
| `--primary`       | `#39ff14` |
| `--secondary`     | `#00ff41` |
| `--muted`         | `#76a971` |
| `--card`          | `#091109` |
| `--card-border`   | `#1b4a20` |
| `--card-elevated` | `#0d1a0e` |
| `--card-muted`    | `#030603` |
| `--success`       | `#67ff72` |
| `--warning`       | `#d7ff45` |
| `--error`         | `#ff6b4a` |
| `--info`          | `#63f5c7` |

**Rationale**: Green-phosphor is already the `retro` trope, so `command-1953` narrows the reference to a single aging tube rather than a general terminal: `body::before` lays a repeating scanline gradient, `body::after` adds a vignette + border to fake a CRT bezel, and `[data-theme="command-1953"] :is(img, video, canvas, svg)` desaturates and adds a subtle drop-shadow so media reads as part of the display rather than clean web assets. Headings switch to the monospace font stack and go uppercase with wider tracking.

**Watch for**: This is the only theme with a body pseudo-element shell (`body::before` / `body::after`, both `position: fixed; z-index: 9999`) and an image/video jitter animation (`command-1953-signal-jitter`), both defined in `src/app/globals.css`. The jitter is disabled under `prefers-reduced-motion: reduce`, and the bezel radius shrinks at `max-width: 640px`. `[data-statusbar]` opts back out of the theme's letter-spacing bump so status-bar chips don't collide.

---

## Known gotcha: restart the dev server after adding a theme block

After adding a `[data-theme="<name>"]` block to `src/app/globals.css`, **stop and restart `npm run dev`** (`Ctrl+C` then `npm run dev`) and hard-refresh the browser (`Ctrl+Shift+R`). Next.js + Turbopack's HMR for Tailwind v4 (`@import "tailwindcss"`) does not always pick up newly-added selector-level blocks inside an already-imported stylesheet. The symptom: the theme selector appears in the carousel and the `<html data-theme="...">` attribute flips correctly, but the page stays on the previous theme's colors. Restarting dev rebuilds the CSS bundle cleanly. This has bitten every theme addition so far; don't skip the restart.

## Testing checklist for a theme change

When you touch `globals.css` or add/rename a theme, run this check **before** opening a PR. None of it is automated.

1. **Login / landing / dashboard** in the changed theme. Landing must still be Default regardless.
2. **Open a modal** (e.g. Feedback or a confirm dialog). Modal backdrop should have readable contrast; modal card should not float invisibly.
3. **Open a Toast** (success and error). Both should render without hex leakage.
4. **Trigger a loading state** (page loader, button `isLoading`). Spinner should inherit color.
5. **View a data-dense page** (`/dashboard`, a country's state page, `/legislation`). Look for grey-on-grey chips, invisible borders, illegible muted text.
6. **Flip between two themes in the carousel.** The instant `data-theme` swap must not leave any element mid-transition.
7. **Open Settings → Appearance.** The carousel preview card must render the theme correctly regardless of what's currently applied (the swatches are hard-coded hex, not `var(--*)`).
8. **Test at 375px width.** Mobile.
9. **Test `prefers-reduced-motion: reduce`** in Chrome DevTools.

## Failure modes (and what they look like)

- **Missing `--muted` override**: Labels inherit `#6b6b7a` from Default, which looks grey on a cream Broadsheet bg.
- **Missing `--success` override** in Retro/Solarized/OLED/Cold War: Tailwind-500 green is used, which washes out.
- **Hard-coded `bg-[#111118]` in a component**: The component is black on Broadsheet.
- **`text-white` in a button on Broadsheet**: The button label disappears because Primary is `#8c1c1c` with a `color: white` that equals `#fff` on `#fbf8f0` — wait, that works. Actually: `text-white` on a **light-surface card** is the failure (e.g. `bg-card text-white` renders white on `#fbf8f0`).
- **`rgba(0,0,0,0.3)` overlay on OLED**: Invisible. Use `--overlay` or `rgba(255,255,255,0.05)`.

## Carousel mechanics

The carousel in `AppearanceSection.tsx` paginates **4 slides per page** (`VISIBLE = 4`). With 12 themes in `THEME_OPTIONS`, that's `Math.ceil(12/4) = 3` pages.

- Slide width: `calc((100% - 30px) / 4)` (30px = 3 × 10px gap).
- Transform-only scroll; no layout thrash.
- Active theme gets a primary-color border + `shadow-[0_0_0_2px_...]` ring.
- Hover lifts slide `-translate-y-0.5`.
- Dots reflect the current page; clicking a dot jumps pages; active dot elongates to `w-4`.
- On mount, the carousel snaps to the page containing the user's active theme via `THEME_OPTIONS.findIndex` — so if a user has `dark-pastel` (index 9), the carousel opens on page 3 (`Math.floor(9/4) = 2`, zero-indexed).
- Each slide's swatches are **hard-coded hex values** in `THEME_OPTIONS`, not `var(--*)`, so the preview renders correctly regardless of the active theme. These hex values are a second, manually-maintained copy of each theme's core tokens — they can drift from `globals.css` and won't be caught by anything but a visual check.

`THEME_OPTIONS` order (current): `default`, `oled`, `cloakroom`, `broadsheet`, `coldwar`, `command-1953`, `usa`, `light`, `pastel`, `dark-pastel`, `retro`, `solarized`. This is not strictly grouped by dark/light — `broadsheet` (light) sits inside the dark run at index 3. When adding a theme, its position in `THEME_OPTIONS` in `AppearanceSection.tsx` determines which carousel page it appears on; there's no enforced grouping convention, so place it wherever reads best next to its neighbors.
