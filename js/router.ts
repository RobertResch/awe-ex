// ---------------------------------------------------------------------
// NAVIGATION / HASH ROUTING
// ---------------------------------------------------------------------
// Note: this module and people.js / timeline.js / workspace.js import
// from each other in a cycle (router needs their render functions, they
// need navigateTo). That is safe here because every function involved is
// a hoisted function declaration and none of them is *called* until well
// after all modules have finished evaluating (they only run inside later
// event handlers) - see CHANGES.md for a note on revisiting this later
// with an event-based approach instead.
import { state } from "./state.js";
import { renderDashboard } from "./dashboard.js";
import { renderEvidenceList } from "./evidence.js";
import { renderPeople, renderLocations } from "./people.js";
import { renderTimeline } from "./timeline.js";
import { renderWorkspace } from "./workspace.js";

export function navigateTo(viewName: string): void {
  window.location.hash = viewName;
  // handleHashChange() will pick this up via the hashchange listener
}

const VALID_VIEWS = ["dashboard", "evidence", "people", "timeline", "workspace"] as const;
type ViewName = (typeof VALID_VIEWS)[number];

export function handleHashChange(): void {
  const rawHash = window.location.hash.replace("#", "");
  // TYPESCRIPT (Demo 7): `validViews.indexOf(hash) === -1` narrows nothing
  // - after this check, `hash` is still just `string` as far as the
  // compiler is concerned, so `document.getElementById("view-" + hash)`
  // below is still `HTMLElement | null`, not guaranteed non-null. Rewriting
  // the check as an `includes` type guard against `ViewName` (a literal
  // union derived from the same array) lets the compiler track that a
  // valid hash really is one of the five known view names - real spot #1
  // of the "3 things the compiler made me think about" for Demo 7.
  const hash: ViewName = (VALID_VIEWS as readonly string[]).includes(rawHash)
    ? (rawHash as ViewName)
    : "dashboard";
  state.currentPage = hash;

  const sections = document.querySelectorAll(".view");
  for (const section of sections) {
    section.classList.remove("active");
  }
  // Every value of `ViewName` has a matching `#view-<name>` section in
  // index.html - guaranteed by static markup, not by anything the compiler
  // can see, so this is a deliberate `!` rather than a defensive `if`. See
  // EXERCISE_2_ANSWERS.md, Demo 7, Q2 for where this line falls on the
  // "any/! is fine" vs "model it properly" line.
  document.getElementById("view-" + hash)!.classList.add("active");

  const navButtons = document.querySelectorAll<HTMLButtonElement>(".nav-btn");
  for (const btn of navButtons) {
    btn.classList.remove("active");
    if (btn.getAttribute("data-view") === hash) {
      btn.classList.add("active");
    }
  }

  if (hash === "dashboard" && !state.viewRendered.dashboard) {
    renderDashboard();
    state.viewRendered.dashboard = true;
  } else if (hash === "evidence" && !state.viewRendered.evidence) {
    renderEvidenceList();
    state.viewRendered.evidence = true;
  } else if (hash === "people" && !state.viewRendered.people) {
    renderPeople();
    renderLocations();
    state.viewRendered.people = true;
  } else if (hash === "timeline" && !state.viewRendered.timeline) {
    renderTimeline();
    state.viewRendered.timeline = true;
  } else if (hash === "workspace") {
    // workspace is cheap enough that it always re-renders
    renderWorkspace();
  }
}
