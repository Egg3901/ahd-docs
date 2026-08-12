# Design System — Components

Companion to [`design-system.md`](design-system.md). This document specifies the contracts for every primitive in `src/components/ui/*` — what the component does, what its props mean, and what the common misuses are.

If you need a primitive that isn't in this list, check `src/components/ui/index.ts` first. If still missing, open an issue before rolling your own — most "new" primitives end up being a misuse of an existing one.

## Index

- [Button](#button)
- [Badge / BadgeCount / TallyBadge / LiveDot](#badge)
- [Input](#input)
- [Label](#label)
- [Modal](#modal)
- [Slider](#slider)
- [Toast](#toast)
- [Tooltip](#tooltip)
- [Skeleton](#skeleton)
- [EmptyState](#emptystate)
- [LoadingSpinner / PageLoader / PageError](#loading-states)
- [ResponsiveTable](#responsivetable)
- [MobileSelect](#mobileselect)
- [SectionLabel](#sectionlabel)
- [HeroStatsStrip](#herostatsstrip)

---

## Button

`src/components/ui/Button.tsx`

```tsx
<Button variant="primary" size="md">Run for office</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost">Skip</Button>
<Button variant="destructive" isLoading>Resign</Button>
<Button variant="primary" iconOnly aria-label="Add"><PlusIcon /></Button>
```

**Props**

| Prop                      | Type                                                   | Default     | Purpose                                                |
| ------------------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------ |
| `variant`                 | `"primary" \| "secondary" \| "ghost" \| "destructive"` | `"primary"` | Visual weight.                                         |
| `size`                    | `"sm" \| "md" \| "lg"`                                 | `"md"`      | Heights: 28 / 36 / 44px.                               |
| `iconOnly`                | `boolean`                                              | `false`     | Square button; requires `aria-label`.                  |
| `isLoading`               | `boolean`                                              | `false`     | Replaces children with a spinner; disables the button. |
| Standard `<button>` props | —                                                      | —           | `onClick`, `disabled`, `type`, etc.                    |

**When to use each variant**

- **primary** — The single most important action on the screen. One per view, max.
- **secondary** — Cancel, Back, non-destructive alternates. Most buttons are secondary.
- **ghost** — Low-weight actions next to denser content (e.g. "Skip", "Learn more" inline with text).
- **destructive** — Delete, resign, disband, ban. Always paired with a Modal confirmation; never a one-click destructive button.

**Size defaults**

- `md` (36px) — the workhorse.
- `sm` (28px) — dense toolbars, inline actions inside cards.
- `lg` (44px) — landing CTAs and form submits.

**Do**

- Use `aria-label` when `iconOnly` is set.
- Use `disabled` for "cannot click right now" (e.g. insufficient funds); use `isLoading` for "waiting on a fetch."
- Keep labels in sentence case (`Run for office`), not title case.

**Don't**

- Don't wrap Button in `<a>`. If it navigates, use `<Link>` directly with matching classnames, or ask the design system to add an `href` prop.
- Don't apply `className="bg-red-500"` to a Button to "make it stand out." Use `variant="destructive"`.
- Don't re-create a Button with a `<div onClick>`. Accessibility regressions are immediate.

---

## Badge

`src/components/ui/Badge.tsx`

The Badge family covers status chips, vote tallies, count bubbles, bill-ID tags, and live indicators. All colors resolve through the token system's 10% fill / 30% border tint convention — no component hard-codes hex outside the `colorMap` table.

### `<Badge>`

```tsx
<Badge color="success">Passed</Badge>
<Badge color="warning" dot>Pending vote</Badge>
<Badge color="primary" live>Live debate</Badge>
<Badge color="info" variant="outline">House</Badge>
<Badge color="secondary" variant="tag">HR-1234</Badge>
```

| Prop      | Type                                                                                   | Default     | Purpose                        |
| --------- | -------------------------------------------------------------------------------------- | ----------- | ------------------------------ |
| `color`   | `"default" \| "primary" \| "secondary" \| "success" \| "warning" \| "error" \| "info"` | `"default"` | Semantic color family.         |
| `variant` | `"subtle" \| "solid" \| "outline" \| "tag"`                                            | `"subtle"`  | Render style.                  |
| `dot`     | `boolean`                                                                              | `false`     | Small colored dot prefix.      |
| `live`    | `boolean`                                                                              | `false`     | Pulsing dot (overrides `dot`). |

**Variants**

- **subtle** — colored bg (10%), colored border (30%), colored text. The default.
- **solid** — filled background, white text. Heavy emphasis (e.g. "New").
- **outline** — transparent bg, colored border + text. Low emphasis.
- **tag** — mono font, tighter radius. Bill IDs, ticker symbols, API identifiers.

### `<LiveDot color="primary" />`

Standalone pulsing dot. Useful inline with text without the rest of the badge chrome.

### `<BadgeCount count={7} color="primary" />`

Compact numeric count chip — sits inline next to labels (e.g. inbox badges, notification counts).

### `<TallyBadge yea={218} nay={205} abstain={12} />`

Split chip for vote tallies. Always renders Y / N; `abstain` is optional.

---

## Input

`src/components/ui/Input.tsx`

Standard text input with consistent chrome. See the file directly for supported types, but the key rules:

- Height matches Button `md` (36px) so inputs and buttons align in a row.
- Focus state uses `glow-focus` (2px primary ring + glow).
- Pair with `<Label>` for form rows — do not use `placeholder` as a label.
- Prefer `type="number"` for numeric inputs with native keyboard on mobile; set `inputMode="numeric"` for currency fields.

## Label

`src/components/ui/Label.tsx`

Form-row label. Always associate via `htmlFor`. The eyebrow/all-caps look is for **section labels**, not form labels — use `<SectionLabel>` for those.

---

## Modal

`src/components/ui/Modal.tsx`

Full overlay modal. Honors escape-to-close, backdrop-click-to-close, scroll lock, and focus trap.

**Usage**

```tsx
<Modal open={open} onClose={onClose} title="Resign from office">
  <p className="body">Resigning triggers a snap election in {stateName}.</p>
  <div className="flex justify-end gap-2 mt-4">
    <Button variant="secondary" onClick={onClose}>
      Cancel
    </Button>
    <Button variant="destructive" onClick={onConfirm}>
      Resign
    </Button>
  </div>
</Modal>
```

**Do**

- Always pair destructive actions with a Modal.
- Put the destructive button on the right; cancel on the left.
- Keep body copy under 3 sentences. If you need more, it's a page, not a modal.

**Don't**

- Don't stack modals. If modal A needs to open modal B, redesign.
- Don't hide the close button. The `X` + escape key + backdrop click are the three ways out, and all three must remain available.

---

## Slider

`src/components/ui/Slider.tsx`

Styled range input. Used for policy positions, budget allocations, bet sizing.

**Color variants**: `primary` / `warning` / `error` / `success` / `secondary` / `muted` via `ahd-slider-<color>` classes on the root `<input>`.

**Invariant**: The slider thumb is always `--foreground` bordered in the active color. Thumb is the focus target. The track is 8px, the thumb is 22px — this ratio is intentional and should not be overridden per-use.

---

## Toast

`src/components/ui/Toast.tsx`

Ephemeral notification. Fired via `useToast()` hook.

```tsx
const toast = useToast();
toast.success("Bill submitted — resolves turn 47");
toast.error("Not enough funds — need $12,000 more");
toast.info("NPP voted against HR-2031");
```

Slides up from the bottom-right, auto-dismisses after 4s (error: 6s). Supports a click action for "undo" patterns.

**Do**

- Use toasts for confirmations ("Saved") and soft errors ("Retrying…").
- Include specific numbers and units in the message (`Bill submitted — resolves turn 47`, not `Saved`).

**Don't**

- Don't use toasts for critical errors that require user action — use a Modal or inline error.
- Don't fire a toast on every keystroke / autosave. Toasts are for user-initiated actions.

---

## Tooltip

`src/components/ui/Tooltip.tsx`

Hover/focus tooltip. Positioned via Floating UI; auto-flips near viewport edges.

**Invariant**: Tooltips must be keyboard-accessible — wrap an element that can receive focus. Don't use tooltips as the sole carrier of critical information; they are supplementary.

---

## Skeleton

`src/components/ui/Skeleton.tsx`

Shimmer placeholder used while data loads. Prefer Skeleton over spinners for page content — a spinner in a data-dense dashboard is uninformative.

**Do**

- Match the skeleton's shape to the content it replaces (card skeleton = card-shaped; table row skeleton = row-shaped).
- Use one skeleton per loading boundary, not per element.

**Don't**

- Don't mix Skeleton with a spinner. Pick one.

---

## EmptyState

`src/components/ui/EmptyState.tsx`

Zero-data view for tables, lists, and dashboards. Props accept a title, description, and optional CTA.

**Do**

- Give a next-step. "You have no bills in flight — propose one" beats "No bills found."
- Match the message to the user's likely cause: empty because they haven't started, or empty because a filter is too narrow.

---

## Loading states

Three distinct patterns:

- **`<LoadingSpinner />`** — inline spinner for small regions (buttons, row-level async). Use Button's `isLoading` prop instead of placing a spinner next to a button.
- **`<PageLoader />`** — full-page loader while an authenticated shell fetches initial data. Respects theme tokens; uses a `--primary` accent.
- **`<PageError />` / `<ErrorPageContent />`** — full-page error screen. Includes retry CTA and error boundary integration.

---

## ResponsiveTable

`src/components/ui/ResponsiveTable.tsx`

Table that reflows to cards on narrow viewports. Use it instead of hand-rolling a `<table>`.

**Do**

- Pass row keys that are stable (`ObjectId.toString()`), never array indices.
- Use `variant="dense"` for admin/ops tables; default is game-facing spacing.

**Don't**

- Don't put images wider than the column inside cells. The card reflow mode overflows.

---

## MobileSelect

`src/components/ui/MobileSelect.tsx`

Native `<select>` on mobile; styled dropdown on desktop. Used for single-choice inputs with 5+ options.

**Rationale**: Native select is faster on touch devices and respects OS accessibility settings. The custom dropdown is only mounted on `md:` and up.

---

## SectionLabel

`src/components/ui/SectionLabel.tsx`

Eyebrow label with a 2px primary-color left accent. Used above section headings.

```tsx
<SectionLabel>Current cabinet</SectionLabel>
<h2 className="h2 mt-1">Your appointees</h2>
```

**Invariant**: Always uppercase with `tracking-caps` (0.1em). This is the one place in the product where we override Sentence Case — eyebrows are uppercase by convention.

---

## HeroStatsStrip

`src/components/ui/HeroStatsStrip.tsx`

Horizontal strip of key metrics shown under a page hero. Used on dashboard, state pages, and corporation pages.

**Invariant**: The hero image above it is always `h-[175px] w-full sm:h-[220px]`. Do not override — this is enforced across 14 surfaces.

---

## Creating a new primitive

If you're tempted to add to `src/components/ui/`:

1. **Prove the reuse.** Two usages is coincidence; three is a pattern.
2. **Name from the job.** `BadgeCount`, not `NumberBubble`.
3. **Consume tokens.** No raw hex. No Tailwind-named colors (`bg-red-500`). Only semantic utilities (`bg-primary`, `bg-error`).
4. **Props describe state, not style.** `isLoading`, `disabled`, `open` — not `className="compact"`.
5. **Add to `src/components/ui/index.ts`.**
6. **Document it here** with props table, usage examples, and common misuses.
7. **Add to the design-system skill** at `.claude/skills/ahd-design-system/SKILL.md` if it's something an agent should reach for automatically.
