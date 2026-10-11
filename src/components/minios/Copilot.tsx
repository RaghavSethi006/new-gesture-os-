import { useServerFn } from "@tanstack/react-start";
import { CornerDownLeft, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { capabilityCatalog } from "@/lib/minios/capabilities";
import { planWithAi } from "@/lib/minios/copilot.functions";
import { INTENT_EXAMPLES, planFromSteps, planFromText, type Plan } from "@/lib/minios/planner";
import { useDesktop } from "@/lib/minios/store";
import type { Circle } from "@/lib/minios/core-geometry";

export function Copilot({
  bounds,
  core,
  open,
  onOpenChange,
}: {
  bounds: { width: number; height: number };
  core: Circle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, dispatch } = useDesktop();
  const askAi = useServerFn(planWithAi);
  const [value, setValue] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [undoState, setUndoState] = useState<{
    state: typeof state;
    label: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      input.current?.focus();
      dispatch({ type: "set_core_mode", mode: "listening" });
    } else if (state.core.mode !== "sleep") {
      dispatch({ type: "set_core_mode", mode: "idle" });
    }
  }, [dispatch, open, state.core.mode]);

  const preview = useMemo(
    () => (value.trim() ? planFromText(value, state, bounds) : null),
    [value, state, bounds],
  );

  const runPlan = (plan: Plan) => {
    if (plan.steps.length > 0) {
      setUndoState({
        state,
        label:
          plan.steps.length > 1
            ? `${plan.steps.length} steps`
            : (plan.steps[0]?.label ?? "last plan"),
      });
    }
    plan.steps.forEach((step) => step.actions.forEach((action) => dispatch(action)));
    dispatch({ type: "set_core_mode", mode: "speaking" });
    window.setTimeout(() => dispatch({ type: "set_core_mode", mode: "listening" }), 1200);
    setLog((l) =>
      [
        ...plan.steps.map((s) => `${s.label}${plan.source === "ai" ? " · ai" : ""}`),
        ...plan.unmatched.map((u) => `Didn't understand “${u}”`),
      ]
        .reverse()
        .concat(l)
        .slice(0, 8),
    );
  };

  const run = async () => {
    const text = value.trim();
    if (!text) return;
    const plan = planFromText(text, state, bounds);
    // Deterministic rules cover the whole request → run immediately.
    if (plan.steps.length > 0 && plan.unmatched.length === 0) {
      runPlan(plan);
      setValue("");
      return;
    }

    setThinking(true);
    dispatch({ type: "set_core_mode", mode: "thinking" });
    try {
      const ai = await askAi({
        data: {
          text,
          catalog: JSON.stringify(capabilityCatalog({ state, bounds })),
        },
      });
      const aiPlan = planFromSteps(ai.steps, state, bounds, "ai");
      if (aiPlan.steps.length > 0) {
        runPlan(aiPlan);
        setValue("");
      } else if (plan.steps.length > 0) {
        runPlan(plan);
        setValue("");
      } else {
        setLog((l) => [ai.note ?? `No intent matched “${text}”`, ...l].slice(0, 8));
      }
    } catch {
      if (plan.steps.length > 0) {
        runPlan(plan);
        setValue("");
      } else {
        setLog((l) => [`Couldn't plan “${text}”`, ...l].slice(0, 8));
      }
    } finally {
      setThinking(false);
      if (state.core.mode !== "sleep") {
        dispatch({ type: "set_core_mode", mode: "listening" });
      }
    }
  };

  if (!open) return null;

  const panelWidth = Math.min(576, bounds.width - 24);
  const preferLeft = core.cx > bounds.width / 2;
  const panelLeft = Math.max(
    12,
    Math.min(
      preferLeft ? core.cx - core.radius - panelWidth - 10 : core.cx + core.radius + 10,
      bounds.width - panelWidth - 12,
    ),
  );
  const panelTop = Math.max(12, Math.min(core.cy - 70, bounds.height - 300));

  return (
    <div
      className="absolute z-[9999]"
      style={{ left: panelLeft, top: panelTop, width: panelWidth }}
    >
      <div className="os-glass os-window-shadow w-full max-w-xl rounded-[var(--os-radius)] p-3">
        <div className="flex items-center gap-2">
          {thinking ? (
            <Loader2 className="size-4 animate-spin" style={{ color: "var(--os-accent)" }} />
          ) : (
            <Sparkles className="size-4" style={{ color: "var(--os-accent)" }} />
          )}
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
              if (e.key === "Escape") onOpenChange(false);
            }}
            placeholder="Tell the shell what to do — chain commands with “and” or “then”"
            aria-label="Copilot command"
            className="flex-1 bg-transparent text-sm text-os-text placeholder:text-os-muted focus:outline-none"
          />
          <button
            type="button"
            aria-label="Close copilot"
            onClick={() => onOpenChange(false)}
            className="grid size-6 place-items-center rounded-md text-os-muted hover:bg-os-surface-raised hover:text-os-text"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mt-2 border-t border-os-line pt-2 text-xs">
          {value.trim() ? (
            preview && preview.steps.length > 0 ? (
              <ol className="space-y-1">
                {preview.steps.map((step, i) => (
                  <li
                    key={`${step.capability}-${i}`}
                    className="flex items-center gap-2 text-os-text"
                  >
                    <span className="text-os-muted">{i + 1}.</span>
                    {step.label}
                    <span className="text-os-muted">· {step.capability}</span>
                  </li>
                ))}
                {preview.unmatched.length > 0 && (
                  <li className="text-os-muted">
                    + {preview.unmatched.length} clause
                    {preview.unmatched.length > 1 ? "s" : ""} for the AI planner
                  </li>
                )}
                <li className="flex items-center gap-1 pt-1 text-os-muted">
                  <CornerDownLeft className="size-3" /> Enter to run
                </li>
              </ol>
            ) : (
              <span className="text-os-muted">No rule matched — Enter asks the AI planner</span>
            )
          ) : (
            <div className="flex flex-wrap gap-1">
              {INTENT_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setValue(example)}
                  className="rounded border border-os-line px-2 py-0.5 text-os-muted hover:bg-os-surface-raised hover:text-os-text"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {(log.length > 0 || undoState) && (
          <div className="mt-2 border-t border-os-line pt-2 text-xs text-os-muted">
            {undoState && (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "hydrate", state: undoState.state });
                  setLog((l) => [`Undid ${undoState.label}`, ...l].slice(0, 8));
                  setUndoState(null);
                }}
                className="mb-2 flex items-center gap-1 rounded border border-os-line px-2 py-0.5 text-os-text hover:bg-os-surface-raised"
              >
                <Undo2 className="size-3" /> Undo {undoState.label}
              </button>
            )}
            {log.length > 0 && (
              <ul className="space-y-1">
                {log.map((entry, i) => (
                  <li key={`${entry}-${i}`}>› {entry}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
