import { APP_CAPABILITIES } from "./app-capabilities";
import { APP_LIST } from "./apps";
import { SNAP_ZONE_LABELS, type SnapZone } from "./snap";
import { computeDesktopGridLayout, GRID_PRESETS, type GridPreset } from "./spatial-grid";
import type { Action } from "./store";
import type { CoreAnchor, CoreMode, DesktopState, WindowState } from "./types";

/**
 * Capability registry — the single vocabulary of the shell.
 *
 * Every intent producer (command bar, keyboard, gestures, LLM copilot) speaks
 * this vocabulary: it names a capability id plus string args, and the registry
 * turns that into store actions. Adding an app, tool or behaviour means adding
 * one entry here — the planner, the UI and the AI prompt pick it up for free.
 */

export type CapabilityArgs = Record<string, string | undefined>;

export type CapabilityContext = {
  state: DesktopState;
  bounds: { width: number; height: number };
};

export type Resolved = { label: string; actions: Action[] };

export type Capability = {
  id: string;
  /** Shown in the UI and given to the LLM. */
  description: string;
  /** Parameter name -> what it accepts. */
  params: Record<string, string>;
  examples: string[];
  /** Deterministic keyword matcher for a single clause of user text. */
  match: (text: string, ctx: CapabilityContext) => CapabilityArgs | null;
  /** Turn args into store actions against the current (simulated) state. */
  resolve: (args: CapabilityArgs, ctx: CapabilityContext) => Resolved | null;
};

/* ------------------------------------------------------------------ helpers */

const ACCENTS = ["teal", "amber", "rose"] as const;
const CORE_ANCHORS: CoreAnchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
];
const CORE_MODES: CoreMode[] = ["idle", "listening", "thinking", "speaking", "sleep"];

function coreAnchorInText(text: string): CoreAnchor | null {
  if (/\b(main|screen|middle) center\b|\bcenter of (?:the )?screen\b/.test(text)) return "center";
  if (/\btop.?left|upper.?left\b/.test(text)) return "top-left";
  if (/\btop.?right|upper.?right\b/.test(text)) return "top-right";
  if (/\bbottom.?left|lower.?left\b/.test(text)) return "bottom-left";
  if (/\bbottom.?right|lower.?right\b/.test(text)) return "bottom-right";
  if (/\btop.?center|top.?middle\b/.test(text)) return "top-center";
  if (/\bbottom.?center|bottom.?middle\b/.test(text)) return "bottom-center";
  if (/\bcenter\b/.test(text)) return "center";
  return null;
}

function activeWindows(state: DesktopState): WindowState[] {
  return state.windows.filter((w) => w.workspaceId === state.activeWorkspaceId);
}

function appFromText(text: string) {
  return APP_LIST.find((a) => text.includes(a.id) || text.includes(a.name.toLowerCase()));
}

/** Resolve a target window from an arg like "notes", "focused", "this window". */
export function findTarget(args: CapabilityArgs, ctx: CapabilityContext): WindowState | undefined {
  const windows = activeWindows(ctx.state);
  const focused = windows.find((w) => w.focused) ?? windows.at(-1);
  const raw = (args["target"] ?? args["app"] ?? "").trim().toLowerCase();
  if (!raw || /^(this|it|current|focus(ed)?|active|window)$/.test(raw)) return focused;
  const app = appFromText(raw);
  if (app) {
    const match = windows.find((w) => w.appId === app.id);
    if (match) return match;
  }
  return (
    windows.find((w) => w.title.toLowerCase().includes(raw)) ??
    windows.find((w) => w.appId.includes(raw)) ??
    focused
  );
}

function findWorkspace(args: CapabilityArgs, ctx: CapabilityContext) {
  const raw = (args["workspace"] ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  return (
    ctx.state.workspaces.find((w) => w.name.toLowerCase() === raw) ??
    ctx.state.workspaces.find((w) => w.name.toLowerCase().includes(raw)) ??
    ctx.state.workspaces.find((w) => w.id === raw)
  );
}

function workspaceInText(text: string, ctx: CapabilityContext) {
  return ctx.state.workspaces.find((w) => text.includes(w.name.toLowerCase()));
}

function zoneInText(text: string): SnapZone | null {
  if (/top.?left|upper.?left/.test(text)) return "top-left";
  if (/top.?right|upper.?right/.test(text)) return "top-right";
  if (/bottom.?left|lower.?left/.test(text)) return "bottom-left";
  if (/bottom.?right|lower.?right/.test(text)) return "bottom-right";
  if (/\bleft\b/.test(text)) return "left";
  if (/\bright\b/.test(text)) return "right";
  if (/\b(fill|full|whole|maximi[sz]e|top)\b/.test(text)) return "maximize";
  return null;
}

function targetArgsFromText(text: string): CapabilityArgs {
  const app = appFromText(text);
  return app ? { target: app.id } : {};
}

/* ------------------------------------------------------------- capabilities */

const SHELL_CAPABILITIES: Capability[] = [
  {
    id: "set_core_auto",
    description: "Let the AI core choose its position automatically around windows",
    params: {},
    examples: ["position yourself automatically", "core auto position"],
    match: (text) => {
      const subject = ["core", "avatar", "yourself", "you"].some((word) => text.includes(word));
      const automatic = ["auto", "automatic", "smart", "best position"].some((word) =>
        text.includes(word),
      );
      return subject && automatic ? {} : null;
    },
    resolve: () => ({ label: "Core position → automatic", actions: [{ type: "set_core_auto" }] }),
  },
  {
    id: "move_core",
    description: "Move and lock the AI core to one of its seven screen positions",
    params: { anchor: CORE_ANCHORS.join(" | ") },
    examples: [
      "move yourself top right",
      "stay in the bottom center",
      "put the core in screen center",
    ],
    match: (text) => {
      if (!/\b(core|avatar|yourself|you)\b/.test(text)) return null;
      const anchor = coreAnchorInText(text);
      return anchor ? { anchor } : null;
    },
    resolve: (args) => {
      const anchor = CORE_ANCHORS.find((value) => value === args["anchor"]);
      return anchor
        ? {
            label: `Core → ${anchor.replace("-", " ")}`,
            actions: [{ type: "set_core_anchor", anchor, placement: "locked" }],
          }
        : null;
    },
  },
  {
    id: "set_core_mode",
    description: "Set the visual interaction mode of the AI core",
    params: { mode: CORE_MODES.join(" | ") },
    examples: ["put the core to sleep", "wake up the avatar"],
    match: (text) => {
      if (!/\b(core|avatar|you)\b/.test(text)) return null;
      if (/\b(sleep|sleeping)\b/.test(text)) return { mode: "sleep" };
      if (/\b(wake|idle)\b/.test(text)) return { mode: "idle" };
      return null;
    },
    resolve: (args) => {
      const mode = CORE_MODES.find((value) => value === args["mode"]);
      return mode
        ? { label: `Core mode → ${mode}`, actions: [{ type: "set_core_mode", mode }] }
        : null;
    },
  },
  {
    id: "save_layout",
    description: "Save the current window layout as a named snapshot you can restore later",
    params: { title: "name for the layout" },
    examples: ["save layout as writing", "save this setup as research"],
    match: (text) => {
      if (!/\b(layout|snapshot|setup|session|arrangement)\b/.test(text)) return null;
      if (!/\b(save|store|remember|keep|capture)\b/.test(text)) return null;
      const named =
        /(?:as|called|titled|named)\s+(.+)$/.exec(text) ??
        /(?:layout|snapshot|setup|session|arrangement)\s+(.+)$/.exec(text);
      return { title: named?.[1]?.trim() ?? "" };
    },
    resolve: (args, ctx) => {
      const name = (args["title"] ?? "").trim() || `Layout ${ctx.state.layouts.length + 1}`;
      return {
        label: `Save layout “${name}”`,
        actions: [{ type: "save_layout", name }],
      };
    },
  },
  {
    id: "restore_layout",
    description: "Restore a previously saved named layout",
    params: { title: "saved layout name" },
    examples: ["restore writing", "load the research layout"],
    match: (text, ctx) => {
      const named = ctx.state.layouts.find((l) => text.includes(l.name.toLowerCase()));
      const verb = /\b(restore|load|reopen|bring back|switch to|use)\b/.test(text);
      if (named && verb) return { title: named.name };
      if (/\b(layout|snapshot|setup|session)\b/.test(text) && verb) {
        const m =
          /(?:restore|load|reopen|use)\s+(?:the\s+)?(.+?)\s+(?:layout|snapshot|setup|session)/.exec(
            text,
          ) ?? /(?:layout|snapshot|setup|session)\s+(.+)$/.exec(text);
        return m?.[1] ? { title: m[1].trim() } : null;
      }
      return null;
    },
    resolve: (args, ctx) => {
      const raw = (args["title"] ?? "").trim().toLowerCase();
      const layout =
        ctx.state.layouts.find((l) => l.name.toLowerCase() === raw) ??
        ctx.state.layouts.find((l) => l.name.toLowerCase().includes(raw));
      if (!layout) return null;
      return {
        label: `Restore layout “${layout.name}”`,
        actions: [{ type: "restore_layout", id: layout.id }],
      };
    },
  },
  {
    id: "delete_layout",
    description: "Delete a saved layout",
    params: { title: "saved layout name" },
    examples: ["delete the writing layout", "forget layout research"],
    match: (text, ctx) => {
      if (!/\b(delete|remove|forget|discard)\b/.test(text)) return null;
      const named = ctx.state.layouts.find((l) => text.includes(l.name.toLowerCase()));
      if (named && /\b(layout|snapshot|setup|session)\b/.test(text)) return { title: named.name };
      return null;
    },
    resolve: (args, ctx) => {
      const raw = (args["title"] ?? "").trim().toLowerCase();
      const layout = ctx.state.layouts.find((l) => l.name.toLowerCase() === raw);
      if (!layout) return null;
      return {
        label: `Delete layout “${layout.name}”`,
        actions: [{ type: "delete_layout", id: layout.id }],
      };
    },
  },
  {
    id: "open_app",
    description: "Open (or focus) an app window",
    params: { app: `one of: ${APP_LIST.map((a) => a.id).join(", ")}` },
    examples: ["open notes", "launch the file browser", "show settings"],
    match: (text) => {
      const app = appFromText(text);
      if (!app) return null;
      if (/\b(open|launch|start|show|bring up|run|fire up)\b/.test(text)) return { app: app.id };
      // A bare app name with no other verb still means "open it".
      return /\b(snap|close|quit|minimi|maximi|fullscreen|tile|move|send|restore|hide)\b/.test(text)
        ? null
        : { app: app.id };
    },
    resolve: (args) => {
      const app = APP_LIST.find(
        (a) =>
          a.id === (args["app"] ?? "").toLowerCase() ||
          a.name.toLowerCase() === (args["app"] ?? "").toLowerCase(),
      );
      if (!app) return null;
      return { label: `Open ${app.name}`, actions: [{ type: "open_app", appId: app.id }] };
    },
  },
  {
    id: "snap_window",
    description: "Snap a window to a half, quarter or fill the workspace",
    params: {
      target: "app id, window title, or 'focused'",
      zone: "left | right | top-left | top-right | bottom-left | bottom-right | maximize",
    },
    examples: [
      "snap notes left",
      "dock files to the bottom right",
      "put settings on the right half",
    ],
    match: (text) => {
      const zone = zoneInText(text);
      if (!zone) return null;
      if (!/\b(snap|dock|half|quarter|put|move|place|pin|side)\b/.test(text)) return null;
      return { ...targetArgsFromText(text), zone };
    },
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      const zone = (args["zone"] ?? "").toLowerCase() as SnapZone;
      if (!target || !SNAP_ZONE_LABELS[zone]) return null;
      return {
        label: `${SNAP_ZONE_LABELS[zone]} · ${target.title}`,
        actions: [{ type: "snap_window", id: target.id, zone, bounds: ctx.bounds }],
      };
    },
  },
  {
    id: "tile_workspace",
    description: "Arrange every visible window of the workspace in a grid",
    params: {},
    examples: ["tile the workspace", "arrange everything", "grid layout"],
    match: (text) => (/\b(tile|arrange|organi[sz]e|clean up the windows)\b/.test(text) ? {} : null),
    resolve: (_args, ctx) => ({
      label: "Tile this workspace",
      actions: [{ type: "tile_workspace", bounds: ctx.bounds }],
    }),
  },
  {
    id: "snap_window_to_grid",
    description:
      "Snap a window to specific grid coordinates or preset (e.g. left half, right half, quadrants, center stage)",
    params: {
      target: "app id, window title, or 'focused'",
      preset: Object.keys(GRID_PRESETS).join(" | "),
    },
    examples: [
      "dock notes to left grid half",
      "put files on right half of grid",
      "snap notes to center stage",
    ],
    match: (text) => {
      if (!/\b(grid|dock|columns?|matrix)\b/.test(text)) return null;
      let preset: GridPreset | null = null;
      if (/\b(left half|cols 1-6|left 6)\b/.test(text)) preset = "left_half";
      else if (/\b(right half|cols 7-12|right 6)\b/.test(text)) preset = "right_half";
      else if (/\b(top half|upper half)\b/.test(text)) preset = "top_half";
      else if (/\b(bottom half|lower half)\b/.test(text)) preset = "bottom_half";
      else if (/\btop.?left\b/.test(text)) preset = "top_left_quad";
      else if (/\btop.?right\b/.test(text)) preset = "top_right_quad";
      else if (/\bbottom.?left\b/.test(text)) preset = "bottom_left_quad";
      else if (/\bbottom.?right\b/.test(text)) preset = "bottom_right_quad";
      else if (/\bcenter\b/.test(text)) preset = "center_stage";
      else if (/\b(full|whole)\b/.test(text)) preset = "full_grid";
      if (!preset) return null;
      return { ...targetArgsFromText(text), preset };
    },
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      const presetKey = (args["preset"] ?? "") as GridPreset;
      const preset = GRID_PRESETS[presetKey];
      if (!target || !preset) return null;
      return {
        label: `Grid: ${preset.name} · ${target.title}`,
        actions: [
          {
            type: "snap_window_to_grid",
            id: target.id,
            colStart: preset.colStart,
            colSpan: preset.colSpan,
            rowStart: preset.rowStart,
            rowSpan: preset.rowSpan,
            bounds: ctx.bounds,
          },
        ],
      };
    },
  },
  {
    id: "close_window",
    description: "Close a window",
    params: { target: "app id, window title, or 'focused'" },
    examples: ["close notes", "quit the files window"],
    match: (text) =>
      /\b(close|quit|dismiss|kill|exit)\b/.test(text) && !/\ball\b/.test(text)
        ? targetArgsFromText(text)
        : null,
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      if (!target) return null;
      return {
        label: `Close ${target.title}`,
        actions: [{ type: "close_window", id: target.id }],
      };
    },
  },
  {
    id: "close_all_windows",
    description: "Close every window in the active workspace",
    params: {},
    examples: ["close everything", "close all windows"],
    match: (text) =>
      /\b(close|quit|clear)\b/.test(text) && /\b(all|everything)\b/.test(text) ? {} : null,
    resolve: (_args, ctx) => {
      const windows = activeWindows(ctx.state);
      if (windows.length === 0) return null;
      return {
        label: `Close ${windows.length} window${windows.length > 1 ? "s" : ""}`,
        actions: windows.map((w) => ({ type: "close_window", id: w.id }) as Action),
      };
    },
  },
  {
    id: "minimize_window",
    description: "Minimize a window to the dock",
    params: { target: "app id, window title, or 'focused'" },
    examples: ["minimize notes", "hide this window"],
    match: (text) =>
      /\b(minimi[sz]e|hide|stash|tuck away)\b/.test(text) ? targetArgsFromText(text) : null,
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      if (!target) return null;
      return {
        label: `Minimize ${target.title}`,
        actions: [{ type: "set_window_mode", id: target.id, mode: "minimized" }],
      };
    },
  },
  {
    id: "fullscreen_window",
    description: "Make a window fullscreen",
    params: { target: "app id, window title, or 'focused'" },
    examples: ["fullscreen files", "expand notes"],
    match: (text) =>
      /\b(fullscreen|full screen|expand|blow up)\b/.test(text) ? targetArgsFromText(text) : null,
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      if (!target) return null;
      return {
        label: `Fullscreen ${target.title}`,
        actions: [{ type: "set_window_mode", id: target.id, mode: "fullscreen" }],
      };
    },
  },
  {
    id: "restore_window",
    description: "Return a window to its previous size",
    params: { target: "app id, window title, or 'focused'" },
    examples: ["restore notes", "make files windowed again"],
    match: (text) =>
      /\b(restore|windowed|shrink|unmaximi[sz]e|bring back)\b/.test(text)
        ? targetArgsFromText(text)
        : null,
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      if (!target) return null;
      return {
        label: `Restore ${target.title}`,
        actions: [{ type: "set_window_mode", id: target.id, mode: "windowed" }],
      };
    },
  },
  {
    id: "move_window_to_workspace",
    description: "Send a window to another workspace",
    params: {
      target: "app id, window title, or 'focused'",
      workspace: "workspace name",
    },
    examples: ["send settings to focus", "move notes to main"],
    match: (text, ctx) => {
      const workspace = workspaceInText(text, ctx);
      if (!workspace) return null;
      if (!/\b(move|send|push|throw|put)\b/.test(text)) return null;
      return { ...targetArgsFromText(text), workspace: workspace.name };
    },
    resolve: (args, ctx) => {
      const target = findTarget(args, ctx);
      const workspace = findWorkspace(args, ctx);
      if (!target || !workspace) return null;
      return {
        label: `Send ${target.title} to ${workspace.name}`,
        actions: [
          {
            type: "send_window_to_workspace",
            id: target.id,
            workspaceId: workspace.id,
          },
        ],
      };
    },
  },
  {
    id: "switch_workspace",
    description: "Switch the active workspace",
    params: { workspace: "workspace name" },
    examples: ["switch to focus", "go to main workspace"],
    match: (text, ctx) => {
      const workspace = workspaceInText(text, ctx);
      if (!workspace) return null;
      return /\b(workspace|switch|go to|jump to|show)\b/.test(text)
        ? { workspace: workspace.name }
        : null;
    },
    resolve: (args, ctx) => {
      const workspace = findWorkspace(args, ctx);
      if (!workspace) return null;
      return {
        label: `Switch to ${workspace.name}`,
        actions: [{ type: "switch_workspace", workspaceId: workspace.id }],
      };
    },
  },
  {
    id: "create_note",
    description: "Create a new note and open the Notes app",
    params: { title: "optional note title" },
    examples: ["new note", "start a note called groceries"],
    match: (text) => {
      if (!/\b(note|jot)\b/.test(text)) return null;
      if (!/\b(new|create|add|start|make|write)\b/.test(text)) return null;
      const named = /(?:called|titled|named)\s+(.+)$/.exec(text);
      return named?.[1] ? { title: named[1].trim() } : {};
    },
    resolve: (args) => {
      const title = args["title"]?.trim();
      const actions: Action[] = [
        title ? { type: "note_create", title } : { type: "note_create" },
        { type: "open_app", appId: "notes" },
      ];
      return {
        label: title ? `Create note “${title}”` : "Create a note",
        actions,
      };
    },
  },
  {
    id: "set_accent",
    description: "Change the shell accent colour",
    params: { accent: ACCENTS.join(" | ") },
    examples: ["accent amber", "make it rose"],
    match: (text) => {
      const accent = ACCENTS.find((a) => text.includes(a));
      return accent ? { accent } : null;
    },
    resolve: (args) => {
      const accent = ACCENTS.find((a) => a === (args["accent"] ?? "").toLowerCase());
      if (!accent) return null;
      return {
        label: `Accent → ${accent}`,
        actions: [{ type: "set_preference", patch: { accent } }],
      };
    },
  },
  {
    id: "toggle_grid",
    description: "Show or hide the desktop grid overlay",
    params: { value: "on | off" },
    examples: ["hide the grid", "turn the grid on"],
    match: (text) => {
      if (!/\bgrid\b/.test(text)) return null;
      if (/\b(hide|off|remove|disable|no)\b/.test(text)) return { value: "off" };
      if (/\b(show|on|enable)\b/.test(text)) return { value: "on" };
      return null;
    },
    resolve: (args) => {
      const on = (args["value"] ?? "on").toLowerCase() !== "off";
      return {
        label: on ? "Show grid overlay" : "Hide grid overlay",
        actions: [{ type: "set_preference", patch: { showGrid: on } }],
      };
    },
  },
  {
    id: "focus_mode",
    description: "Calm the shell: no grid, reduced motion",
    params: {},
    examples: ["focus mode", "make it calm"],
    match: (text) => (/\b(focus mode|calm|quiet|zen|distraction)\b/.test(text) ? {} : null),
    resolve: () => ({
      label: "Calm the shell (no grid, reduced motion)",
      actions: [{ type: "set_preference", patch: { showGrid: false, reduceMotion: true } }],
    }),
  },
];

/**
 * Full vocabulary: app-contributed capabilities are matched first (they are
 * more specific), then the shell-wide ones.
 */
export const CAPABILITIES: Capability[] = [...APP_CAPABILITIES, ...SHELL_CAPABILITIES];

export const CAPABILITY_MAP: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map((c) => [c.id, c]),
);

/** Compact catalogue handed to the LLM planner. */
export function capabilityCatalog(ctx: CapabilityContext) {
  const gridLayout = computeDesktopGridLayout(
    ctx.state.windows,
    ctx.state.activeWorkspaceId,
    ctx.bounds,
  );

  return {
    capabilities: CAPABILITIES.map((c) => ({
      id: c.id,
      description: c.description,
      params: c.params,
      examples: c.examples,
    })),
    apps: APP_LIST.map((a) => ({ id: a.id, name: a.name, about: a.description })),
    workspaces: ctx.state.workspaces.map((w) => w.name),
    savedLayouts: ctx.state.layouts.map((l) => l.name),
    core: { position: ctx.state.core.anchor, placement: ctx.state.core.placement },
    openWindows: activeWindows(ctx.state).map((w) => ({
      app: w.appId,
      title: w.title,
      mode: w.mode,
      focused: w.focused,
    })),
    screenSpatialGrid: {
      summary: gridLayout.summaryText,
      screenCoveragePct: `${gridLayout.screenCoveragePct}%`,
      occupiedCells: `${gridLayout.occupiedCellsCount}/${gridLayout.totalCellsCount}`,
      windowPlacements: gridLayout.windows.map((w) => ({
        app: w.appId,
        title: w.title,
        gridCoordinates: w.gridCoordString,
        screenSector: w.regionLabel,
        screenCoverage: `${w.coveragePct}%`,
        overlaps: w.overlapsWith.map((o) => `${o.title} (${o.overlapPct}%)`),
      })),
    },
  };
}
