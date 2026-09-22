// ---------------------------------------------------------------------
// WORKSPACE
// ---------------------------------------------------------------------
// Hypothesis load/save stays here rather than in storage.ts: it is
// generic localStorage read/write plus a long list of specific form-field
// ids, so it is really "workspace view logic that happens to persist
// itself" rather than a reusable storage helper.
import { state, STORAGE_KEY_HYPOTHESIS } from "./state.js";
import { getSelectedOptions } from "./utils.js";
import { navigateTo } from "./router.js";
import { openEvidenceDetail } from "./evidence.js";

export function renderWorkspace(): void {
  renderBookmarksList();
  renderNotesList();
  populateHypothesisDropdowns();
  loadHypothesisFromStorage();
}

function renderBookmarksList(): void {
  const container = document.getElementById("bookmarksList");
  if (!container) return;

  const bookmarkedItems = state.allEvidence.filter((ev) => ev.bookmarked);

  if (bookmarkedItems.length === 0) {
    container.innerHTML =
      "<p>No bookmarked evidence yet. Bookmark items from the Evidence view.</p>";
    return;
  }

  let html = "";
  for (const ev of bookmarkedItems) {
    html +=
      '<div class="mini-list-item"><strong>' +
      ev.id +
      "</strong> &mdash; " +
      ev.title +
      ' <button type="button" class="btn btn-small btn-secondary" data-open-evidence="' +
      ev.id +
      '">Open</button></div>';
  }
  container.innerHTML = html;

  const openButtons = container.querySelectorAll("[data-open-evidence]");
  for (const btn of openButtons) {
    btn.addEventListener("click", (e) => {
      navigateTo("evidence");
      const target = e.target as HTMLElement;
      const id = target.getAttribute("data-open-evidence");
      if (!id) return;
      setTimeout(() => {
        openEvidenceDetail(id);
      }, 0);
    });
  }
}

interface NoteEntry {
  evidenceId: string;
  title: string;
  text: string;
}

function renderNotesList(): void {
  const container = document.getElementById("notesList");
  if (!container) return;

  const noteEntries: NoteEntry[] = [];
  for (const ev of state.allEvidence) {
    const note = state.notesStore[ev.id];
    if (note) {
      noteEntries.push({ evidenceId: ev.id, title: ev.title, text: note });
    }
  }

  if (noteEntries.length === 0) {
    container.innerHTML = "<p>No notes yet. Add one from an evidence item's detail view.</p>";
    return;
  }

  let html = "";
  for (const entry of noteEntries) {
    html +=
      '<div class="mini-list-item"><strong>' +
      entry.evidenceId +
      "</strong> &mdash; " +
      entry.title;
    html += "<div>" + entry.text + "</div></div>"; // unsafe innerHTML rendering, same as the note preview
  }
  container.innerHTML = html;
}

export function populateHypothesisDropdowns(): void {
  const suspectSelect = document.getElementById("hypSuspect") as HTMLSelectElement | null;
  const evidenceSelect = document.getElementById("hypEvidence") as HTMLSelectElement | null;
  if (!suspectSelect || !evidenceSelect) return;

  const currentSuspect = suspectSelect.value;
  suspectSelect.innerHTML = '<option value="">Select a person…</option>';
  for (const person of state.allPeople) {
    suspectSelect.innerHTML += '<option value="' + person.id + '">' + person.name + "</option>";
  }
  suspectSelect.value = currentSuspect;

  evidenceSelect.innerHTML = "";
  for (const ev of state.allEvidence) {
    evidenceSelect.innerHTML +=
      '<option value="' + ev.id + '">' + ev.id + " - " + ev.title + "</option>";
  }
}

interface HypothesisDraft {
  suspectId: string;
  nature: string;
  evidenceIds: string[];
  confidence: string;
  explanation: string;
  alternative: string;
  savedAt: string;
}

export function saveHypothesis(): void {
  const draft: HypothesisDraft = {
    suspectId: (document.getElementById("hypSuspect") as HTMLSelectElement).value,
    nature: (document.getElementById("hypNature") as HTMLSelectElement).value,
    evidenceIds: getSelectedOptions(document.getElementById("hypEvidence") as HTMLSelectElement),
    confidence: (document.getElementById("hypConfidence") as HTMLInputElement).value,
    explanation: (document.getElementById("hypExplanation") as HTMLTextAreaElement).value,
    alternative: (document.getElementById("hypAlternative") as HTMLTextAreaElement).value,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY_HYPOTHESIS, JSON.stringify(draft));
  } catch (err) {
    console.error("Could not save hypothesis draft", err);
    alert("Your hypothesis could not be saved to local storage.");
    return;
  }

  const msg = document.getElementById("hypothesisSavedMsg")!;
  msg.classList.remove("hidden");
  setTimeout(() => {
    msg.classList.add("hidden");
  }, 2000);
}

function loadHypothesisFromStorage(): void {
  const raw = localStorage.getItem(STORAGE_KEY_HYPOTHESIS);
  if (!raw) return;

  // BUGFIX (Demo 5, Exercise 1): same class of bug as loadNotesFromStorage() in
  // storage.js - a bare JSON.parse() with no try/catch. This one is
  // narrower in blast radius (it only breaks inside renderWorkspace(),
  // called every time you open the Workspace tab) but still threw an
  // uncaught SyntaxError and silently left the hypothesis form empty
  // if "remotion_hypothesis" was hand-corrupted in DevTools.
  //
  // TYPESCRIPT (Demo 6/7): `Partial<HypothesisDraft>` rather than
  // `HypothesisDraft` for the same reason as `state.caseData` in state.ts -
  // this is an `as` cast over unchecked `JSON.parse` output, so nothing
  // guarantees a hand-edited value actually has every field. Every read
  // below already falls back with `|| ""` / `|| []`, which only works
  // because the type admits the fields might be missing.
  let draft: Partial<HypothesisDraft>;
  try {
    draft = JSON.parse(raw) as Partial<HypothesisDraft>;
  } catch (err) {
    console.warn("Could not read stored hypothesis draft, ignoring it", err);
    return;
  }

  (document.getElementById("hypSuspect") as HTMLSelectElement).value = draft.suspectId || "";
  (document.getElementById("hypNature") as HTMLSelectElement).value = draft.nature || "";
  (document.getElementById("hypConfidence") as HTMLInputElement).value = draft.confidence || "50";
  document.getElementById("hypConfidenceValue")!.textContent = draft.confidence || "50";
  (document.getElementById("hypExplanation") as HTMLTextAreaElement).value =
    draft.explanation || "";
  (document.getElementById("hypAlternative") as HTMLTextAreaElement).value =
    draft.alternative || "";

  const evidenceSelect = document.getElementById("hypEvidence") as HTMLSelectElement;
  const savedIds = draft.evidenceIds || [];
  for (const option of evidenceSelect.options) {
    option.selected = savedIds.indexOf(option.value) !== -1;
  }
}
