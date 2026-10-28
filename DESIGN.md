# Lê Long Sport (Arena3): design system

Direction: **Floodlit Hall, with Apple's discipline.** A sports centre at night under floodlights: sprout green and earth brown, photography with a real subject, effects that point at something real. The craft rules come from Apple's interface principles: feedback on press-down, motion that can be grabbed and reversed, translucent chrome over content, type that changes shape with size, and restraint (every element earns its place).

Where `docs/UI-REDESIGN.md` disagrees with this file, this file wins. `PRODUCT.md` is not in the repo yet; do not invent it.

English first, Vietnamese second. Visual effects and motion take priority over raw performance, as long as they point at something real and honour reduced motion.

## Colour

One colour is the **action**: `accent` (sprout green). Nothing that is merely a state is painted in it.

| Role | Token | Use |
| --- | --- | --- |
| Action | `accent`, `accent-hover`, `accent-text`, `accent-tint` | Filled primary button, links, focus, selected segment, a free hour on the court grid |
| Success (a state) | `success`, `success-tint` | Paid, confirmed, active, completed. A cooler green than the action, always with a check glyph in badges |
| Warning | `hold`, `hold-text`, `warning-tint` | Held, pending, waitlisted. `hold-text` is the AA-safe amber for small text |
| Danger | `danger`, `danger-tint` | Cancelled, expired, refused, destructive actions |
| Info | `info`, `info-tint` | Neutral notices |
| Earth | `earth`, `wood`, `pass`, `slot-class` | Secondary accent: member pass, classes on the grid, neutral wells |

Label hierarchy: `fg` (label), `muted` (secondary), `subtle` (tertiary, still AA for small text), `faint` (quaternary: decoration and disabled glyphs only, never body text). Hairlines: `separator` (between rows), `line` / `line-strong` (card and field edges). Fills: `fill`, `fill-strong` (fields, chips, neutral buttons).

Every token exists in the light block (`@theme`) and the dark block (`@media (prefers-color-scheme: dark)`) of `src/styles.css`. Tints are `color-mix` of the role over `surface`, so they follow the theme without a second definition. Never write `#hex`, `rgba()`, `bg-white` or `black/...` in a component; scrims are made from `scrim` (the brand night), never from black. The only unavoidable literals are in `fx.tsx`, `gl.tsx` and `illustrations.tsx`, where a canvas or SVG cannot read a custom property.

Status must survive a photocopy: a badge carries a glyph (check, clock, cross, info, minus) in addition to its hue, and the court grid uses fills, outlines, stripes and a plus sign, never hue alone.

## Radius

Nothing outside this scale. `rounded-md`, `rounded-lg` and `rounded-xl` already resolve to it.

| Token | px | Use |
| --- | --- | --- |
| `radius-xs` | 6 | Chip, tiny control, menu item |
| `radius-sm` | 8 | Field, small button |
| `radius-md` | 12 | Button, panel, tile |
| `radius-lg` | 16 | Card, list group |
| `radius-xl` | 20 | Sheet, page header, hero |
| `radius-pill` | full | Badge, segmented control, filter chip |

## Elevation and material

Three soft elevations tinted with the brand ink (`shadow-sm` resting, `shadow-md` lifted or popover, `shadow-lg` sheet or dialog) plus `shadow-border`, the hairline ring used by cards.

Three materials (`.material-thin`, `.material-regular`, `.material-thick`): blurred, saturated, tinted by the surface token, with a bright top edge. Only chrome wears one: header, tab bar, sidebar, sheet, popover, sticky toolbar. Never lay one material on another, never put one over the court grid cells. They fall back to a solid surface without `backdrop-filter`, under `prefers-reduced-transparency` and under `prefers-contrast: more`.

## Typography

Be Vietnam Pro (400 to 800, self-hosted). Tracking is a function of size: tight when large, slightly open when small. Leading is the inverse. Vietnamese stacks tall diacritics, so no leading goes below 1.15. Numbers (money, times, codes) are tabular.

| Utility | Size | Leading | Tracking | Weight |
| --- | --- | --- | --- | --- |
| `text-large-title` | 30 to 40 (fluid) | 1.15 | -0.032em | 700 |
| `text-title-1` | 24 to 30 (fluid) | 1.18 | -0.026em | 700 |
| `text-title-2` | 22 | 1.25 | -0.02em | 600 |
| `text-title-3` | 19 | 1.3 | -0.014em | 600 |
| `text-headline` | 17 | 1.35 | -0.01em | 600 |
| `text-body` | 16 | 1.5 | -0.006em | |
| `text-callout` | 15 | 1.45 | -0.004em | |
| `text-subheadline` | 14 | 1.42 | 0 | |
| `text-footnote` | 13 | 1.4 | +0.002em | |
| `text-caption` | 12 | 1.35 | +0.01em | |

`cn()` knows these names (`src/lib/cn.ts`); without that, `text-callout` and `text-fg` both read as colours and one eats the other.

## Motion

A spring is a conversation, not a script: it starts from where the element is, keeps the velocity it was given and can be redirected at any instant. `SPRING` in `src/components/motion.tsx`:

| Spring | Damping | Response | Use |
| --- | --- | --- | --- |
| `snappy` | 1.0 | 0.3 s | Press, toggle, tab indicator, lift |
| `smooth` | 1.0 | 0.45 s | Page, card, reveal. The default |
| `gentle` | 1.0 | 0.7 s | Something large settling |
| `bouncy` | 0.8 | 0.4 s | Only after a gesture that carried momentum (a flick) |

Rules:

1. **Content is visible at rest.** The server renders it visible. An entrance (`PageIn`, `Reveal`, `StaggerItem`, `CountUp`) is a Web Animations run on already-visible content after mount, and a timer clears any hidden pose that is still there. A throttled tab, a slow script or an observer that never fires costs a flourish, never a heading or a figure.
2. Feedback on press-down, not release (`.press`, `active:scale-[0.97]`), under 100 ms.
3. Interactive motion starts from the current value, never the target. No CSS keyframes for anything a finger can grab.
4. Sheets: enter and leave along the same path, from the trigger's side; drag 1:1 with the finger; on release project the momentum (`project()`) and snap to the nearest rest, handing the velocity to the spring; rubber-band past an edge (`rubberband()`).
5. Everything honours `prefers-reduced-motion` (no pause button exists): slides become cross-fades or nothing, content stays visible.
6. GSAP only in `src/lib/gsap.ts`, `src/components/landing/*`, `src/components/moments/*`, through `useScene()`. In-app motion is `motion`. Never both in one component.

## Effect library (house style)

`fx.tsx`, `gl.tsx` and `motion.tsx` are restored at the user's request. Never remove or flatten them to calm a screen; tune strength, opacity or speed. Every use must point at something real, and none goes over the court-grid cells or a data table.

| Effect | Where | What it means |
| --- | --- | --- |
| `CountUp` | Stat strips, hero metrics | A figure is live. Rests on the true value |
| `HoldCountdown` / ring | Booking hold | Five minutes are running out |
| `PaidMark` | Payment confirmed | Money has landed |
| `StarBorder` | The one payment control of a screen | This is the action that moves money |
| `GlareHover`, `Tilt` | Member pass, points card | A card you can hold |
| `SpotlightCard` | Raised cards (quiet strength) | Pointer is here |
| `GLBackground` dotgrid | Page header photo, desk background | Ambient field, low opacity |
| Live ping dot | Current hour, running session | Now |
| `Reveal`, `Stagger` | Landing sections, lists | First sight of content |

## Layout

- One figure appears once per screen. A page header either carries 1 to 2 figures that the stat strip below does not, or none.
- Navigation appears once. No row of shortcuts that repeats the nav; "quick actions" are jobs (open a shift, add a member, export), not links to other pages.
- The primary data or action is in the first screen at 1440x900, and at 390 px the free hours on `/app/book`.
- Zero is a sentence, not a number: an empty strip says "Nothing yet", it does not draw a 56 px zero.
- Court grid is the protagonist of booking screens: one row of filters above it (day strip plus sport), the rest in a menu, a one-line legend.
- No horizontal page scroll at 390 px; the grid and tables scroll inside their own frame.
- Touch targets 44 px on a phone (`.tap`, `.hit`).

## Copy

No em or en dashes in visible text (use a comma, full stop or colon; ranges use `-`). No internal codes (UUID, table names, F4/F5). No benefit of zero. New strings: English literal in `t("...")`, Vietnamese in `src/lib/i18n/vi.redesign.ts`, then `node scripts/i18n-check.mjs`.
