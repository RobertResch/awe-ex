// ---------------------------------------------------------------------
// DOMAIN DATA MODEL
// ---------------------------------------------------------------------
// Interfaces matching the shape of the files under data/*.json (now served
// from public/data/*.json, see Demo 2). These are the NORMALIZED shapes the
// rest of the app can trust once dataLoader.ts has processed the raw JSON -
// see dataLoader.ts's `RawEvidence` type and `normalizeStatus`/
// `normalizeRelevance` for the one field that needed actual normalization,
// not just a type annotation.

export interface CaseData {
  caseId: string;
  title: string;
  subtitle: string;
  status: string;
  opened: string;
  summary: string;
  location: string;
  leadInvestigator: string;
  notes: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  speciality: string;
  responsibilities: string[];
  statement: string;
  background: string;
  avatar: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  contains: string[];
}

// AMBIGUOUS FIELD (Demo 6): evidence.json/timeline.json entries reference
// people through `personIds`, but the array doesn't consistently hold
// person `id` slugs (e.g. "kernel-colt") - evidenceMentionsPerson()
// (utils.ts) has always checked BOTH `person.id` and `person.name` against
// this array, which only makes sense if some entries hold one and some
// hold the other. The plain-JS version never had to admit this: an
// untyped array can silently hold a mix of shapes forever. Modeling it as
// `PersonRef = string` doesn't resolve the ambiguity (that would require
// going back to fix the source data, out of scope here) - it documents it,
// which is the honest thing a type can do when the data itself is
// inconsistent. See EXERCISE_2_ANSWERS.md, Demo 6, for the full writeup.
export type PersonRef = string;

export type EvidenceStatus = "unreviewed" | "reviewed" | "flagged";
export type EvidenceRelevance = "unknown" | "relevant" | "irrelevant";

export interface Evidence {
  id: string;
  type: string;
  title: string;
  timestamp: string;
  summary: string;
  content: string;
  personIds: PersonRef[];
  locationIds: string[];
  tags: string[];
  status: EvidenceStatus;
  relevance: EvidenceRelevance;
  // Not present in evidence.json - set at runtime by
  // applyStoredBookmarkFlags() (evidence.ts) from state.bookmarks.
  bookmarked?: boolean;
}

// certainty is deliberately typed as `string`, not a
// "confirmed" | "reported" | "contradictory" union: certaintyBadgeClass()
// (timeline.ts) already has to handle an "anything else" fallback case, so
// pretending this field is a closed set would be modeling wishful thinking
// instead of what the data (and the code that reads it) actually does.
export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  type: string;
  certainty: string;
  personIds: PersonRef[];
  locationIds: string[];
  evidenceIds: string[];
}
