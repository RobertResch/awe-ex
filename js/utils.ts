// ---------------------------------------------------------------------
// GENERIC LOOKUP / FORMATTING HELPERS
// ---------------------------------------------------------------------
// Pure functions: given the same inputs they always return the same
// output, and they touch neither shared state nor the network. That is
// what makes this module safe to import from almost anywhere without
// worrying about import cycles or side effects - it has zero imports of
// its own.
//
// The three "findXById" helpers used to reach for the global arrays
// directly (the module-level `var allEvidence`, etc. from the original
// app.js). Here they take the collection to search as a parameter instead.
// That is a deliberate module-boundary decision (not a bug fix): it is
// what lets this module stay a dependency-free leaf, and it is exactly the
// kind of "not everything needs to be public" / "not everything needs to
// reach for global state" call the exercise asks for.
//
// TYPESCRIPT (Demo 5): the three "findXById" helpers are typed generically
// over `{ id: string }` instead of a concrete `Evidence`/`Person`/`Location`
// type - those domain types don't exist yet (they're Demo 6's job), and a
// generic constraint is actually a more honest description of what these
// functions require: nothing about them cares which domain type they're
// searching, only that each item has an `id`. Calling them with
// `Evidence[]`/`Person[]`/`Location[]` later (Demo 6+) still works exactly
// as before - TypeScript infers `T` from the argument.

interface WithId {
  id: string;
}

// TYPESCRIPT (Demo 5/7): with `noUncheckedIndexedAccess` on, `list[i]` has
// type `T | undefined` (not `T`) - the compiler no longer trusts that an
// in-bounds-looking numeric index actually is in bounds. Binding it to a
// local first and checking truthiness narrows it back to `T` for the rest
// of the block. This isn't just satisfying the compiler: it's the exact
// same "trust the array has what I think it has" assumption that caused
// real bugs elsewhere in this codebase (see EXERCISE_1_ANSWERS.md) - see
// Demo 7 write-up for why this is judged a real, if minor, safety win
// rather than pedantry.
export const findEvidenceById = <T extends WithId>(id: string, evidenceList: T[]): T | null => {
  for (let i = 0; i < evidenceList.length; i++) {
    const item = evidenceList[i];
    if (item && item.id === id) return item;
  }
  return null;
};

export const findPersonById = <T extends WithId>(id: string, peopleList: T[]): T | null => {
  for (let i = 0; i < peopleList.length; i++) {
    const item = peopleList[i];
    if (item && item.id === id) return item;
  }
  return null;
};

export const findLocationById = <T extends WithId>(id: string, locationsList: T[]): T | null => {
  for (let i = 0; i < locationsList.length; i++) {
    const item = locationsList[i];
    if (item && item.id === id) return item;
  }
  return null;
};

interface EvidenceLike {
  personIds?: string[];
}

interface PersonLike {
  id: string;
  name: string;
}

export const evidenceMentionsPerson = (ev: EvidenceLike, person: PersonLike): boolean => {
  if (!ev.personIds) return false;
  return ev.personIds.indexOf(person.id) !== -1 || ev.personIds.indexOf(person.name) !== -1;
};

export const formatDate = (ts: string | undefined | null): string => {
  if (!ts) return "Unknown date";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return (
    d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
};

export const getStatusBadgeClass = (status: string | undefined | null): string => {
  const s = (status || "").toLowerCase();
  if (s === "reviewed") return "badge-reviewed";
  if (s === "flagged") return "badge-flagged";
  return "badge-unreviewed";
};

export const getRelevanceBadgeClass = (relevance: string | undefined | null): string => {
  const r = (relevance || "").toLowerCase();
  if (r === "relevant") return "badge-relevant";
  return "badge-unreviewed";
};

export const getSelectedOptions = (selectEl: HTMLSelectElement): string[] => {
  const result: string[] = [];
  for (let i = 0; i < selectEl.options.length; i++) {
    const option = selectEl.options[i];
    if (option && option.selected) result.push(option.value);
  }
  return result;
};
