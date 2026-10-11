# MiniOS — phase roadmap

Web MiniOS shell, local-only persistence (localStorage). One state shape + one
action layer (`src/lib/minios/store.tsx`) drives every surface: UI, keyboard,
copilot.

## Phase 1 — Desktop shell (done)

- Window model: windowed / minimized / fullscreen, drag, focus, z-order.
- Workspaces with per-workspace windows and switching.
- Internal apps: Notes, Files (mock tree), Window Manager, Settings.
- Taskbar/dock with running-app state; glassmorphic theming + accent tokens.
- Local persistence of windows, workspaces, notes, preferences.

## Phase 2 — Window management (done)

- Snap zones: halves, quarters, maximize/fill (`snap.ts`) with drag preview.
- Workspace tiling grid.
- Keyboard shortcuts: Alt+Arrows (snap), Alt+T tile, Alt+W close, Alt+S settings,
  Alt+1–4 workspaces, ⌘K/Ctrl+K copilot.

## Phase 3 — Universal copilot (done)

- Capability registry (`capabilities.ts`) — id, description, params, examples,
  deterministic matcher, resolver → store actions.
- App-contributed capabilities (`app-capabilities.ts`): note append/delete,
  motion and snapping toggles. Apps extend the vocabulary without planner edits.
- Planner (`planner.ts`): clause splitting on and/then/commas, sequential
  resolution against a simulated state so "it" refers to earlier steps.
- AI fallback (`copilot.functions.ts`): capability catalog + shell state sent to
  the Lovable AI Gateway, strict JSON plan schema, graceful error handling.
- Copilot UI: numbered plan preview, AI badge, history, undo of the last plan.

## Phase 4 — Sessions & plugins (in progress)

- [x] Session snapshots: named layouts you can save and restore from the Window
      Manager or the copilot ("save layout as writing", "restore writing").
- [x] Living AI core: seven anchors, automatic or locked placement, interaction
      states, curved window exclusion, and natural-language positioning.

- [ ] App plugin API: apps declare windows, capabilities and settings in one
      manifest so adding an app is a single file.
- [ ] Virtual displays: more than one canvas, move windows between displays.
- [ ] Command palette parity: run any capability from a list, not just text.
- [ ] Multi-step undo stack (currently one level).

## Phase 5 — Beyond the browser (not started)

- [ ] Native shell (Tauri) hosting the same React shell.
- [ ] Bridge capabilities to real OS windows.
- [ ] Server-side persistence and sync (replaces local-only storage).
