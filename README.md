# Project ReMotion – Investigation Portal

Investigate the failure of an AI-assisted rehabilitation robot.

## About

Project ReMotion is a browser-based investigation platform built around a fictional incident.
During a pre-demonstration calibration test, the AI-assisted rehabilitation robot **ReMotion**
loaded the wrong calibration profile and triggered its emergency stop. This application lets an
investigator review the evidence, people, locations, and timeline surrounding the incident, and
build up a working hypothesis about what happened.

This repository contains a TypeScript investigation application (originally vanilla JavaScript, no
frameworks used), built and served with [Vite](https://vitejs.dev). The system is functional but has
accumulated technical debt and inconsistent implementation decisions. Your task during the course
will be to analyse, maintain, refactor, migrate, and extend it.

## Running the application

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install     # first time only
npm run dev     # start the Vite dev server with hot module replacement
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Other scripts:

```bash
npm run build         # type-check, then produce a production build in dist/
npm run preview       # serve the production build from dist/ locally
npm run lint          # ESLint
npm run lint:fix       # ESLint, applying safe auto-fixes
npm run format        # Prettier, rewriting files
npm run format:check  # Prettier, check only (used in CI)
npm run typecheck     # tsc --noEmit
```

Case data lives under `public/data/*.json` and is fetched by the app at runtime — Vite serves
`public/` as static passthrough files, so this works the same way in `dev`, `build`, and `preview`.

## Features

- **Dashboard** — case summary and key statistics calculated from the loaded case data.
- **Evidence catalogue** — search, filter (by type, person, location, status, relevance), sort,
  bookmark, and open detailed evidence records.
- **People & Locations** — profile cards for the investigation team and the six key locations.
- **Timeline** — chronological view of case events with filtering and links to related evidence.
- **Investigator workspace** — bookmarked evidence, personal notes, and a hypothesis draft form.
  Workspace data is saved to your browser's local storage and will still be there when you reload
  the page.

## Browser requirements

A recent version of any evergreen desktop browser (Chrome, Firefox, Edge, Safari). JavaScript must
be enabled. The layout targets common desktop and tablet widths.

## Project status

This is an existing brownfield application, not a fresh scaffold. It works for everyday use, but
you should expect to find rough edges, inconsistent patterns, and a handful of bugs as you work
with it — that discovery process is part of the course.
