# ProjektinhallintaClaude — Merch Project Tracker

## Project Overview
A browser-based project tracking tool for a freelance merch production consultant (Supercell).
Tracks multiple merchandising projects simultaneously with tasks, deadlines, and status.
Single-user, runs entirely in the browser — no server, no login, no internet required after first load.

## Live URL
https://ville-git.github.io/ProjektinhallintaClaude/

## GitHub Repository
https://github.com/ville-git/ProjektinhallintaClaude

## How to Run Locally
Just open `index.html` in any browser — no installation or server needed.

## File Structure
```
ProjektinhallintaClaude/
├── index.html      # Page structure: header, dashboard view, detail view, modals
├── styles.css      # All styling: layout, cards, badges, modals, responsive
├── app.js          # All logic: data layer, rendering, event handling
└── CLAUDE.md       # This file
```

## Stack
- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework, no build step)
- **Storage:** `localStorage` (data lives in the browser, persists between sessions)
- **Hosting:** GitHub Pages (free, auto-deploys from `main` branch)

## Data Model
Data is stored in `localStorage` under the key `merch_tracker_data` as JSON:

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Clash Royale S4 Plushies",
      "deadline": "2026-06-01",
      "status": "In Progress",
      "createdAt": "2026-05-04",
      "tasks": [
        {
          "id": "uuid",
          "name": "Approve sample",
          "status": "Not Started",
          "dueDate": "2026-05-10"
        }
      ]
    }
  ]
}
```

## Statuses
| Level | Options |
|---|---|
| Project | Not Started · In Progress · Blocked · Done |
| Task | Not Started · In Progress · Done |

## "Needs Attention" Logic
A project is flagged (yellow card border + attention tag) when **any** of these are true:
1. Project status is **Blocked**
2. Deadline is **within 7 days** (and project is not Done)
3. At least one task has a **past due date** and is not Done

Done projects are never flagged.

## Features
- Create, edit, delete projects (name + deadline + status)
- Create, edit, delete tasks under each project (name + status + optional due date)
- Dashboard with project cards showing status, deadline, task progress bar
- Sticky attention bar counting projects that need attention
- Project detail view with full task list
- **Export:** downloads all data as a dated `.json` file (backup)
- **Import:** restores data from a previously exported `.json` file

## Design Decisions
- **localStorage over a server:** Single-user tool — no backend needed. Simpler to run and host.
- **Export/Import buttons:** Provides a manual backup mechanism since localStorage is browser-bound.
- **No framework:** Keeps the codebase small and easy to understand without developer tooling.
- **GitHub Pages:** Free static hosting that auto-serves `index.html` from the `main` branch.
- **Vanilla JS:** No build step — edit a file, push, done.

## Deploying Updates
When you make changes to any file:
```bash
cd /Users/salmari/ProjektinhallintaClaude
git add index.html styles.css app.js CLAUDE.md
git commit -m "Describe what you changed"
git push
```
GitHub Pages will update the live site within ~1 minute.

## Current State
- [x] Step 1: HTML skeleton + CSS design system
- [x] Step 2: Data layer (localStorage CRUD)
- [x] Step 3: Dashboard view with project cards
- [x] Step 4: Project detail view with task list
- [x] Step 5: Create & edit modals for projects and tasks
- [x] Step 6: "Needs attention" logic + alert bar + card highlighting
- [x] Step 7: Export / Import JSON
- [x] Step 8: CLAUDE.md
- [x] Deployed to GitHub Pages
