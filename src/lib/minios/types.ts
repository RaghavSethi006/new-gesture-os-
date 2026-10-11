export type WindowMode = "minimized" | "windowed" | "fullscreen";

export type AppId = "notes" | "files" | "settings" | "windows" | "media" | "telemetry";

export type WindowState = {
  id: string;
  appId: AppId;
  title: string;
  mode: WindowMode;
  x: number;
  y: number;
  width: number;
  height: number;
  workspaceId: string;
  monitor: number;
  focused: boolean;
  zIndex: number;
  isExternal: boolean;
  externalHandle?: string;
  lastInteraction: string;
  /** geometry remembered while fullscreen, restored on exit */
  restore?: { x: number; y: number; width: number; height: number } | undefined;
};

export type Workspace = {
  id: string;
  name: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type Preferences = {
  accent: "teal" | "amber" | "rose";
  reduceMotion: boolean;
  showGrid: boolean;
  snapToEdges: boolean;
};

export type CoreAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "center";

export type CoreMode = "idle" | "listening" | "thinking" | "speaking" | "sleep";

export type CoreState = {
  anchor: CoreAnchor;
  placement: "auto" | "locked";
  mode: CoreMode;
};

/** A named snapshot of the window layout you can restore later. */
export type Layout = {
  id: string;
  name: string;
  createdAt: string;
  activeWorkspaceId: string;
  windows: WindowState[];
  core?: CoreState;
};

export type DesktopState = {
  windows: WindowState[];
  workspaces: Workspace[];
  activeWorkspaceId: string;
  notes: Note[];
  layouts: Layout[];
  preferences: Preferences;
  core: CoreState;
  zCounter: number;
};

export type AppDefinition = {
  id: AppId;
  name: string;
  description: string;
  defaultSize: { width: number; height: number };
};
