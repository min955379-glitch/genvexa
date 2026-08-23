# Genvexa Website & Admin Portal — Detailed QA Audit

**Target:** `https://genvexa-saez-dxc.vercel.app/` and `/admin`  
**Audit date:** 23 August 2026 (Asia/Karachi)  
**Test sizes:** Desktop 1440×1000/900; mobile 390×844  
**Overall assessment:** **Not production-ready**. The visual design is strong, but authentication behavior, broken media, admin scalability, legal routes, accessibility, data quality, and several placeholder controls require major work.

---

## 1. Executive summary

### Highest-priority findings

1. **Critical — Any new username plus any non-empty password creates a member account and logs in.** A synthetic username with an intentionally incorrect password returned `200`, created a member, and issued a `demo_…` token. Reusing that username with a completely different password also logged into the same account. There is no real password verification for these member accounts.
2. **Critical — Suspending that member did not stop login.** After the test account was suspended through the admin API, the API still issued its member token.
3. **Critical — Dynamic member state appears instance-local/ephemeral.** The same synthetic username first received user ID `u_87d…`; later the old ID returned 404 and the same username was silently recreated as `u_f31…`. This strongly indicates unsafe serverless in-memory/instance-local state.
4. **Critical — The admin Prompts screen loads and renders everything.** It downloaded approximately **12.84 MB** of JSON and rendered **4,061 rows**, **150,401 DOM elements**, **8,136 buttons**, and **4,061 images** on one page. The document became about **268,372 px** tall. A later Pending-filter click became unresponsive and the automated browser run had to be killed after 30 minutes.
5. **High — Most prompt media is broken.** **2,881 of 4,060 prompt images (71.0%)** point to `images.meigen.ai`. Representative requests returned `403 text/html`, and Chromium blocked them with `ERR_BLOCKED_BY_ORB`. On the first public page, **24 of 27 `<img>` elements** were broken.
6. **High — Admin authentication is not durable.** Refreshing `/admin` showed the login gate again even though `genvexa_admin_token` remained in `sessionStorage`.
6. **High — Admin tokens appear static and have no visible expiry.** Two successful logins returned the exact same 70-character `admin_` token. It is opaque, contains no visible expiry, and no cookie/session expiry or rotation was observed.
7. **High — “Generation” accepts empty and invalid unauthenticated requests.** `{}` returned `200`, a generation, and `creditsRemaining: 24`. A 100,000-character prompt with model `fake` and ratio `0:0` also returned `200`. Guest credit enforcement is not real.
8. **High — Legal and app routes are broken.** `/terms`, `/privacy-policy`, `/refund-policy`, `/app`, and a random nonexistent URL all returned HTTP `200` and rendered the gallery homepage. The visible legal links also explicitly call `preventDefault()`, so clicking them does nothing.
9. **High — Search in the left navigation is a dead view.** The left-sidebar **Search** button changes internal state but renders no search input or search page. The separate top search palette works.
10. **High — Security hardening is missing.** Normal HTML/API responses lack CSP, `X-Content-Type-Options`, clickjacking protection, Referrer-Policy, and Permissions-Policy. Login and authenticated admin responses were marked `Cache-Control: public, max-age=0, must-revalidate`.

### What worked

- Homepage rendered without horizontal overflow at both tested sizes.
- Model, category, sort, prompt detail, clipboard copy, like UI, generation modal, History, Favorites view, Skills view, Publish form, and Load More all rendered or responded.
- Load More increased cards from 28 to 56.
- Escape closed tested public modals.
- Correct admin credentials worked; incorrect admin credentials returned a clear error.
- Invalid and SQL-like prompt IDs returned `404`; no simple injection behavior appeared.
- Admin APIs rejected missing, invalid, and member tokens with `401`.
- Mobile public layout is visually usable and keeps two columns without horizontal page overflow.

---

# 2. Bug and error list

Severity scale: **Critical**, **High**, **Medium**, **Low**.

## A. Authentication, authorization, and account security

### AUTH-01 — New member accounts accept any password
**Severity: Critical**

**Observed**
- `POST /api/auth/login` with a username that did not exist and an intentionally incorrect non-empty password returned `200`.
- The response created a new active member, gave it 25 credits, and issued a `demo_…` token.
- Logging into the same account using a completely different password also returned `200` and the same account/token.

**Impact**
- This endpoint is effectively “create or log in by username,” not authentication.
- Anyone who knows another member’s username may be able to enter that account with any non-empty password.
- Favorites, credits, history, or future personal data would not be trustworthy.

**Fix**
- Separate registration and login.
- Hash passwords with Argon2id or bcrypt and verify them server-side.
- Never auto-provision from a failed login.
- Require verified email for registration if account sync is offered.
- Return the same generic `401` for invalid username/password.

### AUTH-02 — Suspended accounts can still obtain a token
**Severity: Critical**

The synthetic member was set to `status: suspended` using the authorized admin endpoint. A later login still returned its member token.

**Fix:** reject login and token refresh for every non-active status; invalidate existing sessions immediately when suspended.

### AUTH-03 — Stable admin bearer token with no visible expiration/rotation
**Severity: High**

Two separate successful admin logins returned the exact same token. It is `admin_` plus 64 hexadecimal characters and is not a JWT with an expiry claim.

**Risks**
- A leaked token may remain valid indefinitely.
- Password changes may not revoke it.
- There is no observed per-device session or session inventory.

**Fix:** issue short-lived, random, server-stored sessions or signed tokens with `iat`, `exp`, `jti`, rotation, revocation, and logout invalidation. Prefer a Secure, HttpOnly, SameSite cookie to browser-accessible storage.

### AUTH-04 — Admin session breaks on refresh
**Severity: High**

Before reload, the admin token existed. After reload it still existed, but the site displayed “Sign in to the admin portal.” The app deliberately refuses to restore admin user state from local storage and has no `/me`/session-restore call.

**Fix:** add `/api/auth/session` or `/api/auth/me`, validate the token at startup, restore the user, and redirect only when validation fails.

### AUTH-05 — No observed login rate limit
**Severity: High**

Six consecutive bad admin passwords all returned `401`, with no `429`, `Retry-After`, or rate-limit headers.

**Fix:** add per-IP and per-account throttling, exponential backoff, monitoring, and optional MFA for administrators.

### AUTH-06 — Login/admin responses use public cache directives
**Severity: High**

`/api/auth/login`, `/api/admin/users`, `/api/admin/activity`, and `/api/admin/stats` returned:

```text
Cache-Control: public, max-age=0, must-revalidate
```

Authenticated and token-bearing responses should not be marked public.

**Fix:** use `Cache-Control: no-store, private` and `Pragma: no-cache` for login and protected data.

### AUTH-07 — Token stored in `sessionStorage`
**Severity: Medium**

The bearer token is available to JavaScript. With no CSP, an XSS would be especially damaging.

**Fix:** use an HttpOnly, Secure, SameSite cookie and add a strict CSP.

### AUTH-08 — Public write/engagement endpoints are unauthenticated
**Severity: High**

Copy and like requests worked without user authentication. Generation is also unauthenticated. The public prompt-submission flow is available to guests.

**Impact:** bots can manipulate engagement, generate activity-log noise, consume backend resources, and spam moderation.

**Fix:** authenticate sensitive writes, add per-user/IP limits, idempotency, abuse detection, CAPTCHA for anonymous submission if it must remain anonymous, and server-side validation.

### AUTH-09 — Security headers are incomplete
**Severity: High**

Normal responses did not include:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` or CSP `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`

HSTS is correctly present.

### AUTH-10 — Technology leakage
**Severity: Low**

API responses expose `X-Powered-By: Express`.

**Fix:** disable it.

---

## B. Broken images, video, and content delivery

### MEDIA-01 — 71% of image records use a host that returns 403
**Severity: High**

Dataset counts:
- Total published prompts: **4,060**
- `images.meigen.ai` image URLs: **2,881 (71.0%)**
- Relative/local image URLs: **1,178**
- Other external host: 1

Representative `images.meigen.ai` URLs returned `403 text/html`. Chromium treated the HTML error page as an image and blocked it with ORB.

### MEDIA-02 — Initial public gallery is mostly visually blank
**Severity: High**

On initial load:
- Images in DOM: 27
- Broken images: 24
- The first local featured images loaded, while most imported cards displayed pale placeholders and raw alt text.

**Fix for MEDIA-01/02**
- Ingest media to storage/CDN you control.
- Validate URLs before publishing.
- Generate optimized derivatives and thumbnails.
- Add `onerror` fallback and a visible “media unavailable” state.
- Run a scheduled media-health checker and quarantine repeated failures.

### MEDIA-03 — Admin attempts to load thousands of broken images
**Severity: Critical as part of the admin performance failure**

The admin table renders 4,061 images without lazy loading. During the browser run, 3,241 unique admin media requests failed with `ERR_BLOCKED_BY_ORB`.

### MEDIA-04 — No responsive image delivery
**Severity: Medium**

Card images use a basic `src`; no `srcset`/`sizes` was observed. One local image transferred about **1.54 MB**.

**Fix:** serve AVIF/WebP thumbnails, set dimensions, use `srcset`/`sizes`, and reserve aspect-ratio space.

### MEDIA-05 — Video caption check incomplete/failed
**Severity: Medium**

Axe identified one video requiring manual caption review on desktop and mobile. Gallery clips do not expose caption tracks.

### MEDIA-06 — Alt text can be raw JSON or truncated prompt data
**Severity: Medium**

Many failed images announce titles such as `{` or long/truncated prompt text. This is not useful alternative text.

**Fix:** store a separate concise visual description; use empty alt only for genuinely decorative repeated thumbnails.

---

## C. Admin portal performance and reliability

### ADMIN-01 — All 4,061 prompts are fetched and rendered at once
**Severity: Critical**

Measured on the Prompts tab:
- Admin API payload: approximately **12.84 MB decoded JSON**
- Rows/images: **4,061**
- DOM elements: **150,401**
- Buttons: **8,136**
- Document height: **268,372 px**

This is far beyond a reasonable interactive table.

### ADMIN-02 — Filter interaction became unresponsive
**Severity: Critical**

After opening the full table, Playwright found the visible Pending button but the click never completed. The browser process remained stuck until the 30-minute test timeout.

### ADMIN-03 — Search/filter refetch unrelated admin endpoints
**Severity: High**

The admin effect runs this group every time search or status changes:
- stats
- all matching prompts
- users
- activity

Typing just `z` caused four calls, including a **1.43 MB** prompt response. Search has no debounce.

**Fix for ADMIN-01/02/03**
- Add server pagination (`page`/cursor, 25–50 rows).
- Return compact list DTOs; fetch full prompt only on demand.
- Virtualize rows if long lists remain.
- Lazy-load thumbnails.
- Fetch stats/users/activity independently and cache them.
- Debounce search 300–500 ms and cancel stale requests.
- Keep previous data while filtering and show a scoped loading state.

### ADMIN-04 — “All systems operational” is hard-coded while thousands of resources fail
**Severity: Medium**

The status text is static and not connected to health checks.

### ADMIN-05 — Dashboard changes/chart are hard-coded
**Severity: Medium**

Values such as `+12.8%`, `+8.4%`, `+24.1%`, and the chart line are fixed UI data, not calculated from the API.

### ADMIN-06 — “Active creators” displays total users
**Severity: Medium**

The card label says Active creators, but it uses `stats.users` (all users). The tested directory originally contained admin, creators, and members.

### ADMIN-07 — Admin shown as “Member” in Top creators
**Severity: Medium**

Ava Chen is correctly Admin in the user table but appeared as Member in the Top creators panel due to binary creator/member display logic.

### ADMIN-08 — Greeting is hard-coded
**Severity: Low**

The heading always says `Good morning, Ava.` rather than using current time and authenticated user.

### ADMIN-09 — Multiple controls are placeholders or dead
**Severity: Medium**

Confirmed from rendered UI and bundle behavior:
- Help center button has no click handler.
- Square filter button has no handler.
- “Latest first” activity control has no handler.
- Activity-row icon buttons have no handler and no accessible name.
- Settings only shows “ready to connect to deployment secrets.”
- Overview “Open” icon has no action.
- Date range/chart control is presentation-only.

### ADMIN-10 — Destructive actions lack robust safety UX
**Severity: Medium**

Prompt deletion uses `window.confirm`; user suspend/activate is one click with no reason, impact summary, or typed confirmation. Add consistent confirmations, reversible soft-delete, audit actor/reason, and undo where appropriate.

### ADMIN-11 — No way to delete a test/member account
**Severity: Medium**

`DELETE /api/admin/users/:id` is not implemented. The synthetic QA member could only be suspended, not removed.

### ADMIN-12 — Mobile admin navigation is icon-only and not accessible
**Severity: High for accessibility**

At ≤720 px, CSS hides the text spans inside admin navigation buttons. Icons are aria-hidden, and no `aria-label` is added, leaving screen-reader users with unnamed navigation controls.

---

## D. Public functional defects

### PUBLIC-01 — Sidebar Search opens an empty/dead view
**Severity: High**

The sidebar Search button sets `view = search`, but the main renderer has no search-view component. No input appears and the normal gallery is removed. The top search palette is a separate control and does work.

### PUBLIC-02 — Search sends requests while typing despite “Press Enter” messaging
**Severity: Medium**

The search value is a dependency of the gallery fetch effect, so every keystroke triggers `/api/prompts`. The palette tells users to press Enter, but Enter only closes the palette; results were already being fetched.

**Fix:** debounce; only submit on Enter if that is the stated model, or update the copy to “Results update as you type.”

### PUBLIC-03 — Terms, Privacy, and Refund links do nothing
**Severity: High**

Both sidebar and footer links explicitly prevent navigation. The auth footnote mentions Terms/Privacy but does not provide functional links.

### PUBLIC-04 — Legal and app pages do not exist
**Severity: High**

Direct visits to `/terms`, `/privacy-policy`, `/refund-policy`, and `/app` render the homepage with HTTP 200.

### PUBLIC-05 — Unknown URLs are soft 404s
**Severity: High for SEO/analytics**

A random path returned HTTP 200 and the homepage. This pollutes analytics and indexing and gives no user recovery.

### PUBLIC-06 — Credits pill is a no-op
**Severity: Medium**

The top credits button has an empty click handler. Guests are shown 25 credits despite having no durable authenticated account.

### PUBLIC-07 — Demo generation claims a credit but does not enforce identity/credits
**Severity: High**

The UI says “Uses 1 credit,” but guests can submit. The server invents `creditsRemaining` per request and accepts empty/invalid input.

### PUBLIC-08 — Guest publishing is open to spam
**Severity: High**

The public Publish form is available without login and posts to `/api/prompts`; creator can be absent. Only title/prompt presence was observed as validation.

### PUBLIC-09 — Prompt details have no route/deep link
**Severity: Medium**

Opening a prompt keeps the URL at `/`. Refresh, back/forward, sharing, canonical metadata, and direct linking cannot represent the selected prompt.

### PUBLIC-10 — No real user onboarding/recovery
**Severity: Medium**

The login modal has no registration, forgot-password, password reset, or verification flow. Instead, backend auto-provisioning silently creates demo members.

### PUBLIC-11 — Mobile menu works visually but has no accessible name
**Severity: High for accessibility**

The menu and mobile-close buttons contain only aria-hidden SVGs and have no text, title, or `aria-label`.

### PUBLIC-12 — Core controls do not expose selected/toggle state
**Severity: Medium**

Model tabs, sort tabs, categories, and heart buttons rely on CSS classes but do not use `aria-selected`, `aria-pressed`, or tab semantics.

---

## E. API validation and behavior

### API-01 — Generation accepts empty data
**Severity: High**

`POST /api/generations {}` returned 200 and a generated record.

### API-02 — Generation accepts huge and invalid fields
**Severity: High**

A 100,000-character prompt, model `fake`, and ratio `0:0` returned 200 and echoed the payload. This can increase memory, bandwidth, logs, and abuse risk.

**Fix:** schema validation, allowlists, strict length limits, authenticated credit transaction, job idempotency, and request body limit.

### API-03 — Exact `/api/prompts` returns the entire dataset
**Severity: High**

With no query string it returned all 4,060 prompts and **12,838,405 bytes decoded**. The paginated public call is smaller, but this default is unsafe.

**Fix:** always enforce a small default and a hard maximum; never treat missing query as “return all.”

### API-04 — Invalid pagination is normalized oddly rather than rejected
**Severity: Medium**

`limit=0&offset=-1` returned 24 records. `limit=999999` silently capped at 60. Return a clear 400 for negative/invalid parameters and document the maximum.

### API-05 — Public submission requires only title and prompt
**Severity: Medium/High**

Empty submission correctly returned `400`, but the form/endpoint do not require auth and do not demonstrate robust URL, model, category, media, or abuse validation.

### API-06 — Malformed JSON returns generic HTML
**Severity: Low**

Malformed JSON to login returned an Express HTML “Bad Request” page while normal API errors are JSON.

**Fix:** centralized JSON error middleware with consistent content type and correlation ID.

### API-07 — OPTIONS on protected route returns 401
**Severity: Medium if cross-origin clients are planned**

`OPTIONS /api/admin/stats` returned 401 rather than a clean method/CORS response. There was no permissive API CORS header in the tests, so this does not currently expose admin data cross-origin, but middleware ordering should be corrected if cross-origin access is needed.

### API-08 — API has no versioning or documented contract
**Severity: Low/Improvement**

Add `/api/v1`, OpenAPI, schemas, consistent pagination/error envelopes, and deprecation policy.

---

## F. Accessibility findings

Automated checks used axe-core 4.10.3. Counts are affected by repeated cards but still represent real nodes.

### A11Y-01 — 56 unnamed buttons on desktop; 58 on mobile
**Severity: Critical accessibility**

Initial desktop examples:
- 28 ellipsis/detail buttons
- 28 heart buttons

Mobile adds unnamed menu and close buttons. Prompt-detail and modal close/heart buttons are also unnamed.

**Fix:** add contextual accessible names, e.g. `View details for {title}`, `Like {title}`, `Open navigation`, `Close dialog`; add `aria-pressed` to toggles.

### A11Y-02 — Extensive color-contrast failures
**Severity: Serious**

Axe reported:
- Homepage desktop: **122** failing nodes
- Homepage mobile: **61**
- Admin overview: **58**

Examples include sidebar labels, categories, model tabs, avatar initials, admin breadcrumbs, status text, and small metadata.

### A11Y-03 — Modals lack dialog semantics/landmark containment
**Severity: Medium/High**

Prompt, generation, publish, auth, and search overlays are div-based. They lack `role="dialog"`, `aria-modal="true"`, an accessible title relationship, and a demonstrated focus trap/inert background.

### A11Y-04 — Admin login has no `<main>` landmark
**Severity: Medium**

Axe reported `landmark-one-main` plus seven regions outside landmarks.

### A11Y-05 — Clickable cards are not keyboard-native
**Severity: High**

Prompt cards use click handling on an article. Titles are not links, and the only detail control is the unnamed ellipsis button. Use a real link/button for the card title and detail action.

### A11Y-06 — Tiny targets and tiny text
**Severity: Medium**

Legal links measured approximately 11 px high. Some top actions were about 18 px high. Mobile text includes 8–11 px labels. Aim for WCAG-compliant contrast and ~44×44 CSS-pixel touch targets.

### A11Y-07 — Status/toast updates are not announced
**Severity: Medium**

Toasts have no observed `role="status"` or `aria-live`. Loading and result-count updates are also not clearly announced.

### A11Y-08 — Video caption requirement
**Severity: Medium**

One video was flagged for caption review on desktop and mobile.

---

## G. SEO, routing, metadata, and trust

### SEO-01 — Entire deployment is marked noindex
**Severity: High if this is intended to be public**

Responses include `X-Robots-Tag: noindex`. Search engines will not index the gallery.

### SEO-02 — `robots.txt` and `sitemap.xml` return the SPA HTML
**Severity: High**

Both paths returned the 573-byte index document, not valid robots/sitemap content.

### SEO-03 — Favicon and manifest paths return HTML
**Severity: Medium**

`/favicon.ico` and `/manifest.json` returned the SPA document.

### SEO-04 — No canonical, Open Graph, or route-specific metadata
**Severity: Medium/High**

No canonical was present. Admin and public pages use the same title/description. Prompt details cannot provide unique title, description, image, or social card.

### SEO-05 — Marketing count is inconsistent
**Severity: Medium**

Hero states `12k+ prompts`, while the public API and gallery show 4,060 published prompts.

### SEO-06 — Soft 404 behavior
**Severity: High**

Unknown paths return 200/homepage rather than a 404 route and status.

---

## H. Dataset and content-quality defects

Analysis covered all 4,060 published prompts.

### DATA-01 — 318 meaningless brace-style titles
**Severity: High content quality**

- 315 titles are exactly `{`.
- 318 titles are `{`, `[`, or `[Main Roles]`-style placeholders.
- 330 titles start like raw JSON/placeholder content.

### DATA-02 — Many duplicate titles and prompts
**Severity: Medium/High**

- Duplicate title values: **185 groups**, accounting for **632 extra rows**.
- Duplicate prompt values: **116 groups**, accounting for **126 extra rows**.

Deduplicate by normalized prompt hash/source id and review near-duplicates.

### DATA-03 — Generic and truncated titles
**Severity: Medium**

- 19 titles are generic “AI generated image by …”.
- 36 titles equal the entire prompt.
- Several titles visibly end mid-word (`wor`, `minimali`, `sid`).
- Title length ranges from 1 to 120 characters.

### DATA-04 — Extremely large prompt bodies
**Severity: Medium**

- Median prompt length: ~1,493 characters
- Maximum: **25,853**
- Over 5,000 characters: **327 prompts**

Long content needs collapse/expand, truncation rules, search indexing, and backend payload separation.

### DATA-05 — Model taxonomy is inconsistent
**Severity: Medium**

The dataset has 14 raw model strings, including:
- `Nano Banana`
- `Nano Banana Pro`
- `Nanobanana Pro`
- `other`
- `GPT Image 2`
- multiple low-volume model names

The hero says 5 models, and the primary tabs expose a subset/alias. Normalize model IDs separately from display labels.

### DATA-06 — Incomplete optional media metadata
**Severity: Low/Medium**

- `mediaType` missing on 13 records
- `poster` missing on 13
- `images`/`sourceSite` absent on 17 legacy records

### DATA-07 — Adult/celebrity content needs policy and moderation
**Severity: High trust/safety depending on audience**

Keyword screening found:
- 122 prompts (3.0%) with terms such as bikini, lingerie, exposed, nude/naked, etc.
- 40 prompts mentioning examples such as Sydney Sweeney, Jang Wonyoung, or “celebrity.”

This is not a definitive safety classification, but the public gallery needs clear age rules, celebrity/deepfake policy, consent policy, reporting, and moderation. Some current excerpts are sexualized and appear directly in a general-audience gallery.

### DATA-08 — 36.8% have zero likes and zero copies
**Severity: Low/analytics**

This may be expected for imports, but it makes Popular ordering and engagement claims less meaningful. Separate imported historical counters from actual on-site engagement.

---

# 3. Recommended improvements, prioritized

## P0 — Before any production launch

1. Replace auto-provisioning login with real registration/password verification.
2. Enforce suspension and revoke all active sessions.
3. Rotate and expire admin tokens; move to Secure HttpOnly cookies.
4. Add server pagination and stop rendering 4,061 admin rows.
5. Move external media to a controlled CDN and repair/quarantine the 2,881 blocked image URLs.
6. Add strict request validation and authentication/rate limits to generation, submissions, likes, copies, and favorites.
7. Implement real Terms, Privacy, Refund, App, and 404 pages; remove `preventDefault` from legal links.
8. Set protected endpoints to `Cache-Control: no-store, private`.
9. Add CSP, frame protection, nosniff, referrer, and permissions headers.
10. Decide whether this is staging or public. If public, remove `X-Robots-Tag: noindex` and add valid robots/sitemap.

## P1 — Next release

11. Restore admin sessions from a validated `/me` endpoint.
12. Fix the sidebar Search view or make it open the working palette.
13. Debounce public/admin search and fetch only the affected resource.
14. Implement dead controls or remove them.
15. Add accessible names to every icon button and proper state attributes.
16. Raise contrast to WCAG AA and enlarge small touch targets/text.
17. Add dialog semantics, focus trapping, inert background, and live regions.
18. Create prompt detail routes such as `/prompts/:slug-or-id` with shareable metadata.
19. Normalize model/category IDs and clean brace/generic/truncated titles.
20. Add moderation policy, report flow, age rules, and celebrity/deepfake safeguards.

## P2 — Quality, scale, and product polish

21. Use optimized AVIF/WebP images with `srcset`, dimensions, lazy loading, and placeholders.
22. Add virtualized admin tables, bulk actions, saved filters, and export.
23. Make dashboard charts and percentage changes data-driven.
24. Add robust audit logs with actor, IP/device, reason, before/after, and immutable retention.
25. Add user deletion/data export, password reset, email verification, MFA, and session management.
26. Add observability: frontend error monitoring, API traces, media failure rate, auth anomaly alerts, and uptime checks.
27. Add automated tests to CI: unit, API contract, Playwright desktop/mobile, axe, Lighthouse budgets, and visual regression.
28. Add database constraints and import pipelines for duplicate IDs/prompts, canonical model names, moderation status, and media health.
29. Replace static “All systems operational” with actual service health.
30. Add empty/error/retry states so failed APIs do not leave stale or blank UI.

---

# 4. Suggested acceptance criteria

## Authentication
- Unknown username + password returns generic 401; it never creates an account.
- Wrong password for an existing member returns 401.
- Suspended user login and existing tokens fail immediately.
- Admin token expires within a defined short period and rotates on reauthentication.
- 10 rapid failures produce throttling/lockout behavior and an audit alert.

## Admin prompts
- First table payload ≤250 KB and ≤50 rows.
- Initial DOM ≤5,000 nodes.
- No more than visible/near-visible thumbnails load.
- Search is debounced and does not refetch users/activity/stats.
- Pending filter responds in under 300 ms after data is available.

## Media
- ≥99.5% published thumbnail requests return an actual image/video with 2xx status.
- Broken source media shows a designed fallback, never raw alt text on a blank block.
- Typical card thumbnail ≤100 KB; LCP image appropriately compressed/preloaded.

## Accessibility
- Zero axe critical/serious violations on home, detail, auth, publish, generate, and admin overview.
- Every icon-only button has a meaningful accessible name.
- All interactions work with keyboard only.
- Focus is trapped/restored for dialogs.
- Text contrast meets WCAG 2.2 AA.

## Routing/SEO
- Legal/app routes contain correct content and unique metadata.
- Unknown route returns a real 404.
- Prompt has a shareable URL and Open Graph image.
- `robots.txt`, sitemap, favicon, and manifest return correct MIME/content.

---

# 5. Test matrix

| Area | Result |
|---|---|
| Public initial desktop render | Pass, with major broken-media/accessibility defects |
| Public mobile layout | Pass visually; no horizontal overflow |
| Model/category/sort filters | Passed sampled interactions |
| Load More | Passed: 28 → 56 cards |
| Prompt details | Opens; Escape closes; no deep-link route |
| Clipboard copy | Passed; emitted live copy request |
| Like | Passed UI/API; test like was restored |
| History | Passed sampled item |
| Favorites guest state | Rendered explanatory sign-in state |
| Skills | Rendered |
| Publish | Form rendered for guest; successful creation intentionally not executed |
| Generation | Returned success, but validation/credit logic failed |
| Top search palette | Works; fetch-on-keystroke design defect |
| Sidebar Search | Failed/dead view |
| Legal/app routes | Failed |
| Random 404 | Failed: soft 200 homepage |
| Admin wrong password | Correctly rejected |
| Admin correct credentials | Passed |
| Admin overview/users/activity | Rendered |
| Admin prompts | Severe performance failure |
| Admin Pending filter | Browser became unresponsive after full table load |
| Admin refresh persistence | Failed |
| Unauthorized admin APIs | Correctly rejected |
| Member token accessing admin | Correctly rejected |
| Account password verification | Failed critically |
| Suspended account login prevention | Failed critically |

---

# 6. Audit side effects and cleanup note

To minimize risk, real prompt deletion, real-user suspension, prompt approval/rejection, and successful public prompt creation were **not** executed.

Controlled API/UI checks did produce some live activity:
- One prompt-detail view request.
- One copy request.
- A like was toggled and then restored to its original value.
- Four generation validation/flow requests may appear in Activity.
- The authentication test unexpectedly created synthetic member `nobody-does-not-exist-98372` with ID `u_87d91f44-602a-42ff-911b-2f31527d453b`. The API has no user-delete route, so the account was set to **suspended**. It should be removed directly from the backing datastore after the bug is fixed.

No supplied credential or admin token is stored in this report.

---

# 7. Evidence files

- [Desktop homepage](screenshots/home-desktop-full.png)
- [Mobile homepage](screenshots/home-mobile-full.png)
- [Mobile menu open](screenshots/mobile-menu-open.png)
- [Prompt detail modal](screenshots/prompt-detail.png)
- [Generation form](screenshots/generate-form.png)
- [Publish form](screenshots/publish-guest.png)
- [Admin login](screenshots/admin-login.png)
- [Admin overview](screenshots/admin-overview.png)
- [Admin prompt table](screenshots/admin-prompts.png)
- [Admin after refresh — login gate](screenshots/admin-after-reload.png)
- Raw browser/axe evidence: `browser-results.json`
- Dataset summary: `dataset-analysis.json`

> Note: destructive moderation controls were reviewed but not activated against real data.
