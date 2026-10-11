import { FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useDesktop } from "@/lib/minios/store";
import { cn } from "@/lib/utils";

export function NotesApp() {
  const { state, dispatch } = useDesktop();
  const [selectedId, setSelectedId] = useState<string | null>(state.notes[0]?.id ?? null);
  const active = state.notes.find((n) => n.id === selectedId) ?? state.notes[0];

  return (
    <div className="flex h-full min-h-0 select-none">
      {/* Left Sidebar: Note List */}
      <aside className="flex w-60 shrink-0 flex-col p-3 space-y-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase">
            // LOGS ({state.notes.length})
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "note_create" })}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus className="size-3" /> New
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto space-y-1 pr-1">
          {state.notes.map((note) => {
            const isSelected = active?.id === note.id;
            return (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    "group relative w-full text-left rounded-xl p-2.5 transition-all",
                    isSelected
                      ? "bg-cyan-500/15 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white/90",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        isSelected ? "text-cyan-400" : "text-white/40",
                      )}
                    />
                    <span className="truncate text-[13px] font-medium">
                      {note.title || "Untitled log"}
                    </span>
                  </div>
                  <span className="mt-1 block font-mono text-[10px] text-white/40 pl-5">
                    {new Date(note.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Right Content: Frameless Text Editor */}
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              value={active.title}
              onChange={(e) =>
                dispatch({ type: "note_update", id: active.id, title: e.target.value })
              }
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight text-white/95 outline-none placeholder:text-white/30"
              placeholder="Log Title..."
            />
            <button
              type="button"
              aria-label="Delete note"
              title="Purge record"
              onClick={() => {
                dispatch({ type: "note_delete", id: active.id });
                const remaining = state.notes.filter((n) => n.id !== active.id);
                setSelectedId(remaining[0]?.id ?? null);
              }}
              className="size-8 rounded-full flex items-center justify-center text-white/40 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <textarea
            value={active.body}
            onChange={(e) => dispatch({ type: "note_update", id: active.id, body: e.target.value })}
            className="min-h-0 flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-white/80 outline-none placeholder:text-white/20 selection:bg-cyan-500/30 font-sans"
            placeholder="Write your note or command transcript..."
          />

          <div className="flex items-center justify-between pt-2 font-mono text-[10px] text-white/30">
            <span>BYTES: {active.body.length}</span>
            <span>WORDS: {active.body.trim().split(/\s+/).filter(Boolean).length}</span>
            <span className="text-cyan-400/60">AUTOSAVED_LOCAL</span>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center text-center text-white/40">
          <p className="font-mono text-xs">NO ACTIVE LOG SELECTED</p>
        </div>
      )}
    </div>
  );
}
