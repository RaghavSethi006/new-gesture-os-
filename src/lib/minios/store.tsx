import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import { APPS } from "./apps";
import { zoneRect, type SnapZone } from "./snap";
import type {
  AppId,
  CoreAnchor,
  CoreMode,
  DesktopState,
  Preferences,
  WindowMode,
  WindowState,
} from "./types";

const STORAGE_KEY = "minios.desktop.v1";

/**
 * One shared action layer. Gestures and an AI agent are both "intent
 * producers" that dispatch these same actions later on.
 */
export type Action =
  | { type: "open_app"; appId: AppId }
  | { type: "close_window"; id: string }
  | { type: "focus_window"; id: string }
  | { type: "set_window_mode"; id: string; mode: WindowMode }
  | { type: "move_window"; id: string; x: number; y: number }
  | { type: "resize_window"; id: string; width: number; height: number }
  | { type: "switch_workspace"; workspaceId: string }
  | { type: "send_window_to_workspace"; id: string; workspaceId: string }
  | { type: "tile_workspace"; bounds: { width: number; height: number } }
  | {
      type: "snap_window";
      id: string;
      zone: SnapZone;
      bounds: { width: number; height: number };
    }
  | {
      type: "snap_window_to_grid";
      id: string;
      colStart: number;
      colSpan: number;
      rowStart: number;
      rowSpan: number;
      bounds: { width: number; height: number };
      cols?: number;
      rows?: number;
    }
  | { type: "note_create"; title?: string }
  | { type: "note_update"; id: string; title?: string; body?: string }
  | { type: "note_delete"; id: string }
  | { type: "save_layout"; name: string }
  | { type: "restore_layout"; id: string }
  | { type: "delete_layout"; id: string }
  | { type: "set_core_anchor"; anchor: CoreAnchor; placement?: "auto" | "locked" }
  | { type: "set_core_auto" }
  | { type: "set_core_mode"; mode: CoreMode }
  | { type: "set_preference"; patch: Partial<Preferences> }
  | { type: "hydrate"; state: DesktopState };

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

export function createInitialState(): DesktopState {
  return {
    windows: [],
    workspaces: [
      { id: "ws-main", name: "Main" },
      { id: "ws-focus", name: "Focus" },
    ],
    activeWorkspaceId: "ws-main",
    notes: [
      {
        id: "note-welcome",
        title: "Welcome to MiniOS",
        body: "This is the internal shell layer.\n\nEvery window — internal or (later) native — uses one WindowState shape, so gestures and the AI copilot can drive the same action layer.\n\nTry: drag a title bar, double-click it to go fullscreen, or open the Window Manager.",
        updatedAt: now(),
      },
    ],
    layouts: [],
    core: {
      anchor: "top-right",
      placement: "auto",
      mode: "idle",
    },
    preferences: {
      accent: "teal",
      reduceMotion: false,
      showGrid: true,
      snapToEdges: true,
    },
    zCounter: 10,
  };
}

function focusIn(windows: WindowState[], id: string, z: number): WindowState[] {
  return windows.map((w) =>
    w.id === id
      ? { ...w, focused: true, zIndex: z, lastInteraction: now() }
      : { ...w, focused: false },
  );
}

export function reducer(state: DesktopState, action: Action): DesktopState {
  switch (action.type) {
    case "hydrate":
      return {
        ...createInitialState(),
        ...action.state,
        core: { ...createInitialState().core, ...action.state.core, mode: "idle" },
        preferences: {
          ...createInitialState().preferences,
          ...action.state.preferences,
        },
      };

    case "open_app": {
      const existing = state.windows.find(
        (w) => w.appId === action.appId && w.workspaceId === state.activeWorkspaceId,
      );
      const z = state.zCounter + 1;
      if (existing) {
        return {
          ...state,
          zCounter: z,
          windows: focusIn(state.windows, existing.id, z).map((w) =>
            w.id === existing.id && w.mode === "minimized" ? { ...w, mode: "windowed" } : w,
          ),
        };
      }
      const app = APPS[action.appId];
      const offset = state.windows.length * 28;
      const win: WindowState = {
        id: `win-${uid()}`,
        appId: action.appId,
        title: app.name,
        mode: "windowed",
        x: 80 + (offset % 220),
        y: 64 + (offset % 160),
        width: app.defaultSize.width,
        height: app.defaultSize.height,
        workspaceId: state.activeWorkspaceId,
        monitor: 0,
        focused: true,
        zIndex: z,
        isExternal: false,
        lastInteraction: now(),
      };
      return {
        ...state,
        zCounter: z,
        windows: [...state.windows.map((w) => ({ ...w, focused: false })), win],
      };
    }

    case "close_window":
      return { ...state, windows: state.windows.filter((w) => w.id !== action.id) };

    case "focus_window": {
      const z = state.zCounter + 1;
      return { ...state, zCounter: z, windows: focusIn(state.windows, action.id, z) };
    }

    case "set_window_mode": {
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        windows: state.windows.map((w) => {
          if (w.id !== action.id) {
            return action.mode === "minimized" ? w : { ...w, focused: false };
          }
          if (action.mode === "fullscreen" && w.mode !== "fullscreen") {
            return {
              ...w,
              mode: action.mode,
              focused: true,
              zIndex: z,
              lastInteraction: now(),
              restore: { x: w.x, y: w.y, width: w.width, height: w.height },
            };
          }
          if (action.mode === "windowed" && w.mode === "fullscreen" && w.restore) {
            return {
              ...w,
              ...w.restore,
              restore: undefined,
              mode: action.mode,
              focused: true,
              zIndex: z,
              lastInteraction: now(),
            };
          }
          return {
            ...w,
            mode: action.mode,
            focused: action.mode !== "minimized",
            zIndex: action.mode === "minimized" ? w.zIndex : z,
            lastInteraction: now(),
          };
        }),
      };
    }

    case "move_window":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, x: action.x, y: action.y, lastInteraction: now() } : w,
        ),
      };

    case "resize_window":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                width: Math.max(320, action.width),
                height: Math.max(200, action.height),
                lastInteraction: now(),
              }
            : w,
        ),
      };

    case "switch_workspace":
      return { ...state, activeWorkspaceId: action.workspaceId };

    case "send_window_to_workspace":
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, workspaceId: action.workspaceId } : w,
        ),
      };

    case "tile_workspace": {
      const visible = state.windows.filter(
        (w) => w.workspaceId === state.activeWorkspaceId && w.mode !== "minimized",
      );
      if (visible.length === 0) return state;
      const cols = Math.ceil(Math.sqrt(visible.length));
      const rows = Math.ceil(visible.length / cols);
      const gap = 12;
      const cellW = (action.bounds.width - gap * (cols + 1)) / cols;
      const cellH = (action.bounds.height - gap * (rows + 1)) / rows;
      const geometry = new Map<string, Partial<WindowState>>();
      visible.forEach((w, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        geometry.set(w.id, {
          mode: "windowed",
          restore: undefined,
          x: Math.round(gap + col * (cellW + gap)),
          y: Math.round(gap + row * (cellH + gap)),
          width: Math.round(cellW),
          height: Math.round(cellH),
        });
      });
      return {
        ...state,
        windows: state.windows.map((w) =>
          geometry.has(w.id) ? ({ ...w, ...geometry.get(w.id) } as WindowState) : w,
        ),
      };
    }

    case "snap_window": {
      const rect = zoneRect(action.zone, action.bounds);
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                ...rect,
                mode: "windowed",
                restore: undefined,
                focused: true,
                zIndex: z,
                lastInteraction: now(),
              }
            : { ...w, focused: false },
        ),
      };
    }

    case "snap_window_to_grid": {
      const cols = action.cols ?? 12;
      const rows = action.rows ?? 8;
      const cellW = action.bounds.width / cols;
      const cellH = action.bounds.height / rows;
      const x = Math.round(action.colStart * cellW);
      const y = Math.round(action.rowStart * cellH);
      const width = Math.round(action.colSpan * cellW);
      const height = Math.round(action.rowSpan * cellH);
      const z = state.zCounter + 1;
      return {
        ...state,
        zCounter: z,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? {
                ...w,
                x: Math.max(0, x),
                y: Math.max(0, y),
                width: Math.max(300, width),
                height: Math.max(180, height),
                mode: "windowed",
                restore: undefined,
                focused: true,
                zIndex: z,
                lastInteraction: now(),
              }
            : { ...w, focused: false },
        ),
      };
    }

    case "note_create": {
      const note = {
        id: `note-${uid()}`,
        title: action.title?.trim() || "Untitled note",
        body: "",
        updatedAt: now(),
      };
      return { ...state, notes: [note, ...state.notes] };
    }

    case "note_update":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id
            ? {
                ...n,
                title: action.title ?? n.title,
                body: action.body ?? n.body,
                updatedAt: now(),
              }
            : n,
        ),
      };

    case "note_delete":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };

    case "save_layout": {
      const name = action.name.trim() || "Untitled layout";
      const layout = {
        id: `layout-${uid()}`,
        name,
        createdAt: now(),
        activeWorkspaceId: state.activeWorkspaceId,
        windows: state.windows.map((w) => ({ ...w })),
        core: { ...state.core, mode: "idle" as const },
      };
      return {
        ...state,
        layouts: [
          layout,
          ...state.layouts.filter((l) => l.name.toLowerCase() !== name.toLowerCase()),
        ],
      };
    }

    case "restore_layout": {
      const layout = state.layouts.find((l) => l.id === action.id);
      if (!layout) return state;
      const base = state.zCounter + 1;
      return {
        ...state,
        activeWorkspaceId: layout.activeWorkspaceId,
        zCounter: base + layout.windows.length,
        windows: layout.windows.map((w, i) => ({
          ...w,
          zIndex: base + i,
          lastInteraction: now(),
        })),
        core: layout.core ? { ...layout.core, mode: "idle" } : state.core,
      };
    }

    case "delete_layout":
      return {
        ...state,
        layouts: state.layouts.filter((l) => l.id !== action.id),
      };

    case "set_core_anchor":
      return {
        ...state,
        core: {
          ...state.core,
          anchor: action.anchor,
          placement: action.placement ?? "locked",
        },
      };

    case "set_core_auto":
      return { ...state, core: { ...state.core, placement: "auto" } };

    case "set_core_mode":
      return { ...state, core: { ...state.core, mode: action.mode } };

    case "set_preference":
      return { ...state, preferences: { ...state.preferences, ...action.patch } };

    default:
      return state;
  }
}

type StoreValue = { state: DesktopState; dispatch: Dispatch<Action> };

const StoreContext = createContext<StoreValue | null>(null);

export function DesktopProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  // Read persisted state after hydration so SSR and first client render match.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DesktopState;
      if (parsed && Array.isArray(parsed.windows)) {
        const defaults = createInitialState();
        dispatch({
          type: "hydrate",
          state: {
            ...defaults,
            ...parsed,
            core: { ...defaults.core, ...parsed.core },
            preferences: { ...defaults.preferences, ...parsed.preferences },
          },
        });
      }
    } catch {
      /* corrupted payload — keep defaults */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDesktop(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useDesktop must be used inside <DesktopProvider>");
  return ctx;
}
