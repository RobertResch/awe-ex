// ---------------------------------------------------------------------
// PEOPLE & LOCATIONS
// ---------------------------------------------------------------------
import { state } from "./state.js";
import { evidenceMentionsPerson } from "./utils.js";
import { navigateTo } from "./router.js";
import { renderEvidenceList } from "./evidence.js";
import type { Person } from "./types.js";

export function switchPeopleTab(tab: "people" | "locations"): void {
  state.currentPeopleTab = tab;
  // These four ids are unconditional, static markup in index.html - see the
  // same `!` reasoning as router.ts's `#view-<hash>` lookup.
  const peoplePanel = document.getElementById("peoplePanel")!;
  const locationsPanel = document.getElementById("locationsPanel")!;
  const peopleTabBtn = document.getElementById("tabPeopleBtn")!;
  const locationsTabBtn = document.getElementById("tabLocationsBtn")!;

  if (tab === "people") {
    peoplePanel.classList.remove("hidden");
    locationsPanel.classList.add("hidden");
    peopleTabBtn.classList.add("active");
    locationsTabBtn.classList.remove("active");
  } else {
    peoplePanel.classList.add("hidden");
    locationsPanel.classList.remove("hidden");
    peopleTabBtn.classList.remove("active");
    locationsTabBtn.classList.add("active");
  }
}

// REFACTOR (Demo 10, Exercise 1): private, pure-ish helper (reads state.allEvidence but
// takes no DOM/`this` dependency) - safe arrow-function candidate.
const countEvidenceForPerson = (person: Person): number => {
  let count = 0;
  for (const ev of state.allEvidence) {
    if (evidenceMentionsPerson(ev, person)) count++;
  }
  return count;
};

export function renderPeople(): void {
  const container = document.getElementById("peoplePanel")!;
  let html = "";
  for (const person of state.allPeople) {
    const count = countEvidenceForPerson(person);

    html += '<div class="person-card">';
    html += '<div class="person-card-header">';
    html +=
      '<img class="person-avatar" src="' +
      person.avatar +
      '" alt="Portrait of ' +
      person.name +
      '">';
    html +=
      "<div><h3>" + person.name + '</h3><div class="person-role">' + person.role + "</div></div>";
    html += "</div>";
    html += "<p><strong>Speciality:</strong> " + person.speciality + "</p>";
    html += "<ul>";
    for (const responsibility of person.responsibilities) {
      html += "<li>" + responsibility + "</li>";
    }
    html += "</ul>";
    html += '<div class="person-statement">&ldquo;' + person.statement + "&rdquo;</div>";
    html += "<p>" + count + " related evidence item" + (count === 1 ? "" : "s") + " &mdash; ";
    html +=
      '<button type="button" class="evidence-count-link" data-person-id="' +
      person.id +
      '">view</button></p>';
    html += "</div>";
  }
  container.innerHTML = html;

  const links = container.querySelectorAll(".evidence-count-link");
  for (const link of links) {
    link.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const personId = target.getAttribute("data-person-id");
      const filterPersonSelect = document.getElementById(
        "filterPerson"
      ) as HTMLSelectElement | null;
      if (filterPersonSelect) filterPersonSelect.value = personId ?? "";
      navigateTo("evidence");
      setTimeout(() => {
        renderEvidenceList();
      }, 0);
    });
  }
}

export function renderLocations(): void {
  const container = document.getElementById("locationsPanel")!;
  let html = "";
  for (const loc of state.allLocations) {
    html += '<div class="location-card">';
    html += "<h3>" + loc.id + " &mdash; " + loc.name + "</h3>";
    html += "<p>" + loc.description + "</p>";
    html += "<p><strong>Contains:</strong></p><ul>";
    for (const item of loc.contains) {
      html += "<li>" + item + "</li>";
    }
    html += "</ul></div>";
  }
  container.innerHTML = html;
}
