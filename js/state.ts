// ---------------------------------------------------------------------
// SHARED STATE
// ---------------------------------------------------------------------
// ES modules give every file its own top-level scope: a variable declared
// in one module is invisible to another unless it is explicitly exported
// and imported. Importing a binding also does not let you reassign it from
// outside its home module - imported names are live but read-only bindings.
// Trying to do `import { allEvidence } from "./state.js"; allEvidence = x;`
// throws "Uncaught TypeError: Assignment to constant variable." in Chrome
// (see EXERCISE_1_ANSWERS.md, Demo 1, Q2).
//
// To let several view modules read AND update the same application state,
// this module exports a single object and everyone else mutates its
// *properties* (state.allEvidence = ...) instead of trying to rebind the
// imported name itself. Property assignment on an object you already hold
// a reference to is always allowed, module boundary or not - only rebinding
// the imported name is restricted.
//
// TYPESCRIPT (Demo 5): the loaded-data fields (`allEvidence`, `allPeople`,
// `allLocations`, `allTimeline`, `caseData`, `selectedEvidence`) were
// originally typed `unknown[]` / `Record<string, unknown>` here rather than
// `any`, since Demo 6 hadn't defined the domain types (Evidence, Person,
// ...) yet - `unknown` was the honest "we haven't modeled this data's shape
// yet" placeholder: unlike `any`, it still forced anyone who read out of
// these fields to narrow/cast before using the result.
//
// TYPESCRIPT (Demo 6): now that types.ts exists, those placeholders are
// replaced with the real domain types below. `caseData` uses `Partial
// <CaseData>` rather than `CaseData` because it is genuinely `{}` until
// dataLoader.ts's first fetch resolves - `Partial` says "every field is
// optional," which is what makes the empty initial value type-check
// honestly instead of lying about a `CaseData` that isn't there yet.

import type { CaseData, Evidence, Location, Person, TimelineEvent } from "./types.js";

export const STORAGE_KEY_BOOKMARKS = "remotion_bookmarks";
export const STORAGE_KEY_NOTES = "remotion_notes";
export const STORAGE_KEY_HYPOTHESIS = "remotion_hypothesis";

export interface AppState {
  allEvidence: Evidence[];
  filteredEvidence: Evidence[];
  selectedEvidence: Evidence | null;
  bookmarks: string[];
  currentPage: string;

  allPeople: Person[];
  allLocations: Location[];
  allTimeline: TimelineEvent[];
  caseData: Partial<CaseData>;

  currentPeopleTab: "people" | "locations";
  loadingStepsRemaining: number;

  evidenceViewLoading: boolean;

  viewRendered: {
    dashboard: boolean;
    evidence: boolean;
    people: boolean;
    timeline: boolean;
    workspace: boolean;
  };

  notesStore: Record<string, string>;
  latestSearchRequestId: number;
}

export const state: AppState = {
  allEvidence: [],
  filteredEvidence: [],
  selectedEvidence: null,
  bookmarks: [],
  currentPage: "dashboard",

  allPeople: [],
  allLocations: [],
  allTimeline: [],
  caseData: {},

  currentPeopleTab: "people",
  loadingStepsRemaining: 2,

  evidenceViewLoading: true,

  viewRendered: {
    dashboard: false,
    evidence: false,
    people: false,
    timeline: false,
    workspace: false
  },

  notesStore: {},
  latestSearchRequestId: 0
};
