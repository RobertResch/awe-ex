// ---------------------------------------------------------------------
// ENTRY POINT: event listener setup + init
// ---------------------------------------------------------------------
// index.html still calls several functions directly from inline
// onclick="..."/onchange="..." attributes (nav buttons, "Close",
// "Save note", "Save hypothesis draft", the sort <select>, and the
// buttons rendered from template strings in evidence.js). Inline handler
// attributes always run in the *global* scope, never in a module's scope,
// and a module's top-level declarations are private to that module by
// default (unlike a classic <script>, where every top-level `function` or
// `var` becomes a property of `window`). So every function still reached
// from markup has to be attached to `window` explicitly here - that is
// the one deliberate, documented exception to "keep things private".
//
// TYPESCRIPT (Demo 7): `window.navigateTo = navigateTo` doesn't type-check
// against the DOM's built-in `Window` interface (it has no `navigateTo`
// property) - the `declare global { interface Window { ... } }` block
// below is TypeScript's supported way to extend a built-in global type
// with the properties your own code actually adds to it. This types the
// exact "the one deliberate exception" this file's own comment describes,
// instead of reaching for `window as any`.
import { loadBookmarksFromStorage, loadNotesFromStorage, loadNoteAsync } from "./storage.js";
import { loadAllData } from "./dataLoader.js";
import { handleHashChange, navigateTo } from "./router.js";
import {
  renderEvidenceList,
  handleSearchInput,
  clearFilters,
  handleSortChange,
  closeEvidenceDetail,
  saveCurrentNote
} from "./evidence.js";
import { renderTimeline } from "./timeline.js";
import { switchPeopleTab } from "./people.js";
import { saveHypothesis } from "./workspace.js";

declare global {
  interface Window {
    navigateTo: typeof navigateTo;
    switchPeopleTab: typeof switchPeopleTab;
    closeEvidenceDetail: typeof closeEvidenceDetail;
    saveCurrentNote: typeof saveCurrentNote;
    handleSortChange: typeof handleSortChange;
    saveHypothesis: typeof saveHypothesis;
  }
}

window.navigateTo = navigateTo;
window.switchPeopleTab = switchPeopleTab;
window.closeEvidenceDetail = closeEvidenceDetail;
window.saveCurrentNote = saveCurrentNote;
window.handleSortChange = handleSortChange;
window.saveHypothesis = saveHypothesis;

// ---------------------------------------------------------------------
// EVENT LISTENER SETUP
// ---------------------------------------------------------------------

function setupEventListeners(): void {
  window.addEventListener("hashchange", handleHashChange);

  const navButtons = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  // BUGFIX (Demo 4, Exercise 1, silent/console-only): this loop used to declare its
  // counter with `var i`. `var` is function-scoped, not block-scoped, so
  // there was only ever ONE `i` shared by every click handler created in
  // this loop. By the time a user actually clicked a button, the loop had
  // long finished and `i` equalled navButtons.length (5) - one past the
  // last valid index - so `navButtons[i]` was `undefined` and
  // `.getAttribute` threw `Uncaught TypeError: Cannot read properties of
  // undefined (reading 'getAttribute')`. Nothing looked broken because the
  // buttons ALSO still navigate via the separate inline onclick="navigateTo(...)"
  // attribute in index.html, which fires first and works fine - so the
  // error was silently swallowed by the browser and only visible in the
  // console. `let` gives every iteration of the loop its own binding, so
  // each handler closes over the `i` it was created with instead of a
  // shared one.
  // REFACTOR (Demo 10, Exercise 1): converted from an anonymous `function () {...}`
  // to an arrow function. It's an inline callback created fresh on every
  // loop iteration (never passed around or referenced elsewhere), doesn't
  // use `this`, and needs no `arguments` object - a safe, idiomatic
  // conversion.
  // TYPESCRIPT (Demo 7): `noUncheckedIndexedAccess` makes `navButtons[i]`
  // `HTMLButtonElement | undefined` even inside a bounds-checked `for`
  // loop. Binding it to a per-iteration `const button` both satisfies that
  // and is what actually gets closed over below - the same "each iteration
  // needs its own binding" lesson as the `let i` bugfix above, just applied
  // one level deeper.
  for (let i = 0; i < navButtons.length; i++) {
    const button = navButtons[i];
    if (!button) continue;
    button.addEventListener("click", () => {
      const targetView = button.getAttribute("data-view");
      console.log("nav clicked:", targetView);
    });
  }

  document.getElementById("evidenceSearch")!.addEventListener("input", handleSearchInput);

  document.getElementById("filterType")!.addEventListener("change", renderEvidenceList);
  document.getElementById("filterPerson")!.addEventListener("change", renderEvidenceList);
  document.getElementById("filterLocation")!.addEventListener("change", renderEvidenceList);

  // BUGFIX (Demo 5, Exercise 1): filterStatus used to ALSO get a redundant
  // `setAttribute("onchange", "renderEvidenceList()")` right after the
  // addEventListener call above - the only element in the app bound to
  // the same event twice, through two different mechanisms. It was
  // harmless (both handlers do the same idempotent re-render) but wasteful
  // and confusing to read: changing the Status filter re-rendered the list
  // twice for no reason. Removed; the addEventListener call above is
  // sufficient on its own, exactly like every other filter control.
  document.getElementById("filterStatus")!.addEventListener("change", renderEvidenceList);

  document.getElementById("filterRelevance")!.addEventListener("change", renderEvidenceList);

  document.getElementById("clearFiltersBtn")!.addEventListener("click", clearFilters);

  document.getElementById("timelineOrder")!.addEventListener("change", renderTimeline);
  document.getElementById("timelinePersonFilter")!.addEventListener("change", renderTimeline);
  document.getElementById("timelineLocationFilter")!.addEventListener("change", renderTimeline);
  document.getElementById("timelineTypeFilter")!.addEventListener("change", renderTimeline);

  document.getElementById("hypConfidence")!.addEventListener("input", (e) => {
    document.getElementById("hypConfidenceValue")!.textContent = (
      e.target as HTMLInputElement
    ).value;
  });
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------

// REFACTOR (Demo 9, Exercise 1): converted from `loadAllData().then(function () {...})`
// to await, matching dataLoader.js. This also fixes a bug (found during
// Demo 5's walkthrough, deferred to be fixed here): the original code did
// `var firstNote = loadNoteAsync("E01"); console.log("First note preview:",
// firstNote);` - loadNoteAsync() returns a Promise, so `firstNote` was that
// pending Promise object itself, not the note text, and the console logged
// something like `Promise {<fulfilled>: ''}` instead of the note. This is
// the exact bug pattern Demo 9's last question asks about: a Promise being
// treated as if it were already-resolved data. `await` unwraps the settled
// value before the console.log runs, exactly like every other await above.
async function initApp(): Promise<void> {
  loadBookmarksFromStorage();
  loadNotesFromStorage();
  setupEventListeners();

  await loadAllData();
  handleHashChange();
  const firstNote = await loadNoteAsync("E01");
  console.log("First note preview:", firstNote);
}

// CODE SMELL FIX (Demo 8, Exercise 1): handleHashChange used to be registered as a
// "hashchange" listener TWICE - once inside setupEventListeners() above,
// and again here at the bottom of the file. Both call the exact same
// function, so every navigation ran the whole render/highlight-nav-button
// routine twice in a row - harmless in effect (idempotent), but wasteful,
// and the kind of duplication that looks like a real second listener was
// intended until you read closely. One registration (inside
// setupEventListeners, alongside every other listener the app sets up) is
// enough.
window.addEventListener("DOMContentLoaded", initApp);
