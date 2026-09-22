// ---------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------
import { state } from "./state.js";
import { formatDate, getStatusBadgeClass } from "./utils.js";
import type { Evidence, TimelineEvent } from "./types.js";

export function renderDashboard(): void {
  const container = document.getElementById("dashboardContent");
  if (!container) return;

  // TYPESCRIPT (Demo 7): with `noUncheckedIndexedAccess` on,
  // `state.allEvidence[i]` is `Evidence | undefined`, not `Evidence` -
  // looping with `for...of` instead of a manual index reads each element
  // directly typed as `Evidence` (iterating an array can't produce
  // `undefined`the way indexing can), which sidesteps the false-undefined
  // case entirely instead of guarding against it. Applied the same way to
  // every "just read each item" loop below and in the other converted
  // modules; loops that also need the index for something else keep their
  // original `for (let i = ...)` shape with an explicit guard instead (see
  // evidence.ts).
  let reviewedCount = 0;
  for (const ev of state.allEvidence) {
    if ((ev.status || "").toLowerCase() === "reviewed") reviewedCount++;
  }

  const progressPct =
    state.allEvidence.length === 0
      ? 0
      : Math.round((reviewedCount / state.allEvidence.length) * 100);

  let html = "";
  html += '<div class="case-summary-card">';
  html += "<h3>" + (state.caseData.title || "Case") + "</h3>";
  html +=
    '<p><span class="badge badge-flagged">' +
    (state.caseData.status || "unknown").toUpperCase() +
    "</span></p>";
  html += "<p>" + (state.caseData.summary || "") + "</p>";
  html += "</div>";

  html += '<div class="stat-grid">';
  html += statCardHTML(state.allEvidence.length, "Evidence items");
  html += statCardHTML(state.allPeople.length, "People");
  html += statCardHTML(state.allLocations.length, "Locations");
  html += statCardHTML(state.bookmarks.length, "Bookmarked");
  html += statCardHTML(reviewedCount, "Reviewed");
  html += "</div>";

  html += '<div class="dashboard-panel">';
  html += "<h3>Review progress</h3>";
  html +=
    '<div class="progress-bar-outer"><div class="progress-bar-inner" style="width:' +
    progressPct +
    '%;"></div></div>';
  html += "<p>" + progressPct + "% of evidence reviewed</p>";
  html += "</div>";

  html += '<div class="dashboard-columns">';

  html += '<div class="dashboard-panel"><h3>Recent evidence</h3>';
  const recentEvidence: Evidence[] = state.allEvidence.slice(-5).reverse();
  if (recentEvidence.length === 0) {
    html += "<p>No evidence loaded yet.</p>";
  }
  for (const ev of recentEvidence) {
    html +=
      '<div class="mini-list-item"><strong>' +
      ev.id +
      "</strong> &mdash; " +
      ev.title +
      ' <span class="badge ' +
      getStatusBadgeClass(ev.status) +
      '">' +
      ev.status +
      "</span></div>";
  }
  html += "</div>";

  html += '<div class="dashboard-panel"><h3>Recent timeline events</h3>';
  const recentTimeline: TimelineEvent[] = state.allTimeline.slice(-5).reverse();
  if (recentTimeline.length === 0) {
    html += "<p>No timeline events loaded yet.</p>";
  }
  for (const evt of recentTimeline) {
    html +=
      '<div class="mini-list-item"><strong>' +
      formatDate(evt.time) +
      "</strong><br>" +
      evt.title +
      "</div>";
  }
  html += "</div>";

  html += "</div>"; // dashboard-columns

  container.innerHTML = html;
}

// REFACTOR (Demo 10, Exercise 1): private helper, never used as an event-listener
// reference, doesn't touch `this` - a clean arrow-function candidate. It's
// referenced above (inside renderDashboard) before this line textually,
// but that's fine: renderDashboard's body doesn't run until it's called
// from elsewhere, by which point this module has fully finished
// evaluating and `statCardHTML` is already initialized. Hoisting only
// would have mattered if something called statCardHTML() at module
// top-level, outside of any function - nothing here does.
const statCardHTML = (value: number, label: string): string => {
  return (
    '<div class="stat-card"><div class="stat-value">' +
    value +
    '</div><div class="stat-label">' +
    label +
    "</div></div>"
  );
};
