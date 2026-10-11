import type { Capability } from "./capabilities";
import type { Action } from "./store";

/**
 * Per-app capability contributions.
 *
 * Each app owns the vocabulary for its own domain. Adding an app means adding
 * one entry here — the deterministic planner, the plan preview and the AI
 * catalogue all pick it up automatically.
 */

function findNote(title: string, notes: { id: string; title: string }[]) {
  const raw = title.trim().toLowerCase();
  if (!raw) return undefined;
  return (
    notes.find((n) => n.title.toLowerCase() === raw) ??
    notes.find((n) => n.title.toLowerCase().includes(raw))
  );
}

const notesCapabilities: Capability[] = [
  {
    id: "delete_note",
    description: "Delete a note by its title",
    params: { title: "note title (or part of it)" },
    examples: ["delete the note called standup", "remove note groceries"],
    match: (text) => {
      if (!/\bnote\b/.test(text)) return null;
      if (!/\b(delete|remove|trash|discard)\b/.test(text)) return null;
      const named = /(?:called|titled|named)\s+(.+)$/.exec(text) ?? /note\s+(.+)$/.exec(text);
      return named?.[1] ? { title: named[1].trim() } : null;
    },
    resolve: (args, ctx) => {
      const note = findNote(args["title"] ?? "", ctx.state.notes);
      if (!note) return null;
      return {
        label: `Delete note “${note.title}”`,
        actions: [{ type: "note_delete", id: note.id }],
      };
    },
  },
  {
    id: "append_to_note",
    description: "Append a line of text to an existing note",
    params: { title: "note title", text: "text to append" },
    examples: ["add buy milk to the note groceries"],
    match: (text) => {
      const m =
        /\badd\s+(.+?)\s+to\s+(?:the\s+)?note\s+(?:called\s+|titled\s+|named\s+)?(.+)$/.exec(text);
      return m?.[1] && m[2] ? { text: m[1].trim(), title: m[2].trim() } : null;
    },
    resolve: (args, ctx) => {
      const note = findNote(args["title"] ?? "", ctx.state.notes);
      const text = (args["text"] ?? "").trim();
      if (!note || !text) return null;
      const current = ctx.state.notes.find((n) => n.id === note.id);
      const body = current?.body ? `${current.body}\n${text}` : text;
      const actions: Action[] = [
        { type: "note_update", id: note.id, body },
        { type: "open_app", appId: "notes" },
      ];
      return { label: `Add “${text}” to ${note.title}`, actions };
    },
  },
];

const settingsCapabilities: Capability[] = [
  {
    id: "toggle_motion",
    description: "Enable or reduce shell animations",
    params: { value: "on | off" },
    examples: ["reduce motion", "turn animations back on"],
    match: (text) => {
      if (!/\b(motion|animation|animations)\b/.test(text)) return null;
      if (/\b(reduce|less|off|disable|stop|no)\b/.test(text)) return { value: "off" };
      if (/\b(on|enable|allow|restore|back)\b/.test(text)) return { value: "on" };
      return null;
    },
    resolve: (args) => {
      const reduce = (args["value"] ?? "off").toLowerCase() === "off";
      return {
        label: reduce ? "Reduce motion" : "Enable animations",
        actions: [{ type: "set_preference", patch: { reduceMotion: reduce } }],
      };
    },
  },
  {
    id: "toggle_snapping",
    description: "Enable or disable edge snapping while dragging windows",
    params: { value: "on | off" },
    examples: ["disable snapping", "turn edge snapping on"],
    match: (text) => {
      if (!/\bsnap(ping)?\b/.test(text)) return null;
      if (/\b(off|disable|stop|no)\b/.test(text)) return { value: "off" };
      if (/\b(on|enable|allow)\b/.test(text)) return { value: "on" };
      return null;
    },
    resolve: (args) => {
      const on = (args["value"] ?? "on").toLowerCase() !== "off";
      return {
        label: on ? "Enable edge snapping" : "Disable edge snapping",
        actions: [{ type: "set_preference", patch: { snapToEdges: on } }],
      };
    },
  },
];

/** Registry of app-owned capabilities, merged into the shell vocabulary. */
export const APP_CAPABILITIES: Capability[] = [...notesCapabilities, ...settingsCapabilities];
