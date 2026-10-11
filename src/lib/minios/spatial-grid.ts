import type { Bounds } from "./core-geometry";
import type { AppId, WindowMode, WindowState } from "./types";

export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_GRID_ROWS = 8;

export type WindowGridPlacement = {
  id: string;
  appId: AppId;
  title: string;
  mode: WindowMode;
  isFocused: boolean;
  zIndex: number;
  /** 0-indexed column range: colStart .. colEnd inclusive */
  colStart: number;
  colEnd: number;
  colSpan: number;
  /** 0-indexed row range: rowStart .. rowEnd inclusive */
  rowStart: number;
  rowEnd: number;
  rowSpan: number;
  /** Formatted human friendly tag, e.g. "C1-6 · R1-8" */
  gridCoordString: string;
  /** High level semantic region label, e.g. "Left Half", "Top-Right Quad", "Full Screen" */
  regionLabel: string;
  /** Percentage of total screen area this window covers (0-100) */
  coveragePct: number;
  pixelRect: { x: number; y: number; width: number; height: number };
  overlapsWith: Array<{
    id: string;
    title: string;
    overlapPct: number;
  }>;
};

export type DesktopGridLayout = {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  windows: WindowGridPlacement[];
  totalCellsCount: number;
  occupiedCellsCount: number;
  screenCoveragePct: number;
  freeCellsCount: number;
  matrix: Array<
    Array<{
      col: number;
      row: number;
      occupants: Array<{ id: string; title: string; isFocused: boolean }>;
      isOccupied: boolean;
    }>
  >;
  summaryText: string;
  sectors: {
    leftHalf: boolean;
    rightHalf: boolean;
    topHalf: boolean;
    bottomHalf: boolean;
    center: boolean;
  };
};

export type GridPreset =
  | "left_half"
  | "right_half"
  | "top_half"
  | "bottom_half"
  | "top_left_quad"
  | "top_right_quad"
  | "bottom_left_quad"
  | "bottom_right_quad"
  | "center_stage"
  | "full_grid";

export const GRID_PRESETS: Record<
  GridPreset,
  {
    name: string;
    colStart: number;
    colSpan: number;
    rowStart: number;
    rowSpan: number;
  }
> = {
  left_half: { name: "Left Half (50%)", colStart: 0, colSpan: 6, rowStart: 0, rowSpan: 8 },
  right_half: { name: "Right Half (50%)", colStart: 6, colSpan: 6, rowStart: 0, rowSpan: 8 },
  top_half: { name: "Top Half (50%)", colStart: 0, colSpan: 12, rowStart: 0, rowSpan: 4 },
  bottom_half: { name: "Bottom Half (50%)", colStart: 0, colSpan: 12, rowStart: 4, rowSpan: 4 },
  top_left_quad: { name: "Top-Left Quad", colStart: 0, colSpan: 6, rowStart: 0, rowSpan: 4 },
  top_right_quad: { name: "Top-Right Quad", colStart: 6, colSpan: 6, rowStart: 0, rowSpan: 4 },
  bottom_left_quad: { name: "Bottom-Left Quad", colStart: 0, colSpan: 6, rowStart: 4, rowSpan: 4 },
  bottom_right_quad: {
    name: "Bottom-Right Quad",
    colStart: 6,
    colSpan: 6,
    rowStart: 4,
    rowSpan: 4,
  },
  center_stage: { name: "Center Stage (66%)", colStart: 2, colSpan: 8, rowStart: 1, rowSpan: 6 },
  full_grid: { name: "Full Grid (100%)", colStart: 0, colSpan: 12, rowStart: 0, rowSpan: 8 },
};

export function describeRegion(
  colStart: number,
  colEnd: number,
  rowStart: number,
  rowEnd: number,
  cols: number = DEFAULT_GRID_COLS,
  rows: number = DEFAULT_GRID_ROWS,
  mode: WindowMode = "windowed",
): string {
  if (mode === "fullscreen") return "Full Screen (Maximized)";

  const colSpan = colEnd - colStart + 1;
  const rowSpan = rowEnd - rowStart + 1;
  const colMid = cols / 2;
  const rowMid = rows / 2;

  // Check exact halves
  if (colStart === 0 && colEnd === cols - 1 && rowStart === 0 && rowEnd === rows - 1) {
    return "Full Screen Matrix";
  }
  if (colStart === 0 && colEnd < colMid && rowStart === 0 && rowEnd === rows - 1) {
    return "Left Half Dock";
  }
  if (colStart >= colMid && colEnd === cols - 1 && rowStart === 0 && rowEnd === rows - 1) {
    return "Right Half Dock";
  }
  if (colStart === 0 && colEnd === cols - 1 && rowStart === 0 && rowEnd < rowMid) {
    return "Top Half Dock";
  }
  if (colStart === 0 && colEnd === cols - 1 && rowStart >= rowMid && rowEnd === rows - 1) {
    return "Bottom Half Dock";
  }

  // Quadrants
  if (colEnd < colMid && rowEnd < rowMid) return "Top-Left Quadrant";
  if (colStart >= colMid && rowEnd < rowMid) return "Top-Right Quadrant";
  if (colEnd < colMid && rowStart >= rowMid) return "Bottom-Left Quadrant";
  if (colStart >= colMid && rowStart >= rowMid) return "Bottom-Right Quadrant";

  // Center stage
  if (colStart >= 1 && colEnd <= cols - 2 && rowStart >= 1 && rowEnd <= rows - 2) {
    return "Center Stage";
  }

  // Sides
  if (colStart === 0) return `Left Dock (${colSpan} cols)`;
  if (colEnd === cols - 1) return `Right Dock (${colSpan} cols)`;
  if (rowStart === 0) return `Top Dock (${rowSpan} rows)`;
  if (rowEnd === rows - 1) return `Bottom Dock (${rowSpan} rows)`;

  return `Floating [${colSpan}×${rowSpan}]`;
}

export function computeDesktopGridLayout(
  windows: WindowState[],
  activeWorkspaceId: string,
  bounds: Bounds,
  cols: number = DEFAULT_GRID_COLS,
  rows: number = DEFAULT_GRID_ROWS,
): DesktopGridLayout {
  const safeW = Math.max(100, bounds.width);
  const safeH = Math.max(100, bounds.height);
  const cellWidth = safeW / cols;
  const cellHeight = safeH / rows;
  const totalScreenArea = safeW * safeH;

  const activeWindows = windows.filter(
    (w) => w.workspaceId === activeWorkspaceId && w.mode !== "minimized",
  );

  // Initialize matrix
  const matrix: DesktopGridLayout["matrix"] = [];
  for (let r = 0; r < rows; r++) {
    const rowItems: DesktopGridLayout["matrix"][number] = [];
    for (let c = 0; c < cols; c++) {
      rowItems.push({
        col: c,
        row: r,
        occupants: [],
        isOccupied: false,
      });
    }
    matrix.push(rowItems);
  }

  // Calculate placements
  const placements: WindowGridPlacement[] = activeWindows.map((win) => {
    let colStart = 0;
    let colEnd = cols - 1;
    let rowStart = 0;
    let rowEnd = rows - 1;

    let pixelRect = { x: win.x, y: win.y, width: win.width, height: win.height };

    if (win.mode === "fullscreen") {
      colStart = 0;
      colEnd = cols - 1;
      rowStart = 0;
      rowEnd = rows - 1;
      pixelRect = { x: 0, y: 0, width: safeW, height: safeH };
    } else {
      colStart = Math.max(0, Math.min(cols - 1, Math.floor(win.x / cellWidth)));
      colEnd = Math.max(
        colStart,
        Math.min(cols - 1, Math.floor((win.x + Math.max(1, win.width) - 1) / cellWidth)),
      );
      rowStart = Math.max(0, Math.min(rows - 1, Math.floor(win.y / cellHeight)));
      rowEnd = Math.max(
        rowStart,
        Math.min(rows - 1, Math.floor((win.y + Math.max(1, win.height) - 1) / cellHeight)),
      );
    }

    const colSpan = colEnd - colStart + 1;
    const rowSpan = rowEnd - rowStart + 1;
    const windowArea = pixelRect.width * pixelRect.height;
    const coveragePct = Math.min(100, Math.round((windowArea / totalScreenArea) * 1000) / 10);

    const gridCoordString = `C${colStart + 1}${colSpan > 1 ? `-${colEnd + 1}` : ""} × R${rowStart + 1}${rowSpan > 1 ? `-${rowEnd + 1}` : ""}`;
    const regionLabel = describeRegion(colStart, colEnd, rowStart, rowEnd, cols, rows, win.mode);

    // Register into matrix
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        if (matrix[r]?.[c]) {
          matrix[r]![c]!.occupants.push({
            id: win.id,
            title: win.title,
            isFocused: win.focused,
          });
          matrix[r]![c]!.isOccupied = true;
        }
      }
    }

    return {
      id: win.id,
      appId: win.appId,
      title: win.title,
      mode: win.mode,
      isFocused: win.focused,
      zIndex: win.zIndex,
      colStart,
      colEnd,
      colSpan,
      rowStart,
      rowEnd,
      rowSpan,
      gridCoordString,
      regionLabel,
      coveragePct,
      pixelRect,
      overlapsWith: [],
    };
  });

  // Calculate overlaps between active windows
  for (let i = 0; i < placements.length; i++) {
    const a = placements[i]!;
    for (let j = 0; j < placements.length; j++) {
      if (i === j) continue;
      const b = placements[j]!;

      const xOverlap = Math.max(
        0,
        Math.min(a.pixelRect.x + a.pixelRect.width, b.pixelRect.x + b.pixelRect.width) -
          Math.max(a.pixelRect.x, b.pixelRect.x),
      );
      const yOverlap = Math.max(
        0,
        Math.min(a.pixelRect.y + a.pixelRect.height, b.pixelRect.y + b.pixelRect.height) -
          Math.max(a.pixelRect.y, b.pixelRect.y),
      );
      const overlapArea = xOverlap * yOverlap;
      if (overlapArea > 0) {
        const areaA = a.pixelRect.width * a.pixelRect.height;
        const overlapPct = Math.round((overlapArea / areaA) * 100);
        if (overlapPct > 2) {
          a.overlapsWith.push({
            id: b.id,
            title: b.title,
            overlapPct,
          });
        }
      }
    }
  }

  // Count occupied cells
  let occupiedCellsCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r]![c]!.isOccupied) {
        occupiedCellsCount++;
      }
    }
  }

  const totalCellsCount = cols * rows;
  const freeCellsCount = totalCellsCount - occupiedCellsCount;
  const screenCoveragePct = Math.round((occupiedCellsCount / totalCellsCount) * 100);

  // Sector occupancy summary
  const sectors = {
    leftHalf: placements.some((p) => p.colStart < cols / 2),
    rightHalf: placements.some((p) => p.colEnd >= cols / 2),
    topHalf: placements.some((p) => p.rowStart < rows / 2),
    bottomHalf: placements.some((p) => p.rowEnd >= rows / 2),
    center: placements.some(
      (p) =>
        p.colStart <= cols / 2 &&
        p.colEnd >= cols / 2 - 1 &&
        p.rowStart <= rows / 2 &&
        p.rowEnd >= rows / 2 - 1,
    ),
  };

  // Generate natural language layout summary
  let summaryText = "";
  if (placements.length === 0) {
    summaryText = "Desktop canvas is clear. All 12×8 grid sectors are free.";
  } else if (placements.length === 1) {
    const single = placements[0]!;
    summaryText = `${single.title} occupies ${single.regionLabel} (${single.gridCoordString}, ${single.coveragePct}% screen).`;
  } else {
    const appSummaries = placements
      .map((p) => `${p.title}: ${p.regionLabel} (${p.gridCoordString}, ${p.coveragePct}%)`)
      .join("; ");
    summaryText = `${placements.length} apps active. ${appSummaries}. Total grid coverage: ${screenCoveragePct}%.`;
  }

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    windows: placements,
    totalCellsCount,
    occupiedCellsCount,
    freeCellsCount,
    screenCoveragePct,
    matrix,
    summaryText,
    sectors,
  };
}
