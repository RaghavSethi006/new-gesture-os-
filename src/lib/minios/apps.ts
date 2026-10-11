import type { AppDefinition, AppId } from "./types";

export const APPS: Record<AppId, AppDefinition> = {
  notes: {
    id: "notes",
    name: "Notes",
    description: "Plain-text notes, stored on this device",
    defaultSize: { width: 640, height: 440 },
  },
  files: {
    id: "files",
    name: "Files",
    description: "Browse the MiniOS storage folder",
    defaultSize: { width: 720, height: 460 },
  },
  windows: {
    id: "windows",
    name: "Window Manager",
    description: "Live view of every open window",
    defaultSize: { width: 700, height: 420 },
  },
  settings: {
    id: "settings",
    name: "Settings",
    description: "Appearance, shell behaviour, workspaces",
    defaultSize: { width: 560, height: 440 },
  },
  media: {
    id: "media",
    name: "Media Player",
    description: "Holographic Spotify media deck",
    defaultSize: { width: 460, height: 260 },
  },
  telemetry: {
    id: "telemetry",
    name: "Telemetry",
    description: "Real-time signals & connector monitors",
    defaultSize: { width: 620, height: 380 },
  },
};

export const APP_LIST: AppDefinition[] = [
  APPS.notes,
  APPS.files,
  APPS.media,
  APPS.telemetry,
  APPS.windows,
  APPS.settings,
];
