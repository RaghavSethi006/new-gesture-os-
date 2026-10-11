import {
  Activity,
  Disc3,
  FileText,
  FolderOpen,
  Grid2x2,
  LayoutGrid,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ComponentType } from "react";

import { APP_LIST } from "@/lib/minios/apps";
import { useDesktop } from "@/lib/minios/store";
import type { AppId } from "@/lib/minios/types";
import { cn } from "@/lib/utils";

const ICONS: Record<AppId, ComponentType<{ className?: string }>> = {
  notes: FileText,
  files: FolderOpen,
  media: Disc3,
  telemetry: Activity,
  windows: LayoutGrid,
  settings: Settings,
};

export function Taskbar({
  bounds,
  onOpenCopilot,
}: {
  bounds: { width: number; height: number };
  onOpenCopilot: () => void;
}) {
  const { state, dispatch } = useDesktop();

  const workspaceWindows = state.windows.filter((w) => w.workspaceId === state.activeWorkspaceId);
  const minimized = workspaceWindows.filter((w) => w.mode === "minimized");

  return (
    <div className="z-50 flex shrink-0 flex-wrap items-center gap-3 px-4 py-2 bg-slate-950/60 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1">
        {APP_LIST.map((app) => {
          const Icon = ICONS[app.id];
          const open = workspaceWindows.some((w) => w.appId === app.id);
          return (
            <button
              key={app.id}
              type="button"
              title={app.description}
              onClick={() => dispatch({ type: "open_app", appId: app.id })}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-white/60 hover:bg-white/10 hover:text-white transition-all",
                open && "text-white bg-white/5",
              )}
            >
              <Icon className="size-4 text-cyan-400" />
              <span className="hidden sm:inline font-medium">{app.name}</span>
              {open && (
                <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
              )}
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-white/10" />

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {minimized.length === 0 ? (
          <span className="text-[11px] font-mono text-white/30">IDLE_MIN_QUEUE</span>
        ) : (
          minimized.map((win) => (
            <button
              key={win.id}
              type="button"
              onClick={() => dispatch({ type: "set_window_mode", id: win.id, mode: "windowed" })}
              className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all font-mono"
            >
              {win.title}
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onOpenCopilot}
        title="Copilot command bar (⌘K)"
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-[0_0_12px_rgba(0,212,255,0.2)]"
      >
        <Sparkles className="size-3.5" />
        Copilot
      </button>

      <button
        type="button"
        onClick={() => dispatch({ type: "tile_workspace", bounds })}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all font-mono"
      >
        <Grid2x2 className="size-3.5" />
        TILE
      </button>

      <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
        {state.workspaces.map((ws) => {
          const active = ws.id === state.activeWorkspaceId;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={() => dispatch({ type: "switch_workspace", workspaceId: ws.id })}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-mono transition-all",
                active
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm"
                  : "text-white/50 hover:text-white",
              )}
            >
              {ws.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
