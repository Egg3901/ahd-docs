# Design System

This document is the **source of truth** for the A House Divided visual language. Source-of-truth code lives in `src/app/globals.css` (tokens) and `src/components/ui/*` (primitives). This doc describes the rules those files encode.

Related reading:

- [`design-system-themes.md`](design-system-themes.md) — every theme's token table, when to ship it, failure modes to watch for.
- [`design-system-components.md`](design-system-components.md) — Button, Badge, Input, Modal, Slider, Toast contracts + do/don't examples.
- `src/app/globals.css` — authoritative token values. Don't duplicate them in component files.
- `.claude/skills/ahd-design-system/SKILL.md` — agent skill; keep in sync with this doc when token conventions change.

## Why this exists

AHD is data-dense and ships 12 themes. Without a shared token contract, each contributor ends up hard-coding a hex, a theme breaks in one place, and the product starts to feel like four different apps. The rules below are the minimum needed to keep that from happening. Everything else — layout, rhythm, motion — is secondary.

## Tenets

1. **Token, not hex.** Every surface, text, border, and accent color resolves through a CSS custom property (`var(--primary)`, `var(--card)`). A raw `#1d4ed8` in a component is a bug — it breaks every theme except Default. The one lawful exception is the brand duality values (`#dc2626`, `#1d4ed8`) used inside the `.animated-gradient` utility, which is intentionally off-theme.
2. **Serif display, sans body, mono numerics.** Lora for hero/section titles; Geist for everything else; Geist Mono for values, timestamps, and IDs. The contrast is the system.
3. **Dense, consequential copy.** Lead with the mechanic, disclose the trade-off, include units. No emoji. No "Seamlessly / Powerfully / Leverage." Second person for the player.
4. **Cards are `rounded-xl` with `1px var(--card-border)`.** Colored card variants use a 10% fill / 30% border tint pair. Never full saturation.
5. **Every component must work in all 12 themes.** If you need a color that doesn't exist in the token set, add a token — don't branch on `data-theme`.

## Tokens

All tokens live on `:root` and per-theme `[data-theme="..."]` blocks in `src/app/globals.css`. There are four layers:

### 1. Palette tokens (theme-scoped)

| Token                                                       | Purpose                                                                                             |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `--background`                                              | Page backdrop.                                                                                      |
| `--foreground`                                              | Default text color; the only "white" value — never `#fff` directly.                                 |
| `--primary` / `--primary-dark`                              | Political red. CTAs, destructive, live indicators, alignment bars.                                  |
| `--secondary` / `--secondary-dark`                          | Political blue. Secondary CTAs, informational chips.                                                |
| `--accent`                                                  | Strong text emphasis (equals `--foreground` in most themes).                                        |
| `--muted`                                                   | Labels, captions, disabled text.                                                                    |
| `--card` / `--card-border`                                  | Card surface + 1px border.                                                                          |
| `--card-default` / `--card-elevated` / `--card-muted`       | Elevation tiers inside a card stack.                                                                |
| `--success` / `--warning` / `--error` / `--info` + `-muted` | Semantic ramp. Tailwind-500 conventions in Default; overridden in Retro, Solarized, OLED, Cold War. |
| `--track` / `--overlay`                                     | Slider + range tracks; modal/page backdrops.                                                        |

### 2. Elevation tokens (theme-scoped)

| Token                                  | Use                                  |
| -------------------------------------- | ------------------------------------ |
| `--shadow-sm` (`--shadow-card`)        | Cards at rest.                       |
| `--shadow-md` (`--shadow-panel`)       | Popovers, panels, dropdowns.         |
| `--shadow-lg` (`--shadow-modal`)       | Modals, fullscreen overlays.         |
| `--glow-primary` / `--glow-primary-sm` | Focus ring and live-indicator glows. |

Shadows are deep (up to 70% black alpha) because the default backdrop is near-black — they read as soft glows, not grey halos.

### 3. Typography tokens (global)

Declared once on `:root`. Do not override per theme.

| Token               | Value | Use                                  |
| ------------------- | ----- | ------------------------------------ |
| `--text-body-xs`    | 10px  | Micro captions, eyebrow labels.      |
| `--text-body-sm`    | 12px  | Meta, tags, table cell metadata.     |
| `--text-body`       | 14px  | Default body. Data-dense dashboards. |
| `--text-body-lg`    | 16px  | Emphasized body.                     |
| `--text-heading-sm` | 18px  | Card headings.                       |
| `--text-heading`    | 20px  | Panel titles.                        |
| `--text-heading-lg` | 24px  | Page-section titles.                 |
| `--text-display`    | 30px  | Section display (landing only).      |

Fonts are wired via `next/font` in `src/app/layout.tsx`: `--font-geist-sans`, `--font-geist-mono`, `--font-lora`, plus `--font-fraunces` (mapped to `font-display`, used at the `--text-display` scale) and `--font-jetbrains-mono` (used ahead of Geist Mono in the `command-1953` theme's body font stack). Components reference the first three through the `@theme inline` mapping — `font-sans` / `font-mono` / `font-serif` Tailwind utilities resolve correctly.

### 4. Radii, spacing, motion (global)

- **Radii**: 4 / 6 / 8 / 12 / 16 / 999. `rounded-lg` (8) for buttons + inputs; `rounded-xl` (12) for cards; `rounded-full` (999) for pills, avatars, progress bars.
- **Spacing**: Tailwind defaults. 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. Cards use 16–24px; dense tables use 8–12px.
- **Motion**:
  - `fadeIn` 0.3s ease on new content.
  - `slideUp` 0.2s on toasts.
  - Cards hover: `translateY(-1px)` + `--shadow-md`. 200ms.
  - Buttons press: `active:scale-[0.98]`. No bounce.
  - Live indicators: `animate-ping-slow` 2s infinite.
  - `prefers-reduced-motion` is honored — every animated utility has a reduce branch.

## Themes (overview)

AHD ships **12 themes**. Full tables in [`design-system-themes.md`](design-system-themes.md).

| Theme          | Mood                                              | Use case                                                                                |
| -------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `default`      | Warmed graphite, soft ivory text                  | The canonical look.                                                                     |
| `oled`         | True `#000` with punched accents                  | AMOLED devices, night play.                                                             |
| `usa`          | Navy + crimson + parchment                        | Patriotic "prestige" look.                                                              |
| `light`        | Slate-50 clean                                    | Day mode, professional.                                                                 |
| `pastel`       | Fuchsia/violet soft                               | Approachable day mode.                                                                  |
| `dark-pastel`  | Purple + cyan neo                                 | Alt dark.                                                                               |
| `retro`        | Green-phosphor CRT                                | Novelty / nostalgic.                                                                    |
| `solarized`    | Burnt orange + teal                               | Classic terminal.                                                                       |
| `cloakroom`    | Ivory on warm graphite, oxblood + brass           | Statesman mood; leadership screens.                                                     |
| `broadsheet`   | Cream paper + deep ink + crimson                  | Editorial day mode.                                                                     |
| `coldwar`      | Amber on near-black                               | Sit-room console at night.                                                              |
| `command-1953` | Green-phosphor CRT scanlines, JetBrains Mono body | Console-room mood for the 1953 command era; heaviest per-theme override block in `src/app/globals.css` (body background, focus ring, tables, media). |

The `default` theme is applied automatically on unauthenticated / marketing pages. User selection persists to `User.theme` (see [`design-system-themes.md`](design-system-themes.md) for the server sync flow).

## Layout rules

- **Max content width**: `max-w-7xl` (1280px) centered with `px-4 sm:px-6`.
- **Sticky navbar** top; sticky footer on long pages only.
- **Dashboard strip**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`.
- **Mobile**: single column, `space-y-4`. Never horizontal scroll (except tables with explicit overflow).
- **Root page padding**: `pb-16` so sticky footers don't clip content.

## Iconography

- **`lucide-react`** is the icon library (see `package.json`). It's imported directly (`import { X } from "lucide-react"`) across dozens of components, including `src/app/settings/page.tsx` and `src/app/corporation/[id]/sector/[sectorId]/page.tsx`. Older components still carry inline SVGs copied from Heroicons v1 outline (2px stroke, 24x24 viewBox, `stroke="currentColor"` + `fill="none"`, rounded linecap/linejoin) — new work should reach for `lucide-react` first rather than pasting another inline SVG.
- **Default size**: `h-5 w-5` (20px), `h-4 w-4` (16px) in dense rows, `h-10 w-10` inside `rounded-lg bg-primary/20 text-primary` tile affordances.
- **Color**: always `currentColor` — tint comes from the parent `text-*` class.
- **No emoji in UI.** Legacy reaction menus are the single exception; do not add to new surfaces.

## Imagery

- **Full-bleed hero imagery** is not landing-only: it also runs across in-app feature headers (unions, forex, cabinet, legislature, Congress, news, changelog). Sources are served through `/api/images/hero/[slug]` (e.g. `/api/images/hero/white-house`, see `src/lib/constants/executiveSurface.ts`) or the CDN static set in `src/lib/images/staticCdnAssets.ts` (`lincoln-memorial.webp`); there's no direct `/white-house.jpg` or `/lincoln-memorial.jpg` public path. Always paired with a 30-50% dark overlay and a subtle cool-tinted gradient behind (`from-slate-900 to-slate-800`).
- **Hero image standard dimensions**: `h-[175px] w-full sm:h-[220px]`. In use on 25+ landing and feature pages (grep `h-\[175px\] w-full sm:h-\[220px\]` in `src/` before assuming a fixed count).
- **Solid dark surfaces + subtle card elevation + accent colors** carry the weight on pages without a hero image; a growing set of in-app feature pages does pair those surfaces with a hero image, so "in-app never uses imagery" is no longer the rule.
- **No hand-drawn illustrations, no repeating patterns, no stock photography.**

## Hover / press / focus

- **Cards**: border shifts from `card-border` to `primary/40`, optional `-translate-y-px`.
- **Primary buttons**: darken to `primary-dark` + glow `shadow-primary/25`.
- **Secondary buttons**: border shifts to `muted/40`, bg to `card/80`.
- **Ghost buttons**: bg fills to `card`, text to `foreground`.
- **Links**: `.link-underline` animates a 1px underline left→right in 200ms.
- **Press**: everything uses `active:scale-[0.98]` — never a color flash.
- **Focus-visible**: `.glow-focus` paints a 2px primary ring with small glow behind it. Never remove focus outlines without replacement.

## Glass and transparency

- `.glass-card`: `color-mix(in srgb, var(--card) 70%, transparent)` + 12px backdrop-blur. Sticky navbars, overlays.
- Ad banners, sticky footers, turn status bar use ~60–70% opacity + blur.
- Body content is always opaque. Do not use blurred cards in flow.

## Where components live

- `src/components/ui/*` — design-system primitives (Button, Badge, Input, Modal, Slider, Toast, Tooltip, etc.). Purely presentational, no game logic.
- `src/components/{StatsCard,MetricCard,Avatar,Navbar,SiteFooter,charts/*}` — domain components reused across features.
- `src/components/<feature>/*` — feature-scoped components (e.g. `src/components/officials/*`, `src/components/elections/*`).
- `src/components/landing/*` — marketing surfaces only.

When adding a new primitive, put it in `src/components/ui/` and export from `src/components/ui/index.ts`.

## Checklist for new UI work

Before opening a PR that adds or changes UI, confirm:

- [ ] No raw hex values — every color resolves through a CSS custom property.
- [ ] Component renders correctly in **all 12 themes** (spot-check `default`, `light`, `oled`, `broadsheet`, `cloakroom`, `command-1953` — these cover dark, light, true-black, cream, warm-dark, and console-scanline respectively).
- [ ] Interactive elements have a `:hover`, `:active`, and `:focus-visible` state.
- [ ] Respects `prefers-reduced-motion`.
- [ ] Mobile layout verified at 375px width.
- [ ] Copy follows the voice rules: sentence case UI, specific numbers, em-dashes for asides.
- [ ] Icons use inline Heroicons v1 outline with `currentColor`.
- [ ] Uses an existing UI primitive where one fits (don't re-roll a Button).

## Adding a new token

Tokens are cheap; adding them correctly is not. Before adding:

1. **Check if an existing token covers it.** `--card-elevated` already exists — don't add `--card-raised`.
2. **Name semantically, not visually.** `--card-warning-border` over `--yellow-border`.
3. **Add to every theme block** in `src/app/globals.css`. A missing token silently falls back to the cascade, which usually looks broken.
4. **Update `@theme inline`** if you want a Tailwind utility generated (e.g. `bg-X`).
5. **Document in this file's token tables** and in [`design-system-themes.md`](design-system-themes.md).
6. **Run `npm run typecheck && npm run lint`** — the `no-country-literals` rule is the closest analogue to a token-linter; there isn't one for colors yet, so peer review must catch hex leaks.

## Adding a new theme

See [`design-system-themes.md`](design-system-themes.md) for the full contributor checklist. Summary:

1. Pick a mood and justify it — each theme should have a real use case, not just a color shift.
2. Add the `[data-theme="<name>"]` block to `src/app/globals.css` with every token filled.
3. Add `<name>` to the `Theme` union in `src/contexts/ThemeContext.tsx`, the `VALID_THEMES` array, `User.theme` in `src/lib/db/types/user.ts`, and `themeSchema` in `src/lib/api/schemas/settings.ts`.
4. Add a carousel option to `THEME_OPTIONS` in `src/app/settings/components/AppearanceSection.tsx` with hex swatches (these are embedded in the settings page and do **not** resolve through CSS variables, so the carousel works regardless of which theme is currently active).
5. **Restart `npm run dev`** (`Ctrl+C` then re-run) and hard-refresh the browser. Turbopack's HMR for `@import "tailwindcss"` does not reliably pick up newly-added `[data-theme=...]` blocks. Skipping the restart is the #1 reason a new theme appears to "do nothing" when toggled.
6. Spot-check `Button`, `Badge`, `Modal`, `StatsCard`, and `/dashboard` for obvious breakage.
7. Add a CHANGELOG entry under `### UI` → `**Theming**`.

## Anti-patterns

These are specific failure modes seen in PRs — flag them in review.

- **Hard-coded `#ffffff` or `#000`.** Use `var(--foreground)` or `var(--card-muted)`.
- **`text-white` on a variable-background surface.** Use `text-foreground`. `text-white` will be illegible on Broadsheet and Light.
- **Tailwind `bg-red-500` on domain UI.** Use `bg-error` or `bg-primary`. Tailwind-named utilities skip theming entirely.
- **Conditional rendering based on `data-theme`.** Add a token instead. If you find yourself writing `if (theme === "broadsheet")`, you have a bug.
- **New `useState` soup.** When a component has 5+ `useState` calls for related state, switch to `useReducer`. See `src/components/officials/useOfficialsState.ts` as the canonical example.
- **Adding `console.log`.** Remove before commit. Lint does not catch this in all contexts.
- **Redefining design tokens per feature.** Every CSS module that declares its own `--card-x` is a theme regression waiting to happen.
