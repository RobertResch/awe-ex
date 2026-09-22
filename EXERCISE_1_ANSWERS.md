# Exercise 1 — Answers & Demo Notes

Companion to `CHANGES.md`. `CHANGES.md` says *what* changed and where; this file has the *why*, the
bug reports, and the answers to every theory question. Line numbers referencing the "original" code
mean `app.js` (untouched on disk, no longer loaded by `index.html`) — diff it against the matching
`js/*.js` file for a live before/after.

**How to run it:** `python -m http.server 8080` (or any static file server) from the project root,
then open `http://localhost:8080`. See Demo 1, Q4 for why `file://` won't work.

---

## Demo 1 — Split the app into JS modules

### Tasks — what was done

Module boundaries and the export/private decisions for every function are documented in
`CHANGES.md`. Two things worth restating here because the questions below depend on them:

- **Shared state** lives in one place: `js/state.js` exports a single `state` object (plus three
  `STORAGE_KEY_*` constants that never change). Every module that needs `allEvidence`,
  `bookmarks`, etc. imports `state` and reads/writes `state.allEvidence`, `state.bookmarks`, ...
- **Inline HTML handlers still work**: `index.html` (and HTML built as template strings inside
  `evidence.js`) call functions like `navigateTo('dashboard')`, `closeEvidenceDetail()`,
  `saveCurrentNote()` directly via `onclick="..."`. `main.js` explicitly does
  `window.navigateTo = navigateTo;` (and five more) so those attributes keep resolving.

### Questions

**Q1. Classic `<script>` vs `<script type="module">` — two behavioral differences relevant here.**

1. **Scoping & globals.** A classic script's top-level `var`/`function` declarations become
   properties of `window` — every script on the page shares one flat global namespace. A module's
   top-level declarations are private to that module by default; nothing leaks to `window` unless
   you explicitly `export` it (and the importer explicitly `import`s it) — this is *why* `main.js`
   has to do `window.navigateTo = navigateTo` for the inline `onclick` handlers to keep working;
   under the old classic-script setup, `navigateTo` was already `window.navigateTo` for free.
2. **Execution order & timing.** Classic scripts run synchronously, in document order, blocking
   HTML parsing at the point they're encountered (unless `async`/`defer`). Module scripts are
   deferred by default — they run after the document is parsed, and imports are fetched and
   resolved before the module's own top-level code runs. That's why `initApp` can safely be wired
   to `window.addEventListener("DOMContentLoaded", initApp)` without a race: by the time `main.js`
   itself executes, the whole `import` graph (11 files) has already loaded.

(A third, not required but worth knowing: modules are always strict mode; classic scripts are
sloppy mode unless you opt in with `"use strict"`. See Demo 8, Q2.)

**Q2. `allEvidence` used to be a global `var`. What has to happen now for another module to read or
change it? What error do you get if you forget, and why is that useful?**

A different module has to `import { state } from "./state.js"` and then read/write
`state.allEvidence` — a *property* of the shared `state` object, not a standalone variable. This
matters because ES module imports are **live but read-only bindings**: you can read an imported
name, and if it's an object you can mutate its *properties*, but you cannot *reassign* the imported
name itself. If `state.js` instead exported `export let allEvidence = [];` and some other module
tried `import { allEvidence } from "./state.js"; allEvidence = newData;`, Chrome throws:

```
Uncaught TypeError: Assignment to constant variable.
```

(Firefox: `TypeError: "allEvidence" is read-only`.) That error is genuinely useful, not just an
annoyance: it forces every cross-module mutation of shared state to go through an explicit,
greppable channel (a property write on an object everyone imports, or — in a stricter design — a
setter function) instead of letting *any* file silently rebind a name that a dozen other files also
hold a reference to. It converts an implicit, anywhere-anytime footgun into something the module
system itself refuses to allow by accident.

**Q3. Named export vs default export — where did you choose one, and why?**

Every export in this refactor is a **named** export (`export function foo() {}` /
`export const state = {...}`), and there isn't a single `export default` anywhere. That's the
deliberate choice, for two reasons specific to this app:

- Several modules (`evidence.js`, `timeline.js`, `workspace.js`, `people.js`) export *multiple*
  things each (e.g. `evidence.js` exports 9 different functions). A module can only have **one**
  default export, so default exports would have forced an artificial "pick one thing to be the
  main export" decision on files that genuinely have several independent, equally-important public
  functions.
- Named exports keep the imported name tied to the exported name at every call site
  (`import { renderEvidenceList } from "./evidence.js"`) — an IDE/grep can trace "who imports
  `renderEvidenceList`" reliably. A default export can be renamed freely on import
  (`import whatever from "./evidence.js"`), which is convenient for a single well-known "the thing
  this file is" (e.g. a single React component) but actively unhelpful here, where you want the
  name to travel with the function.

If I had to pick one place default export would have been *reasonable*: `main.js`, since it's a
true single-purpose entry point with nothing else meaningfully "public" about it. It isn't imported
by anything else, though (it's only loaded via `<script type="module" src="js/main.js">`), so there
was no real difference either way — I kept it named for consistency across all 11 files.

**Q4. Why won't `type="module"` scripts run at all from `file://`? Same reason as needing a server
for `fetch()`, a different one, or both?**

Both — but they're two *different* restrictions that happen to point at the same fix.

- `fetch()` fails over `file://` because `fetch` follows the Fetch spec's CORS/origin rules, and a
  `file://` URL doesn't have an HTTP origin in the way `http://localhost:8080` does — browsers
  treat local file loads as an opaque/null origin and refuse the cross-origin-shaped request (this
  app already needed a server for this reason before the refactor, per the README).
- `<script type="module">` fails over `file://` for a *separate* reason: module `import`/`export`
  resolution is itself defined to go through the same-origin fetch machinery — every `import "./x.js"`
  is, under the hood, a fetch for that module's source. Browsers additionally apply CORS
  restrictions specifically to module script loading (partly for security reasons: prevent a local
  HTML file from silently importing arbitrary local `.js` files with elevated trust), so
  `file://index.html` loading `file://js/main.js`, which then tries to `import` `state.js`, gets
  blocked at that import step even in browsers that would otherwise render the classic-script
  version of this app from disk.

Running any static file server turns both problems into normal same-origin `http://` requests, and
fixes both at once — which is why the fix looks like "one fix for two reasons."

---

## Demo 2 — Bug hunt: mutation/reference bug

### Task — reproduction, hypothesis, fix

**Repro steps** (against the *original*, unfixed code — both this bug and the Demo 3 bug below have
to be present together for this exact path):

1. Load the app fresh (hash empty, so it lands on Dashboard). Note the 5 items under "Recent
   evidence."
2. Navigate to the **Evidence** tab. Because of the Demo 3 bug (`evidenceViewLoading` never
   becomes `false`), the tab shows its loading spinner forever — but the toolbar, including the
   **Sort** dropdown, is still fully interactive underneath it.
3. Change the **Sort** dropdown (e.g. to "Title (A–Z)").
4. Navigate back to **Dashboard**.

**Expected:** the Dashboard's "Recent evidence" panel is unaffected by anything done on the
Evidence page — the two views show independent data.

**Actual (before the fix):** "Recent evidence" now shows a *different* set/order of items,
re-sorted alphabetically by title, even though nothing on the Dashboard was touched.

**Hypothesis:** `loadEvidenceData()` did `filteredEvidence = allEvidence;` — assigning the *same
array reference*, not a copy. `handleSortChange()` calls `filteredEvidence.sort(...)`, an in-place
mutation. As long as nothing has re-assigned `filteredEvidence` to a fresh array yet (which
normally happens the instant `getFilteredEvidence()` runs — but that call is unreachable while the
Demo 3 bug keeps `renderEvidenceList()` stuck on its early-return loading branch), `filteredEvidence`
*is* `allEvidence`. Sorting one sorts the other. `renderDashboard()`'s "Recent evidence" reads
`allEvidence.slice(-5).reverse()` — the *last 5 items in allEvidence's own order* — so re-sorting
`allEvidence` changes which 5 items (and in what order) show up there.

**Confirmed by:** setting a breakpoint on the `filteredEvidence.sort(...)` line inside
`handleSortChange` and inspecting, in the Scope panel, whether `filteredEvidence === allEvidence`
(they were the same object — same reference, confirmed via `===` in the console).

**Fix:** `state.filteredEvidence = state.allEvidence.slice();` — `.slice()` makes an independent
shallow copy (new array, same item objects inside it — which is fine and intentional, since editing
an evidence item's status *should* be visible everywhere that item appears).

**Verified doesn't break anything nearby:** bookmarking, filtering, and status/relevance edits in
the evidence detail view all still work, because they were never relying on `filteredEvidence` and
`allEvidence` being array-identical — only on the *item objects* inside both arrays being the same
references, which `.slice()` preserves.

### Questions

**Q1. Reference vs. copy, in your own words, and how it explains what you observed.**

A JavaScript variable holding an object or array doesn't hold the array's contents directly — it
holds a *reference*, a pointer to one array living in memory. `b = a` (no `.slice()`, no spread)
copies the *pointer*, not the array: `a` and `b` now both point at the exact same array, and a
mutation through either name (`.sort()`, `.push()`, `arr[0] = x`) is visible through the other,
because there is only ever one array. A *copy* (`b = a.slice()`) allocates a second, independent
array with the same starting contents — after that, `.sort()` on `b` never touches `a`. That's
precisely what happened here: `filteredEvidence = allEvidence` was a reference copy, so
`filteredEvidence.sort()` was, secretly, `allEvidence.sort()`.

**Q2. Walk through the exact trigger. Could you have found it by reading the code top-to-bottom
without running it? Why or why not?**

Trigger: load the app → navigate to Evidence (spinner shows, due to the co-located Demo 3 bug) →
change the Sort dropdown while the spinner is still showing → navigate to Dashboard → "Recent
evidence" has silently changed.

Reading `filteredEvidence = allEvidence;` on its own, cold, *is* a plausible thing to notice by
eye — a careful reviewer used to the reference/copy distinction should flag "this assigns the same
array, is that intended?" without running anything. What reading top-to-bottom would **not** easily
reveal is that this bug's *specific reachable symptom* depends on the interaction with a second,
unrelated bug (`evidenceViewLoading` never resetting) that keeps `getFilteredEvidence()` — the
function that normally overwrites `filteredEvidence` with a fresh array on every render — from ever
running. Confirming that this exact line is exploitable (not just "looks risky") required tracing
the actual call graph and timing across `loadEvidenceData`, `renderEvidenceList`, and
`handleSortChange`, which is exactly the kind of cross-function, timing-dependent reasoning that's
much faster to confirm by setting a breakpoint and watching it happen than by tracing call graphs
in your head.

---

## Demo 3 — Bug hunt: async/Promise-handling bug

### Task — reproduction, hypothesis, fix

**Repro steps:**

1. Load the app (any starting hash).
2. Navigate to the **Evidence** tab.

**Expected:** after `data/evidence.json` finishes loading (near-instant on localhost), the loading
spinner disappears and the evidence cards render.

**Actual (before the fix):** the spinner (`#evidenceLoadingIndicator`) never goes away, no matter
how long you wait, how many times you reload, or how you navigate. `#evidenceList` stays empty
forever.

**Hypothesis, in terms of the async operation:** `loadEvidenceData()` `fetch()`es
`data/evidence.json`. Its lifecycle has four points that matter: *before it starts*
(`evidenceViewLoading` is `true`, correctly — nothing has loaded yet), *while pending* (still `true`,
also correct), *on success* (should become `false` — the whole reason the flag exists), *on
failure* (should also become `false`, so the UI doesn't lie about still loading after an error). The
bug: nothing, anywhere in the original file, ever assigns `evidenceViewLoading = false`. Confirmed
by `grep`-ing the entire original `app.js` for `evidenceViewLoading` — it appears exactly twice: the
initial `var evidenceViewLoading = true;` declaration, and the `if (evidenceViewLoading)` check
inside `renderEvidenceList()` that returns early. `renderEvidenceList()` is therefore permanently
stuck taking its "still loading" branch, regardless of what `allEvidence` actually contains.

**Fix:** set `state.evidenceViewLoading = false;` at the point in `loadEvidenceData`'s async
lifecycle where evidence has actually finished loading — the success branch, right after
`state.allEvidence = data;` — **and** in the failure branch (`catch`), so a failed fetch doesn't
leave the UI spinning forever on top of the `alert()` that already told the user something went
wrong.

**Verified as an async-handling fix, not a cosmetic patch:** the fix sets the flag at the precise
point in the Promise's settlement (inside the `.then()`/`await`-resolved success path, and inside
`.catch()`/the `catch` block) where the underlying condition it represents ("is evidence still
loading?") actually becomes false — not via a `setTimeout`, not via polling, not via always setting
it `false` unconditionally before the fetch (which would just show empty/stale data instead of a
spinner). Confirmed by reloading with the Network tab open and matching the moment the spinner
disappears to the moment the `evidence.json` request completes.

### Question

**Q1. Answered above** — see the "Hypothesis" paragraph: the async operation is the
`fetch("data/evidence.json")` call inside `loadEvidenceData`; the bug is that its **on success**
(and **on failure**) lifecycle points never updated `evidenceViewLoading`, confirmed by grepping the
whole file for every place that variable is touched (there wasn't one) rather than guessing from the
symptom alone.

---

## Demo 4 — Bug hunt: silent bug

### Task — reproduction, console output, fix

**Repro steps:**

1. Open DevTools → Console, before touching anything.
2. Load the app.
3. Click any nav button (Dashboard / Evidence / People & Locations / Timeline / Workspace).

**Console output (before the fix):**

```
nav clicked: dashboard          ← from setupEventListeners' console.log, BEFORE the throw
Uncaught TypeError: Cannot read properties of undefined (reading 'getAttribute')
    at HTMLButtonElement.<anonymous> (main.js:...)
```

Wait — actually, on the *original*, un-refactored code the log line never printed at all: the crash
happens on the very next line, before `console.log` runs. The exact sequence is:
`navButtons[i].getAttribute("data-view")` throws immediately (line 1 of the handler body), so
`console.log("nav clicked:", targetView)` never executes. **Nothing in the UI changes** — the page
still navigates correctly, because a completely separate, working `onclick="navigateTo('dashboard')"`
HTML attribute handler on the same button fires independently and does the actual work.

**Traced to:** `setupEventListeners()`'s nav-button loop (`app.js:1038-1043`):

```js
var navButtons = document.querySelectorAll(".nav-btn");
for (var i = 0; i < navButtons.length; i++) {
  navButtons[i].addEventListener("click", function () {
    var targetView = navButtons[i].getAttribute("data-view"); // <- throws
    console.log("nav clicked:", targetView);
  });
}
```

`var i` is function-scoped, not block-scoped — there is only **one** `i` binding shared by every
closure created in the loop. By the time any button is actually clicked (well after the loop has
finished), `i` equals `navButtons.length` (5), one past the last valid index, so `navButtons[5]` is
`undefined`.

**Fix:** `for (let i = ...)` — `let` creates a fresh binding *per iteration*, so each click handler
closes over the `i` it was created with, not a shared final value.

**Confirmed clean:** after the fix, clicking every nav button repeatedly produces exactly one
`nav clicked: <view>` log per click, no errors, console stays clean.

### Question

**Q1. How did you notice this, given nothing looked broken? Why is "nothing looks broken" ≠
"nothing is broken"?**

Nothing in the *rendered page* signals this bug — navigation works, no visual glitch, no missing
data. It's only visible by having the Console tab open and clicking around, per this demo's own
instructions, and noticing an `Uncaught TypeError` firing on every single nav click. "Nothing looks
broken" only checks what a user *happens to look at* — the UI's happy path. It says nothing about:
whether errors are being silently caught/ignored elsewhere, whether a *different* code path that
currently coincidentally works (here, the inline `onclick`) is masking a broken one that a future
refactor might remove, whether the error is filling up error-tracking/monitoring in production, or
whether a *slightly* different user action would hit the broken path without the safety net. A
codebase this size having zero uncaught exceptions during normal use is a real, checkable bar —
"the UI looked fine" is not the same claim.

---

## Demo 5 — Bug hunt: full walkthrough & reflection

### Task — full bug list (beyond Demos 2–4)

Each entry: repro → expected vs. actual → root cause → fix → verification.

**Bug A — Sort dropdown has no effect.**
*Repro:* Evidence tab (with the Demo 3 fix applied so it actually renders) → pick any "Sort" option.
*Expected:* list re-orders. *Actual:* list order never changes, regardless of selection.
*Root cause:* `handleSortChange()` sorted `filteredEvidence` in place, then called
`renderEvidenceList()`, which calls `getFilteredEvidence()` — which **always** rebuilds `results`
by looping over `allEvidence` in its original order and reassigning `filteredEvidence` to that new,
unsorted array. The just-applied sort is discarded on every single render.
*Fix:* moved sorting inside `getFilteredEvidence()` itself, reading `#sortEvidence`'s value the same
way every other filter control is already read from the DOM, so every render (filter- or
sort-triggered) applies the current sort exactly once, last.
*Verified:* picked each of the 4 sort options in turn and confirmed the list order actually changes
each time, and stays changed after using an unrelated filter.

**Bug B — Timeline shows "Location: [object Object]".**
*Repro:* Timeline tab, any event whose location resolves via `findLocationById`.
*Expected:* `"Location: L02 - Calibration Bay"`. *Actual:* `"Location: [object Object]"`.
*Root cause:* `eventLocationNames.push(evtLoc || item.locationIds[el]);` pushed the location
**object** itself, not a display string; `Array.prototype.join()` calls `.toString()` on each item,
and the default `Object.prototype.toString()` is `"[object Object]"`.
*Fix:* `eventLocationNames.push(evtLoc ? evtLoc.id + " - " + evtLoc.name : item.locationIds[el]);`
*Verified:* every timeline event's location line now shows a real place name; unresolvable location
IDs still fall back to the raw ID, unchanged from before.

**Bug C — Corrupting `remotion_notes` in DevTools breaks the entire app.**
*Repro:* Application → Local Storage, set `remotion_notes` to `not json`, reload.
*Expected:* the app should at worst ignore the corrupt notes and start with an empty note store —
nothing else should be affected. *Actual:* the entire app appears dead: no data loads, no filters
work, only the nav buttons' inline `onclick` still functions.
*Root cause:* `loadNotesFromStorage()` did a bare `JSON.parse(raw)` with no `try/catch` (unlike its
neighbor `loadBookmarksFromStorage`, which does have one). It's called from `initApp()` *before*
`setupEventListeners()` and `loadAllData()`; the uncaught `SyntaxError` aborts `initApp()` entirely,
so neither of those ever runs.
*Fix:* wrapped in `try/catch`, falling back to `{}` on failure and logging a `console.warn`.
*Verified:* repeated the corrupt-value repro after the fix — console shows one warning, the rest of
`initApp()` (listeners, data load) proceeds normally, notes just start empty.

**Bug D — Corrupting `remotion_hypothesis` breaks the Workspace tab.**
Same class of bug as C, narrower scope (`loadHypothesisFromStorage`, only called from
`renderWorkspace()`). Same fix pattern (`try/catch`, `console.warn`, bail out of that function only).
*Verified:* corrupt value + reload → Workspace tab still renders bookmarks/notes; the hypothesis
form just starts blank instead of throwing.

**Bug E — Quick-view modal accumulates click listeners.**
*Repro:* Timeline tab, open the quick-view modal (click "View E0x") 3 times in a row, watch the
console.
*Expected:* opening/closing the modal repeatedly has no growing side effect.
*Actual (original code):* `console.log("modal opened, active close listeners:", modalCloseListenerCount)`
counts up (1, 2, 3, ...) — a real, growing listener leak, since a new click listener was attached to
the persistent modal `<div>` on every open and never removed.
*Root cause:* the `modal.addEventListener("click", ...)` call sat outside the
`if (!modal) { modal = document.createElement(...) }` guard, so it ran on every call, not just when
the element was first created.
*Fix:* moved the listener registration inside the "just created" branch (event delegation on the
persistent element still handles all future content via `e.target` checks, so one listener is
enough forever). Removed the now-unneeded `modalCloseListenerCount` diagnostic counter from
`state.js`.
*Verified:* opened the modal 5 times, then clicked "Open full evidence" once — `openEvidenceDetail`
now runs exactly once (previously it would have run once per prior open, redundantly).

**Bug F — `filterStatus` double-bound.**
Fixed alongside the Demo 8 code-smell cleanup — see `CHANGES.md`. Cosmetic (double render), not
user-visible, but real duplication.

**Bug G — Duplicate `hashchange` registration.**
Also fixed alongside Demo 8 — see `CHANGES.md`.

**Bug H — `loadNoteAsync("E01")`'s result logged as a pending Promise, not the note text.**
*Repro:* Console tab, reload the app, watch the very first console lines after data loads.
*Expected:* `First note preview: <the note text, or "">`.
*Actual:* `First note preview: Promise {<fulfilled>: ''}` (a Promise object, not a string).
*Root cause:* `loadNoteAsync()` returns a `Promise`; the original code did
`var firstNote = loadNoteAsync("E01"); console.log(..., firstNote);` — never unwrapping it.
*Fix:* deferred to Demo 9 (see that section) — converted to `const firstNote = await loadNoteAsync("E01");`.
*Verified:* console now logs the actual (empty, by default) string.

### Chosen bug to present live: **Bug A / Demo 2's aliasing bug** (either works from the pre-fix
snapshot of `app.js`, still on disk, unmodified, for exactly this purpose)

### Questions

**Q1.** For the chosen bug (Demo 2's reference bug), the live walkthrough is exactly the repro steps
written under Demo 2 above, run against the **original, unmodified `app.js`** (still on disk, no
longer wired up in `index.html` — swap the `<script>` tag back to `<script src="app.js">` for the
live demo, or open it in a second copy of `index.html`) to show the broken behavior, then swap to
`js/main.js` to show the fix.

**Q2. Did fixing one bug ever change/reveal/accidentally fix another? Or how did you confirm they
were isolated?**

Yes, directly — Demos 2 and 3 are entangled by design (or by accident, at the original author's
level, but the entanglement is real either way): the Demo 2 aliasing bug (`filteredEvidence =
allEvidence`) is only *reachable* through the sort dropdown while the Evidence tab is stuck on the
Demo 3 loading-spinner bug (`evidenceViewLoading` never `false`), because fixing Demo 3 makes
`renderEvidenceList()` reach `getFilteredEvidence()` on the very first render of the Evidence tab —
which immediately reassigns `filteredEvidence` to a fresh array, closing the window in which the
Demo 2 bug could ever bite. **Fixing Demo 3 first would have made the Demo 2 bug's specific
reachable symptom (sort-while-loading reordering the Dashboard) disappear**, even though the
underlying bad line (`filteredEvidence = allEvidence`, a reference instead of a copy) would still
be sitting there, technically still wrong, just no longer exploitable via that particular path. That
is exactly why I fixed Demo 2 *before* Demo 3 in this write-up/commit order — so its "before" state
(both bugs present) stays reproducible independent of fix order. For every other pair of bugs in the
list (B through H), I confirmed isolation the practical way: after each fix, I re-ran the repro steps
for every *previously* fixed bug and confirmed none of their symptoms changed.

---

## Demo 6 — Use the JavaScript debugger

This demo is inherently something you do live, in your own DevTools, not something written code can
demonstrate for you. What follows is a precise runbook — exact functions, exact lines, exact values
to expect — built from the actual bugs above, so you can walk through it directly in class instead
of improvising a target on the spot.

### Runbook (do this against a running copy of the app, `js/timeline.js` and `js/dataLoader.js` are
the most useful files for this)

1. **Real breakpoint, step line by line.** Open `js/timeline.js` in Sources, click the line number
   next to `const evtLoc = findLocationById(item.locationIds[el], state.allLocations);` inside
   `renderTimeline` (around line 68) to set a breakpoint. Reload, navigate to the Timeline tab.
   Execution pauses there. Use **Step over** repeatedly to advance through the loop body without
   diving into `findLocationById`; use **Step into** once on the `findLocationById(...)` call itself
   to walk through its internal `for` loop in `utils.js`; once inside, use **Step out** to return
   immediately to `renderTimeline` without single-stepping the rest of that helper.
   - *Wrong-choice example (for the Q1 answer below):* Step **into** `formatDate(item.time)` a few
     lines above — you'll walk through `new Date(ts)`, `isNaN()`, two `toLocale*String` calls — none
     of which matter for understanding *this* bug (the location-name one), so stepping over it
     instead saves real time.
2. **Call Stack, "who called this and with what."** While paused inside `findLocationById` (from
   step 1's Step Into), open the Call Stack panel. Bottom-to-top you'll see roughly:
   `(anonymous)` → `handleHashChange` (router.js) → the `click`/`hashchange` event dispatch → and
   `findLocationById` at the top (current frame). Click the `renderTimeline` frame in the stack to
   jump to its local scope and inspect `item` — this is how you'd answer "who called
   `findLocationById`, and with what `id`" for a real bug, instead of guessing.
3. **Conditional breakpoint / logpoint.** Right-click the line number on
   `for (let el = 0; el < item.locationIds.length; el++) {` in `renderTimeline` → **Add conditional
   breakpoint** → condition `item.id === "T03"` (or whichever timeline event ID you want to isolate)
   → reload and navigate to Timeline again. Execution now only pauses for that one event, instead of
   every iteration of every event's location loop. (A logpoint on the same line,
   e.g. `{item.id, el}`, prints without pausing at all — useful once you already trust the fix and
   just want to confirm behavior across every event without breaking the flow.)
4. **Scope/Watch panel, track a value, edit it live.** With the Demo 5 "Bug B" fix in place (already
   applied — see above), pause on the `eventLocationNames.push(...)` line. Add `evtLoc` to the Watch
   panel. Step through a few iterations and watch it change from one location object to `null`
   (for an unresolvable ID) to another object. **Before writing the fix**, this is exactly how you'd
   test the hypothesis live: right-click `evtLoc` in Scope → **Edit value** → type
   `evtLoc.name` was NOT what got pushed originally; you can literally overwrite the
   `eventLocationNames.push(...)` line's effect by editing `evtLoc` in the console
   (`evtLoc.toString = () => evtLoc.name` as a scratch experiment) to confirm your hypothesis about
   why `[object Object]` was appearing, before committing to the real code fix.

### Questions

**Q1. Step over vs. Step into — concrete example where the wrong one wastes time.**

**Step over** runs the current line (including any function calls on it) to completion without
following execution *into* those calls; **Step into** follows execution into the first function
call on the current line, stepping through its internals one line at a time. Using Step Into on
`formatDate(item.time)` inside `renderTimeline` (see runbook step 1) when you're actually
investigating the location-name bug wastes time: you'd walk through `new Date()`, `isNaN()`, and two
locale-formatting calls that have nothing to do with the bug you're chasing, then have to manually
Step Out to get back to where you actually wanted to be. Step Over on that same line runs
`formatDate` to completion in one action and leaves you exactly where you want to keep working.

**Q2. What is the call stack, and how did it help?**

The call stack is the ordered list of function invocations currently "in progress" — the function
you're paused in at the top, the function that called it below that, the function that called *that*
below that, and so on down to the event/timer/module-load that started the whole chain. Reading it
(runbook step 2) answered exactly "who called `findLocationById`, and with what `id`": one frame
down was `renderTimeline`, and clicking that frame let me inspect its local `item` variable to see
the exact timeline event object being rendered at that moment — information you cannot get just by
looking at `findLocationById`'s own source, since it has no idea who its caller is.

**Q3. What is a conditional breakpoint, and why is it more efficient than repeatedly hitting
Resume?**

A conditional breakpoint only pauses execution when a JS expression you supply evaluates truthy —
everything else about it behaves like a normal breakpoint. Without one, isolating "the iteration
where `item.id === 'T03'`" inside a loop that runs for every timeline event means hitting Resume
once per event you don't care about, hoping you don't lose count or accidentally resume past the one
you wanted. With the condition set, the debugger silently runs through every uninteresting iteration
on its own and only actually stops execution at the one you specified — zero wasted Resume clicks,
and it works even if you don't know in advance which iteration number the interesting case will be.

**Q4. DevTools-set breakpoint vs. a `debugger;` statement in source — when would you prefer one?**

A DevTools breakpoint lives in the browser's session state, set by clicking a line number; it
survives a page reload (DevTools remembers breakpoints per source file/URL) but is **not** part of
the codebase — nobody else on the team sees it, and it's gone if you clear browser data or switch
machines. A `debugger;` statement is a literal line of code, committed like any other line: every
developer who runs that code path in DevTools-open conditions pauses there automatically, with no
per-machine setup. Prefer a UI breakpoint for your own ad-hoc, temporary investigation (like
everything in this runbook) — you don't want stray `debugger;` statements surviving into a commit.
Prefer a committed `debugger;` for a genuinely hard-to-reach, rarely-triggered condition a teammate
will need to stop at too (e.g. `if (someRareEdgeCase) debugger;` guarding a conditional you can't
easily express as a DevTools breakpoint condition, or reliably reproduce without domain context) —
though even then, remove it before merging unless the team has explicitly agreed to leave
instrumentation in.

**Q5. A moment `console.log` alone would not have been enough, but stepping through was.**

Diagnosing the Demo 2 mutation bug is the clearest case: a `console.log(filteredEvidence)` right
after `filteredEvidence = allEvidence;` would print an array that *looks* completely normal — same
contents, same order, nothing visually "wrong" about the logged value at that moment, because the
bug isn't about what the array contains, it's about whether two names point at the *same* array
object. `console.log` alone can't distinguish "two variables holding equal-looking arrays" from "two
variables holding the exact same array" without extra, purpose-built comparison code
(`console.log(filteredEvidence === allEvidence)`, which you'd have to already suspect to write).
Stepping through with a breakpoint on the `.sort()` call and inspecting both names side-by-side in
the Scope panel — or just typing `filteredEvidence === allEvidence` directly into the paused-context
console — showed the identity relationship immediately and unambiguously, which is exactly what a
plain logged value can't show on its own.

---

## Demo 7 — DevTools tour: Console, Network, Application, Elements

### Runbook

- **Console:** use the log-level dropdown (top-left of the Console panel) to filter to "Errors" only,
  reproduce the Demo 4 bug (click a nav button, pre-fix) and confirm exactly one
  `Uncaught TypeError` line survives the filter; switch to "Warnings" and reproduce Bug C/D from
  Demo 5 (corrupt `localStorage` + reload) to see the `console.warn` lines. Use the text filter box
  to search `nav clicked` and confirm only that string's log lines remain visible regardless of
  level filter. Toggle **Preserve log**, then trigger `navigateTo(...)` (which changes
  `window.location.hash` but does **not** reload the page) — with Preserve log off, older entries
  would normally survive anyway since this is a hash change, not a navigation; Preserve log actually
  matters when you *do* a full reload (e.g. testing the corrupt-localStorage repro) and want to keep
  seeing the console output from *before* the reload for comparison against what appears after.
- **Network:** reload with Network open, filter type to "Fetch/XHR". You'll see 5 requests, in this
  order: `case.json`, `people.json`, `locations.json` (these three strictly sequential, per Demo 9's
  nested-chain conversion), then `evidence.json` and `timeline.json` fired back-to-back right after
  (not awaited by `loadAllData`, so they overlap each other and the render of the first three).
  Click `evidence.json`: **Status** `200`, **Type** `fetch`, **Time** the actual round-trip
  (near-instant on localhost); the **Response** tab shows the raw JSON array from
  `data/evidence.json`. Throttle to "Slow 3G" (Network panel dropdown) and reload — see the Q4
  answer below for what to expect.
- **Application → Local Storage:** three keys — see Q3 below for what each holds. Edit
  `remotion_bookmarks`'s value directly in the panel (e.g. add an evidence ID that doesn't exist,
  `["E99"]`), reload, and confirm the app doesn't crash (the bookmark star just never matches
  anything, harmlessly). Then replace `remotion_notes`'s value with `not valid json` and reload —
  before the Demo 5 fix, the whole app dies; after the fix, one `console.warn` and everything else
  still works.
- **Elements:** open the Evidence tab, inspect a rendered `.evidence-card` `<div>`. Its
  `data-id="E01"` attribute traces directly back to
  `'<div class="evidence-card" data-id="' + ev.id + '">'` in `renderEvidenceCardHTML` (`evidence.js`);
  the bookmark `<button data-action="bookmark" data-id="...">` traces to the same function, and its
  `data-action`/`data-id` attributes are exactly what `handleEvidenceListClick`'s event-delegation
  logic reads back out (`target.dataset.action`, `target.dataset.id`) to decide what was clicked.

### Questions

**Q1. `console.log` vs. `console.warn` vs. `console.error` — beyond the color.**

All three print a value to the console with the same formatting/inspection capabilities (objects are
expandable, `%s`/`%d` substitutions work the same, etc.) — the practical differences: `console.warn`
and `console.error` both capture and display a **stack trace** by default (which line called this,
and from where), while `console.log` does not; the DevTools log-level filter (used in the runbook
above) lets you hide/show each category independently, so a codebase that uses the right level
consistently lets you filter straight to "show me only the things that are actually broken"
(`console.error`) without wading through informational logs; and `console.error` calls are what
error-monitoring tools (Sentry and similar) typically hook into by default, so which one you choose
has real downstream consequences beyond the local dev console.

**Q2. Network tab — Status/Type/Time for a `fetch()`; how would the app react to a 404?**

**Status** is the HTTP response code (`200` for every request in this app's happy path — all 5 JSON
files exist under `data/`). **Type** identifies what kind of request it was and how the browser
classifies it (`fetch` here, vs. `document`/`stylesheet`/`img` for other resource types) — useful
for filtering out noise when you only care about your app's own data calls. **Time** is the
request's total round-trip duration, breakable down further (DNS/connect/TTFB/download) by hovering
the waterfall bar. **If `evidence.json` returned 404 instead of 200:** `fetch()` itself would still
*resolve* successfully (a 404 is a valid HTTP response, not a network failure) — `res.ok` would be
`false`, but the code never checks `res.ok`. `res.json()` would then try to parse whatever body the
404 response has (likely an HTML error page from the file server, not JSON) — that would throw a
`SyntaxError` inside `.json()`'s own parsing, which **is** caught by `loadEvidenceData`'s
`try/catch`/`.catch()`: it logs `console.error`, shows the `alert()`, and (post Demo 3 fix) resets
`evidenceViewLoading` to `false` so the Evidence tab shows its empty/no-results state instead of
spinning forever. So the app degrades reasonably here, but only because a *different* class of error
(JSON parse failure) happens to route through the same catch block as a genuine network failure —
it never actually inspects the status code to react to it specifically.

**Q3. This app's `localStorage` keys, what each is for, and what happens if you corrupt one.**

- `remotion_bookmarks` — a JSON array of bookmarked evidence IDs (e.g. `["E01","E05"]`). Read by
  `loadBookmarksFromStorage()`, which **already** has a `try/catch` in the original code: corrupting
  this key and reloading just logs a `console.warn` and starts with an empty bookmark list — no
  crash, by design.
- `remotion_notes` — a JSON object mapping evidence ID → note text (e.g. `{"E01":"check this"}`).
  Read by `loadNotesFromStorage()`. Before the Demo 5 fix: corrupting this key crashed `initApp()`
  entirely (see Demo 5, Bug C) because the original had no `try/catch` here, unlike its bookmarks
  sibling. After the fix: same graceful `console.warn` + empty-object fallback as bookmarks.
- `remotion_hypothesis` — a single JSON object holding the whole hypothesis draft form (suspect,
  nature, selected evidence IDs, confidence, explanation, alternative, timestamp). Read by
  `loadHypothesisFromStorage()`, called every time the Workspace tab renders. Before the fix:
  corrupting it broke that one function's execution (Workspace tab renders its bookmarks/notes
  columns fine, but the hypothesis form fields never populate, and a `SyntaxError` is logged). After
  the fix: `console.warn` + the function returns early, form just stays blank.

**Q4. Throttled network — what populated first/last/briefly-wrong, and why does order matter?**

Under "Slow 3G," the loading overlay ("Loading case file…") stays visible noticeably longer, since
`showLoadingOverlay` shows it immediately and `hideLoadingStep()` only hides it once both
`loadingStepsRemaining` decrements reach zero (once from `loadCorePeopleAndLocations` finishing, once
from `loadTimelineData`'s `finally`). Because `case.json` → `people.json` → `locations.json` are
strictly sequential (by design — see Demo 9), the Dashboard's case-summary card and person/location
counts appear only after all three of those round trips complete, one after another — under
throttling this stretches out visibly rather than feeling instant. Meanwhile `evidence.json` and
`timeline.json` are fired without being awaited by `loadAllData`, so they load *concurrently* with
each other and with whatever renders after the core three finish — under throttling you can actually
see the Dashboard's stat grid render with `0` evidence/timeline counts first (built from whatever
`state.allEvidence`/`state.allTimeline` happen to be at that exact millisecond), then re-render a
moment later once those two additional fetches land and call `renderDashboard()` again. Order
matters here because it's the direct, visible consequence of exactly which requests are awaited vs.
fired-and-forgotten in `dataLoader.js` — throttling doesn't create a new bug, it just stretches the
existing "case/people/locations block the UI, evidence/timeline race in afterward" behavior out
long enough to *see* with your own eyes instead of it resolving within a single frame.

---

## Demo 8 — Clean coding: globals, `var`/`let`/`const`, code smells

### Task — every top-level `var` in the original `app.js`

```
var allEvidence = [];              var allPeople = [];
var filteredEvidence = [];         var allLocations = [];
var selectedEvidence = null;       var allTimeline = [];
var bookmarks = [];                var caseData = {};
var currentPage = "dashboard";     var currentPeopleTab = "people";
                                    var loadingStepsRemaining = 2;
var evidenceViewLoading = true;    var notesStore = {};
var viewRendered = {...};          var modalCloseListenerCount = 0;
var STORAGE_KEY_BOOKMARKS = ...;   var latestSearchRequestId = 0;   (declared later, line 498)
var STORAGE_KEY_NOTES = ...;
var STORAGE_KEY_HYPOTHESIS = ...;
```

18 top-level `var`s. Three, and what "two unrelated pieces of code sharing that name" would risk:

- **`allEvidence`** — every render function, every filter, every bookmark toggle reads or writes
  this. If two unrelated features both needed "the current list of evidence-like things" (say, a
  future "related cases" feature also wanted a variable named `allEvidence` for its own, differently
  -shaped data), in one flat global scope the second declaration doesn't create a second variable —
  it's the *same* `var allEvidence`, silently overwritten. Every existing reader of `allEvidence`
  would start seeing the wrong data, with no error anywhere.
- **`currentPage`** — read by `renderDashboard`? No — but read by `handleBookmarkClick`,
  `renderEvidenceDetail`'s change listeners, `loadEvidenceData`, `loadTimelineData`, `handleHashChange`
  itself. A second feature (e.g. a modal system) reusing the generic name `currentPage` for "which
  page a paginated list is on" would corrupt the router's notion of which view is active, causing
  wrong-view renders after data loads.
- **`loadingStepsRemaining`** — a plain counter. Two independent async flows both decrementing a
  variable named `loadingStepsRemaining` for their *own* step-counting purposes would corrupt each
  other's count, causing the loading overlay to hide too early (data still loading) or never (count
  never reaches zero).

**Does the Demo 1 module split already prevent this?** Yes, entirely, for anything that stayed in
`state.js`'s `state` object plus module-private variables: `state.allEvidence` cannot collide with
an unrelated `allEvidence` declared inside, say, `dashboard.js`, because `dashboard.js`'s own
top-level `const`/`let` declarations are private to that module's scope — there is no shared global
namespace for them to collide in anymore. It does **not** prevent collisions *within* the `state`
object itself (two different features both trying to use the property name `state.currentPage` for
different things would still collide, the same way two properties of any one object always would) —
the module split solves cross-module namespace collisions, not "everyone who imports `state` has to
agree on what each of its properties means," which is a design-discipline problem, not something the
module system enforces for you.

### Task — the sweep

Done — see `CHANGES.md` Demo 8, and the final `grep -rn "\bvar\s" js/` check confirming zero
remaining `var` declarations (only two hits, both inside explanatory *comments* referencing `var` by
name).

### Task — two more code smells (beyond the globals)

1. **`filterStatus` bound to `change` twice** (`main.js`) — the exact same listener
   (`renderEvidenceList`) registered via both `addEventListener` and a redundant
   `setAttribute("onchange", "renderEvidenceList()")` right next to it. Bad because: it's silent
   duplicate work (every Status filter change re-renders the list twice), and it's exactly the kind
   of thing that looks like it *might* be intentional (maybe someone meant the two handlers to do
   different things and never finished the second one?) until you actually trace both and confirm
   they're identical — wasted reviewer time either way. Fixed by removing the redundant line.
2. **`handleHashChange` registered as a `"hashchange"` listener twice** (`main.js`) — once inside
   `setupEventListeners()`, once again at the very bottom of the file. Same category of bug: every
   navigation runs the whole render-and-highlight routine twice, harmlessly but wastefully, and
   reads like a second, differently-scoped listener might have been intended. Fixed by removing the
   duplicate registration at the bottom of the file.

(Bugs A through E from Demo 5 are arguably code smells too, but I'm counting them under Demo 5's
bug-hunt requirement rather than double-counting them here.)

### Questions

**Q1. `var` vs. `let` vs. `const` — scope, reassignment, and a concrete `var`-enabled bug.**

`var` is function-scoped (or global-scoped at the top level) and hoisted with an initial value of
`undefined` — it's visible and reassignable throughout the entire enclosing function regardless of
which block it's declared in, and re-declaring the same name in the same scope is not even an error.
`let` and `const` are block-scoped — confined to the nearest `{ ... }` — and hoisted into a
"temporal dead zone" where accessing them before their declaration line throws, rather than
silently giving `undefined`. `let` allows reassignment after declaration; `const` does not allow
*rebinding* the name (though, as covered in Demo 1 Q2 and used throughout this refactor, an object
or array bound with `const` can still have its contents mutated). The Demo 4 bug in this exact
codebase is the textbook example: `for (var i = ...) { el.addEventListener("click", function () {
use(i) }) }` — every closure created in the loop shares the one function-scoped `i`, so by the time
any of them actually runs, `i` holds whatever value the loop finished on. `let` in the same position
gives each iteration its own fresh binding, so each closure captures the `i` it was created with —
which is exactly the fix applied in `main.js`.

**Q2. Accidental globals — how non-strict mode allows them, and what changes under ES modules
(always strict).**

In non-strict-mode JS, assigning to a name that was never declared with `var`/`let`/`const`
(`total = 5;` instead of `let total = 5;`) doesn't throw — it silently creates a new property on the
global object (`window.total = 5` in a browser), because the language falls back to treating the
bare assignment as an implicit global. This is exactly the kind of typo (forgetting the keyword)
that's easy to make and easy to miss, since nothing about it looks wrong until something else,
possibly far away, reads `window.total` and gets a surprising value. ES modules are **always**
strict mode, with no opt-in required — the same mistake (`total = 5;` with no declaration) throws
`Uncaught ReferenceError: total is not defined` immediately, at the point of the typo, instead of
quietly fabricating a global. That is a strictly better outcome: a loud, immediate, precisely
-located error instead of a silent one that surfaces somewhere else entirely, if it surfaces at all.

**Q3. "Works" vs. "clean" — a concrete example and its real cost.**

`getFilteredEvidence()` (pre–Demo 5 fix) worked completely correctly for filtering — search, type,
person, location, status, and relevance filters all behaved exactly as intended. It just also
happened to silently discard the currently-selected sort order on every call, because sorting lived
in a *different* function that assumed (wrongly) it was the last word on `filteredEvidence`'s order.
Nothing about the filtering logic itself was broken — the bug was purely an emergent property of two
correct-in-isolation functions not agreeing on which one owns "the final order of the rendered
list." The real cost of leaving code like that as-is: **bug risk** (any future change to either
function has to somehow rediscover, by trial and error, that render order depends on interaction
between two files instead of being owned in one obvious place); **onboarding time** (a new team
member reading `handleSortChange` reasonably assumes it works, since the code inside it is entirely
correct sort logic — they'd have to already know to go looking in `getFilteredEvidence` to discover
why sorting silently does nothing); **review difficulty** (a code reviewer looking at either function
in isolation, in a typical small diff, would have no reason to suspect the other one exists or
matters). Consolidating the sort logic into the one function that's guaranteed to run last removes
all three costs at once, without changing what the feature does for a user who was never filtering
*and* sorting felt broken - it just also silently fails to do the one thing the control promises.

---

## Demo 9 — Refactor nested Promises to `async`/`await`

### Task — the shape, before touching it

`loadCorePeopleAndLocations()` (`app.js:56-78`) was **6 levels of nested `.then()`**:

```
fetch(case.json)
  .then(caseRes =>
    caseRes.json()
      .then(caseJson => {
        ...
        fetch(people.json)
          .then(peopleRes =>
            peopleRes.json()
              .then(peopleJson => {
                ...
                fetch(locations.json)
                  .then(locationsRes =>
                    locationsRes.json()
                      .then(locationsJson => { ... }))}))}))
```

Three fetches, each one's *entire chain* (both the network round trip and the `.json()` body parse)
gated behind the previous one's entire chain finishing — `people.json` is not even *requested* until
`case.json`'s body has been fully parsed, and likewise for `locations.json` after `people.json`.
Strictly sequential, one request in flight at a time, by design (the exercise explicitly says this
concurrency question is out of scope for this pass).

### Task — the rewrite, same behavior

Done — see `dataLoader.js` and `CHANGES.md`. `loadCorePeopleAndLocations` is now a flat sequence of
6 `await` statements (3× `await fetch(...)` + `await res.json()`), same strict one-after-another
ordering preserved exactly (each `fetch()` line still doesn't execute until the previous `await`
line above it has resolved).

### Task — at least one more `.then()`/`.catch()`/`.finally()` conversion, error handling intact

Converted **two** more: `loadEvidenceData` (`.then()/.then()/.catch()` → `try { await; await; }
catch { ... }`, same `console.error` + `alert()` + `evidenceViewLoading = false` fallback preserved)
and `loadTimelineData` (`.then()/.then()/.catch()/.finally()` → `try/catch/finally`, `finally` block
still always calls `hideLoadingStep()` regardless of success or failure, exactly as
`.finally()` did). Also converted `loadAllData` itself and `main.js`'s `initApp`.

### Task — verify order of operations unchanged, with the debugger

Runbook: set a breakpoint on the first line of `loadCorePeopleAndLocations`
(`const caseRes = await fetch("data/case.json");`), reload, and with the Call Stack panel open, use
Step Over repeatedly. You should see, in order: the `case.json` line completes, `caseJson` gets
assigned, `state.caseData` gets set, *then* (and only then) the `people.json` line begins — never
before. Confirm the Network panel shows `case.json`'s request completing before `people.json`'s
request even starts (no overlap in the waterfall), matching the original nested-`.then()` version's
behavior exactly.

### Questions

**Q1. Why is the nested chain harder to reason about, even though it runs identically?**

Reading the nested version top-to-bottom requires holding an ever-growing stack of "we're inside the
success callback of X, which is inside the success callback of Y, which is inside..." in your head,
with the actual "what happens after this" logic buried at increasing indentation and each new step
requiring you to re-locate where its own `return` statement is to know whether it's actually chained
into the rest or accidentally orphaned (a classic source of real bugs: forgetting a `return` before
a nested `fetch(...).then(...)` silently breaks the chain). The `async`/`await` version reads as a
flat, ordered list of steps — "do this, then this, then this" — matching how you'd narrate the
sequence out loud, with no indentation growth per step and no risk of a missing `return` breaking
the chain (there's nothing to return; `await` just blocks the next line until the previous one
settles).

**Q2. What does `await` actually do to the `async` function's execution? What is the rest of the
program doing meanwhile?**

`await someExpr` suspends the enclosing `async` function's execution at that exact point, returning
control to the caller (and up the call stack, ultimately back to the browser's event loop)
immediately — it does **not** block the thread. The `async` function's remaining code is scheduled
to resume, from that exact point, only once `someExpr`'s Promise settles (fulfills or rejects), as a
microtask. Meanwhile, the rest of the program — the browser's rendering, other event listeners,
other timers, other in-flight fetches — keeps running completely normally on the same single thread;
nothing else is paused, because nothing about `await` blocks anything except the one `async`
function's own continuation.

**Q3. `async` functions always return a Promise. Prove it: what do you get calling `.then()` and
logging it?**

`loadCorePeopleAndLocations()` doesn't `return` anything explicitly (its last statement is
`populateAllDropdowns();`), yet `loadCorePeopleAndLocations().then(result => console.log(result))`
logs `undefined` — because the function's implicit return value (`undefined`, since there's no
explicit `return`) still gets wrapped in a fulfilled Promise automatically, exactly as if you'd
written `return Promise.resolve(undefined)`. `loadAllData()` demonstrates the same thing with a
function whose body is nothing *but* `await`s and calls with no `return`:
`loadAllData().then(r => console.log(r))` also logs `undefined`. The `.then()` call itself only
works at all — you can't call `.then()` on a plain value — because both functions genuinely return
Promise objects, not the values their bodies compute.

**Q4. `async`/`await`'s equivalent of `.catch()`? What happens if you forget it and the `await`ed
operation rejects?**

A `try { await ...; } catch (err) { ... }` block. If you omit it and the awaited Promise rejects, the
`await` expression **throws** that rejection value as a normal JavaScript exception inside the
`async` function — which, if nothing else catches it, propagates out and causes the `async`
function's own returned Promise to reject. If *that* rejection also has no `.catch()`/`try` anywhere
up its chain, it surfaces as an **unhandled promise rejection** — logged to the console
(`Uncaught (in promise) TypeError: Failed to fetch`, for example) rather than crashing the page, but
silently skipping the rest of that function's code from the failure point onward, exactly the way a
thrown, uncaught exception skips the rest of a synchronous function.

**Q5. Is `async`/`await` code faster? What precisely does and doesn't change?**

No — this refactor changes **zero** runtime behavior around timing or performance. `async`/`await`
is syntax sugar over the exact same Promise machinery `.then()` chains use underneath; the V8/engine
scheduling, the microtask queue, the number of network round trips, and their sequencing are
identical before and after. What changes is purely how the *source code* is written and read — the
same six network-and-parse steps happen in the same order, taking the same wall-clock time, whether
expressed as nested `.then()` callbacks or flat `await` statements.

**Q6. Deliberately remove one `await` you added — what breaks, and how does it relate to Demos
2–5?**

Removing `await` from `const caseJson = await caseRes.json();` (leaving the function still `async`)
makes `caseJson` hold the **Promise** returned by `caseRes.json()`, not the parsed data — the very
next line, `state.caseData = caseJson;`, then assigns that unresolved Promise object directly into
`state.caseData`. Every place that reads `state.caseData.title`/`state.caseData.summary`/etc. (the
Dashboard's case-summary card) would then be reading properties off a Promise object instead of the
actual case data — `undefined` for all of them, with no error thrown anywhere, since accessing a
nonexistent property on an object just silently gives `undefined`. This is *exactly* the same bug
pattern documented in Demo 5, Bug H (`loadNoteAsync("E01")`'s result logged as a pending Promise
instead of the resolved note text) — a Promise being read from and used as if it were already the
settled value it will only eventually become. Both are the direct, mechanical consequence of the
same mistake: treating an unresolved Promise as if `await`ing it (or `.then()`-ing it) were optional
rather than the entire point.

---

## Demo 10 — Refactor to arrow functions

### Tasks

Done — see `CHANGES.md` for the full list (`utils.js`'s 8 functions, `statCardHTML`,
`certaintyBadgeClass`, `openEvidenceModal`, `countEvidenceForPerson`, `simulateAsyncSearch`,
`statusOptionHTML`, plus every genuinely-anonymous inline callback across the codebase).

**The one function deliberately not converted:** `clearFilters` (`evidence.js`) — and, for the same
reason, `renderEvidenceList`, `renderTimeline`, `handleSearchInput`, and `handleEvidenceListClick`
alongside it. All five are passed **bare** (unwrapped) to `addEventListener` in `main.js`/`evidence.js`
(e.g. `document.getElementById("clearFiltersBtn").addEventListener("click", clearFilters);`) rather
than wrapped in an anonymous function. A regular function used as a directly-referenced DOM event
listener receives `this === event.currentTarget` per the DOM spec; an arrow function used the same
way would **silently** lose that (arrows always use the `this` of their enclosing lexical scope —
here, `undefined`, since ES modules are strict mode) rather than throwing an error you'd notice.
None of these five functions currently read `this`, so converting them wouldn't break anything
*today* — but it would permanently and invisibly foreclose a capability any future edit to any of
them might reasonably reach for (e.g. `this.classList.add("active")` inside `clearFilters` to
visually flag the button that was clicked), and it's exactly the kind of arrow-function conversion
experienced JS developers specifically watch for and avoid, precisely because it looks like a
harmless style change.

### Questions

**Q1. Arrow functions and `this` — why risky as methods, often good as callbacks?**

A regular function's `this` is determined **by how it's called** (as a bare call, as a method on an
object, via `.call()`/`.apply()`, as a DOM event listener, as a constructor with `new`) — it's
dynamic, resolved fresh at call time. An arrow function has **no `this` of its own at all**; `this`
inside an arrow function is simply whatever `this` was in the enclosing scope at the point the arrow
was *defined*, permanently, regardless of how the arrow is later invoked. That makes arrow functions
risky as **object methods** (`{ name: "x", greet: () => console.log(this.name) }`) — `this` inside
`greet` is not the object at all, it's whatever `this` was in the surrounding scope where the object
literal itself was written (often `undefined` or the module scope), so `this.name` is wrong. It makes
arrows *good* as **callbacks** precisely because that's usually what you want: a `setTimeout`
callback, a `.then()` handler, or a nested closure inside a method typically wants to keep referring
to the *outer* `this` it was written next to, not get a new one assigned based on how the callback
mechanism happens to invoke it — which is exactly the classic "regular function callback loses
`this`" problem arrow functions were introduced to solve.

**Q2. No `new`, no `arguments` — did either limitation affect what you could convert?**

Neither actually blocked a conversion in this codebase: nothing here is ever called with `new` (no
constructor-style usage anywhere), and grepping the original `app.js` for `arguments` turns up zero
uses — every function here already takes named parameters. Both limitations were relevant to
*deciding what NOT to convert*, though, in spirit: the real blocker I found was the `this`-binding
risk for bare-referenced DOM listeners (Q1/Q of Tasks above), which is the same underlying mechanism
(`this` behaving differently for arrows) as the "no `arguments` of their own" limitation — an arrow
function also can't see the `arguments` object of the call that invoked *it*, only of any enclosing
regular function, for exactly the same "arrows don't have their own per-call binding" reason `this`
doesn't work the way you'd expect either.

**Q3. Hoisting — function declarations are, `const`/`let` arrows are not. Did this matter?**

Textually, yes, in a few spots — `dashboard.js`'s `statCardHTML`, `timeline.js`'s
`certaintyBadgeClass`/`openEvidenceModal`, and `evidence.js`'s `statusOptionHTML` are all defined
*below*, in file order, the function that calls them. Functionally, no — I checked each one, and in
every case the calling function's *body* only executes when it's invoked from elsewhere (a router
call, an event handler, `dataLoader.js`), which happens well after the entire module has finished
evaluating top-to-bottom, at which point every `const` in the file — including these arrow functions
— is already initialized. Hoisting would only actually have mattered if something in this codebase
called one of these helpers *at module top level*, outside any function, before its own `const` line
had executed — nothing here does that. The one place I deliberately double-checked this reasoning
against was the `router.js` ↔ `people.js`/`timeline.js`/`workspace.js` circular import (documented
in `router.js`'s file comment and `CHANGES.md`) — even there, nothing calls the cross-imported
function until well after all modules finish loading, so the cycle is safe regardless of function
-declaration-vs-arrow-const styling.

**Q4. Concrete before/after — behavioral difference or pure style?**

```js
// before
function getStatusBadgeClass(status) {
  var s = (status || "").toLowerCase();
  if (s === "reviewed") return "badge-reviewed";
  if (s === "flagged") return "badge-flagged";
  return "badge-unreviewed";
}

// after
export const getStatusBadgeClass = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "reviewed") return "badge-reviewed";
  if (s === "flagged") return "badge-flagged";
  return "badge-unreviewed";
};
```

Purely readability/style here — this function never used `this`, `arguments`, or `new`, is never
called before its own declaration executes, and is never passed bare to anything that would invoke
it in a way where `this`-binding matters. Every call site (`getStatusBadgeClass(ev.status)` etc.)
behaves identically before and after.

**Q5. One consistent rule for function-declaration vs. function-expression vs. arrow.**

The rule this refactor actually followed, stated explicitly: **use an arrow function for anything
that is (a) a private, pure-ish helper never called before its module finishes evaluating, or (b) an
inline callback passed directly as a literal (`.then(...)`, `addEventListener("click", (e) => ...)`,
`setTimeout(...)`, `.sort(...)`, `.filter(...)`)** — for both of these, `this`/`arguments`/hoisting
never realistically matter, and the shorter, no-`function`-keyword syntax is a clear readability win.
**Use a regular `function` declaration for anything that is (a) part of a module's public,
named API surface (exported `render*`/`populate*`/`open*`/`close*`/`save*` functions) — for
call-stack readability and consistency, even though most of these would technically also be arrow
-safe, or (b) ever passed *bare* (unwrapped) to something that invokes it as a method/listener where
`this` could plausibly matter someday.** The justification: (b) is a genuine, if currently latent,
correctness boundary — converting those five functions to arrows would compile and run fine today
and quietly remove a capability with no error to catch the mistake later; (a) is a team-communication
convention rather than a technical requirement, chosen so that "is this function part of what other
files are meant to call" is answerable from declaration style alone, without having to check every
`export` list.
