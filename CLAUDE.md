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
Open `index.html` in any browser — no installation or server needed.

## File Structure
```
ProjektinhallintaClaude/
├── index.html      # Page structure: header, dashboard, side panel, command center, modals
├── styles.css      # Design system: tokens, layout, components, animations
├── app.js          # All logic: data layer, rendering, interactions, inline editing
└── CLAUDE.md       # This file
```

## Stack
- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework, no build step)
- **Storage:** `localStorage` (persists between sessions, key: `merch_tracker_data`)
- **Font:** Inter via Google Fonts
- **Hosting:** GitHub Pages (auto-deploys from `main` branch)

## Data Model
Stored as JSON in `localStorage` under key `merch_tracker_data`:

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Clash Royale S4 Plushies",
      "deadline": "2026-06-01",
      "status": "In Progress",
      "createdAt": "2026-05-05",
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
A project is flagged (amber left border + pulsing dot) when **any** of these are true:
1. Project status is **Blocked**
2. Deadline is **within 7 days** (and project is not Done)
3. At least one task has a **past due date** and is not Done

Done projects are never flagged regardless of deadline.

## Layout

```
┌──────────────────────────────────────────────────────┐
│  HEADER: Merch Tracker  [⚡ Agents] [☾] [•••] [+ New]│
├──────────────────────────────────────────────────────┤
│  PROJECT GRID (auto-fill, min 240px cards)           │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │  Card  │ │  Card  │ │  Card  │ │  Card  │        │
│  └────────┘ └────────┘ └────────┘ └────────┘        │
├──────────────────────────────────────────────────────┤
│  COMMAND CENTER (all tasks across all projects)      │
│  [Status pills] [Project ▾] [Sort ▾]                │
│  Project │ Task │ Status │ Due date │                │
└──────────────────────────────────────────────────────┘
```

When a project card is clicked, a **side detail panel** slides in from the right.
The grid stays visible and dimmed behind it. Press **Escape** or click the overlay to close.

## Features

### Dashboard
- Project cards in a responsive grid (auto-fills to ~5 columns at 1400px wide)
- Each card: name, status badge, deadline, up to 3 tasks with status dots, progress bar
- Attention: amber left border + pulsing dot on cards that need attention
- Cards animate in with a stagger on render

### Inline Editing (no modal needed)
- **Status badge** on any card → click opens a floating dropdown with all 4 statuses
- **Deadline** on any card → click replaces text with a date picker in-place
- Same inline editing available inside the detail panel

### Detail Panel (slide-in from right)
- Two tabs: **Tasks** and **Automation ✦** (placeholder)
- Project name, inline-editable status and deadline
- Full task list: click task status badge to cycle (Not Started → In Progress → Done)
- Edit and delete tasks from the panel
- Edit project name or delete project

### Command Center (below the grid)
- Unified table of every task across all projects
- Filter by status (pill buttons) and by project (dropdown)
- Sort by: Due date / Project / Status / Task name
- Overdue rows highlighted in red
- Click project name → opens that project's detail panel
- Click task status → cycles status inline
- Edit and delete tasks directly from the table

### Agent Panel (⚡ Agents button)
- Slides in from the right alongside the workspace (pushes grid, doesn't overlay it)
- Architectural placeholder for future automation features
- Content slot is wired and ready — adding features requires no layout changes

### Theme
- Dark / Light toggle in the header (☾ / ☀)
- Preference persists across sessions (stored in `localStorage` as `merch_tracker_theme`)
- Smooth 250ms transition on all surfaces and text

### Data Management
- **Export:** Downloads all data as a dated `.json` file (via ••• menu)
- **Import:** Restores from a previously exported `.json` file (via ••• menu)

## Design System
All colours, spacing, shadows, and radii are CSS custom properties in `styles.css`.
Switching between light and dark theme changes only the `:root` / `[data-theme="dark"]` token set.

| Token group | Examples |
|---|---|
| Accent purple | `--purple`, `--purple-light`, `--purple-hover` |
| Accent blue | `--blue`, `--blue-light` |
| Status colours | `--status-ip-bg`, `--status-bl-text`, etc. |
| Shadows | `--shadow-xs` through `--shadow-panel` |
| Transitions | `--transition-fast` (120ms) / `--transition-base` (200ms) / `--transition-slow` (320ms) |

## Animations
| Element | Motion |
|---|---|
| Project cards | Staggered fade-up (40ms delay between cards) |
| Attention dot | Slow amber pulse, 2.4s loop |
| Side / Agent panel | Slide from right, cubic-bezier ease-out |
| Overlay | Fade in/out (element stays in DOM to allow transition) |
| Status badges | Colour crossfade on change |
| Progress bars | Eased width transition (500ms) |

`prefers-reduced-motion` is respected — all animations collapse to instant.

## Design Decisions
- **localStorage:** No backend needed for single-user tool. Export/Import provides manual backup.
- **No framework:** No build step — edit a file, push, done. Easy to maintain without developer tooling.
- **Inline editing for status/deadline:** Fewer clicks, feels faster than opening a modal for small changes.
- **Task status cycles on click:** Single-click to advance a task avoids modal overhead.
- **Agent panel pushes workspace:** Keeps the grid visible while automation panel is open (vs. overlaying it).
- **Side panel uses transform, not display:none:** Allows CSS transitions to fire correctly.
- **Command Center hidden until projects exist:** Avoids empty/confusing UI on first load.

## Deploying Updates
When you make changes to any file:
```bash
cd /Users/salmari/ProjektinhallintaClaude
git add index.html styles.css app.js CLAUDE.md
git commit -m "Describe what you changed"
git push
```
GitHub Pages updates the live site within ~1 minute.

## Current State
- [x] Step 1: Design system — CSS variables, Inter font, spacing/shadow scale
- [x] Step 2: Layout shell — header, grid, command center section, agent panel slot
- [x] Step 3: Project cards — compact design, task preview, progress, attention dot
- [x] Step 4: Inline editing — status dropdown, deadline date picker
- [x] Step 5: Detail panel — slide-in, task list, automation tab placeholder
- [x] Step 6: Command Center — unified task table, filter + sort
- [x] Step 7: Theme toggle + animations
- [x] Step 8: Deployed to GitHub Pages, CLAUDE.md updated
