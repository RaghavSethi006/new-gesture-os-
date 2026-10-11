import { useEffect, useMemo, useRef, useState } from "react";

import { FilesApp } from "@/components/minios/apps/FilesApp";
import { MediaApp } from "@/components/minios/apps/MediaApp";
import { NotesApp } from "@/components/minios/apps/NotesApp";
import { SettingsApp } from "@/components/minios/apps/SettingsApp";
import { TelemetryApp } from "@/components/minios/apps/TelemetryApp";
import { WindowManagerApp } from "@/components/minios/apps/WindowManagerApp";
import { Copilot } from "@/components/minios/Copilot";
import { LivingCore } from "@/components/minios/LivingCore";
import { SpatialGridOverlay } from "@/components/minios/SpatialGridOverlay";
import { Taskbar } from "@/components/minios/Taskbar";
import { WindowFrame } from "@/components/minios/WindowFrame";
import { APP_LIST } from "@/lib/minios/apps";
import { resolvedCoreCircle } from "@/lib/minios/core-geometry";
import { SNAP_ZONE_LABELS, zoneRect, type SnapZone } from "@/lib/minios/snap";
import { computeDesktopGridLayout } from "@/lib/minios/spatial-grid";
import { useDesktop } from "@/lib/minios/store";
import type { AppId } from "@/lib/minios/types";
import { cn } from "@/lib/utils";

function AppSurface({
  appId,
  bounds,
}: {
  appId: AppId;
  bounds: { width: number; height: number };
}) {
  switch (appId) {
    case "notes":
      return <NotesApp />;
    case "files":
      return <FilesApp />;
    case "media":
      return <MediaApp />;
    case "telemetry":
      return <TelemetryApp />;
    case "windows":
      return <WindowManagerApp bounds={bounds} />;
    case "settings":
      return <SettingsApp />;
    default:
      return null;
  }
}

export function Desktop() {
  const { state, dispatch } = useDesktop();
  const canvas = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 1280, height: 720 });
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [snapZone, setSnapZone] = useState<SnapZone | null>(null);
  const [gridOverlayActive, setGridOverlayActive] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => setBounds({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = state.windows.filter(
    (w) => w.workspaceId === state.activeWorkspaceId && w.mode !== "minimized",
  );

  const gridLayout = useMemo(
    () => computeDesktopGridLayout(state.windows, state.activeWorkspaceId, bounds),
    [state.windows, state.activeWorkspaceId, bounds],
  );

  const core = resolvedCoreCircle(state.core, state.windows, state.activeWorkspaceId, bounds);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCopilotOpen((open) => !open);
        return;
      }
      if (!event.altKey || event.metaKey || event.ctrlKey) return;

      const focused = state.windows.find(
        (w) => w.focused && w.workspaceId === state.activeWorkspaceId,
      );
      const snapTo = (zone: SnapZone) => {
        if (!focused) return;
        event.preventDefault();
        dispatch({ type: "snap_window", id: focused.id, zone, bounds });
      };

      switch (event.key) {
        case "ArrowLeft":
          return snapTo("left");
        case "ArrowRight":
          return snapTo("right");
        case "ArrowUp":
          return snapTo("maximize");
        case "ArrowDown":
          if (!focused) return;
          event.preventDefault();
          return dispatch({
            type: "set_window_mode",
            id: focused.id,
            mode: "minimized",
          });
      }

      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        return dispatch({ type: "tile_workspace", bounds });
      }
      if (key === "w" && focused) {
        event.preventDefault();
        return dispatch({ type: "close_window", id: focused.id });
      }
      if (key === "s") {
        event.preventDefault();
        const index = state.workspaces.findIndex((w) => w.id === state.activeWorkspaceId);
        const next = state.workspaces[(index + 1) % state.workspaces.length];
        if (next) dispatch({ type: "switch_workspace", workspaceId: next.id });
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= APP_LIST.length) {
        event.preventDefault();
        const app = APP_LIST[digit - 1];
        if (app) dispatch({ type: "open_app", appId: app.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bounds, dispatch, state]);

  return (
    <div
      className="os-wallpaper flex h-screen w-full flex-col overflow-hidden text-os-text"
      data-accent={state.preferences.accent}
    >
      <div
        ref={canvas}
        className={cn("relative min-h-0 flex-1", state.preferences.showGrid && "os-grid-overlay")}
      >
        {/* Futuristic Top HUD Status Ticker with Live Spatial Grid Tracking */}
        <div className="absolute top-2 inset-x-0 z-20 flex justify-center items-center select-none pointer-events-auto">
          <div className="flex items-center gap-3 font-mono text-[10px] text-cyan-400 tracking-widest uppercase bg-black/40 backdrop-blur-md px-3.5 py-1 rounded-full border border-cyan-500/20 shadow-sm">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-500/40" />
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
              SYS_CORE
            </span>
            <span className="text-white/20">|</span>
            <span>WS: {state.activeWorkspaceId.toUpperCase()}</span>
            <span className="text-white/20">|</span>
            <button
              type="button"
              onClick={() => setGridOverlayActive((prev) => !prev)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer",
                gridOverlayActive || state.preferences.showGrid
                  ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/40"
                  : "hover:bg-cyan-500/10 text-cyan-400/80",
              )}
              title="Toggle Screen Spatial Grid Overlay"
            >
              <span>GRID: 12×8</span>
              <span className="text-[9px] text-cyan-300">
                [{gridLayout.screenCoveragePct}% OCCUPIED]
              </span>
            </button>
            <span className="text-white/20">|</span>
            <span>THREADS: {visible.length}</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-cyan-500/40" />
          </div>
        </div>

        {/* Spatial Grid Matrix Overlay */}
        <SpatialGridOverlay
          layout={gridLayout}
          visible={gridOverlayActive || state.preferences.showGrid}
          onToggleVisible={setGridOverlayActive}
        />

        {snapZone && (
          <div
            className="pointer-events-none absolute z-[9998] grid place-items-center rounded-[var(--os-radius)] border-2 text-xs tracking-wide"
            style={{
              ...(() => {
                const r = zoneRect(snapZone, bounds);
                return { left: r.x, top: r.y, width: r.width, height: r.height };
              })(),
              borderColor: "var(--os-accent)",
              background: "color-mix(in oklab, var(--os-accent) 14%, transparent)",
            }}
          >
            <span className="text-os-text">{SNAP_ZONE_LABELS[snapZone]}</span>
          </div>
        )}

        {/* AI Living Core — ALWAYS rendered on the desktop canvas as requested */}
        <LivingCore
          bounds={bounds}
          anchor={core.anchor}
          mode={state.core.mode}
          open={copilotOpen}
          onActivate={() => setCopilotOpen((value) => !value)}
        />

        <Copilot bounds={bounds} core={core} open={copilotOpen} onOpenChange={setCopilotOpen} />

        {visible.map((win) => (
          <WindowFrame key={win.id} win={win} bounds={bounds} onSnapPreview={setSnapZone}>
            <AppSurface appId={win.appId} bounds={bounds} />
          </WindowFrame>
        ))}
      </div>

      <Taskbar bounds={bounds} onOpenCopilot={() => setCopilotOpen(true)} />
    </div>
  );
}
