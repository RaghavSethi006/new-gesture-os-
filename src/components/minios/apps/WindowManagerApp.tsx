import {
  Columns2,
  Grid,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Move,
  Scan,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { computeDesktopGridLayout, GRID_PRESETS, type GridPreset } from "@/lib/minios/spatial-grid";
import { useDesktop } from "@/lib/minios/store";
import { cn } from "@/lib/utils";

export function WindowManagerApp({
  bounds = { width: 1280, height: 720 },
}: {
  bounds?: { width: number; height: number };
}) {
  const { state, dispatch } = useDesktop();
  const [layoutName, setLayoutName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<GridPreset>("left_half");

  const layout = useMemo(
    () => computeDesktopGridLayout(state.windows, state.activeWorkspaceId, bounds),
    [state.windows, state.activeWorkspaceId, bounds],
  );

  const windows = useMemo(
    () => [...state.windows].sort((a, b) => b.zIndex - a.zIndex),
    [state.windows],
  );

  const saveLayout = () => {
    if (!layoutName.trim()) return;
    dispatch({ type: "save_layout", name: layoutName.trim() });
    setLayoutName("");
  };

  const snapToPreset = (winId: string, presetKey: GridPreset) => {
    const preset = GRID_PRESETS[presetKey];
    if (!preset) return;
    dispatch({
      type: "snap_window_to_grid",
      id: winId,
      colStart: preset.colStart,
      colSpan: preset.colSpan,
      rowStart: preset.rowStart,
      rowSpan: preset.rowSpan,
      bounds,
    });
  };

  return (
    <div className="flex h-full flex-col p-5 select-none space-y-4">
      {/* Telemetry Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-widest text-cyan-300 uppercase">
            SPATIAL_GRID // WINDOW_RADAR
          </span>
        </div>
        <div className="flex gap-3 font-mono text-[11px] text-white/50">
          <span>
            GRID: <strong className="text-cyan-400">12 × 8 (96 cells)</strong>
          </span>
          <span className="text-white/20">|</span>
          <span>
            COVERAGE: <strong className="text-cyan-400">{layout.screenCoveragePct}%</strong>
          </span>
          <span className="text-white/20">|</span>
          <span>
            THREADS: <strong className="text-cyan-400">{windows.length}</strong>
          </span>
        </div>
      </div>

      {/* Screen Spatial Grid Radar (Visual 12x8 Canvas Map) */}
      <div className="rounded-xl bg-white/[0.04] p-3 border border-cyan-500/20 backdrop-blur-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest text-cyan-400/90 uppercase flex items-center gap-1.5">
            <Scan className="size-3" />
            SCREEN SPATIAL RADAR [12 COLS × 8 ROWS]
          </span>
          <span className="font-mono text-[9px] text-white/40">
            {layout.occupiedCellsCount} OCCUPIED / {layout.freeCellsCount} FREE CELLS
          </span>
        </div>

        {/* 12 x 8 Visual Matrix Radar */}
        <div className="relative aspect-[16/9] w-full rounded-lg bg-black/60 border border-white/10 p-1.5 overflow-hidden">
          {/* Grid lines and background dots */}
          <div className="grid grid-cols-12 grid-rows-8 h-full w-full gap-0.5">
            {Array.from({ length: 96 }).map((_, i) => {
              const c = i % 12;
              const r = Math.floor(i / 12);
              const cell = layout.matrix[r]?.[c];
              const isOccupied = cell?.isOccupied;

              return (
                <div
                  key={`radar-cell-${c}-${r}`}
                  className={cn(
                    "rounded-[2px] transition-colors",
                    isOccupied
                      ? "bg-cyan-500/20 border border-cyan-400/30"
                      : "bg-white/[0.02] hover:bg-white/[0.06]",
                  )}
                  title={`Cell C${c + 1}, R${r + 1}${isOccupied ? ` · Occupied by ${cell?.occupants.map((o) => o.title).join(", ")}` : " · Vacant"}`}
                />
              );
            })}
          </div>

          {/* Overlaid App Boxes in the Radar */}
          {layout.windows.map((win) => {
            const leftPct = (win.colStart / 12) * 100;
            const topPct = (win.rowStart / 8) * 100;
            const widthPct = (win.colSpan / 12) * 100;
            const heightPct = (win.rowSpan / 8) * 100;

            return (
              <button
                key={`radar-overlay-${win.id}`}
                type="button"
                onClick={() => dispatch({ type: "focus_window", id: win.id })}
                className={cn(
                  "absolute rounded p-1 text-left flex flex-col justify-between transition-all cursor-pointer overflow-hidden",
                  win.isFocused
                    ? "bg-cyan-500/40 border border-cyan-300 ring-1 ring-cyan-400/60 shadow-[0_0_12px_rgba(0,212,255,0.25)]"
                    : "bg-cyan-950/60 border border-cyan-500/40 hover:bg-cyan-800/60 text-white/80",
                )}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate font-mono text-[9px] font-bold text-white uppercase">
                    {win.title}
                  </span>
                  <span className="font-mono text-[8px] text-cyan-300 shrink-0">
                    {win.coveragePct}%
                  </span>
                </div>
                <span className="font-mono text-[8px] text-cyan-200/80 truncate">
                  {win.gridCoordString}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Natural Language Layout Ticker */}
        <p className="font-mono text-[10px] text-cyan-300/80 bg-cyan-950/40 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 leading-relaxed">
          {layout.summaryText}
        </p>
      </div>

      {/* Running Windows Process List with Grid Pos & Quick Dock Buttons */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
        <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase block">
          // ACTIVE_SURFACES_GRID_TELEMETRY
        </span>

        {windows.length === 0 ? (
          <div className="grid place-items-center py-10 font-mono text-xs text-white/30">
            NO ACTIVE WINDOW PROCESSES ON SCREEN
          </div>
        ) : (
          windows.map((win) => {
            const placement = layout.windows.find((p) => p.id === win.id);

            return (
              <div
                key={win.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl p-3 transition-all",
                  win.focused
                    ? "bg-cyan-500/15 text-white shadow-[0_0_15px_rgba(0,212,255,0.1)] border border-cyan-500/30"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-transparent",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold">{win.title}</span>
                      {win.focused && (
                        <span className="font-mono text-[9px] text-cyan-400 uppercase font-semibold">
                          [FOCUSED]
                        </span>
                      )}
                      {placement && (
                        <span className="font-mono text-[9px] rounded bg-cyan-500/20 px-1.5 py-0.5 text-cyan-300">
                          {placement.regionLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-white/40 mt-1">
                      <span>
                        GRID:{" "}
                        <strong className="text-cyan-300">
                          {placement ? placement.gridCoordString : "MINIMIZED"}
                        </strong>
                      </span>
                      {placement && (
                        <span>
                          COVERAGE:{" "}
                          <strong className="text-cyan-300">{placement.coveragePct}%</strong>
                        </span>
                      )}
                      <span>
                        PIXELS: [{win.x}, {win.y}] {win.width}×{win.height}
                      </span>
                      {placement && placement.overlapsWith.length > 0 && (
                        <span className="text-amber-400">
                          OVERLAP:{" "}
                          {placement.overlapsWith
                            .map((o) => `${o.title} (${o.overlapPct}%)`)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Window Action Controls */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      title="Focus"
                      onClick={() => dispatch({ type: "focus_window", id: win.id })}
                      className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-mono text-cyan-300 hover:bg-cyan-500/30 transition-colors cursor-pointer"
                    >
                      FOCUS
                    </button>
                    <button
                      type="button"
                      title={win.mode === "fullscreen" ? "Restore" : "Maximize"}
                      onClick={() =>
                        dispatch({
                          type: "set_window_mode",
                          id: win.id,
                          mode: win.mode === "fullscreen" ? "windowed" : "fullscreen",
                        })
                      }
                      className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                    >
                      {win.mode === "fullscreen" ? (
                        <Minimize2 className="size-3.5" />
                      ) : (
                        <Maximize2 className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Terminate Process"
                      onClick={() => dispatch({ type: "close_window", id: win.id })}
                      className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Grid Dock Buttons */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                  <span className="font-mono text-[9px] text-white/30 mr-1">GRID DOCK:</span>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "left_half")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Dock to Left Half (Columns 1-6)"
                  >
                    LEFT 1/2
                  </button>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "right_half")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Dock to Right Half (Columns 7-12)"
                  >
                    RIGHT 1/2
                  </button>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "center_stage")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Dock to Center Stage (Cols 3-10, Rows 2-7)"
                  >
                    CENTER
                  </button>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "top_left_quad")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Dock to Top-Left Quad"
                  >
                    TL QUAD
                  </button>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "bottom_right_quad")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Dock to Bottom-Right Quad"
                  >
                    BR QUAD
                  </button>
                  <button
                    type="button"
                    onClick={() => snapToPreset(win.id, "full_grid")}
                    className="rounded bg-white/10 hover:bg-cyan-500/25 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200 transition-colors cursor-pointer"
                    title="Span 100% of Grid"
                  >
                    FULL 12×8
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Snapshot Layout Manager */}
      <div className="rounded-xl bg-white/5 p-3 backdrop-blur-md space-y-2 shrink-0">
        <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase block">
          // PERSIST_LAYOUT_SNAPSHOT
        </span>
        <div className="flex gap-2">
          <input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLayout();
            }}
            placeholder="Snapshot Identifier (e.g. Split Coding, Research)..."
            className="min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={saveLayout}
            className="rounded-lg bg-cyan-500/20 px-3 py-1.5 font-mono text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-colors shadow-sm cursor-pointer"
          >
            CAPTURE
          </button>
        </div>
      </div>
    </div>
  );
}
