import type { CoreAnchor, CoreState, WindowState } from "./types";

export type Bounds = { width: number; height: number };
export type Circle = { cx: number; cy: number; radius: number; visualRadius: number };

export const CORE_ANCHORS: CoreAnchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
];

const EDGE = 18;

export function coreCircle(anchor: CoreAnchor, bounds: Bounds): Circle {
  const visualRadius = anchor === "center" ? 110 : 88;
  const radius = visualRadius + 18;
  const edgeX = 36;
  const edgeY = 56;
  const x = anchor.endsWith("left")
    ? edgeX + visualRadius
    : anchor.endsWith("right")
      ? bounds.width - edgeX - visualRadius
      : bounds.width / 2;
  const y = anchor.startsWith("top")
    ? 36 + visualRadius
    : anchor.startsWith("bottom")
      ? bounds.height - edgeY - visualRadius
      : bounds.height / 2;
  return { cx: x, cy: y, radius, visualRadius };
}

export function rectCircleOverlap(
  rect: { x: number; y: number; width: number; height: number },
  circle: Circle,
): boolean {
  const x = Math.max(rect.x, Math.min(circle.cx, rect.x + rect.width));
  const y = Math.max(rect.y, Math.min(circle.cy, rect.y + rect.height));
  return (x - circle.cx) ** 2 + (y - circle.cy) ** 2 < circle.radius ** 2;
}

function overlapCost(win: WindowState, circle: Circle): number {
  if (win.mode === "minimized") return 0;
  const closestX = Math.max(win.x, Math.min(circle.cx, win.x + win.width));
  const closestY = Math.max(win.y, Math.min(circle.cy, win.y + win.height));
  const distance = Math.hypot(closestX - circle.cx, closestY - circle.cy);
  if (distance >= circle.radius) return 0;
  return (circle.radius - distance) * (win.focused ? 5 : 2);
}

export function bestCoreAnchor(
  windows: WindowState[],
  activeWorkspaceId: string,
  bounds: Bounds,
  current: CoreAnchor,
): CoreAnchor {
  const active = windows.filter(
    (win) => win.workspaceId === activeWorkspaceId && win.mode !== "minimized",
  );
  let winner = current;
  let winnerCost = Number.POSITIVE_INFINITY;
  for (const anchor of CORE_ANCHORS) {
    const circle = coreCircle(anchor, bounds);
    const movementPenalty = anchor === current ? 0 : 14;
    const centerPenalty = anchor === "center" ? 28 : 0;
    const cost =
      active.reduce((sum, win) => sum + overlapCost(win, circle), 0) +
      movementPenalty +
      centerPenalty;
    if (cost < winnerCost) {
      winner = anchor;
      winnerCost = cost;
    }
  }
  return winner;
}

export function resolvedCoreCircle(
  core: CoreState,
  windows: WindowState[],
  activeWorkspaceId: string,
  bounds: Bounds,
): Circle & { anchor: CoreAnchor } {
  const anchor =
    core.placement === "auto"
      ? bestCoreAnchor(windows, activeWorkspaceId, bounds, core.anchor)
      : core.anchor;
  return { ...coreCircle(anchor, bounds), anchor };
}

export function pushRectOutsideCircle(
  rect: { x: number; y: number; width: number; height: number },
  circle: Circle,
  bounds: Bounds,
) {
  if (!rectCircleOverlap(rect, circle)) return rect;
  const options = [
    { ...rect, x: circle.cx - circle.radius - rect.width },
    { ...rect, x: circle.cx + circle.radius },
    { ...rect, y: circle.cy - circle.radius - rect.height },
    { ...rect, y: circle.cy + circle.radius },
  ].map((candidate) => ({
    ...candidate,
    x: Math.max(0, Math.min(candidate.x, bounds.width - candidate.width)),
    y: Math.max(0, Math.min(candidate.y, bounds.height - candidate.height)),
  }));
  return (
    options
      .filter((candidate) => !rectCircleOverlap(candidate, circle))
      .sort(
        (a, b) => Math.hypot(a.x - rect.x, a.y - rect.y) - Math.hypot(b.x - rect.x, b.y - rect.y),
      )[0] ?? rect
  );
}

/**
 * The core now sits in its own cradle in the shell chrome, so windows keep
 * their own straight edges and simply reserve the cradle's footprint.
 */
export function coreReservedRect(circle: Circle) {
  const halfW = circle.visualRadius * 0.76 + circle.visualRadius;
  const halfH = circle.visualRadius * 0.6 + circle.visualRadius;
  return {
    x: circle.cx - halfW,
    y: circle.cy - halfH,
    width: halfW * 2,
    height: halfH * 2,
  };
}
