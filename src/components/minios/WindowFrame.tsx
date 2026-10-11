import { Maximize2, Minus, Minimize2, X } from "lucide-react";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { zoneForPointer, type SnapZone } from "@/lib/minios/snap";
import type { Bounds } from "@/lib/minios/core-geometry";
import { useDesktop } from "@/lib/minios/store";
import type { WindowState } from "@/lib/minios/types";
import { cn } from "@/lib/utils";

const SNAP = 16;

export function WindowFrame({
  win,
  bounds,
  children,
  onSnapPreview,
}: {
  win: WindowState;
  bounds: Bounds;
  children: ReactNode;
  onSnapPreview?: (zone: SnapZone | null) => void;
}) {
  const { state, dispatch } = useDesktop();
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const pendingZone = useRef<SnapZone | null>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const snap = state.preferences.snapToEdges;

  const fullscreen = win.mode === "fullscreen";

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (fullscreen) return;
    dispatch({ type: "focus_window", id: win.id });
    drag.current = { dx: event.clientX - win.x, dy: event.clientY - win.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    let x = event.clientX - drag.current.dx;
    let y = event.clientY - drag.current.dy;
    x = Math.min(Math.max(x, -win.width + 120), bounds.width - 120);
    y = Math.min(Math.max(y, 0), bounds.height - 48);
    if (snap) {
      if (Math.abs(x) < SNAP) x = 0;
      if (Math.abs(y) < SNAP) y = 0;
      if (Math.abs(bounds.width - (x + win.width)) < SNAP) x = bounds.width - win.width;
      if (Math.abs(bounds.height - (y + win.height)) < SNAP) y = bounds.height - win.height;
    }
    dispatch({ type: "move_window", id: win.id, x: Math.round(x), y: Math.round(y) });

    const zone = snap ? zoneForPointer({ x: event.clientX, y: event.clientY }, bounds) : null;
    if (zone !== pendingZone.current) {
      pendingZone.current = zone;
      onSnapPreview?.(zone);
    }
  };

  const endDrag = () => {
    drag.current = null;
    const zone = pendingZone.current;
    pendingZone.current = null;
    onSnapPreview?.(null);
    if (zone) {
      dispatch({ type: "snap_window", id: win.id, zone, bounds });
    }
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    dispatch({ type: "focus_window", id: win.id });
    resize.current = {
      x: event.clientX,
      y: event.clientY,
      w: win.width,
      h: win.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resize.current) return;
    dispatch({
      type: "resize_window",
      id: win.id,
      width: Math.round(resize.current.w + (event.clientX - resize.current.x)),
      height: Math.round(resize.current.h + (event.clientY - resize.current.y)),
    });
  };

  const FS_MARGIN_X = Math.max(32, Math.min(84, Math.round(bounds.width * 0.055)));
  const FS_MARGIN_Y = Math.max(32, Math.min(68, Math.round(bounds.height * 0.055)));

  const cellW = bounds.width / 12;
  const cellH = bounds.height / 8;
  const colStart = Math.max(0, Math.min(11, Math.floor(win.x / cellW)));
  const colEnd = Math.max(
    colStart,
    Math.min(11, Math.floor((win.x + Math.max(1, win.width) - 1) / cellW)),
  );
  const rowStart = Math.max(0, Math.min(7, Math.floor(win.y / cellH)));
  const rowEnd = Math.max(
    rowStart,
    Math.min(7, Math.floor((win.y + Math.max(1, win.height) - 1) / cellH)),
  );
  const colSpan = colEnd - colStart + 1;
  const rowSpan = rowEnd - rowStart + 1;
  const areaPct = Math.round(((win.width * win.height) / (bounds.width * bounds.height)) * 100);
  const gridCoords = `C${colStart + 1}${colSpan > 1 ? `-${colEnd + 1}` : ""} × R${rowStart + 1}${rowSpan > 1 ? `-${rowEnd + 1}` : ""}`;

  const geometry = fullscreen
    ? {
        left: FS_MARGIN_X,
        top: FS_MARGIN_Y,
        width: Math.max(320, bounds.width - FS_MARGIN_X * 2),
        height: Math.max(240, bounds.height - FS_MARGIN_Y * 2),
      }
    : { left: win.x, top: win.y, width: win.width, height: win.height };

  return (
    <section
      role="dialog"
      aria-label={win.title}
      onPointerDown={() => dispatch({ type: "focus_window", id: win.id })}
      className={cn(
        "group/window absolute flex flex-col overflow-hidden select-none border-0 outline-none ring-0 shadow-none",
        fullscreen ? "rounded-3xl" : "rounded-2xl",
        win.focused ? "opacity-100" : "opacity-90 hover:opacity-100",
        state.preferences.reduceMotion
          ? ""
          : "transition-[opacity,left,top,width,height] duration-200",
      )}
      style={{
        ...geometry,
        zIndex: win.zIndex,
        background:
          "radial-gradient(ellipse 95% 90% at 50% 50%, rgba(13, 20, 36, 0.72) 0%, rgba(10, 16, 28, 0.54) 55%, rgba(7, 11, 22, 0.2) 85%, transparent 100%)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        boxShadow: "none",
      }}
    >
      {/* Semi-transparent halftone stipple texture overlay fading outward */}
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-hidden"
        aria-hidden="true"
      >
        <defs>
          <pattern id={`ht-dots-${win.id}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.6" fill="rgba(56, 189, 248, 0.26)" />
          </pattern>
          <radialGradient id={`ht-mask-${win.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="25%" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="65%" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="85%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`ht-dot-mask-${win.id}`}>
            <rect width="100%" height="100%" fill={`url(#ht-mask-${win.id})`} />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill={`url(#ht-dots-${win.id})`}
          mask={`url(#ht-dot-mask-${win.id})`}
        />
      </svg>

      {/* Top Header Bar with HUD App Tag and Window Controls */}
      <div
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          e.stopPropagation();
          dispatch({
            type: "set_window_mode",
            id: win.id,
            mode: fullscreen ? "windowed" : "fullscreen",
          });
        }}
        className={cn(
          "relative z-10 flex h-11 shrink-0 items-center justify-between px-3.5 select-none bg-transparent",
          fullscreen ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
      >
        {/* Left: Futuristic HUD App Tag */}
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-[10px] font-semibold tracking-wider text-cyan-300 uppercase">
              {win.title.toUpperCase().replace(/\s+/g, "_")}
            </span>
            <span className="text-white/20 font-mono text-[9px]">|</span>
            <span className="font-mono text-[9px] text-cyan-400/80 tracking-tight">
              {fullscreen ? "FULLSCREEN [12×8]" : `${gridCoords} (${areaPct}%)`}
            </span>
          </div>
        </div>

        {/* Right: The 3 Window Controls (Min, Max/Window, Close) — SHOW ONLY ON HOVER */}
        <div className="flex items-center gap-2 pointer-events-auto opacity-0 group-hover/window:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          {/* Minimize Button */}
          <button
            type="button"
            aria-label="Minimize"
            title="Minimize"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "set_window_mode", id: win.id, mode: "minimized" });
            }}
            className="size-6 rounded-full bg-amber-500/25 hover:bg-amber-400 text-amber-300 hover:text-black transition-all flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-110 active:scale-95 shadow-none"
          >
            <Minus className="size-3 stroke-[2.5]" />
          </button>

          {/* Maximize / Restore Window Button */}
          <button
            type="button"
            aria-label={fullscreen ? "Restore window" : "Maximize window"}
            title={fullscreen ? "Restore" : "Maximize"}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({
                type: "set_window_mode",
                id: win.id,
                mode: fullscreen ? "windowed" : "fullscreen",
              });
            }}
            className="size-6 rounded-full bg-emerald-500/25 hover:bg-emerald-400 text-emerald-300 hover:text-black transition-all flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-110 active:scale-95 shadow-none"
          >
            {fullscreen ? (
              <Minimize2 className="size-3 stroke-[2.5]" />
            ) : (
              <Maximize2 className="size-3 stroke-[2.5]" />
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "close_window", id: win.id });
            }}
            className="size-6 rounded-full bg-rose-500/25 hover:bg-rose-500 text-rose-300 hover:text-white transition-all flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-110 active:scale-95 shadow-none"
          >
            <X className="size-3 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Main Borderless App Surface */}
      <div className="relative z-10 min-h-0 flex-1 overflow-auto bg-transparent text-white">
        {children}
      </div>

      {!fullscreen && (
        <div
          onPointerDown={startResize}
          onPointerMove={onResize}
          onPointerUp={() => (resize.current = null)}
          onPointerCancel={() => (resize.current = null)}
          role="separator"
          aria-label="Resize window"
          className="absolute right-0 bottom-0 z-20 size-4 cursor-se-resize opacity-0 group-hover/window:opacity-40 hover:!opacity-100 transition-opacity"
          style={{
            background:
              "radial-gradient(circle at 100% 100%, var(--os-accent) 0%, transparent 70%)",
          }}
        />
      )}
    </section>
  );
}
