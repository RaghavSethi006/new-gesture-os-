export type SnapZone =
  "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "maximize";

export type Rect = { x: number; y: number; width: number; height: number };

export const SNAP_ZONE_LABELS: Record<SnapZone, string> = {
  left: "Left half",
  right: "Right half",
  "top-left": "Top-left quarter",
  "top-right": "Top-right quarter",
  "bottom-left": "Bottom-left quarter",
  "bottom-right": "Bottom-right quarter",
  maximize: "Fill workspace",
};

const GAP = 12;

/** Geometry for a snap zone inside the desktop canvas. */
export function zoneRect(zone: SnapZone, bounds: { width: number; height: number }): Rect {
  const halfW = (bounds.width - GAP * 3) / 2;
  const halfH = (bounds.height - GAP * 3) / 2;
  const fullH = bounds.height - GAP * 2;
  const right = GAP * 2 + halfW;
  const lower = GAP * 2 + halfH;

  switch (zone) {
    case "left":
      return { x: GAP, y: GAP, width: halfW, height: fullH };
    case "right":
      return { x: right, y: GAP, width: halfW, height: fullH };
    case "top-left":
      return { x: GAP, y: GAP, width: halfW, height: halfH };
    case "top-right":
      return { x: right, y: GAP, width: halfW, height: halfH };
    case "bottom-left":
      return { x: GAP, y: lower, width: halfW, height: halfH };
    case "bottom-right":
      return { x: right, y: lower, width: halfW, height: halfH };
    case "maximize":
      return {
        x: GAP,
        y: GAP,
        width: bounds.width - GAP * 2,
        height: fullH,
      };
  }
}

const EDGE = 28;

/** Which snap zone (if any) a drag pointer is currently hovering. */
export function zoneForPointer(
  point: { x: number; y: number },
  bounds: { width: number; height: number },
): SnapZone | null {
  const nearLeft = point.x <= EDGE;
  const nearRight = point.x >= bounds.width - EDGE;
  const nearTop = point.y <= EDGE;
  const nearBottom = point.y >= bounds.height - EDGE;

  if (nearTop && nearLeft) return "top-left";
  if (nearTop && nearRight) return "top-right";
  if (nearBottom && nearLeft) return "bottom-left";
  if (nearBottom && nearRight) return "bottom-right";
  if (nearTop) return "maximize";
  if (nearLeft) return "left";
  if (nearRight) return "right";
  return null;
}
