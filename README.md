# Greenverse Digital

A static, framework-free website for **Greenverse Digital** — a sustainable
branding studio for purpose-led brands.

> Author: Pratikshya Sahoo

---

## Pages

| Path | Purpose |
| --- | --- |
| `index.html` | Home — hero, marquee, services overview, testimonials, CTA |
| `about.html` | Founder story + studio philosophy |
| `services.html` | Six service offerings, in detail |
| `case-studies.html` | Selected work (placeholder copy until full studies are published) |
| `blog.html` | Journal index (essays + notes) |
| `blog/*.html` | Individual posts |
| `testimonials.html` | Client voices + inline review form |
| `contact.html` | Project enquiry form (mailto fallback for now) |
| `404.html` | Friendly not-found page |

---

## Project structure

```
/
├── *.html                     ← top-level pages
├── blog/                      ← long-form posts
├── images/                    ← brand assets (logo, photography)
├── sitemap.xml                ← search-engine sitemap stub
├── robots.txt
└── assets/
    ├── css/
    │   ├── style.css          ← entry point — @imports the layers below
    │   ├── tokens.css         ← color, typography, spacing, motion tokens
    │   ├── base.css           ← reset + element typography + a11y primitives
    │   ├── layout.css         ← container, section, grid, split, stack
    │   ├── components.css     ← navbar, footer, hero, card, button, form…
    │   └── utilities.css      ← single-purpose helpers (loaded last)
    │
    ├── js/
    │   ├── partials.js        ← injects shared HTML partials at runtime
    │   ├── nav.js             ← sticky header, mobile menu, active link
    │   ├── motion.js          ← IntersectionObserver reveal animations
    │   └── forms.js           ← testimonial + contact form handling
    │
    ├── partials/
    │   ├── head.html          ← reference snippet for <head> (informational)
    │   ├── header.html        ← shared site header + primary nav
    │   ├── footer.html        ← shared site footer
    │   └── cta-banner.html    ← reusable closing call-to-action band
    │
    └── data/
        ├── site.json          ← brand info, contact, social
        ├── nav.json           ← navigation items
        ├── services.json      ← service cards
        ├── testimonials.json  ← client testimonials
        ├── case-studies.json  ← case study cards
        └── posts.json         ← blog post index
```

---

## How shared partials work

Pages embed a placeholder element where a partial should appear:

```html
<div data-include="assets/partials/header.html"></div>
```

At load time, `assets/js/partials.js` fetches the file and replaces the
placeholder with its contents, then dispatches a `partials:loaded` event
that `nav.js` and `motion.js` listen for. **Header, footer, and CTA
banner are edited in one place** and apply across every page.

> **Local preview:** because partials are loaded via `fetch`, browsers
> block them when the page is opened from the filesystem (`file://`).
> Run a tiny local server while developing, e.g.
> `python -m http.server 8080` from the project root, then visit
> <http://localhost:8080>.

### Notes about pathing

- Top-level pages reference partials as `assets/partials/...`.
- Pages inside `blog/` reference partials as `../assets/partials/...`.
- Links *inside* the partials (e.g. `index.html`) are relative to the
  current page, so they resolve correctly from any folder depth.

---

## Content vs. layout

Where possible, copy lives in `assets/data/*.json` so it can later be
sourced from a CMS or rendered by a static-site generator without
touching layout. For now, the JSON files are the canonical reference and
each HTML page hand-mirrors that copy. **When updating a service,
testimonial, or case study, update both the JSON file and the
corresponding HTML.**

---

## Design system

Tokens live in `assets/css/tokens.css`:

- **Colors:** linen cream surfaces, deep forest primary, earth & clay
  accents, near-black olive ink.
- **Typography:** Fraunces (display, serif) + Inter (sans). Fluid scale
  using `clamp()`.
- **Spacing:** 4px-based T-shirt scale (`--space-2xs` through `--space-5xl`).
- **Motion:** standard / emphasized easings, three durations, one reveal
  duration. Honours `prefers-reduced-motion`.

Reusable component classes (`.btn`, `.card`, `.testimonial`, `.hero`,
`.cta-banner`, `.form` + `.field`, `.prose`, `.marquee`, `.site-header`,
`.site-footer`) are documented inline in `assets/css/components.css`.

---

## Accessibility checklist

- Skip-to-content link on every page (`.skip-link`).
- Visible focus rings via `:focus-visible`.
- Real `<label>` elements on every form input; `aria-live` status messages.
- `aria-current="page"` set automatically on the active nav item.
- Reveal animations and the marquee respect `prefers-reduced-motion`.
- Decorative images use `alt=""`; logo + portrait carry meaningful alt text.

---

## Adding a page

1. Copy an existing page (e.g. `services.html`) as the starting point.
2. Update the `<title>`, `<meta name="description">`, and the hero copy.
3. Compose the body using existing components from `components.css`.
4. Add the route to `assets/partials/header.html` (and to the footer
   list in `assets/partials/footer.html`).
5. Add an entry to `sitemap.xml`.

## Adding a blog post

1. Create `blog/<slug>.html` from the existing post as a template.
2. Remember the `../` prefix on partial includes and asset URLs.
3. Add an entry to `assets/data/posts.json` and a card to `blog.html`.

---

## Future improvements

- Wire the contact form to a real endpoint (the handler is ready —
  set `action` on `#contactForm` in `contact.html`).
- Migrate to a static-site generator (Eleventy / Astro) to render the
  JSON data files into HTML automatically.
- Replace placeholder case-study imagery in `case-studies.html` with
  real project photography.
- Self-host the Fraunces + Inter font files for resilience and privacy.
