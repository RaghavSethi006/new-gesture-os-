import type { CSSProperties } from "react";

import { AiCore } from "@/components/minios/AiCore";
import { CORE_ANCHORS, coreCircle, type Bounds } from "@/lib/minios/core-geometry";
import { useDesktop } from "@/lib/minios/store";
import type { CoreAnchor, CoreMode } from "@/lib/minios/types";
import { cn } from "@/lib/utils";

const LABELS: Record<CoreAnchor, string> = {
  "top-left": "top left",
  "top-center": "top center",
  "top-right": "top right",
  "bottom-left": "bottom left",
  "bottom-center": "bottom center",
  "bottom-right": "bottom right",
  center: "screen center",
};

export function LivingCore({
  bounds,
  anchor,
  mode,
  open,
  onActivate,
}: {
  bounds: Bounds;
  anchor: CoreAnchor;
  mode: CoreMode;
  open: boolean;
  onActivate: () => void;
}) {
  const { state, dispatch } = useDesktop();
  const circle = coreCircle(anchor, bounds);
  const size = circle.visualRadius * 2;

  const corePositionStyle: CSSProperties = {
    position: "absolute",
    left: Math.round(circle.cx - size / 2),
    top: Math.round(circle.cy - size / 2),
    width: Math.round(size),
    height: Math.round(size),
    transition:
      "left 500ms cubic-bezier(0.2, 0.8, 0.2, 1), top 500ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[10000]">
      <div className="pointer-events-auto" style={corePositionStyle}>
        <button
          type="button"
          aria-label={`AI core, ${mode}, ${LABELS[anchor]}`}
          aria-expanded={open}
          title={`AI core · ${mode} · ${LABELS[anchor]}`}
          onClick={onActivate}
          className={cn(
            "core-avatar relative grid size-full place-items-center rounded-full bg-transparent p-0 border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-os-accent",
            `core-${mode}`,
            state.preferences.reduceMotion && "core-reduced-motion",
          )}
        >
          <span className="sr-only">Open AI core</span>
          <AiCore state={mode} className="size-full" />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-300/80 select-none">
              {mode}
            </span>
          </div>
        </button>
      </div>

      {open && (
        <div
          className="pointer-events-auto absolute right-3 top-3 z-[10000] flex gap-1 rounded-md border border-os-line bg-os-surface/85 backdrop-blur-md p-1 shadow-lg"
          aria-label="Core position"
        >
          <button
            type="button"
            onClick={() => dispatch({ type: "set_core_auto" })}
            className={cn(
              "rounded px-2 py-1 text-[10px] uppercase text-os-muted",
              state.core.placement === "auto" && "bg-os-surface-raised text-os-accent",
            )}
          >
            Auto
          </button>
          {CORE_ANCHORS.map((position) => (
            <button
              key={position}
              type="button"
              title={LABELS[position]}
              aria-label={`Move core to ${LABELS[position]}`}
              onClick={() =>
                dispatch({ type: "set_core_anchor", anchor: position, placement: "locked" })
              }
              className={cn(
                "size-6 rounded text-[9px] text-os-muted hover:bg-os-surface-raised",
                anchor === position &&
                  state.core.placement === "locked" &&
                  "bg-os-surface-raised text-os-accent",
              )}
            >
              {position === "center"
                ? "●"
                : position
                    .split("-")
                    .map((word) => word[0]?.toUpperCase())
                    .join("")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
