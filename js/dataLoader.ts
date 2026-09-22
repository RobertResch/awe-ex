// ---------------------------------------------------------------------
// DATA LOADING
// ---------------------------------------------------------------------
import { state } from "./state.js";
import { renderDashboard } from "./dashboard.js";
import {
  populateEvidenceDropdowns,
  renderEvidenceList,
  applyStoredBookmarkFlags
} from "./evidence.js";
import { populateTimelineDropdowns, renderTimeline } from "./timeline.js";
import { populateHypothesisDropdowns } from "./workspace.js";
import type {
  CaseData,
  Evidence,
  EvidenceRelevance,
  EvidenceStatus,
  Location,
  Person,
  TimelineEvent
} from "./types.js";

function showLoadingOverlay(msg: string): void {
  const overlay = document.getElementById("loadingOverlay");
  const text = document.getElementById("loadingText");
  if (text) text.textContent = msg;
  if (overlay) overlay.classList.remove("hidden");
}

function hideLoadingStep(): void {
  state.loadingStepsRemaining--;
  if (state.loadingStepsRemaining <= 0) {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.classList.add("hidden");
  }
}

function populateAllDropdowns(): void {
  populateEvidenceDropdowns();
  populateTimelineDropdowns();
  populateHypothesisDropdowns();
}

// REFACTOR (Demo 9, Exercise 1): this used to be 6 levels of nested .then() calls -
// fetch(case) -> .json() -> fetch(people) -> .json() -> fetch(locations) ->
// .json() - each one only starting after the previous one's ENTIRE promise
// chain (fetch AND its .json() parse) had resolved. That nesting exists on
// purpose: case.json must finish before people.json is even requested, and
// people.json must finish before locations.json is requested - three
// strictly sequential round trips, not three parallel ones (that
// optimization is out of scope for this exercise). `await` reproduces
// exactly the same "start the next request only once the previous one is
// fully done" behavior, but as a flat, top-to-bottom list of steps instead
// of a staircase of callbacks-inside-callbacks.
async function loadCorePeopleAndLocations(): Promise<void> {
  const caseRes = await fetch("data/case.json");
  // TYPESCRIPT (Demo 6): `Response.json()` returns `Promise<any>` - the
  // `as CaseData` cast is a type-level promise, not a runtime check. See
  // the Demo 6 Q2 writeup in EXERCISE_2_ANSWERS.md for what this cast does
  // and does not protect against.
  const caseJson = (await caseRes.json()) as CaseData;
  state.caseData = caseJson;

  const peopleRes = await fetch("data/people.json");
  const peopleJson = (await peopleRes.json()) as Person[];
  state.allPeople = peopleJson;

  const locationsRes = await fetch("data/locations.json");
  const locationsJson = (await locationsRes.json()) as Location[];
  state.allLocations = locationsJson;

  hideLoadingStep();
  renderDashboard();
  populateAllDropdowns();
}

// AMBIGUOUS FIELD, continued (Demo 6): `status`/`relevance` in
// evidence.json are supposed to be one of a fixed set of values, but E12
// is stored as "Reviewed"/"Unknown" (capitalized) while every other entry
// uses lowercase. The original JS never had to decide anything about this
// - every comparison site already did `.toLowerCase()` first (see
// getStatusBadgeClass in utils.ts), so the inconsistency was invisible.
// Typing `Evidence.status` as the strict union `EvidenceStatus` forces an
// actual decision at the one place new data enters the app: normalize once,
// here, so every other module can trust the field instead of re-defending
// against casing everywhere it's read. Note what this does NOT do: `as
// RawEvidence[]` below is still just a compile-time assertion.
// `normalizeStatus`/`normalizeRelevance` are the actual runtime check - and
// this pair of things (an unchecked cast BEFORE normalization + a real
// runtime check AFTER) is exactly the distinction the Demo 6 Q2 writeup is
// about.
type RawEvidence = Omit<Evidence, "status" | "relevance"> & {
  status: string;
  relevance: string;
};

function normalizeStatus(raw: string): EvidenceStatus {
  const s = (raw || "").toLowerCase();
  if (s === "reviewed") return "reviewed";
  if (s === "flagged") return "flagged";
  return "unreviewed";
}

function normalizeRelevance(raw: string): EvidenceRelevance {
  const r = (raw || "").toLowerCase();
  if (r === "relevant") return "relevant";
  if (r === "irrelevant") return "irrelevant";
  return "unknown";
}

// REFACTOR (Demo 9, Exercise 1): the async/await equivalent of a .catch() is wrapping
// the awaited calls in a try/catch - same error-handling behavior (same
// alert, same fallback re-render), just without a separate callback.
async function loadEvidenceData(): Promise<void> {
  try {
    const res = await fetch("data/evidence.json");
    const data = (await res.json()) as RawEvidence[];
    // BUGFIX (Demo 6/7): E12 rendered with capitalized "Reviewed"/"Unknown"
    // badge text while every other item showed lowercase - a genuine,
    // previously-unnoticed data-entry inconsistency the TypeScript
    // migration surfaced (see EXERCISE_2_ANSWERS.md, Demo 7, Q3). Normalized
    // once here instead of patching evidence.json by hand, so any future
    // casing slip in the data is handled the same way automatically.
    state.allEvidence = data.map((item) => ({
      ...item,
      status: normalizeStatus(item.status),
      relevance: normalizeRelevance(item.relevance)
    }));
    applyStoredBookmarkFlags();
    // BUGFIX (Demo 2, Exercise 1, mutation/reference): this used to be
    // `state.filteredEvidence = state.allEvidence;` - the SAME array,
    // not a copy. Sorting filteredEvidence (see handleSortChange in
    // evidence.js) called .sort() in place, which - while
    // filteredEvidence still pointed at the exact same array as
    // allEvidence - silently reordered allEvidence too, changing the
    // Dashboard's "Recent evidence" panel as a side effect of a control
    // on a completely different page. .slice() makes an independent
    // shallow copy: a new array, same item references inside it, so
    // sorting/filtering one array can never reorder the other.
    state.filteredEvidence = state.allEvidence.slice();
    // BUGFIX (Demo 3, Exercise 1, async/Promise): evidenceViewLoading starts out
    // `true` and, in the original code, was NEVER set back to `false`
    // anywhere - not here, not anywhere else in the file. renderEvidenceList()
    // (evidence.js) checks this flag and returns early whenever it is
    // true, so the Evidence tab showed its loading spinner forever,
    // regardless of how long you waited. The point where this Promise's
    // fulfilled value becomes available - right after both awaits above
    // settle - is exactly the point in its lifecycle where "evidence is no
    // longer loading" becomes true, so that is where the flag must be
    // cleared.
    state.evidenceViewLoading = false;
    renderDashboard();
    populateAllDropdowns();
    if (state.currentPage === "evidence") renderEvidenceList();
  } catch (err) {
    console.error("Failed to load evidence.json", err);
    alert("Evidence could not be loaded. Some views may be incomplete.");
    // Also clear the flag on failure - otherwise a failed fetch leaves
    // the Evidence tab spinning forever too, silently hiding the fact
    // that the alert() above already told the user what happened.
    state.evidenceViewLoading = false;
    renderEvidenceList();
  }
}

// REFACTOR (Demo 9, Exercise 1): try/catch/finally is a direct, built-in match for
// .then()/.catch()/.finally() - the `finally` block below runs in exactly
// the same circumstances the original .finally() callback did: whether the
// try block completed normally or the catch block ran.
async function loadTimelineData(): Promise<void> {
  try {
    const res = await fetch("data/timeline.json");
    const data = (await res.json()) as TimelineEvent[];
    state.allTimeline = data;
    renderDashboard();
    if (state.currentPage === "timeline") renderTimeline();
    populateAllDropdowns();
  } catch (err) {
    console.log("timeline load error", err);
  } finally {
    hideLoadingStep();
  }
}

// REFACTOR (Demo 9, Exercise 1): note what this deliberately does NOT do - it does not
// `await loadEvidenceData()` or `await loadTimelineData()`. The original
// code didn't wait for them either (`.then(function () { loadEvidenceData();
// loadTimelineData(); })` calls them and immediately resolves without
// waiting for either to finish); preserving that exact "fire and forget"
// behavior, bugs and all, is the point of this exercise's refactor - fixing
// it to properly wait for all three loaders is a later exercise.
export async function loadAllData(): Promise<void> {
  showLoadingOverlay("Loading case file…");
  state.loadingStepsRemaining = 2;
  await loadCorePeopleAndLocations();
  loadEvidenceData();
  loadTimelineData();
}
