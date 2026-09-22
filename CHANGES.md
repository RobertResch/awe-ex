# CHANGES.md — Exercise 1 running log

No commits were made for this pass (working tree only). `app.js` is left **completely untouched**
on disk and is no longer loaded by `index.html` — it is the "before" snapshot. Diff any `js/*.js`
file against the matching section of `app.js` to see a before/after for class. Line numbers below
refer to the original `app.js` unless stated otherwise.

See `EXERCISE_1_ANSWERS.md` for the full write-up (bug reports, theory-question answers, and the
Demo 6/7 debugger & DevTools runbook). This file is just the change log.

## Demo 1 — Module split

Split `app.js` (1085 lines, one file) into 11 ES modules under `js/`:

| Module | Responsibility |
|---|---|
| `state.js` | Shared mutable state (one `state` object) + the three `STORAGE_KEY_*` constants |
| `utils.js` | Pure lookup/formatting helpers (no imports, no state, no DOM writes) |
| `storage.js` | `localStorage` read/write for bookmarks & notes |
| `dataLoader.js` | `fetch()`-based data loading (`loadAllData` and friends) |
| `dashboard.js` | Dashboard view rendering |
| `evidence.js` | Evidence catalogue + detail view, filtering, sorting, bookmarking |
| `people.js` | People & Locations view |
| `timeline.js` | Timeline view + the quick-view modal |
| `workspace.js` | Bookmarks list, notes list, hypothesis form |
| `router.js` | Hash-based navigation |
| `main.js` | Entry point: event listener wiring, `initApp`, `window.*` exposure for inline HTML handlers |

`index.html`: `<script src="app.js">` → `<script type="module" src="js/main.js">`.

Pure refactor — no behavior change, no bugs fixed, `var`/`function`/`.then()` style preserved
exactly. Two deliberate design decisions worth noting (see ANSWERS.md Demo 1 for the full
reasoning):

- `findEvidenceById`/`findPersonById`/`findLocationById` now take the collection to search as a
  parameter instead of reaching for a global — makes `utils.js` a dependency-free module.
- Functions still called from inline `onclick="..."`/`onchange="..."` attributes in `index.html`
  (and from HTML built as template strings in `evidence.js`) are explicitly attached to `window` in
  `main.js`, since ES module top-level declarations are **not** globals the way classic `<script>`
  declarations are.

## Demo 2 — Mutation/reference bug (fixed)

**File:** `dataLoader.js` (was `app.js:88`, `loadEvidenceData`)

`state.filteredEvidence = state.allEvidence;` → `state.filteredEvidence = state.allEvidence.slice();`

`filteredEvidence` was assigned the *same array reference* as `allEvidence`, not a copy. See
ANSWERS.md Demo 2 for the full repro (sorting on the Evidence page while it's still showing its
loading spinner reorders the Dashboard's "Recent evidence" panel).

## Demo 3 — Async/Promise bug (fixed)

**File:** `dataLoader.js` (was `app.js:19`, `85`, never — the flag was never reset)

Added `state.evidenceViewLoading = false;` to both the success and failure paths of
`loadEvidenceData`. The flag started `true` and was **never** set back to `false` anywhere in the
original file — the Evidence tab was permanently stuck on its loading spinner. See ANSWERS.md
Demo 3.

## Demo 4 — Silent/console-only bug (fixed)

**File:** `main.js` (was `app.js:1038-1043`, inside `setupEventListeners`)

`for (var i = ...)` → `for (let i = ...)` in the nav-button click-listener loop. `var`'s
function-scoping meant every click handler shared one `i`, which had already advanced past the last
valid index by the time any button was clicked — throwing `Uncaught TypeError` on every nav click,
silently, since the buttons still navigate via their separate inline `onclick` attribute. See
ANSWERS.md Demo 4.

## Demo 5 — Additional bugs found & fixed

1. **Sort dropdown was a no-op** — `evidence.js`, `getFilteredEvidence`. Sorting now happens inside
   `getFilteredEvidence` itself (reading `#sortEvidence` the same way every other filter is read),
   instead of in `handleSortChange`, whose sort was immediately discarded by the next render.
2. **Timeline showed `[object Object]` for locations** — `timeline.js`, `renderTimeline`. Was
   pushing the location object itself into the display array instead of a formatted string.
3. **`loadNotesFromStorage` crashed on corrupt JSON** — `storage.js`. No `try/catch` around
   `JSON.parse`, unlike its sibling `loadBookmarksFromStorage`; since it runs before
   `setupEventListeners()` in `initApp`, an uncaught error here killed every event listener in the
   app. Now wrapped in `try/catch`.
4. **`loadHypothesisFromStorage` crashed on corrupt JSON** — `workspace.js`. Same class of bug,
   narrower blast radius (only the Workspace tab). Now wrapped in `try/catch`.
5. **Quick-view modal leaked click listeners** — `timeline.js`, `openEvidenceModal`. A new listener
   was attached to the (reused) modal element every time it opened, never removed. Now attached
   exactly once, when the modal element is first created.
6. **`filterStatus` was bound to `change` twice** — `main.js`. Removed the redundant
   `setAttribute("onchange", "renderEvidenceList()")` sitting right next to an identical
   `addEventListener` call.
7. **Duplicate `hashchange` listener** — `main.js`. `handleHashChange` was registered twice (inside
   `setupEventListeners`, and again at the bottom of the file). Removed the second registration.
8. **`loadNoteAsync("E01")` result logged as a pending Promise, not the note text** — `main.js`,
   `initApp`. Deferred to and fixed as part of Demo 9 (converting `initApp` to `async`/`await`).

Full repro/root-cause/verification writeups for all of these are in `EXERCISE_1_ANSWERS.md`.

## Demo 8 — `var` → `let`/`const` + code smells

Swept every `var` in every `js/*.js` file to `let` (reassigned) or `const` (never reassigned),
deciding deliberately per binding — see ANSWERS.md Demo 8 for the reasoning and the full original
top-level `var` list. Two code smells beyond the globals theme, fixed as part of Demo 5 above:
the duplicate `filterStatus` binding and the duplicate `hashchange` listener registration.

## Demo 9 — Nested `.then()` → `async`/`await`

**File:** `dataLoader.js`

- `loadCorePeopleAndLocations` — the deepest chain (6 levels of nested `.then()`: 3×
  `fetch().then(res => res.json().then(json => ...))`) → a flat sequence of `await` statements,
  same strict sequencing (case → people → locations, one at a time) preserved exactly.
- `loadEvidenceData` — `.then()/.then()/.catch()` → `try { await ... await ... } catch { ... }`.
- `loadTimelineData` — `.then()/.then()/.catch()/.finally()` → `try/catch/finally`.
- `loadAllData` — `.then()` → `await`, while deliberately **not** awaiting `loadEvidenceData()`/
  `loadTimelineData()`, preserving the original's "fire and forget" behavior for those two.

**File:** `main.js` — `initApp`'s `loadAllData().then(...)` → `await loadAllData()`; also converted
`loadNoteAsync("E01")` from an un-awaited call (Demo 5, bug #8 above) to `await loadNoteAsync(...)`.

## Demo 10 — Arrow functions

- All of `utils.js` (8 pure functions), `dashboard.js`'s `statCardHTML`, `timeline.js`'s
  `certaintyBadgeClass` and `openEvidenceModal`, `people.js`'s `countEvidenceForPerson`,
  `evidence.js`'s `simulateAsyncSearch` and `statusOptionHTML` → arrow functions (`const name = (...) => ...`).
- Anonymous callbacks converted to arrow functions: sort comparators, `.filter()`/`.then()`
  predicates, and every inline `addEventListener`/`setTimeout` callback that isn't a bare
  cross-module reference (main.js nav-button + hypConfidence listeners, timeline.js's link/modal
  click listeners, people.js's evidence-count-link listener, workspace.js's open-evidence listener,
  evidence.js's detail-form change listeners).
- **Deliberately NOT converted:** `renderEvidenceList`, `renderTimeline`, `clearFilters`,
  `handleSearchInput`, and `handleEvidenceListClick` — all passed **bare** (unwrapped) to
  `addEventListener` elsewhere. See ANSWERS.md Demo 10 for the full reasoning (regular functions
  used this way get `this === event.currentTarget` per the DOM spec; arrow functions would
  silently lose that).

## Live verification

No Node/Python were available in this environment, so I stood up a minimal PowerShell static file
server and drove the app in an actual Chrome tab to check the refactor and every bug fix for real,
rather than relying on static review alone:

- App loads cleanly end-to-end (Dashboard shows 18 evidence / 6 people / 6 locations / correct
  review count), zero console errors on load — confirms the module split and the `initApp` →
  `loadAllData` async/await conversion didn't break startup.
- `First note preview: ` logs the resolved (empty) string, not a `Promise` object — Demo 9/Bug H fix
  confirmed live.
- Evidence tab renders its cards immediately (no stuck spinner) — Demo 3 fix confirmed live.
- Clicking every nav button logs a single clean `nav clicked: <view>` line, no
  `Uncaught TypeError` — Demo 4 fix confirmed live.
- Changing the Sort dropdown (`title-asc`/`title-desc`) actually reorders the Evidence list, and —
  separately — no longer changes the order of the Dashboard's "Recent evidence" panel afterward —
  Demo 5/Bug A and Demo 2 fixes both confirmed live, including the Demo 2 regression check (sorting
  Evidence no longer bleeds into `allEvidence`'s own order).
- Timeline events show real location names (`"Location: L01 - Human-Robot Interaction Laboratory"`),
  not `[object Object]` — Demo 5/Bug B fix confirmed live.
- Bookmarking E01 on the Evidence tab immediately shows up in the Workspace tab's bookmark list, and
  persists to `localStorage.remotion_bookmarks` as `["E01"]` — bookmark round-trip confirmed live.
- Hand-corrupting both `remotion_notes` and `remotion_hypothesis` in `localStorage` (to invalid
  JSON) and reloading: the app stays fully interactive (`window.navigateTo` still callable,
  bookmarks still intact and rendered), the Notes panel gracefully shows "No notes yet," and the
  hypothesis form gracefully starts blank instead of the whole app dying — Demo 5/Bug C and Bug D
  fixes both confirmed live, this is the single most convincing before/after in the whole exercise
  since the *original* code goes completely unresponsive under this exact repro.

`localStorage` was cleared back to empty afterward and the temporary dev server was stopped; nothing
from this verification pass was left running or committed.

## Noticed but out of scope for this exercise (written down per the instructions)

- `saveCurrentNote`/`renderNotesList` write user-typed text into `innerHTML` directly (commented
  `// unsafe on purpose` in the original source) — looks like a deliberate plant for a later,
  security-focused exercise; not touched here.
- `loadAllData` doesn't actually wait for `loadEvidenceData`/`loadTimelineData` to finish (see
  Demo 9 above) — parallelizing/fixing the concurrency story is explicitly a later exercise.
- `router.js` and `people.js`/`timeline.js`/`workspace.js` import each other in a cycle (router
  needs their render functions; they need `navigateTo`). It works today because every function
  involved is a hoisted declaration/const-before-use and nothing is called until well after all
  modules finish evaluating, but a cleaner long-term shape would be an event-based/pub-sub
  navigation call instead of a direct cross-module import cycle — worth revisiting once
  "full separation-of-concerns architecture" is in scope.
- No build tooling/bundler, per the exercise's explicit scope — every module is loaded natively by
  the browser via `import`/`export`, which is also why the app must be served over HTTP (see
  ANSWERS.md Demo 1, Q4).

---

# Exercise 2 running log

No commits were made for this pass either (working tree only) — see `EXERCISE_2_ANSWERS.md` for the
full write-up. `app.js` (the pre-Exercise-1 monolith) is still left completely untouched and is
excluded from lint/format tooling; it was never wired into `index.html` and plays no part in this
migration.

## Demo 1 — Package manager & project metadata

Chose **npm** over pnpm — already on the machine (ships with Node), the class doesn't otherwise need
pnpm's disk/workspace benefits for an 11-module app, and it's what most students' machines will have
with zero extra setup. `package.json` created by hand (name, version, description, author, `type:
"module"`, `engines.node`). `.gitignore` adds `node_modules/`, `dist/`, editor/OS noise, and env
files. First real dependency: **Vite** (`^8.3.0`, devDependency) — chosen because it's needed
immediately for Demo 2 anyway. `package-lock.json` generated by `npm install` and is meant to be
committed alongside `package.json`.

## Demo 2 — Vite dev server & file restructuring

Moved `data/` → `public/data/` and `assets/` → `public/assets/` so Vite serves them as unprocessed
static passthrough files at the same root-relative paths (`data/case.json`, `assets/logo/logo.svg`)
both in dev and in the production build. `index.html` and `styles.css` stay at the project root
(Vite's default entry point); `js/*.js` (now `js/*.ts`, see Demo 5–7) needed no restructuring at all
— Vite crawls the module graph starting from `<script type="module" src="js/main.js">` automatically.
`vite.config.js` added with `base: "./"` (relative base, so the built app works under a GitHub Pages
project subpath — see Demo 9) and a relocated `cacheDir` (see "Environment quirks" below).

**Verified, not just assumed:** started `npm run dev`, `curl`'d `/`, `/data/case.json`,
`/assets/logo/logo.svg`, and `/js/main.js` (all 200). Later, once a live browser became available
(Chrome via the Claude browser extension), re-verified end-to-end: every view (Dashboard, Evidence
— search/filter/sort/bookmark/status-change/note-save, People & Locations — both tabs, Timeline —
including the quick-view modal's cross-navigation into the Evidence detail view, Workspace —
bookmarks/notes/hypothesis form persisting correctly across a real page reload), zero console errors.
Also ran a precise HMR test using a `window.__hmrCanary` global (destroyed only by an actual page
navigation, not by an in-place module swap): editing `js/dashboard.ts` visibly updated the page but
**did destroy the canary** — this app never calls `import.meta.hot.accept()`, so Vite's default
fallback for a JS/TS module with no accept boundary is a full page reload, not true HMR, even though
it looks instantaneous. Editing `styles.css`, by contrast, updated the page **without** destroying the
canary — CSS is hot-swapped in place by Vite without needing any `accept()` call at all. Full
reasoning in `EXERCISE_2_ANSWERS.md`, Demo 2, Q2.

## Demo 3 — Production build & preview

`vite build` produces `dist/index.html` (10.78 kB), a single bundled+minified
`dist/assets/index-*.js` (23.45 kB, later 22.65 kB after the Demo 5–7 TS migration — down from
59,223 bytes across the 11 original `js/*.js` source files combined), and a single bundled+minified
`dist/assets/index-*.css` (11.44 kB), plus `dist/data/` and `dist/assets/` copied through unchanged
from `public/`. Concrete transformations observed: **bundling** (11 ES modules → 1 JS file),
**minification** (comments stripped, whitespace removed, template-string-quoted output, local names
shortened — 59 KB → ~23 KB), and **content-hashed filenames** (`index-ZAWMSz9M.css`,
`index-ByDM04Ed.js`) so a browser/CDN can cache them forever without ever serving stale JS/CSS after
a deploy — the filename itself changes when the content does. Verified end-to-end with `vite preview`
(not the dev server): `curl`'d the built `index.html`, the hashed JS/CSS bundle, and `data/case.json`
— all 200, and the served HTML's `<script>`/`<link>` tags point at the hashed filenames via relative
(`./assets/...`) paths.

## Demo 4 — Lint & format

Installed ESLint 10 (flat config, `eslint.config.js`) with `@eslint/js` recommended rules,
`typescript-eslint`'s recommended rules (applied to `js/**/*.{js,ts}` even before any file was
actually `.ts`, so the same config carries through Demo 5–7 unchanged), browser globals for app code
vs. Node globals for `*.config.js`, and `eslint-config-prettier` last (turns off any ESLint rule that
would otherwise fight Prettier over formatting). Installed Prettier 3 (`.prettierrc.json`: double
quotes, semicolons, 100-char width, no trailing commas — matches the codebase's existing style to
minimize diff noise). Scripts added: `dev`, `build`, `lint`, `lint:fix`, `format`, `format:check`
(used by CI, Demo 8).

**Real finding #1 (lint):** `npx eslint .` caught `'resolvedTerm' is defined but never used` in
`evidence.js`'s `handleSearchInput` — a genuine leftover parameter from the simulated-async-search
`.then()` callback. `eslint --fix` correctly refused to touch it (renaming/removing a parameter is a
semantic decision, not a style one) — fixed by hand by dropping the unused parameter.

**Real finding #2 (format):** `npx prettier --check .` flagged several files' long
string-concatenation lines exceeding the 100-char width. Fixed by hand in `utils.js`'s `formatDate`
(this repo's dev machine has a Prettier/ESLint `--write`/`--fix` incompatibility with its OneDrive/
Synology-Drive-synced working folder — see "Environment quirks" below — so `--write` was verified
against a throwaway copy of the file tree on a local, non-synced path and the identical diff applied
by hand). Prettier's scope was deliberately narrowed to `js/ts` source only (`.prettierignore` excludes
`*.md`, `*.css`, `*.html`, `app.js`) — reformatting the long-form Markdown docs and hand-tuned
CSS/HTML wholesale would have produced a huge diff unrelated to this exercise's actual focus. The
remaining pre-Demo-5 `.js` files' formatting debt was absorbed into their Demo 5–7 TypeScript
rewrites rather than fixed twice.

## Demo 5 — TypeScript setup & first conversions

`tsconfig.json`: `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`; `moduleResolution: "bundler"` (lets
every import specifier keep its `.js` extension while resolving to the real `.ts` file on disk — zero
import-statement churn across the whole migration); `allowJs: true` / `checkJs: false` so the program
type-checked cleanly across a mixed `.js`/`.ts` tree at every intermediate stage; `noEmit: true`
(Vite/esbuild-family tooling does the actual transpilation — `tsc` here is purely a checker).

First conversions (no `any`): `utils.js` → `utils.ts` (the three `findXById` helpers made generic
over `<T extends { id: string }>` instead of a concrete domain type, since Demo 6's domain types
didn't exist yet — and this turned out to be the better permanent design, kept unchanged through
Demo 7), `state.js` → `state.ts` (loaded-data fields typed `unknown[]`/`Record<string, unknown>` as
an honest "not modeled yet" placeholder, later refined in Demo 6), `storage.js` → `storage.ts`.

Wired into tooling: `build` is now `tsc --noEmit && vite build` (verified live: temporarily typed a
parameter as `number` where a `string` was used — `npm run build` failed at the `tsc` step with a
real `TS2339` error and never reached `vite build`; reverted). `dev` now runs `vite` and
`tsc --noEmit --watch` together via `concurrently`, so type errors surface continuously in the
terminal during development, not only in the editor or at build time.

## Demo 6 — Typing the domain data

Added `js/types.ts`: `CaseData`, `Person`, `Location`, `Evidence` (`status`/`relevance` as strict
unions), `TimelineEvent` (`certainty` deliberately left as plain `string`, since
`certaintyBadgeClass` already has an "anything else" fallback — a closed union would be modeling
wishful thinking the code itself doesn't act on). Converted `dataLoader.js` → `dataLoader.ts` to use
these types instead of raw `fetch().json()`; `state.ts`'s placeholder `unknown[]` fields refined to
the real domain types now that they exist.

**Ambiguous field:** `personIds` (`Evidence`/`TimelineEvent`). `evidenceMentionsPerson` (`utils.ts`)
has always checked a candidate against *both* `person.id` and `person.name` — which only makes sense
if the underlying data mixes both shapes. Modeled as `PersonRef = string` with a comment documenting
the ambiguity rather than silently picking one shape, since fixing the source data is out of scope.
See `EXERCISE_2_ANSWERS.md`, Demo 6, for the full writeup — including the *second*, closely-related
data problem this typing pass surfaced: `evidence.json` entry `E12` stores `status`/`relevance` as
`"Reviewed"`/`"Unknown"` (capitalized) while every other entry uses lowercase. Typing `status` as the
strict union `EvidenceStatus` forced an explicit decision instead of letting every call site keep
`.toLowerCase()`-defending itself: `dataLoader.ts` now normalizes both fields once, at load time
(`normalizeStatus`/`normalizeRelevance`), via an explicit `RawEvidence` type for the raw,
not-yet-normalized JSON shape.

## Demo 7 — Full migration & resolving type errors

Converted the remaining 7 files (`dashboard.js`, `evidence.js`, `main.js`, `people.js`, `router.js`,
`timeline.js`, `workspace.js`) to `.ts`. `npx tsc --noEmit` and `npx eslint .` both exit 0 across the
entire app; `npx prettier --check .` reports "All matched files use Prettier code style!". Production
build re-verified after the full migration (`npm run build`'s `tsc` gate passes, then `vite build`
succeeds, bundle 22.65 kB, a hair smaller than the pre-migration JS build).

Three concrete spots (of several) where the compiler forced an actual decision, not just a type
annotation:

1. **`router.ts`** — `validViews.indexOf(hash) === -1` never narrowed `hash`'s type, so
   `document.getElementById("view-" + hash)` stayed `HTMLElement | null` everywhere downstream.
   Rewritten as an `includes` check against a `readonly` literal-union array so a validated hash is
   actually known to be one of the five view names.
2. **`timeline.ts` / `evidence.ts`** — `new Date(a.time) - new Date(b.time)` type-checks in plain JS
   only via an implicit `Date → number` coercion; TypeScript's arithmetic operators refuse two
   `Date`s outright. Judged **compiler pedantry, not a latent bug** — the implicit coercion was
   already doing the right thing — but a good illustration of why TS refuses silent coercions
   categorically rather than case-by-case.
3. **`timeline.ts`** — `let modal = document.getElementById(...)`, reassigned inside
   `if (!modal) { modal = ... }`, is narrowed to non-null immediately afterward but that narrowing
   doesn't survive into the `addEventListener` closure below it (a `let` a closure can see is treated
   as possibly-reassigned-by-then). Fixed with a `const modalEl = modal;` alias right after the
   narrowing point — the standard pattern for carrying a null-check's result into a closure.

A fourth, arguably the most important: writing a `<select>`'s `.value` (always `string`) back into
`ev.status`/`ev.relevance` (`EvidenceStatus`/`EvidenceRelevance`, strict unions) needed an explicit
`as` cast in `evidence.ts` — justified only because that exact `<select>`'s options were generated
from those same three literal values two lines earlier, not because casts-to-narrow-a-string are
generally safe.

**Genuine bug found (not noise):** the `E12` status/relevance casing inconsistency from Demo 6 —
before this migration it silently rendered a differently-capitalized badge on exactly one evidence
card, easy to miss in a quick visual scan. It only became impossible to ignore once `status` had to
be given a real type, because there was suddenly a concrete "this is the set of values this field is
allowed to be" statement for the raw JSON to (barely) fail to satisfy.

## Demo 8 — GitHub Actions: development workflow (`.github/workflows/ci.yml`)

Triggers on every `push` and `pull_request` (any branch). Steps: checkout, `actions/setup-node@v4`
(Node 20, `cache: npm` keyed on `package-lock.json`), `npm ci`, `npm run lint`, `npm run
format:check`, `npm run typecheck`. **Not yet observed running or failing/passing in the Actions
tab** — this session made no git commits and no pushes (by explicit instruction), so the fail→fix→
pass cycle Demo 8 asks for still needs to happen live: push a commit that breaks lint/format, watch
it fail, fix it, push again, watch it pass.

## Demo 9 — GitHub Actions: deployment workflow (`.github/workflows/deploy.yml`)

Triggers on `push` to `main` plus `workflow_dispatch` (manual re-run). Two jobs: `build` (checkout →
setup-node → `npm ci` → `npm run lint` → `npm run build` → `actions/upload-pages-artifact@v3` on
`dist/`) and `deploy` (`needs: build`; `actions/deploy-pages@v4`, which publishes the uploaded
artifact directly — no `gh-pages` branch, no manual `git push`). `permissions:` is scoped to exactly
`contents: read`, `pages: write`, `id-token: write` — no repository secrets at all; the `id-token`
lets `deploy-pages` obtain a short-lived OIDC token proving the run belongs to this repo, which
GitHub exchanges for publish permission.

**Not yet done (needs the user, live):** the one-time repo setting **Settings → Pages → Build and
deployment → Source: "GitHub Actions"** (not "Deploy from a branch") has to be set by hand in the
GitHub UI before this workflow can publish anything — no workflow file can set this for you. After
that, an actual push to `main` is needed to see the deployed URL serve the working app end-to-end.

## Demo 10 — Triggers, permissions & failure modes

`deploy.yml`'s `build` job runs `npm run build` (= `tsc --noEmit && vite build`) before the `deploy`
job (`needs: build`) can run at all — a real TypeScript error fails the build job and the deploy job
never starts, so **the previously-deployed Pages version stays live untouched** (Pages only updates
on a successful `deploy-pages` publish; there's no "partial" or "broken" deploy state). That's the
correct behavior: broken code should never take down a working, already-live site.

Trigger choice recap: `ci.yml` uses `on: push` + `on: pull_request` (broad — every push, every branch,
cheap to run, meant to fire constantly); `deploy.yml` uses `on: push` scoped to `branches: [main]`
plus `on: workflow_dispatch` (narrow — only the branch that represents "live", plus an escape hatch
for a manual re-publish). `workflow_dispatch` was deliberately *not* added to `ci.yml` — there's
nothing to manually re-trigger lint/format/typecheck for that pushing an empty commit wouldn't already
cover just as well.

**Not yet done (needs the user, live):** an actual failed run's logs in the Actions tab, read and
explained out loud to someone unfamiliar with the repo, per the task's own framing ("be ready to read
a failed run's logs live"). Everything above was verified locally (`npm run lint`/`build`/`typecheck`
failing and passing on demand) but a real GitHub Actions run is a different environment (Ubuntu
runner, fresh checkout, no local caches) and should be watched at least once before class.

## Environment quirks hit during this exercise (worth knowing about, not code changes)

This dev machine's project folder lives inside a **Synology Drive**-synced directory. Two real,
reproducible issues came from that, both fixed in-repo (not worked around by moving the project):

1. **Vite's default config loader hangs indefinitely.** Vite's default `--configLoader bundle` writes
   a transient bundled copy of `vite.config.js` to disk before loading it; that write never completed
   on this synced folder (confirmed: plain Node file I/O, native addon loading, and networking all
   work fine here — only this specific bundle-then-write step hung). Fixed by adding
   `--configLoader native` to the `dev`/`build`/`preview` scripts in `package.json` — it loads the
   (plain-ESM) config directly, no temp file. This is a real, permanent part of how this repo's
   scripts run, not a one-off local hack.
2. **Vite's dependency-optimizer cache directory (`node_modules/.vite`) can't be recreated
   (`EPERM` on `rmdir`).** Fixed by pointing `cacheDir` at the OS temp directory in `vite.config.js`
   (`join(os.tmpdir(), "vite-cache-project-remotion")`) — resolved per-machine via `os.tmpdir()`, so
   this is a no-op on any machine without the problem.

A third issue was worked around rather than fixed in-repo, since it's purely about *this specific
machine's* tooling, not the app: `prettier --write`/`eslint --fix` fail with `EBADF` writing to
already-synced tracked files on this folder (confirmed not a sandbox/shell issue — same failure via
both Bash and PowerShell). Every actual `--write`/`--fix` change in this exercise was verified for
real against a throwaway copy of the affected files on a local, non-synced path, then applied to the
real files by hand with identical content.
