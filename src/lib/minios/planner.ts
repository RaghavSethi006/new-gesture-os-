import {
  CAPABILITIES,
  CAPABILITY_MAP,
  type CapabilityArgs,
  type CapabilityContext,
} from "./capabilities";
import { reducer, type Action } from "./store";
import type { DesktopState } from "./types";

/**
 * Planner — turns free text (or LLM output) into an ordered plan of capability
 * steps. Multi-command input is supported by splitting on connectors and
 * simulating each step against a working copy of the state, so later clauses
 * see the windows earlier clauses created.
 */

export type PlanStepRequest = { capability: string; args?: CapabilityArgs };

export type PlanStep = {
  capability: string;
  label: string;
  actions: Action[];
};

export type Plan = {
  steps: PlanStep[];
  /** Clauses no capability could claim. */
  unmatched: string[];
  source: "rules" | "ai";
};

const CONNECTORS =
  /\s*(?:,|;|\.|\bthen\b|\band then\b|\bafter that\b|\bafter which\b|\bnext\b|\bplus\b|\balso\b|\band\b)\s*/gi;

/** Split a sentence into independent command clauses. */
export function splitClauses(input: string): string[] {
  return input
    .split(CONNECTORS)
    .map((c) => c.trim())
    .filter((c) => c.length > 1);
}

function matchClause(clause: string, ctx: CapabilityContext): PlanStepRequest | null {
  const text = clause.toLowerCase();
  for (const capability of CAPABILITIES) {
    const args = capability.match(text, ctx);
    if (args) return { capability: capability.id, args };
  }
  return null;
}

/** Resolve capability requests into concrete actions, simulating as we go. */
export function planFromSteps(
  requests: PlanStepRequest[],
  state: DesktopState,
  bounds: { width: number; height: number },
  source: Plan["source"] = "rules",
): Plan {
  let working = state;
  const steps: PlanStep[] = [];
  const unmatched: string[] = [];

  for (const request of requests) {
    const capability = CAPABILITY_MAP[request.capability];
    if (!capability) {
      unmatched.push(request.capability);
      continue;
    }
    const resolved = capability.resolve(request.args ?? {}, {
      state: working,
      bounds,
    });
    if (!resolved || resolved.actions.length === 0) {
      unmatched.push(capability.id);
      continue;
    }
    steps.push({ capability: capability.id, ...resolved });
    working = resolved.actions.reduce(reducer, working);
  }

  return { steps, unmatched, source };
}

/** Deterministic plan for natural language, supporting multiple commands. */
export function planFromText(
  input: string,
  state: DesktopState,
  bounds: { width: number; height: number },
): Plan {
  const clauses = splitClauses(input);
  if (clauses.length === 0) return { steps: [], unmatched: [], source: "rules" };

  let working = state;
  const steps: PlanStep[] = [];
  const unmatched: string[] = [];

  for (const clause of clauses) {
    const ctx: CapabilityContext = { state: working, bounds };
    const request = matchClause(clause, ctx);
    if (!request) {
      unmatched.push(clause);
      continue;
    }
    const capability = CAPABILITY_MAP[request.capability];
    if (!capability) {
      unmatched.push(clause);
      continue;
    }
    const resolved = capability.resolve(request.args ?? {}, ctx);
    if (!resolved || resolved.actions.length === 0) {
      unmatched.push(clause);
      continue;
    }
    steps.push({ capability: capability.id, ...resolved });
    working = resolved.actions.reduce(reducer, working);
  }

  return { steps, unmatched, source: "rules" };
}

export const INTENT_EXAMPLES = [
  "open notes and snap it left",
  "open files, snap it right, then switch to focus",
  "tile the workspace",
  "dock notes to left grid half",
  "put files on right half of grid",
  "new note called standup, then fullscreen notes",
  "accent amber and hide the grid",
  "add buy milk to the note groceries",
  "reduce motion and disable snapping",
  "move yourself top right, then tile the workspace",
  "position the core automatically",
];
