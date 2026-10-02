# Greenverse Digital

A static website for Greenverse Digital, built with Eleventy, semantic HTML,
modular CSS, and vanilla JavaScript. Existing page copy and article bodies are
retained. Hostinger remains the production target.

## Development

Use Node.js 22 or newer. Install the locked dependencies, build, and then preview:

```powershell
npm ci --no-audit --no-fund
npm run build
npm test
npm run serve
```

Open `http://127.0.0.1:8080`. The local server exposes only `dist`, binds to
loopback, and does not log requests. Do not serve the repository root or open
templates directly from the filesystem. Stop the preview with Ctrl+C.

For browser regression tests:

```powershell
npx playwright install chromium
npm run test:browser
```

Browser tests run locally, block external requests, and disable trace/video/
screenshot collection. The browser installation command is only needed when the
matching browser is missing. No external CI, log shipping, MCP integration, or
analytics is configured. Previous Google Analytics snippets have been removed.
Existing Google Fonts, Unsplash images, and the map embed remain external
resources on the public site; they are blocked during local automated tests.

## Source and generated output

| Location | Responsibility |
| --- | --- |
| `src/*.njk` | Authoritative static-page content |
| `src/_includes/` | Shared head/body layout, header, footer, CTA, article template |
| `src/posts/*.md` | Authoritative journal content and publication metadata |
| `src/posts/posts.11tydata.js` | Generated article URLs and draft exclusion |
| `assets/data/site.json` | Production origin and shared brand/contact values |
| `assets/data/nav.json` | Primary navigation |
| `assets/css/` | Design tokens and component/layout styles |
| `assets/js/` | Progressive navigation, forms, motion, and sharing |
| `assets/uploads/` | CMS-uploaded raster images |
| `images/`, `Case studies/` | Original image sources, not wholesale deployment directories |
| `.pages.yml` | Hosted Pages CMS article/media schema |
| `scripts/` | Build, validation, local preview |
| `tests/` | Content, generated-output, and browser regressions |
| `dist/` | Disposable generated public release; never edit or commit |

The old HTML article copies and unused JSON content mirrors were removed.
Static marketing pages remain authoritative templates, not duplicate CMS fields.
Historical versions remain available in Git. The Pages authoring document and
desktop/source artifacts are not included in builds.

The build assembles shared markup into every HTML document, bundles CSS into one
file, emits correctly named/optimized image derivatives, and generates the
journal, sitemap, feed, aliases, and Hostinger configuration. It validates all
local links case-sensitively, anchors, canonical URLs, executable scripts, and
public output exclusions. A failed build must not be published.

## Routes and canonical origin

Production is configured as `https://greenversedigital.com`, at the domain root.
Existing `.html` routes are retained:

- `/`, `/about.html`, `/services.html`, `/case-studies.html`
- `/blog.html`, `/contact.html`, `/testimonials.html`
- `/blog/why-you-need-social-media-manager.html`
- `/blog/is-growing-sustainably-enough.html`

Root-absolute links intentionally target this domain-root deployment, not a
GitHub Pages repository subpath. Do not deploy this build under
`/GreenverseDigital/` without deliberately introducing and testing a base-path
configuration.

`src/hostinger.njk` generates `.htaccess` for HTTPS/non-www canonicalization,
`/index.html` consolidation, the uppercase Testimonials alias, the double-nested
article alias, the malformed historical article URL, security headers, and the
custom 404. The local preview simulates route aliases and true 404 status; it
does not execute Apache/LiteSpeed configuration.

**Hostinger staging verification is required before applying these rules.**
Confirm rewrite/header module support, proxy HTTPS behavior, existing rules, and
custom error handling. Existing host configuration must be merged rather than
blindly overwritten. The canonical host is an implementation default, not a
claim that live host settings were changed.

## Article editing and publication

Hosted **Pages CMS** is the selected editor. No CMS app has been authorized or
installed by this change. An owner must inspect the hosted GitHub App's actual
permissions, scope it to the intended repository, and approve access before
connecting it. Do not assume UI field restrictions are a security boundary.

After that authorization, invite the nontechnical writer using the hosted
collaborator feature. The writer edits title, author, original publication date,
summary, search description, image/alt text, and the rich-text body. No Git
commands are required of the writer.

- New entries default to `published: false`.
- Saving commits content in Git; it does **not** deploy to Hostinger.
- `published: true` means inclusion in the next owner-approved build/release.
- Drafts are excluded from article HTML, listings, sitemap, and feed.
- The repository is public: draft source and uploaded images are not private.
  Confidential drafts require an owner-approved private storage arrangement.
- Use lowercase hyphenated slugs. The filename and slug must match.
- Do not rename published slugs without adding and validating a redirect.
- Publication dates remain original dates; use `updatedOn` for substantive edits.
- Article Markdown is not processed as a template and raw HTML is escaped.
  Embedded HTML/iframes are intentionally not accepted as article-body markup.
- Upload JPG/JPEG, PNG, WebP, or AVIF files with safe names. The build rejects
  other formats, symlinks, undecodable files, and files larger than 10 MB.
  Supply meaningful alternative text. Uploads are not automatically private.
- Pages CMS rewrites configured structured fields: all current article fields
  are represented in the schema. Test save/reopen round trips before real use.

### Existing date discrepancy

The sustainability article's own byline says **June 22, 2025**, while the old
journal card said **December 16, 2025**. The existing article byline is retained
as the implementation default; the owner should confirm its historical accuracy.
Reading time is now derived consistently from article content at 200 words per
minute instead of preserving contradictory hand-entered values.

### Preview and PDF

Published content is previewed locally with the same build used for production.
There is no hosted/private draft-preview environment. Do not use the existing
public GitHub Pages site as confidential staging.

Articles include Print / Save PDF using the browser's print facility. Print CSS
removes navigation/controls and shows content. No server PDF service or separately
edited PDF copy is introduced; tagged-PDF accessibility is not guaranteed.

## Release and rollback

The release contract is deliberately local/manual: no new external build runner,
automatic deployment, external logs, or credential storage is configured.

Before the first release:

1. Resolve the existing GitHub Pages branch-root publisher. The audit found it
   enabled on `main:/`. An owner must disable that duplicate publisher or approve
   a separate explicit role **before pushing this restructuring to its publishing
   branch**. This change does not modify GitHub settings.
2. Verify the Hostinger plan, deployment directory, backup/restore capability,
   and permission to manage rewrite/header rules.
3. Review and authorize the CMS app, writer access, and publish/release authority.
4. Confirm article dates, production hostname, and non-confidential draft policy.

For each release:

1. Select/review the source revision and content changes.
2. Run `npm ci --no-audit --no-fund`, `npm run build`, `npm test`, and
   `npm run test:browser`.
3. Retain a complete copy of the known-good public release (including `.htaccess`)
   and its source revision outside the web root.
4. Publish **only the contents of `dist`**, including its generated `.htaccess`,
   to an approved Hostinger staging location first. Never upload this repository,
   `.pages.yml`, `node_modules`, original Pages documents, exports, or credentials.
5. Test root/nested routes, aliases, canonical host redirects, images, forms
   without sending test messages, CSP behavior, and unknown-path **404** status.
6. Deploy the same verified artifact to production using the owner-approved
   Hostinger mechanism. Remove stale public files by an explicitly reviewed
   release manifest; do not use a broad destructive synchronization command.
7. Check live routes, then retain the release artifact and revision for rollback.

To roll back, restore the complete prior public artifact through that same
approved mechanism, including compatible media and redirects, and repeat the
smoke checks. A Git content revert alone does not roll back Hostinger.

Hostinger generic Git deployment does not run a build. Do not point it at the
Markdown/source branch and expect generated HTML. A future generated-output
branch or external build/deploy integration is a separate authorization decision,
including its credential, access, logging, and privacy implications.

## Forms and privacy

Contact retains the existing email-client workflow; name, email, organisation,
and message are included. Opening the client does not prove delivery. Accessible
validation runs in the browser; no backend or external form service was added.

Inline testimonials are explicitly local previews, not submissions or saved
reviews. The existing Google Forms link remains the separate submission option.
Newsletter requests open the visitor's email app rather than enrolling them in
an automated list.

Executable scripts are local. The generated CSP permits existing fonts, images,
and the Google Maps frame but no analytics scripts or remote script execution.
It has no reporting endpoint. A future external form endpoint would also require
an intentional CSP and privacy review; setting an HTML action alone is not enough.

## Blogger migration: not performed

No Blogger export or administration access was available. Before importing:

- Obtain the real Takeout/Atom or historical XML export and retain a backup.
- Reconcile duplicates with the two local articles.
- Inventory original URLs, authors, dates, labels, images/captions, links, embeds,
  comments, and feeds; do not guess source values.
- Preserve content and original dates, map URLs individually, and validate media
  rights and formatting. Raw HTML embeds require a deliberate supported design.
- Decide how comments are retained or omitted.
- Verify redirects where the owner controls the hostname. Hostinger cannot
  redirect responses from `blogspot.com`; do not promise universal cross-domain
  301 redirects.
- Test all mappings and representative article formats, then approve cutover
  and rollback before retiring old content.

## Audit coverage and remaining gates

Repository changes address ROUTE-01--04, ARCH-01--02, A11Y-01--02, RESP-01,
FORM-01--02, SEO-01, source-output separation from SEC-01, and related DOC-01.
PERF-01 has optimized local derivatives; CSS bundling and removal of unnecessary
runtime work do not constitute measured Core Web Vitals results.

ARCH-03, SEO-02--03 and SEC-02 have release rules/documentation but require
Hostinger validation and account-level decisions. Hosted Pages CMS authorization,
real editor round trips, Blogger migration, confidential previews, production
release/rollback rehearsal, and field performance measurement are not claimed
complete by a successful local build.
