// ---------------------------------------------------------------------
// LOCAL STORAGE HELPERS (bookmarks & notes)
// ---------------------------------------------------------------------
// Generic persistence helpers that are not tied to any one view's DOM.
// (Hypothesis load/save stays in workspace.js instead of here, because it
// is tightly coupled to specific form field ids - see workspace.js.)
import { state, STORAGE_KEY_BOOKMARKS, STORAGE_KEY_NOTES } from "./state.js";

export function saveBookmarksToStorage(): void {
  localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(state.bookmarks));
}

export function loadBookmarksFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    state.bookmarks = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not read stored bookmarks, starting empty", err);
    state.bookmarks = [];
  }
}

export function saveNoteForEvidence(evidenceId: string, text: string): void {
  state.notesStore[evidenceId] = text;
  localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(state.notesStore));
}

export function loadNoteForEvidence(evidenceId: string): string {
  return state.notesStore[evidenceId] || "";
}

export function loadNotesFromStorage(): void {
  const raw = localStorage.getItem(STORAGE_KEY_NOTES);
  if (!raw) {
    state.notesStore = {};
    return;
  }

  // BUGFIX (Demo 5, Exercise 1): this used to be a bare `state.notesStore =
  // JSON.parse(raw);` with no try/catch, unlike loadBookmarksFromStorage()
  // right above it. Hand-editing the "remotion_notes" key in DevTools ->
  // Application -> Local Storage into invalid JSON and reloading threw an
  // uncaught SyntaxError here. Because loadNotesFromStorage() runs inside
  // initApp() BEFORE setupEventListeners(), that uncaught error aborted
  // initApp() entirely: no event listeners were ever attached and
  // loadAllData() was never called, so the whole app looked dead (only
  // the nav buttons still worked, via their inline onclick attributes).
  try {
    // TYPESCRIPT (Demo 6 preview): `JSON.parse` returns `any`, so nothing
    // here actually checks that the parsed value is a `Record<string,
    // string>` - the `as` cast documents that trust boundary instead of
    // hiding it behind an implicit `any`, but it doesn't validate anything
    // at runtime. See EXERCISE_2_ANSWERS.md, Demo 6, Q2: a hand-corrupted
    // localStorage value with the wrong shape (e.g. numbers instead of
    // strings) would still pass this line and only misbehave later, at the
    // point something calls `.toLowerCase()` or similar on a "string" that
    // is actually a number.
    state.notesStore = JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    console.warn("Could not read stored notes, starting empty", err);
    state.notesStore = {};
  }
}

export function loadNoteAsync(evidenceId: string): Promise<string> {
  return new Promise((resolve) => {
    resolve(state.notesStore[evidenceId] || "");
  });
}
