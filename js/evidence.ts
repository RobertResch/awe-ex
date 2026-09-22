// ---------------------------------------------------------------------
// EVIDENCE CATALOGUE & DETAIL
// ---------------------------------------------------------------------
import { state } from "./state.js";
import {
  findEvidenceById,
  findPersonById,
  findLocationById,
  evidenceMentionsPerson,
  formatDate,
  getStatusBadgeClass,
  getRelevanceBadgeClass
} from "./utils.js";
import { saveBookmarksToStorage, saveNoteForEvidence, loadNoteForEvidence } from "./storage.js";
import type { Evidence, EvidenceRelevance, EvidenceStatus } from "./types.js";

export function populateEvidenceDropdowns(): void {
  const typeSelect = document.getElementById("filterType") as HTMLSelectElement | null;
  const personSelect = document.getElementById("filterPerson") as HTMLSelectElement | null;
  const locationSelect = document.getElementById("filterLocation") as HTMLSelectElement | null;
  if (!typeSelect || !personSelect || !locationSelect) return;

  const types: string[] = [];
  for (const ev of state.allEvidence) {
    const t = ev.type.toLowerCase();
    if (types.indexOf(t) === -1) types.push(t);
  }
  typeSelect.innerHTML = '<option value="">All types</option>';
  for (const type of types) {
    typeSelect.innerHTML += '<option value="' + type + '">' + type + "</option>";
  }

  personSelect.innerHTML = '<option value="">All people</option>';
  for (const person of state.allPeople) {
    personSelect.innerHTML += '<option value="' + person.id + '">' + person.name + "</option>";
  }

  locationSelect.innerHTML = '<option value="">All locations</option>';
  for (const loc of state.allLocations) {
    locationSelect.innerHTML +=
      '<option value="' + loc.id + '">' + loc.id + " - " + loc.name + "</option>";
  }
}

function getFilteredEvidence(): Evidence[] {
  const searchBox = document.getElementById("evidenceSearch") as HTMLInputElement | null;
  const searchTerm = searchBox ? searchBox.value.toLowerCase().trim() : "";
  const typeVal = (document.getElementById("filterType") as HTMLSelectElement).value;
  const personVal = (document.getElementById("filterPerson") as HTMLSelectElement).value;
  const locationVal = (document.getElementById("filterLocation") as HTMLSelectElement).value;
  const statusVal = (document.getElementById("filterStatus") as HTMLSelectElement).value;
  const relevanceVal = (document.getElementById("filterRelevance") as HTMLSelectElement).value;

  const results: Evidence[] = [];
  for (const item of state.allEvidence) {
    let matches = true;

    if (searchTerm) {
      const haystack = (item.title + " " + item.summary + " " + item.tags.join(" ")).toLowerCase();
      if (haystack.indexOf(searchTerm) === -1) matches = false;
    }
    if (matches && typeVal && item.type.toLowerCase() !== typeVal) matches = false;
    if (matches && personVal) {
      const person = findPersonById(personVal, state.allPeople);
      if (!person || !evidenceMentionsPerson(item, person)) matches = false;
    }
    if (matches && locationVal && item.locationIds.indexOf(locationVal) === -1) matches = false;
    if (matches && statusVal && (item.status || "").toLowerCase() !== statusVal) matches = false;
    if (matches && relevanceVal && (item.relevance || "").toLowerCase() !== relevanceVal)
      matches = false;

    if (matches) results.push(item);
  }

  // BUGFIX (Demo 5, Exercise 1): sorting used to happen only inside handleSortChange,
  // which mutated state.filteredEvidence in place and then called
  // renderEvidenceList(). But renderEvidenceList() always calls this
  // function, which always rebuilds `results` from state.allEvidence's
  // original order and overwrites state.filteredEvidence - throwing away
  // whatever sort had just been applied. The net effect: the "Sort" select
  // had no visible effect, no matter which option you picked. Reading the
  // sort value here too (the same way typeVal/personVal/etc. are already
  // read from the DOM above) means every render - whether triggered by a
  // filter change or a sort change - applies the current sort exactly once,
  // to the final filtered array, right before it's stored/returned.
  const sortValue = (document.getElementById("sortEvidence") as HTMLSelectElement).value;
  if (sortValue === "title-asc") {
    results.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortValue === "title-desc") {
    results.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sortValue === "date-asc") {
    // TYPESCRIPT (Demo 7): `new Date(a.timestamp) - new Date(b.timestamp)`
    // - subtracting two `Date`s directly - type-checks in JS via an
    // implicit `valueOf()` coercion but TypeScript's arithmetic operators
    // require `number`/`bigint` operands. Same real issue as timeline.ts's
    // sort comparator; see EXERCISE_2_ANSWERS.md, Demo 7.
    results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } else {
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  state.filteredEvidence = results;
  return results;
}

export function renderEvidenceList(): void {
  const container = document.getElementById("evidenceList");
  if (!container) return;

  const loadingIndicator = document.getElementById("evidenceLoadingIndicator");
  if (state.evidenceViewLoading) {
    if (loadingIndicator) loadingIndicator.classList.remove("hidden");
    container.innerHTML = "";
    return;
  }
  if (loadingIndicator) loadingIndicator.classList.add("hidden");

  const results = getFilteredEvidence();

  let html = "";
  if (results.length === 0) {
    html = "<p>No evidence matches the current filters.</p>";
  }
  for (const item of results) {
    html += renderEvidenceCardHTML(item);
  }
  container.innerHTML = html;

  // Event delegation for card clicks / bookmark button.
  container.addEventListener("click", handleEvidenceListClick);
}

function renderEvidenceCardHTML(ev: Evidence): string {
  const isBookmarked = state.bookmarks.indexOf(ev.id) !== -1;
  let html = '<div class="evidence-card" data-id="' + ev.id + '">';
  html +=
    '<button class="bookmark-btn ' +
    (isBookmarked ? "active" : "") +
    '" data-action="bookmark" data-id="' +
    ev.id +
    '" aria-label="Toggle bookmark for ' +
    ev.title +
    '"><span class="bookmark-icon">' +
    (isBookmarked ? "★" : "☆") +
    "</span></button>";
  html += "<h3>" + ev.title + "</h3>";
  html +=
    '<div class="evidence-meta">' +
    ev.id +
    " &middot; " +
    ev.type +
    " &middot; " +
    formatDate(ev.timestamp) +
    "</div>";
  html += '<div class="evidence-summary">' + ev.summary + "</div>";

  if (ev.tags.indexOf("critical") !== -1) {
    html += '<span class="badge badge-critical">Critical</span>';
  }
  html += '<span class="badge ' + getStatusBadgeClass(ev.status) + '">' + ev.status + "</span>";
  html +=
    '<span class="badge ' + getRelevanceBadgeClass(ev.relevance) + '">' + ev.relevance + "</span>";
  html += "<div>";
  for (const tag of ev.tags) {
    html += '<span class="tag-chip">' + tag + "</span>";
  }
  html += "</div>";
  html += "</div>";
  return html;
}

// REFACTOR (Demo 10, Exercise 1): handleEvidenceListClick stays a `function`
// declaration on purpose - it is passed BARE to addEventListener two lines
// above (`container.addEventListener("click", handleEvidenceListClick)`),
// not wrapped in an anonymous callback. A regular function used this way
// receives `this === event.currentTarget` per the DOM spec; an arrow
// function would silently lose that (arrows inherit `this` from their
// enclosing lexical scope - `undefined` at this module's top level, since
// ES modules are always strict mode) instead of erroring, which is exactly
// what makes it a dangerous, easy-to-miss conversion. This function
// doesn't currently read `this`, but converting it removes a capability
// cleanly available to any function passed this way, for a purely
// cosmetic gain - not worth it. The same reasoning is why
// renderEvidenceList, renderTimeline, clearFilters, and handleSearchInput
// (all passed bare to addEventListener in main.js) were also deliberately
// left as `function` declarations - see EXERCISE_1_ANSWERS.md, Demo 10.
function handleEvidenceListClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  if (target.dataset.action === "bookmark") {
    event.stopPropagation();
    const id = target.dataset.id;
    if (id) handleBookmarkClick(id);
    return;
  }

  const card = target.closest(".evidence-card");
  if (card) {
    const id = card.getAttribute("data-id");
    if (id) openEvidenceDetail(id);
  }
}

function handleBookmarkClick(evidenceId: string): void {
  const ev = findEvidenceById(evidenceId, state.allEvidence);
  if (!ev) return;

  if (state.bookmarks.indexOf(evidenceId) === -1) {
    state.bookmarks.push(evidenceId);
    ev.bookmarked = true;
  } else {
    state.bookmarks = state.bookmarks.filter((id) => id !== evidenceId);
    ev.bookmarked = false;
  }
  saveBookmarksToStorage();
  if (state.currentPage === "evidence") renderEvidenceList();
}

export function applyStoredBookmarkFlags(): void {
  for (const ev of state.allEvidence) {
    ev.bookmarked = state.bookmarks.indexOf(ev.id) !== -1;
  }
}

export function handleSortChange(): void {
  // The actual sorting now happens inside getFilteredEvidence(), the same
  // place every other filter is read from the DOM - see the BUGFIX (Demo 5)
  // comment there. This handler now only needs to trigger a re-render.
  renderEvidenceList();
}

// Bare-referenced in main.js (addEventListener("click", clearFilters)) -
// see the comment above handleEvidenceListClick for why this deliberately
// stays a `function` declaration instead of becoming an arrow function.
export function clearFilters(): void {
  (document.getElementById("evidenceSearch") as HTMLInputElement).value = "";
  (document.getElementById("filterType") as HTMLSelectElement).value = "";
  (document.getElementById("filterPerson") as HTMLSelectElement).value = "";
  (document.getElementById("filterLocation") as HTMLSelectElement).value = "";
  (document.getElementById("filterStatus") as HTMLSelectElement).value = "";
  (document.getElementById("filterRelevance") as HTMLSelectElement).value = "";
  renderEvidenceList();
}

const simulateAsyncSearch = (term: string): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(term);
    }, 300);
  });
};

// See the comment above handleEvidenceListClick: handleSearchInput is
// passed bare to addEventListener("input", handleSearchInput) in main.js,
// so it deliberately stays a `function` declaration.
export function handleSearchInput(event: Event): void {
  const term = (event.target as HTMLInputElement).value;
  const requestId = ++state.latestSearchRequestId;

  simulateAsyncSearch(term).then(() => {
    // Only apply this response if nothing newer has been typed meanwhile.
    if (requestId !== state.latestSearchRequestId) return;
    renderEvidenceList();
  });
}

// ---------------------------------------------------------------------
// EVIDENCE DETAIL
// ---------------------------------------------------------------------

export function openEvidenceDetail(evidenceId: string): void {
  const ev = findEvidenceById(evidenceId, state.allEvidence);
  if (!ev) return;
  state.selectedEvidence = ev;

  const section = document.getElementById("evidenceDetailSection")!;
  section.classList.remove("hidden");

  renderEvidenceDetail(ev);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function closeEvidenceDetail(): void {
  const section = document.getElementById("evidenceDetailSection")!;
  section.classList.add("hidden");
  section.innerHTML = "";
  state.selectedEvidence = null;
}

function renderEvidenceDetail(ev: Evidence): void {
  const section = document.getElementById("evidenceDetailSection")!;

  const personNames: string[] = [];
  for (const personId of ev.personIds) {
    const person = findPersonById(personId, state.allPeople);
    personNames.push(person ? person.name : personId);
  }

  const locationNames: string[] = [];
  for (const locationId of ev.locationIds) {
    const loc = findLocationById(locationId, state.allLocations);
    locationNames.push(loc ? loc.id + " - " + loc.name : locationId);
  }

  let tagsHtml = "";
  for (const tag of ev.tags) {
    tagsHtml += '<span class="tag-chip">' + tag + "</span>";
  }

  const storedNote = loadNoteForEvidence(ev.id);

  let html = "";
  html += '<div class="evidence-detail-header">';
  html += "<div><h2>" + ev.title + "</h2>";
  html +=
    '<div class="evidence-meta">' +
    ev.id +
    " &middot; " +
    ev.type +
    " &middot; " +
    formatDate(ev.timestamp) +
    "</div></div>";
  html +=
    '<button type="button" class="btn btn-secondary btn-small" onclick="closeEvidenceDetail()">Close</button>';
  html += "</div>";

  if (ev.tags.indexOf("critical") !== -1) {
    html += '<div class="warning-banner">This item is tagged as critical evidence.</div>';
  }

  html += '<div class="detail-field"><strong>Summary</strong>' + ev.summary + "</div>";
  html += '<div class="evidence-detail-content">' + ev.content + "</div>";
  html +=
    '<div class="detail-field"><strong>Related people</strong>' + personNames.join(", ") + "</div>";
  html +=
    '<div class="detail-field"><strong>Related locations</strong>' +
    locationNames.join(", ") +
    "</div>";
  html += '<div class="detail-field"><strong>Tags</strong>' + tagsHtml + "</div>";

  html += '<div class="detail-field"><strong>Review status</strong>';
  html += '<select id="detailStatusSelect">';
  html += statusOptionHTML(ev.status, "unreviewed", "Unreviewed");
  html += statusOptionHTML(ev.status, "reviewed", "Reviewed");
  html += statusOptionHTML(ev.status, "flagged", "Flagged");
  html += "</select></div>";

  html += '<div class="detail-field"><strong>Relevance</strong>';
  html += '<select id="detailRelevanceSelect">';
  html += statusOptionHTML(ev.relevance, "unknown", "Unknown");
  html += statusOptionHTML(ev.relevance, "relevant", "Relevant");
  html += statusOptionHTML(ev.relevance, "irrelevant", "Irrelevant");
  html += "</select></div>";

  html += '<div class="detail-field"><strong>Investigator note</strong>';
  html +=
    '<textarea id="evidenceNoteInput" class="note-textarea" rows="3" data-evidence-id="' +
    ev.id +
    '" placeholder="Add a private note about this evidence...">' +
    storedNote +
    "</textarea>";
  html +=
    '<button type="button" class="btn btn-primary btn-small" style="margin-top:6px;" onclick="saveCurrentNote()">Save note</button>';
  html += "</div>";

  html +=
    '<div class="detail-field"><strong>Note preview</strong><div id="notePreview">' +
    storedNote +
    "</div></div>";

  section.innerHTML = html;

  // TYPESCRIPT (Demo 7): `(e.target as HTMLSelectElement).value` is a
  // plain `string`, but `ev.status` is the strict union `EvidenceStatus`
  // ("unreviewed" | "reviewed" | "flagged") - assigning a bare `string`
  // there is a type error. The `as EvidenceStatus` cast is deliberate and
  // scoped: it's justified only because `statusOptionHTML` above generated
  // this exact <select>'s options from those same three literal values, so
  // no other string can actually reach this line at runtime. That
  // reasoning does NOT transfer to arbitrary user input - see
  // EXERCISE_2_ANSWERS.md, Demo 7, Q2 for where this line falls on the
  // "cast is fine" vs "validate properly" line.
  document.getElementById("detailStatusSelect")!.addEventListener("change", (e) => {
    ev.status = (e.target as HTMLSelectElement).value as EvidenceStatus;
    renderEvidenceDetail(ev);
    if (state.viewRendered.evidence) renderEvidenceList();
  });
  document.getElementById("detailRelevanceSelect")!.addEventListener("change", (e) => {
    ev.relevance = (e.target as HTMLSelectElement).value as EvidenceRelevance;
    renderEvidenceDetail(ev);
    if (state.viewRendered.evidence) renderEvidenceList();
  });
}

const statusOptionHTML = (
  current: string | undefined | null,
  value: string,
  label: string
): string => {
  const currentLower = (current || "").toLowerCase();
  const selected = currentLower === value ? " selected" : "";
  return '<option value="' + value + '"' + selected + ">" + label + "</option>";
};

export function saveCurrentNote(): void {
  const textarea = document.getElementById("evidenceNoteInput") as HTMLTextAreaElement | null;
  if (!textarea) return;
  const evidenceId = textarea.getAttribute("data-evidence-id"); // note id is read back off the DOM
  if (!evidenceId) return;
  const text = textarea.value;
  saveNoteForEvidence(evidenceId, text);
  const preview = document.getElementById("notePreview");
  if (preview) preview.innerHTML = text; // unsafe on purpose, see above
}
