import { ChevronDown, ChevronRight, File, Folder, HardDrive } from "lucide-react";
import { useState } from "react";

import { FILE_TREE, type FileNode } from "@/lib/minios/files";

export function FilesApp() {
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(FILE_TREE[0] ?? null);

  return (
    <div className="flex h-full min-h-0 select-none p-4 gap-4">
      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="size-4 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-widest text-cyan-300 uppercase">
            STORAGE_MATRIX // /minios
          </span>
        </div>

        <ul className="space-y-1">
          {FILE_TREE.map((node) => (
            <Node
              key={node.name}
              node={node}
              depth={0}
              selectedNode={selectedNode}
              onSelect={setSelectedNode}
            />
          ))}
        </ul>
      </div>

      {/* Right Holographic File Inspector Preview */}
      <div className="w-56 shrink-0 rounded-xl bg-white/5 p-3.5 flex flex-col justify-between backdrop-blur-md">
        <div className="space-y-3">
          <span className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase block">
            // OBJECT_METADATA
          </span>

          {selectedNode ? (
            <div className="space-y-2">
              <div className="size-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-300">
                {selectedNode.kind === "folder" ? (
                  <Folder className="size-6" />
                ) : (
                  <File className="size-6" />
                )}
              </div>
              <p className="font-medium text-[13px] text-white/95 break-words">
                {selectedNode.name}
              </p>
              <div className="font-mono text-[11px] text-white/50 space-y-1">
                <p>TYPE: {selectedNode.kind.toUpperCase()}</p>
                {selectedNode.size && <p>SIZE: {selectedNode.size}</p>}
                <p>PERMS: rwxr-xr-x</p>
                <p>STATUS: VERIFIED</p>
              </div>
            </div>
          ) : (
            <p className="font-mono text-xs text-white/40">Select an item</p>
          )}
        </div>

        <div className="font-mono text-[9px] text-white/30 pt-2">HOLO_FS // 64.2 GB FREE</div>
      </div>
    </div>
  );
}

function Node({
  node,
  depth,
  selectedNode,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedNode: FileNode | null;
  onSelect: (node: FileNode) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isFolder = node.kind === "folder";
  const isSelected = selectedNode?.name === node.name;

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onSelect(node);
          if (isFolder) setOpen((v) => !v);
        }}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-all ${
          isSelected
            ? "bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.15)]"
            : "text-white/70 hover:bg-white/5 hover:text-white"
        }`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {isFolder ? (
          open ? (
            <ChevronDown className="size-3.5 text-white/40" />
          ) : (
            <ChevronRight className="size-3.5 text-white/40" />
          )
        ) : (
          <span className="size-3.5" />
        )}
        {isFolder ? (
          <Folder className="size-4 text-cyan-400" />
        ) : (
          <File className="size-4 text-white/40" />
        )}
        <span className="flex-1 truncate font-sans">{node.name}</span>
        {node.size && <span className="font-mono text-[10px] text-white/40">{node.size}</span>}
      </button>
      {isFolder && open && node.children && (
        <ul className="mt-1 space-y-0.5">
          {node.children.map((child) => (
            <Node
              key={child.name}
              node={child}
              depth={depth + 1}
              selectedNode={selectedNode}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
