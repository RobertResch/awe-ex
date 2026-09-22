// ---------------------------------------------------------------------
// TIMELINE
// ---------------------------------------------------------------------
import { state } from "./state.js";
import { findLocationById, findEvidenceById, formatDate } from "./utils.js";
import { navigateTo } from "./router.js";
import { openEvidenceDetail } from "./evidence.js";
import type { TimelineEvent } from "./types.js";

export function populateTimelineDropdowns(): void {
  const personSelect = document.getElementById("timelinePersonFilter") as HTMLSelectElement | null;
  const locationSelect = document.getElementById(
    "timelineLocationFilter"
  ) as HTMLSelectElement | null;
  const typeSelect = document.getElementById("timelineTypeFilter") as HTMLSelectElement | null;
  if (!personSelect || !locationSelect || !typeSelect) return;

  personSelect.innerHTML = '<option value="">All people</option>';
  for (const person of state.allPeople) {
    personSelect.innerHTML += '<option value="' + person.id + '">' + person.name + "</option>";
  }

  locationSelect.innerHTML = '<option value="">All locations</option>';
  for (const loc of state.allLocations) {
    locationSelect.innerHTML += '<option value="' + loc.id + '">' + loc.id + "</option>";
  }

  const types: string[] = [];
  for (const evt of state.allTimeline) {
    if (types.indexOf(evt.type) === -1) types.push(evt.type);
  }
  typeSelect.innerHTML = '<option value="">All event types</option>';
  for (const type of types) {
    typeSelect.innerHTML += '<option value="' + type + '">' + type + "</option>";
  }
}

// REFACTOR (Demo 10, Exercise 1): renderTimeline itself STAYS a `function`
// declaration (see the note on `renderEvidenceList`/`clearFilters`/etc. in
// evidence.js and EXERCISE_1_ANSWERS.md, Demo 10) - it's wired up directly
// as `addEventListener("change", renderTimeline)` in main.js, not wrapped
// in an anonymous callback. The .sort() comparator and the click listener
// inside it, on the other hand, are genuinely anonymous inline callbacks
// with no such risk, so those do become arrow functions below.
export function renderTimeline(): void {
  const container = document.getElementById("timelineContainer");
  if (!container) return;

  const order = (document.getElementById("timelineOrder") as HTMLSelectElement).value;
  const personFilter = (document.getElementById("timelinePersonFilter") as HTMLSelectElement).value;
  const locationFilter = (document.getElementById("timelineLocationFilter") as HTMLSelectElement)
    .value;
  const typeFilter = (document.getElementById("timelineTypeFilter") as HTMLSelectElement).value;

  const events: TimelineEvent[] = [];
  for (const evt of state.allTimeline) {
    if (personFilter && evt.personIds.indexOf(personFilter) === -1) continue;
    if (locationFilter && evt.locationIds.indexOf(locationFilter) === -1) continue;
    if (typeFilter && evt.type !== typeFilter) continue;
    events.push(evt);
  }

  // TYPESCRIPT (Demo 7): `new Date(a.time) - new Date(b.time)` type-checks
  // in JavaScript only because `-` silently coerces both `Date` objects to
  // numbers via `valueOf()`; TypeScript's arithmetic operators require
  // actual `number`/`bigint` operands and reject two `Date`s outright
  // ("The left-hand side of an arithmetic operation must be of type...").
  // Spelling out `.getTime()` is what the original code was already doing
  // implicitly - real spot #2 of the "3 things the compiler made me think
  // about" for Demo 7 (see EXERCISE_2_ANSWERS.md): pedantic here, since the
  // implicit coercion was already correct, but it's exactly the kind of
  // silent coercion that *isn't* always correct, which is why TypeScript
  // refuses it categorically rather than case-by-case.
  const sortedEvents = events.slice().sort((a, b) => {
    const diff = new Date(a.time).getTime() - new Date(b.time).getTime();
    return order === "desc" ? -diff : diff;
  });

  let html = "";
  for (const item of sortedEvents) {
    html += '<div class="timeline-event certainty-' + item.certainty + '">';
    html +=
      '<div class="timeline-time">' +
      formatDate(item.time) +
      '&nbsp;&middot;&nbsp;<span class="badge badge-' +
      certaintyBadgeClass(item.certainty) +
      '">' +
      item.certainty +
      "</span></div>";
    html += "<h3>" + item.title + "</h3>";
    html += "<p>" + item.description + "</p>";

    const eventLocationNames: string[] = [];
    for (const locationId of item.locationIds) {
      const evtLoc = findLocationById(locationId, state.allLocations);
      // BUGFIX (Demo 5, Exercise 1): this used to push `evtLoc` itself - the whole
      // location OBJECT - instead of a display string. Nothing throws:
      // Array.prototype.join() happily calls .toString() on every item,
      // and the default Object.prototype.toString() returns "[object
      // Object]". So every timeline event with a resolvable location
      // silently rendered "Location: [object Object]" instead of the
      // location's name - a visible bug, but an easy one to read past
      // during a quick glance, since the layout still looked correct.
      eventLocationNames.push(evtLoc ? evtLoc.id + " - " + evtLoc.name : locationId);
    }
    if (eventLocationNames.length > 0) {
      html += '<p class="evidence-meta">Location: ' + eventLocationNames.join(", ") + "</p>";
    }

    for (const evidenceId of item.evidenceIds) {
      html +=
        '<button type="button" class="evidence-link-btn" data-evidence-id="' +
        evidenceId +
        '">View ' +
        evidenceId +
        "</button>";
    }
    html += "</div>";
  }
  if (sortedEvents.length === 0) {
    html = "<p>No timeline events match the current filters.</p>";
  }
  container.innerHTML = html;

  const linkButtons = container.querySelectorAll(".evidence-link-btn");
  for (const btn of linkButtons) {
    btn.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const evidenceId = target.getAttribute("data-evidence-id");
      if (evidenceId) openEvidenceModal(evidenceId);
    });
  }
}

const certaintyBadgeClass = (certainty: string): string => {
  if (certainty === "confirmed") return "reviewed";
  if (certainty === "contradictory") return "critical";
  if (certainty === "reported") return "flagged";
  return "unreviewed";
};

// --- Quick-view modal (used from the timeline) -------------------------
const openEvidenceModal = (evidenceId: string): void => {
  const ev = findEvidenceById(evidenceId, state.allEvidence);
  if (!ev) return;

  // BUGFIX (Demo 5, Exercise 1): this modal element is created once and reused - only
  // its .innerHTML is replaced on every call - but the click listener
  // below used to be attached every time openEvidenceModal() ran anyway,
  // OUTSIDE the `if (!modal)` guard. Listeners stack; nothing ever removed
  // the old ones. Opening the quick-view modal N times meant N
  // click handlers all running on every subsequent click - harmless-looking
  // (each one just re-does the same close/open-full logic) but a real,
  // growing memory/listener leak. The fix is to attach the listener exactly
  // once, at the point the modal element itself is created, using event
  // delegation (checking e.target) exactly as before.
  let modal = document.getElementById("quickViewModal");
  const isNewModal = !modal;
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quickViewModal";
    document.body.appendChild(modal);
  }
  // TYPESCRIPT (Demo 7): `modal` is narrowed to non-null right after the
  // `if (!modal) { modal = ... }` block above (TS understands that both
  // branches leave it assigned), but that narrowing doesn't reliably
  // survive into the `addEventListener` closure below - a `let` captured
  // by a closure is (correctly) treated as possibly reassigned by the time
  // the closure runs. Real spot #3: binding a `const` alias here is the
  // standard fix - it's a reference TypeScript can guarantee is never
  // reassigned, so the non-null narrowing is safe to carry into the
  // closure.
  const modalEl = modal;

  modalEl.innerHTML =
    '<div class="modal-backdrop"><div class="modal-box">' +
    '<button type="button" class="modal-close-btn" aria-label="Close">&times;</button>' +
    "<h3>" +
    ev.title +
    "</h3>" +
    '<p class="evidence-meta">' +
    ev.id +
    " &middot; " +
    ev.type +
    " &middot; " +
    formatDate(ev.timestamp) +
    "</p>" +
    "<p>" +
    ev.summary +
    "</p>" +
    '<button type="button" class="btn btn-primary btn-small" data-open-full="' +
    ev.id +
    '">Open full evidence</button>' +
    "</div></div>";

  if (!isNewModal) return;

  modalEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains("modal-close-btn") ||
      target.classList.contains("modal-backdrop")
    ) {
      modalEl.innerHTML = "";
    }
    const openFullId = target.getAttribute("data-open-full");
    if (openFullId) {
      modalEl.innerHTML = "";
      navigateTo("evidence");
      setTimeout(() => {
        openEvidenceDetail(openFullId);
      }, 0);
    }
  });
};
