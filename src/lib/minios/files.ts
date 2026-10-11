export type FileNode = {
  name: string;
  kind: "folder" | "file";
  size?: string;
  children?: FileNode[];
};

/** Static view of the portable MiniOS storage folder. */
export const FILE_TREE: FileNode[] = [
  {
    name: "workspaces",
    kind: "folder",
    children: [
      { name: "main.layout.json", kind: "file", size: "2.1 KB" },
      { name: "focus.layout.json", kind: "file", size: "1.4 KB" },
    ],
  },
  {
    name: "notes",
    kind: "folder",
    children: [{ name: "welcome.md", kind: "file", size: "820 B" }],
  },
  {
    name: "config",
    kind: "folder",
    children: [
      { name: "preferences.json", kind: "file", size: "512 B" },
      { name: "gesture-bindings.json", kind: "file", size: "1.0 KB" },
    ],
  },
  { name: "minios.db", kind: "file", size: "48 KB" },
  { name: "README.md", kind: "file", size: "1.2 KB" },
];
