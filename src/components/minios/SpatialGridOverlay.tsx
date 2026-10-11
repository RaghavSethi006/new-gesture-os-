import { Grid, Eye, EyeOff } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";

import {
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  type DesktopGridLayout,
} from "@/lib/minios/spatial-grid";
import { cn } from "@/lib/utils";

export function SpatialGridOverlay({
  layout,
  visible,
  onToggleVisible,
}: {
  layout: DesktopGridLayout;
  visible: boolean;
  onToggleVisible: Dispatch<SetStateAction<boolean>>;
}) {
  if (!visible) return null;

  const { cols, rows, cellWidth, cellHeight, matrix, windows } = layout;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none">
      {/* Grid Canvas Lines */}
      <svg className="size-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="spatial-grid-pattern"
            width={cellWidth}
            height={cellHeight}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width={cellWidth}
              height={cellHeight}
              fill="none"
              stroke="rgba(0, 212, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Subtle inner cell dot */}
            <circle cx={cellWidth / 2} cy={cellHeight / 2} r="1.2" fill="rgba(0, 212, 255, 0.25)" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#spatial-grid-pattern)" />

        {/* Outer Grid Border Guide */}
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          fill="none"
          stroke="rgba(0, 212, 255, 0.2)"
          strokeWidth="1"
        />
      </svg>

      {/* Grid Coordinates Indices: Top Columns (C1..C12) */}
      <div className="absolute top-1 inset-x-0 flex justify-between px-3 pointer-events-none">
        {Array.from({ length: cols }).map((_, c) => (
          <div
            key={`col-idx-${c}`}
            className="flex-1 text-center font-mono text-[9px] tracking-wider text-cyan-400/50"
          >
            C{c + 1}
          </div>
        ))}
      </div>

      {/* Grid Coordinates Indices: Left Rows (R1..R8) */}
      <div className="absolute left-1 inset-y-0 flex flex-col justify-between py-6 pointer-events-none">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`row-idx-${r}`}
            className="flex-1 flex items-center font-mono text-[9px] text-cyan-400/50"
          >
            R{r + 1}
          </div>
        ))}
      </div>

      {/* Highlight Occupied Grid Blocks */}
      {windows.map((win) => {
        const left = win.colStart * cellWidth;
        const top = win.rowStart * cellHeight;
        const width = win.colSpan * cellWidth;
        const height = win.rowSpan * cellHeight;

        return (
          <div
            key={`grid-box-${win.id}`}
            className={cn(
              "absolute rounded-xl border border-dashed transition-all pointer-events-none flex flex-col justify-between p-2.5",
              win.isFocused
                ? "border-cyan-400/50 bg-cyan-500/[0.04]"
                : "border-cyan-500/20 bg-cyan-950/[0.02]",
            )}
            style={{
              left: `${left + 4}px`,
              top: `${top + 4}px`,
              width: `${Math.max(20, width - 8)}px`,
              height: `${Math.max(20, height - 8)}px`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-semibold text-cyan-300 uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                {win.title} // {win.gridCoordString}
              </span>
              <span className="font-mono text-[9px] text-cyan-400/70">
                {win.coveragePct}% SCREEN
              </span>
            </div>

            <div className="flex justify-between items-end font-mono text-[9px] text-white/30">
              <span>{win.regionLabel}</span>
              {win.overlapsWith.length > 0 && (
                <span className="text-amber-400/70">
                  OVERLAP: {win.overlapsWith.map((o) => o.title).join(", ")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
