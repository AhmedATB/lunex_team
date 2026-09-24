# LUNEX TEAM — Brand Guidelines

Source of truth for LUNEX TEAM's visual identity, voice, and asset usage. Derived directly from the live codebase (`src/app/globals.css`, `src/lib/theme-presets.ts`, `tailwind.config.ts`, `public/brand/`) — every value below is what actually ships, not an aspiration.

## 1. Overview

- **Name:** LUNEX TEAM (Arabic: لونكس تيم)
- **What it is:** An Arabic-language platform for reading and translating manhwa/manhua, with a professional translation team and a weekly release cadence.
- **Tagline (as shipped in metadata):** "LUNEX TEAM — منصة قراءة المانهوا المترجمة"
- **Description (as shipped):** "LUNEX TEAM: منصة عربية فاخرة لقراءة وترجمة المانهوا والمانها بجودة عالية، حصريات أسبوعية وفريق ترجمة احترافي."
- **Core motif:** the crescent moon paired with a faceted crystal cluster — appears on every logo variant and watermark. Treat it as the brand's signature shape, not decoration.

## 2. Voice & Tone

- **Language:** Arabic-first, RTL. All user-facing copy in the codebase is Arabic; English is reserved for the wordmark itself and code-level identifiers.
- **Register:** warm and a little luxurious ("فاخرة" — elegant/premium), never stiff or corporate. Short, direct sentences over long institutional ones.
- **What it emphasizes:** quality of translation, weekly consistency ("حصريات أسبوعية"), and a professional team behind the scenes ("فريق ترجمة احترافي") — the brand sells trust and craft, not just content volume.
- **Error/empty states:** stay calm and helpful (see `src/app/not-found.tsx`: "الصفحة التي تبحث عنها غير متوفرة، ربما تم نقلها أو حذفها." — states the fact, offers the way back, no apology-padding).

## 3. Visual Identity

### 3.1 Logo & Icon

Real, current asset files — do not regenerate or reinterpret these; use exactly what's in `public/brand/`:

| File | Use |
|---|---|
| `public/brand/logo-white.png` | Icon-only mark (moon + crystal cluster), white line-art on transparency — for dark backgrounds |
| `public/brand/logo-dark.png` | Same icon, black line-art — for light backgrounds |
| `public/brand/wordmark-white.png` | Full lockup: icon + "Lunex" (white) + "team" (violet script) — for dark backgrounds |
| `public/brand/wordmark-black.png` | Full lockup, black variant — for light backgrounds |
| `public/brand/icon-square.png` | Square app-icon/favicon crop |
| `public/brand/watermark-1.png`, `watermark-2.png` | Branded watermark banners used by the backend's anti-piracy image pipeline (chapter-page stamping) |

**Rules:**
- Never recolor the mark outside the white/black variants above. If a new color context is needed, generate a new variant from the same underlying facet geometry rather than tinting the PNG.
- Maintain clear space around the icon at least equal to the width of one crystal facet cluster (roughly 15% of the icon's own width) — it is line-art and collides visually with busy backgrounds if crowded.
- The wordmark's "team" is always set in a violet script weight distinct from "Lunex" — never flatten both words to one color/weight.

### 3.2 The Motif

Crescent moon (faceted, low-poly / gem-cut style — never a smooth, soft, realistic moon) + a crystal cluster beneath it shaped like a small crown. This pairing is the brand's one non-negotiable visual signature. When creating new decorative material (banners, error states, seasonal art), the facet/gem-cut treatment should carry over even when the moon/crystal isn't literally present — e.g. faceted shapes, sharp geometric line-art, sparkle accents (4-point stars) rather than soft glows alone.

### 3.3 Color

**Primary brand palette — "البنفسجي الليلي" (Violet Night)**, `[data-style="violet-night"]` in `globals.css`. This is the palette every real logo/watermark asset was built in, and the one to reach for whenever "the brand" (not a specific reading theme) is being represented — e.g. marketing banners, social previews, print.

| Token | HSL / RGB | Swatch |
|---|---|---|
| `--background` | `hsl(260 30% 4%)` → `#0a0611` | near-black violet |
| `--lunex-bg` | `rgb(9 9 11)` | |
| `primary-300` | `rgb(192 132 252)` | pale lilac |
| `primary-400` / `--lunex-violet` | `rgb(168 85 247)` | violet |
| `primary-500` | `rgb(139 49 232)` | |
| `primary-600` / `--lunex-purple` | `rgb(109 40 217)` | deep purple |
| `--ring` | `hsl(271 81% 56%)` | focus/glow ring |
| `--lunex-gray` | `rgb(161 161 170)` | body text on dark |

Brand gradient (`bg-lunex-gradient`, used for the "حصري LUNEX" pill, gradient text, etc.):
```
linear-gradient(135deg, rgb(109,40,217) 0%, rgb(168,85,247) 50%, rgb(216,180,254) 100%)
```

**Secondary palette — reading themes.** The live product lets a signed-in reader pick from six full theme presets (`src/lib/theme-presets.ts`); these are legitimate, shipped product surfaces, not brand deviations, but only Violet Night should be used when representing the brand itself (marketing, social, press).

| Style ID | Arabic name | Accent |
|---|---|---|
| `neon-cyber` (default) | نيون سايبر | cyan `#22d3ee` |
| `violet-night` | البنفسجي الليلي | violet `#a855f7` — **brand primary** |
| `ink-paper` | حبر وورق | warm sepia + red `#dc2626` |
| `hero-sunset` | غروب الأبطال | orange `#f97316` |
| `blue-moon` | قمر أزرق | blue `#3b82f6` |
| `crimson-blood` | دم قرمزي | crimson `#dc2626` |

### 3.4 Typography

| Role | Font | Weights shipped | CSS var |
|---|---|---|---|
| Display / headings | Baloo Bhaijaan 2 | 500, 600, 700, 800 | `--font-baloo` (`font-display`, falls back to Cairo) |
| Body (Arabic-first) | Cairo | 500, 600, 700, 800, 900 | `--font-cairo` |
| Body (secondary/UI) | Tajawal | 400, 500, 700 | `--font-tajawal` (`font-sans`) |

Both display and body faces ship with Arabic + Latin subsets — never substitute a Latin-only web font for either role.

### 3.5 Other tokens

- **Radius:** `--radius: 0.9rem` (large, soft corners — `rounded-lg` = 0.9rem, scaling down for `md`/`sm`).
- **Glow shadows:** `shadow-glow` / `shadow-glow-lg` — a soft violet glow (`rgb(var(--primary-400) / 0.45–0.55)`), used on primary CTAs and hero art. This glow is part of the brand's "luxurious" feel — flat, shadowless UI reads as off-brand.
- **Motion:** `--ease-premium: cubic-bezier(0.16,1,0.3,1)` for premium/settling motion, `--ease-bounce` for playful pop-ins. Prefer premium easing for anything brand-facing; reserve bounce for small UI feedback (toasts, badges).

## 4. Asset Inventory

Beyond the core logo set (§3.1), these brand-derived assets exist in the repo:

| File | What it is | Where used |
|---|---|---|
| `public/hero-banner.png` / `.webp` | 1920×800 hero banner, moon+crystal icon + headline, Violet Night palette | `og:image` / `twitter:image` in `src/app/layout.tsx` |
| `public/phase-archive.png` / `.webp` | Standalone art piece ("Phase Archive") — a faceted 12-phase moon index, an abstract homage to the brand's moon/crystal motif and weekly-release cycle | Background art on `src/app/not-found.tsx` |

## 5. Do's and Don'ts

**Do:**
- Use Violet Night colors and the real PNG assets for anything brand-facing (marketing, social, press, error states).
- Keep the moon+crystal facet language (sharp, geometric, gem-cut) whenever inventing new brand-adjacent art.
- Write Arabic copy that's warm and confident, short sentences, RTL-correct.

**Don't:**
- Don't recolor or redraw the logo outside the existing white/black variants.
- Don't use a reading-theme accent color (cyan, orange, blue, crimson) to represent the brand itself — those belong to the in-product theme switcher only.
- Don't smooth out or round the moon/crystal — the low-poly, faceted cut is the point.
- Don't ship English-only display type — every font role must cover the Arabic subset.
