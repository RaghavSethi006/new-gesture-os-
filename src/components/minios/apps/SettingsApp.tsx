import { Sliders, Sparkles } from "lucide-react";
import { useDesktop } from "@/lib/minios/store";
import type { Preferences } from "@/lib/minios/types";
import { cn } from "@/lib/utils";

const ACCENTS: { id: Preferences["accent"]; label: string; color: string }[] = [
  { id: "teal", label: "Electric Cyan", color: "from-cyan-400 to-blue-500" },
  { id: "amber", label: "Solar Amber", color: "from-amber-400 to-orange-500" },
  { id: "rose", label: "Plasma Rose", color: "from-rose-400 to-pink-500" },
];

const TOGGLES: { key: keyof Preferences; label: string; hint: string }[] = [
  {
    key: "snapToEdges",
    label: "Magnetic Snap",
    hint: "Automatic edge alignment when windows interact",
  },
  {
    key: "showGrid",
    label: "Coordinate Matrix",
    hint: "Holographic alignment grid on desktop canvas",
  },
  {
    key: "reduceMotion",
    label: "Reduced Kinetic Mode",
    hint: "Instant HUD state transitions without kinetic physics",
  },
];

export function SettingsApp() {
  const { state, dispatch } = useDesktop();
  const prefs = state.preferences;

  return (
    <div className="flex h-full flex-col justify-between p-5 select-none space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Sliders className="size-4 text-cyan-400" />
        <span className="font-mono text-xs font-semibold tracking-widest text-cyan-300 uppercase">
          SYSTEM_KERNEL // CONFIGURATION
        </span>
      </div>

      {/* Theme Accent Section */}
      <div className="space-y-2">
        <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase block">
          // PHOTON_CHROMATICS
        </span>
        <div className="grid grid-cols-3 gap-3">
          {ACCENTS.map((accent) => {
            const isSelected = prefs.accent === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                onClick={() => dispatch({ type: "set_preference", patch: { accent: accent.id } })}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl p-3 transition-all",
                  isSelected
                    ? "bg-white/10 shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                    : "bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100",
                )}
              >
                <div
                  className={cn("size-5 rounded-full bg-gradient-to-tr shadow-md", accent.color)}
                />
                <span className="text-xs font-medium text-white/90">{accent.label}</span>
                {isSelected && (
                  <span className="font-mono text-[9px] text-cyan-400 font-semibold tracking-wider">
                    [ACTIVE]
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shell Toggles */}
      <div className="space-y-2">
        <span className="font-mono text-[10px] tracking-widest text-white/40 uppercase block">
          // ENGINE_PARAMETERS
        </span>
        <div className="space-y-2">
          {TOGGLES.map((toggle) => {
            const value = prefs[toggle.key] as boolean;
            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between rounded-xl bg-white/5 p-3 backdrop-blur-md"
              >
                <div>
                  <p className="text-xs font-medium text-white/90">{toggle.label}</p>
                  <p className="text-[11px] text-white/40">{toggle.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  aria-label={toggle.label}
                  onClick={() =>
                    dispatch({ type: "set_preference", patch: { [toggle.key]: !value } })
                  }
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none",
                    value ? "bg-cyan-500 shadow-[0_0_12px_rgba(0,212,255,0.5)]" : "bg-white/20",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 transform rounded-full bg-white transition-transform duration-200 mt-1 ml-1",
                      value ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Footer */}
      <div className="flex items-center justify-between font-mono text-[10px] text-white/30 pt-1">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-cyan-400" />
          MINIOS_AI_KERNEL v4.2.0
        </span>
        <span>BUILD_HASH: #F8945401</span>
      </div>
    </div>
  );
}
