# AI Desktop Companion

# AI-Native Desktop Shell — Architecture & Build Plan

Research pass on the "mini-OS desktop app" idea: an AI copilot with hand-gesture window
control, three window modes (minimized / windowed / fullscreen), full desktop-state
awareness, built with Tauri + React + FastAPI + SQLite.

## Verdict

- **The scoping call you made — "app that behaves like an OS," not an actual OS/compositor
  — is the right one.** It's the difference between a buildable project and a multi-year
  systems effort. Keep it.
- **Your stack is good. Don't change it.** Tauri + React + FastAPI + SQLite isn't just
  plausible, it's a proven combination — there are existing open-source templates running
  almost exactly this stack (Tauri 2 sidecar architecture, FastAPI + SQLModel backend,
  React/TS frontend).
- **The one internal swap I'd make:** don't run gesture recognition in Python/OpenCV. Google
  ships a WASM build of MediaPipe (`@mediapipe/tasks-vision`) that does hand-landmark and
  gesture detection directly in the webview, in JS, with no round-trip to a sidecar process.
  Keep FastAPI for what Python is actually good at: the AI agent loop and memory.
- **The part of the original brainstorm that doesn't survive contact with reality:** an app
  on top of Windows/macOS/Linux _can_ reposition, resize, minimize, and focus real windows
  belonging to other apps — but it can never re-skin them in your widget UI. A real Chrome
  window keeps Chrome's title bar. You get remote control, not repainting. Only apps you
  build yourself _inside_ the shell get the fancy widget treatment. This single fact should
  drive your whole build order, which is why it's section 1.
- **How much real-window control you get is wildly different per OS**, and on Linux it
  depends on which compositor the user happens to be running. Windows is the easy one.
  Treat macOS and Linux as later, smaller phases, not co-equal launch targets.

### Scope confirmed

- **Windows first, Mac and Linux later** — this matches §4's tractability ordering exactly,
  so nothing in the architecture changes. What does change: Phase 5 (Windows) is now the
  actual v1 finish line, not just "the first of three roughly equal platform phases." §7 is
  updated below to reflect that.
- **Both a hosted API and a local model, switchable** — this turned out to have a genuinely
  clean answer rather than needing two parallel code paths. See the new §3.4a.
- **A faceless AI-driven search/media surface, and a full app catalog** — added as §11 and
  §10. The short version: build it as a retrieval-and-render pipeline, not a hidden browser
  (see §11 for why that distinction matters), and most of the "OS" is a build/buy decision
  per app, not a monolith (see §10's table).

---

## 1. The fork in the road: two kinds of "app"

Everything downstream depends on this distinction, so it's worth being blunt about it before
any code gets written.

**Internal / MiniOS apps** — Notes, Files, a terminal pane, an AI chat panel, a settings
screen — are React components you render inside your own canvas. You own every pixel. The
"3-mode widget" concept from your brainstorm (min / windowed / fullscreen, custom title bar,
snap zones, animations) works _exactly_ as pictured, because it's just CSS and component
state. No OS permission, no platform code, fully cross-platform for free.

**Native apps** — the real Chrome, real VS Code, real Spotify — are separate OS processes
with their own real windows. You can ask the operating system to move, resize, minimize,
maximize, focus, or close that window. What you cannot do is intercept its pixels and put
your own rounded-corner widget frame around them — there's no modern, standard way to embed
a foreign app's rendered content inside your window on Windows, macOS, or Wayland (X11 had
`XEmbed`, but it's legacy and nothing else has a real equivalent). So "control" of a native
app means: the OS's own window, moved/sized/minimized under your program's control, still
wearing its own chrome.

|                                         | Internal MiniOS app          | Native app (Chrome, VS Code, …)                        |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Minimize / windowed / fullscreen        | ✅ full control              | ✅ via OS window APIs                                  |
| Move / resize to exact pixels           | ✅ full control              | ✅ via OS window APIs (platform-dependent, see §4)     |
| Your custom title bar / widget skin     | ✅                           | ❌ not possible                                        |
| Gesture-driven layout                   | ✅ trivial                   | ✅ but through OS APIs, not CSS                        |
| AI "knows what's open / focused"        | ✅ trivial (React state)     | ✅ but needs an OS-level watcher (see §3.3)            |
| Cross-machine "resume where I left off" | ✅ real (state is just data) | ⚠️ only as "relaunch + re-arrange," not literal resume |

Design the desktop-state model so every window record — internal or native — has the same
shape, with one field (`is_external`) distinguishing them. The AI, the gesture engine, and
the UI should all talk to _one_ abstraction, not two.

---

## 2. Recommended architecture

Four layers, each doing the thing it's actually good at:

```
┌───────────────────────────────────────────────────────────────┐
│  React desktop shell (rendered inside the Tauri webview)       │
│  · taskbar / launcher / workspace switcher / app widgets       │
│  · gesture engine — MediaPipe Tasks Vision, runs in-browser     │
│  · internal MiniOS apps (Notes, Files, Terminal, AI chat, …)   │
└───────────────┬──────────────────────────────┬─────────────────┘
                │ Tauri invoke() / events        │ HTTP (localhost)
                ▼                                ▼
┌────────────────────────────────┐   ┌────────────────────────────┐
│  Rust core (Tauri) — "hands"    │   │  FastAPI sidecar — "brain"  │
│  · real OS window control        │◄──┤  · AI agent loop             │
│    (Win32 / AXUIElement /        │   │  · calls the Rust tool       │
│     X11 / Hyprland IPC)          │──►│    surface over localhost    │
│  · launch native apps            │   │  · long-term / semantic      │
│  · filesystem, notifications     │   │    memory                    │
│  · live desktop-state cache      │   │  · talks to an LLM API       │
└────────────────┬──────────────────┘   └───────────────┬──────────────┘
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     ▼
                          ┌───────────────────────┐
                          │  SQLite (one file)     │
                          │  workspaces, apps,     │
                          │  prefs, AI memory       │
                          └───────────────────────┘
```

Why this split:

- **Rust owns anything that has to be fast and OS-adjacent**: real window geometry,
  spawning processes, filesystem, notifications, global shortcuts. This is also where the
  live "what's open / what's focused" cache lives, updated by an OS event hook, not polling.
- **Python owns anything that benefits from the AI/data ecosystem**: the agent's
  reasoning loop, tool-call orchestration, conversation memory, maybe embeddings for
  semantic recall later. This is exactly the FastAPI-sidecar-as-bundled-binary pattern —
  PyInstaller freezes the FastAPI app into a single executable, Tauri spawns it as a
  "sidecar" and manages its lifecycle, and the two talk over `localhost` HTTP. It's a
  well-trodden path with multiple working reference templates.
- **React owns rendering and the gesture pipeline.** Running MediaPipe's WASM build directly
  in the webview means gesture latency never has to cross a process boundary — no
  webcam-frame-over-HTTP-to-Python round trip, just `requestAnimationFrame` calling
  `detectForVideo()` locally.
- **SQLite is the single portable "disk"** for your MiniOS — exactly the "shared storage
  space" idea from your second message. Point it at a user-chosen folder and that folder
  _is_ the environment: workspace layouts, preferences, the app registry, gesture bindings,
  AI memory. Be upfront with yourself about what portability actually buys you: config,
  layouts, and AI memory travel with the folder; a _real_ Chrome window obviously can't
  travel with it. What you can do is store "at last session, these apps were open, arranged
  like this" and replay it as a startup script on the new machine — genuinely useful, just
  not literal state teleportation.

---

## 3. Component by component

### 3.1 React desktop shell

This is where the daedalOS-style "webtop" pattern applies directly — it's an open-source,
actively maintained React/Next.js project that already implements a full draggable/
resizable/minimizable window manager, taskbar, and app framework running entirely in the
browser. You don't need to depend on it, but reading its window-manager component is
the fastest way to skip past the fiddly parts of drag/resize/z-index/snap math that have
nothing to do with your AI or gesture layer.

Keep one `WindowState` shape for every window, internal or external:

```ts
type WindowState = {
  id: string;
  appId: string;
  title: string;
  mode: "minimized" | "windowed" | "fullscreen";
  x: number;
  y: number;
  width: number;
  height: number;
  workspaceId: string;
  monitor: number;
  focused: boolean;
  zIndex: number;
  isExternal: boolean; // false = internal MiniOS app, true = real OS window
  externalHandle?: string; // HWND / AXUIElement ref / X11 id / Hyprland address
};
```

Internal apps mutate this via plain React state + a reducer; external apps mutate it via
Tauri events pushed from the Rust core (window moved/closed/focused notifications) plus
Tauri `invoke()` calls going the other way.

### 3.2 Gesture engine — put it in the browser, not Python

`@mediapipe/tasks-vision` ships `HandLandmarker` (21 landmarks per hand, up to 2 hands,
handedness) and a prebuilt `GestureRecognizer` that already classifies a handful of common
gestures, both running via WASM/WebGL directly against a `<video>` element fed by
`getUserMedia`. Practical notes from the research:

- Fingertip landmark indices are fixed across all MediaPipe SDKs: thumb `4`, index `8`,
  middle `12`, ring `16`, pinky `20` — useful once you go beyond the built-in gesture set
  and want custom pinch/spread detection from raw landmarks.
- MediaPipe assumes a mirrored selfie-style feed; flip the video with CSS
  (`transform: scaleX(-1)`) and mirror your x-coordinates, or "left"/"right" handedness
  will be backwards.
- `getUserMedia` works fine in a Tauri desktop webview with no special plugin — it's a
  standard web API. On macOS you do need `NSCameraUsageDescription` in `Info.plist`, and
  expect two separate permission prompts (app-level and webview-level) the first time.
  If a user blocks the camera once, desktop webviews can be sticky about re-prompting;
  point users at the OS-level privacy settings as a fallback in your UI.

Map a _small_ first vocabulary (open palm = activate, pinch = grab, pinch+move = drag,
swipe = workspace switch, fist = cancel) to the **same `WindowState` actions** the AI agent
uses (§3.4) — gestures and the AI should both be "intent producers" feeding one shared
action layer, not two parallel systems that can disagree.

### 3.3 Rust/Tauri core — the "hands"

This is where the OS-specific work lives (full detail in §4). Structurally, expose it as a
flat set of Tauri commands that mirror the AI's tool schema one-to-one:

```rust
#[tauri::command]
async fn get_desktop_state() -> DesktopState { /* … */ }

#[tauri::command]
async fn open_app(app_id: String) -> Result<String, String> { /* … */ }

#[tauri::command]
async fn move_window(window_id: String, x: i32, y: i32) -> Result<(), String> { /* … */ }

#[tauri::command]
async fn resize_window(window_id: String, width: u32, height: u32) -> Result<(), String> { /* … */ }

#[tauri::command]
async fn set_window_mode(window_id: String, mode: WindowMode) -> Result<(), String> { /* … */ }

#[tauri::command]
async fn focus_window(window_id: String) -> Result<(), String> { /* … */ }
```

For internal apps these just mutate the shared state store. For native apps they dispatch
to the platform-specific implementation in §4. Either way, the caller (React, or FastAPI via
React) doesn't need to know which kind of window it's talking to.

The "AI knows what's focused / what's open" requirement means this layer also needs a
**background watcher**, not polling:

- Windows: `SetWinEventHook` for creation/destruction/focus/move events — this is exactly
  how `komorebi` (a Rust tiling WM for Windows) tracks state, alongside `EnumWindows` for
  the initial snapshot.
- macOS: `AXObserver` notifications on the apps you care about, or a lighter polling loop
  as a fallback since Accessibility notifications can be fiddly.
- Linux: X11 has a native event stream; Hyprland pushes live JSON events over its own
  socket.

Standard Tauri plugins worth adding early: `tauri-plugin-shell` (spawn the sidecar, launch
native apps), `tauri-plugin-sql` (SQLite), `tauri-plugin-global-shortcut` (keyboard fallback
for every gesture, which you'll want for demos and accessibility), `tauri-plugin-notification`.

### 3.4 FastAPI sidecar — the "brain"

Standard sidecar setup: FastAPI app frozen to a single executable with PyInstaller, named
per Tauri's target-triple convention, registered as `externalBin` in `tauri.conf.json`,
spawned/killed by Tauri's lifecycle, talking to the frontend over `localhost` HTTP.
This is a well-documented pattern with several working reference implementations to copy
from directly.

The brain's job is a standard tool-calling loop: take the current `DesktopState` + the
user's request (typed, spoken, or a gesture-derived intent string) and let an LLM decide
which of the Rust-mirrored tools to call. Anthropic's tool-use API is a natural fit — you'd
define `move_window`, `open_app`, `set_window_mode`, `switch_workspace`, `get_desktop_state`
etc. as tools with JSON schemas, e.g.:

```json
{
  "name": "move_window",
  "description": "Move a window to an exact screen position.",
  "input_schema": {
    "type": "object",
    "properties": {
      "window_id": { "type": "string" },
      "x": { "type": "integer" },
      "y": { "type": "integer" }
    },
    "required": ["window_id", "x", "y"]
  }
}
```

then let the model emit tool calls, which FastAPI translates into calls against the Rust
command surface (over the same local HTTP channel, or by returning structured actions for
React to execute via `invoke()` — either works; picking one and being consistent matters
more than which one).

One thing worth knowing about because it's directly adjacent to what you're building:
Anthropic's own **computer use** tool takes a different approach — it feeds Claude
screenshots and lets it return coordinates to click/type at, rather than calling named
functions. That's the right tool when there's no structured API for what you're
automating (arbitrary content _inside_ a window). It is the wrong tool for window-manager
actions themselves — structured tool calls against your own `move_window`/`focus_window`
commands will be faster, cheaper, and far more reliable than having a model estimate pixel
coordinates for something you already have an exact API for. This mirrors a real split in
the current agent tooling landscape: macOS-focused agents that use the Accessibility API
directly are reported to be faster and more reliable than screenshot-based ones for exactly
this reason. Save vision-based control for a later "let the AI operate inside an app
that has no API," and use structured tools for everything at the window-manager layer.

### 3.4a Switching between hosted API and local model

This turned out to have a cleaner answer than expected. As of **Ollama v0.14.0** (shipped
January 16, 2026), Ollama ships a built-in endpoint that speaks Anthropic's own Messages API
format at `/v1/messages`, including translating tool calls between Anthropic's `tool_use`
convention and Ollama's internal format. In practice, the _same_ `anthropic` SDK call works
against a hosted Claude model or a fully local model — only a few values change:

```python
from anthropic import Anthropic

def get_client(provider: str) -> Anthropic:
    if provider == "api":
        return Anthropic()  # ANTHROPIC_API_KEY from secure storage
    return Anthropic(base_url="http://localhost:11434", api_key="ollama")  # required, ignored

client = get_client(prefs.ai_provider)
response = client.messages.create(
    model=prefs.ai_model,        # e.g. "claude-sonnet-5" or "qwen3:8b"
    max_tokens=1024,
    tools=WINDOW_MANAGER_TOOLS,  # defined once, shared by both paths
    messages=conversation,
)
```

One tool schema, one response-parsing path, one agent loop. The Settings toggle is really
just swapping `base_url` / `api_key` / `model` — a much simpler design than maintaining a
separate Anthropic-format adapter and OpenAI-format adapter side by side. A few things stay
your responsibility, though:

- **The local model actually has to support tool calling**, and not every model does, even
  when the name suggests it should — Ollama only exposes a working tools interface for
  models whose chat template was trained for it (Gemma 3 doesn't, Gemma 4 does, for
  example), so check the "Tools" capability badge on the model's Ollama library page before
  picking a default. As of this research pass, `qwen3:8b` is a solid default to suggest in
  onboarding: Apache-2.0 licensed, roughly a 5 GB download, about 6–8 GB of RAM/VRAM while
  loaded, and the most consistent small model in current tool-calling comparisons. Treat
  that as a checkpoint to revisit, not a permanent pin — this list changes over months, not
  years.
- **Don't bundle Ollama.** Unlike the FastAPI sidecar, Ollama installs itself as a
  persistent, user-level background service — its own installer, its own auto-updater, a
  system-tray icon, listening on `localhost:11434` — and manages its own model storage
  outside your app entirely. Your app's job is to _detect_ it (a simple `GET` to
  `localhost:11434`), guide the user to install it and pull a model if it's missing, and
  otherwise leave its lifecycle alone.
- **This resolves last round's open question about the portable storage folder:** model
  weights (1–40+ GB depending on choice) live in Ollama's own storage, not yours. Keep the
  shared MiniOS folder for what's actually yours to move — config, layouts, preferences, AI
  memory — and don't try to make local model weights part of the portable bundle.
- **Store the API key properly** — not as a plaintext row in SQLite. Use Tauri's secret
  storage (`tauri-plugin-stronghold`, or the OS keychain) and have the sidecar request it at
  startup rather than persisting it itself.
- **Set expectations rather than hide them.** A hosted Claude model will simply be more
  reliable on long, multi-step, ambiguous requests than an 8B local model — small models'
  tool selection gets noticeably less consistent as a request asks for more chained actions
  at once. For the single-intent calls this app mostly needs ("fullscreen Chrome," "put
  Spotify bottom-right"), a good small local model is genuinely fine. For "set up my whole
  coding workspace and remember I like docs on the second monitor," hosted will just work
  more often. Let the toggle be a real choice the person makes, not a decision you make for
  them.

Add two entries to `preferences` for this: `ai_provider` (`'api'` | `'local'`) and
`ai_model` (e.g. `'claude-sonnet-5'` or `'qwen3:8b'`).

### 3.5 SQLite schema (starting point)

```sql
CREATE TABLE apps (
  id TEXT PRIMARY KEY,             -- 'chrome', 'notes', 'vscode'
  kind TEXT NOT NULL,              -- 'internal' | 'native'
  display_name TEXT NOT NULL,
  icon_path TEXT,
  launch_target TEXT,              -- shell command (native) or component id (internal)
  default_mode TEXT DEFAULT 'windowed'
);

CREATE TABLE windows (
  id TEXT PRIMARY KEY,
  app_id TEXT REFERENCES apps(id),
  title TEXT,
  mode TEXT NOT NULL,              -- 'minimized' | 'windowed' | 'fullscreen'
  x INTEGER, y INTEGER, width INTEGER, height INTEGER,
  workspace_id TEXT,
  monitor INTEGER DEFAULT 0,
  is_external INTEGER DEFAULT 0,
  external_handle TEXT,
  focused INTEGER DEFAULT 0,
  z_index INTEGER DEFAULT 0,
  last_interaction TEXT
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT,
  layout_preset TEXT               -- optional saved-arrangement JSON, for "resume on new machine"
);

CREATE TABLE gesture_bindings (
  gesture TEXT PRIMARY KEY,        -- 'open_palm', 'pinch', 'swipe_left', …
  action TEXT NOT NULL,            -- maps to a tool name
  params_json TEXT
);

CREATE TABLE ai_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,                       -- 'conversation' | 'summary' | 'preference'
  content TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY,            -- 'ai_provider', 'ai_model', 'camera_device_id', …
  value TEXT NOT NULL
);
-- e.g. ('ai_provider', 'local'), ('ai_model', 'qwen3:8b')
-- API keys do NOT go here — see §3.4a on secret storage
```

Practical note: `tauri-plugin-sql` uses `sqlx` and can read/write SQLite directly from the
Rust/React side, while FastAPI would use `SQLAlchemy`/`aiosqlite` on the Python side. SQLite
only allows one writer at a time; if both processes write to the same file, turn on WAL mode
(several plugin implementations enable it automatically on first write) and, if you still see
`database is locked` errors under load, give each process ownership of different tables
rather than fighting over the same rows. The pragmatic default: let FastAPI own `ai_memory`
and preferences (it's the more complex consumer — migrations, eventually embeddings), let
Rust own `windows`/`apps` state (it's the one actually watching the real OS and needs to
write fast).

---

## 4. Real window control, OS by OS

This is the part the original brainstorm glossed over, and it's the part that should
actually determine your phase order. Summary table first, detail after.

| Capability                        | Windows | macOS                                                 | Linux — X11 | Linux — Wayland (Hyprland/Sway)                                      | Linux — Wayland (GNOME/KDE stock) |
| --------------------------------- | ------- | ----------------------------------------------------- | ----------- | -------------------------------------------------------------------- | --------------------------------- |
| List open windows                 | ✅      | ✅                                                    | ✅          | ✅ (generic protocol)                                                | ⚠️ needs a custom extension       |
| Focus / minimize / maximize       | ✅      | ✅                                                    | ✅          | ✅ (generic protocol)                                                | ⚠️                                |
| Move / resize to exact pixels     | ✅      | ✅                                                    | ✅          | ✅ but only via Hyprland's own IPC — **not** in the generic protocol | ❌ without a custom extension     |
| Extra permission needed           | No      | Yes, user-granted, **and the app can't be sandboxed** | No          | No                                                                   | N/A                               |
| Commercial-use licensing to watch | —       | —                                                     | —           | if you lean on existing tools for reference                          | —                                 |

### Windows — build this one first

The most tractable by a wide margin. `windows-rs` (Microsoft's own official Rust bindings)
gives you direct, safe-ish access to the Win32 calls you need: `EnumWindows` to list top-level
windows, `SetWindowPos` to move/resize, `ShowWindow` to minimize/maximize/restore,
`SetForegroundWindow`/`GetForegroundWindow` for focus. No special user permission
prompt is required for a normal user-level app to do this to other normal user-level
windows.

You don't have to invent the approach from scratch: `komorebi`, an actively developed
Rust tiling window manager for Windows, is a working, open-source reference for exactly this
— it runs alongside the normal Windows shell (not replacing it), tracks window state via
`SetWinEventHook`, and exposes every action (focus, move, resize, layout) through a
scriptable IPC surface over Unix domain sockets / named pipes, callable from any
language. Worth reading its architecture even if you write your own thin layer with
`windows-rs` directly — and worth noting its commercial-use terms require a separate license
if you'd depend on it directly rather than just learning from its design.

### macOS — second, and budget more time

Real control of another app's window requires the **Accessibility API** (`AXUIElement`):
get the app's `AXUIElementRef` from its PID, read/write `kAXPositionAttribute`,
`kAXSizeAttribute`, `kAXMinimizedAttribute`, etc. Two hard constraints to plan around:

- **The user must explicitly grant Accessibility permission** in System Settings → Privacy
  & Security → Accessibility. There's no way around the prompt, and there shouldn't be.
- **Your app cannot be sandboxed** for this to work — sandboxed apps never even get the
  permission prompt to appear, developers have hit this wall directly. In practice
  this means: notarized, directly-distributed app, not Mac App Store.

The good news: basic window control (move, resize, focus, minimize) works with Accessibility
permission alone, no further hacks. This is confirmed by `yabai`'s own feature matrix —
"modify window properties" works with System Integrity Protection fully enabled.
Where things get invasive is macOS **Spaces** (virtual desktops) — creating/destroying/
moving between them requires `yabai`-style injection of a "scripting addition" into
`Dock.app`, which needs SIP partially disabled and has to be redone after OS updates.
**Skip Spaces integration for your MVP.** It's real, it's documented, but it's a rabbit hole
that buys you little for how fragile it makes the install story. `Hammerspoon`
(`hs.axuielement`) is a mature, scriptable reference implementation of the
Accessibility-API-only approach if you want a working example to study before writing your
own bindings.

### Linux — X11 easy, Wayland fragmented (be honest about this one)

**X11** sessions are the easy case: any client can reposition any window via the core
protocol, no special permission model exists for this at all. `x11rb` (pure Rust) or
shelling out to `wmctrl`/`xdotool` both work.

**Wayland is not one thing.** There is a generic protocol,
`wlr-foreign-toplevel-management-unstable-v1`, supported by wlroots-based compositors
(Sway, Hyprland, river, …), explicitly designed for building taskbars/docks: it lets you
list windows and request maximize / unmaximize / minimize / unminimize / fullscreen / close
/ activate. **It does not include arbitrary set-position/set-size** — Wayland's
security model deliberately keeps window layout as the compositor's job, not any client's,
which is the opposite of X11's philosophy. If you want actual pixel-precise move/resize on
Wayland, you need a compositor-specific IPC. Hyprland happens to have exactly that: its own
rich socket-based protocol (`hyprctl`) with dispatchers like `movewindowpixel`,
`resizewindowpixel`, and `centerwindow`, addressed by a stable per-window "address," alongside
a live JSON event stream. GNOME and KDE's stock Wayland sessions expose neither of
these — getting equivalent control there means shipping a custom GNOME Shell extension or
KWin script, which is a meaningfully separate project in its own right.

**Practical recommendation:** detect the session at runtime (`XDG_SESSION_TYPE`,
compositor-specific env vars). Support X11 fully. Support Hyprland via `hyprctl` as your
Wayland story, since it's also the compositor your original brainstorm was already leaning
toward. Degrade gracefully everywhere else — internal-app control still works perfectly,
native-app control on GNOME/KDE Wayland falls back to "launch and leave alone" until/unless
you decide a compositor extension is worth building later.

---

## 5. What this changes about your original plan

Two corrections to fold back into the roadmap you had:

1. **Ship internal-app control before any real-window control.** The AI-agent + gesture
   layers can be fully built, demoed, and even shipped as v1 against your own MiniOS apps
   before touching a single platform API. This is also the part of the demo that's most
   impressive to show off, since you fully control the visuals.
2. **Order native-window-control phases by platform tractability, not by "all platforms at
   once."** Windows → macOS → (Linux X11 + Hyprland only) is the order the research
   supports. Treat generic cross-Wayland support as out of scope unless a later phase
   specifically targets a GNOME/KDE extension.

---

## 6. Prior art worth studying before you write code

- **[daedalOS](https://github.com/DustinBrett/daedalOS)** — open-source React/Next.js "web
  desktop": draggable/resizable/minimizable windows, taskbar, file explorer, app framework,
  all in the browser. The fastest shortcut for the internal-app window-manager plumbing.
- **[komorebi](https://github.com/LGUG2Z/komorebi)** — Rust tiling WM for Windows; study its
  event-hook-plus-IPC-command-surface architecture even if you don't depend on it directly.
- **Hammerspoon (`hs.axuielement`)** — mature Lua wrapper over the macOS Accessibility API;
  a working reference for exactly the calls you'll need.
- **Anthropic's computer-use tool / Open Interpreter's OS mode / Fazm** — the "vision +
  coordinates" and "accessibility-API-first" ends of the current agent-desktop-control
  design space, useful for the _content-inside-a-window_ problem once you get there, not the
  window-manager layer itself.

---

## 7. Phased build plan

**Phase 0 — Scaffold.** `create-tauri-app` with the React-TS template, add
`tauri-plugin-sql`, stand up the FastAPI sidecar per the PyInstaller + `externalBin` pattern,
confirm both round-trips work (`React → invoke() → Rust`, `React → HTTP → FastAPI`).

**Phase 1 — Internal MiniOS shell.** Desktop canvas, taskbar, launcher, and the 3-mode
widget system for 3–4 internal apps: Notes, a static Files view, Settings, and a Task/Window
Manager (a live view over the `windows` table — cheap to build this early since the data
already exists, and it's your best demo of "the shell knows what's open"). All state in
React + persisted to SQLite. No AI, no gestures, no OS calls yet. Lean on daedalOS's
window-manager patterns here.

**Phase 2 — AI brain over the internal shell.** Wire the FastAPI sidecar to an LLM with the
tool schema from §3.4, targeting only internal-app actions. Build the provider switch from
§3.4a now, while the only consumer is internal-app actions and mistakes are cheap — a
Settings toggle between hosted (Claude via `api.anthropic.com`) and local (Ollama +
`qwen3:8b` or similar, via its Anthropic-compatible endpoint) sharing one tool schema and
one code path. Validate with something like "set up my writing space" correctly
rearranging your own widgets, on _both_ providers.

**Phase 3 — Search & Discover.** Add the read-only retrieval tools from §11
(`search_web`, `fetch_article`, `search_images`, `search_videos`/`search_audio`) to the same
tool schema from Phase 2, and build the Discover app to render their results as your own
UI. This is the "Jarvis" moment — the AI can now pull up an answer, an article, or a video
without ever showing the person a browser.

**Phase 4 — Gesture engine.** Add `@mediapipe/tasks-vision`, wire a small gesture vocabulary
to the _same_ action layer the AI uses in Phases 2–3, so gestures and AI share one intent
pipeline instead of being two competing systems.

**Phase 5 — Real Windows control. This is v1.** Add `windows-rs` to the Rust core; implement
`get_desktop_state` (EnumWindows snapshot + `SetWinEventHook` for live updates) and the
move/resize/minimize/focus/close commands via `SetWindowPos`/`ShowWindow`/
`SetForegroundWindow`. Extend the tool schema so the AI and gestures can now target real
apps like Chrome and VS Code, not just internal ones. Everything through here — internal
shell, both AI providers, Search & Discover, gestures, real Windows control — is the actual
product you ship first. Phases 6 and 7 are backlog, not blockers.

**Phase 6 (v2) — Real macOS control.** Request Accessibility permission, implement the same
tool surface via `AXUIElement`, plan distribution as a notarized direct download (not
sandboxed / not App Store).

**Phase 7 (v2, optional) — Linux.** X11 via `x11rb` or `wmctrl`/`xdotool`. Wayland via
`hyprctl` for Hyprland users specifically; everything else degrades to internal-app-only
control.

**Phase 8 — Multimodal polish.** Fuse voice + gesture + "what's currently focused" context
("move _this_ over _there_" while pointing), magnetic edge-snapping, saved workspace
presets, transition animations.

---

## 8. Quick start

```bash
# scaffold the Tauri + React app
npm create tauri-app@latest ai-desktop -- --template react-ts
cd ai-desktop

# official SQLite plugin
npm run tauri add sql

# python sidecar
mkdir sidecar && cd sidecar
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn pyinstaller
# write sidecar/main.py (a FastAPI app), then:
pyinstaller --onefile main.py --name fastapi-server
# copy the built binary into src-tauri/binaries/ using Tauri's
# target-triple naming convention, and register it under
# tauri.conf.json -> bundle.externalBin
```

From there: `tauri-plugin-shell` to spawn/manage the sidecar and launch native apps,
`tauri-plugin-global-shortcut` for a keyboard fallback to every gesture (useful for
development and for accessibility), `tauri-plugin-notification` for desktop notifications.

---

## 9. Open questions worth settling early

Settled this round: primary platform is Windows first, §7 reflects that. AI brain is
switchable hosted/local via §3.4a's shared-endpoint design. Still open:

- **First-run experience for the local path.** If someone picks "local" before Ollama is
  even installed, does the app just show instructions, or actually shell out to run the
  Ollama installer and `ollama pull qwen3:8b` for them? The latter is friendlier but means
  bundling install logic for a third-party installer you don't control the versioning of.
- **Auto-fallback, or strictly manual toggle?** E.g. falling back to hosted automatically if
  local is selected but Ollama isn't reachable, versus just surfacing a clear error and
  letting the person switch themselves. Manual is simpler and more predictable to build
  first; auto-fallback is a reasonable v1.1.
- **How much of the gesture vocabulary needs to work with one hand vs. requires two?** Changes
  the `numHands` config and some of your intent-disambiguation logic.
- **License posture** if this becomes more than a personal/research project — MediaPipe
  (Apache 2.0), Tauri (MIT/Apache-2.0), FastAPI (MIT), and SQLite (public domain) are all
  permissive; just don't lift code directly from `komorebi` without checking its commercial
  license terms first.

---

## 10. The app catalog — what this "OS" actually needs

Same build/buy question as §1, per app: internal widget (full 3-mode control, no OS
permission dance, but you build and maintain it) or launch-a-real-app (real capability
for free, but you only get remote control, never the chrome). Sort the obvious candidates
into both buckets before writing any of them.

**Build internal — yours, full widget treatment:**

| App                   | What it does                                                                                                                                                                                                        | Priority                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AI Copilot            | The Jarvis-style conversational surface — text/voice in, tool calls out. Less "an app," more the thing the shell is organized around; consider docking it always-available rather than making it a closeable window | Tier 0 — this is the product |
| Search & Discover     | §11 — search, articles, images, video/audio, faceless                                                                                                                                                               | Tier 0                       |
| Files                 | Browser for the MiniOS's own storage (§2's portable folder), optionally the host filesystem too                                                                                                                     | Tier 1                       |
| Settings              | AI provider toggle (§3.4a), gesture bindings, permissions, appearance                                                                                                                                               | Tier 1                       |
| Notes                 | Plain text/markdown, AI-editable                                                                                                                                                                                    | Tier 1                       |
| Task / Window Manager | Live view over `windows` (§3.5) — what's open, focused, on which workspace. Your cheapest, best demo of "the AI is aware of the desktop"                                                                            | Tier 1                       |
| Notification Center   | Surfaces anything the AI or system wants to say, without interrupting                                                                                                                                               | Tier 2                       |
| Media Player          | Plays what Discover finds — very possibly the _same component_, embedded in two places                                                                                                                              | Tier 2                       |
| Clipboard Manager     | History of copied text/images; a natural gesture target ("paste that there")                                                                                                                                        | Tier 2                       |
| Terminal              | `xterm.js` + a PTY spawned by the Rust core — useful for a dev-leaning shell, and a clean gesture-control demo                                                                                                      | Tier 3                       |
| Image / PDF Viewer    | Lightweight viewer for whatever Files or Discover surfaces                                                                                                                                                          | Tier 3                       |

**Launch native — real app, real window, you get position/size/focus (§4) but never the chrome:**

| App                                    | Why not build it yourself                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Full web browser (Chrome/Firefox/Edge) | A real browser engine is its own decade-long project; Discover already covers "the AI shows me things" without needing one |
| VS Code / IDEs                         | Same logic — your value-add is orchestration, not a second code editor                                                     |
| Spotify / Discord / Slack              | Deep platform integrations (auth, DRM, protocols) you can't realistically match                                            |
| Office apps                            | Enormous surface area for close to zero differentiation                                                                    |

One deliberate gap in that second table: **calendar/email.** Neither "build a mail server
from scratch" nor "just launch Outlook" is right — the better shape is a _thin internal
widget over a real API_ (Google Calendar/Gmail, Microsoft Graph), so it gets the AI-native
widget treatment without reimplementing infrastructure nobody should reimplement. Worth its
own design pass later; flagging it now so it doesn't get lost.

Map straight onto §7: Tier 0/1 is what Phases 1–3 build. Tier 2/3 slot in opportunistically
once the core loop (shell + AI + Discover + gestures + real Windows control) is solid —
resist the pull to build Tier 3 apps before Phase 5 ships; none of them make the "is this
actually an AI-native OS" demo land, and all of them are time you could spend on the thing
that does.

---

## 11. Search & Discover — the faceless browser

The Jarvis comparison is the right one, and it points at a specific choice worth being
deliberate about: **don't build this as "a real Chrome window with the UI hidden."** That's
the heavy path — you'd fight a full browser engine the whole way, and the moment anything
breaks it looks exactly like what it is, a browser. Build it the same shape as the
window-manager tools from §3.4: a fixed set of backend tools the AI calls, results come back
as clean structured data, and your React shell renders its own UI. There's no browser chrome
anywhere because, for the common cases, nothing ever gets rendered as a webpage at all.

**The tools, and what's behind each one.** All owned by FastAPI, all reused unchanged
regardless of which AI provider from §3.4a is active — build these yourself rather than
leaning on a hosted-only search feature, or local mode quietly loses the whole app:

- **`search_web(query)`** → titles, snippets, URLs. **Tavily** is the strongest default —
  search plus clean content extraction in one call, purpose-built for agent output, usable
  free tier for development. **Exa** is the alternative when you want semantic/"find pages
  like this" discovery over keyword matching. One dead end worth knowing so you don't waste
  time chasing it: the classic **Bing Search API was retired in August 2025**; its
  replacement lives inside Azure AI Foundry, isn't a drop-in, and is priced very
  differently.
- **`fetch_article(url)`** → clean article text, no ads/nav/boilerplate. Tavily's own
  Extract endpoint covers this if you're already using Tavily for search. To avoid an extra
  paid dependency: `trafilatura` (Python, self-hosted, free) or Jina AI Reader
  (`r.jina.ai/<url>`, hosted, generous free tier) do the same job.
- **`search_images(query)`** → **Brave Search API** specifically has dedicated
  image/video/news verticals that Tavily/Exa don't really cover. Render as a custom grid
  widget, tap to open larger inline — never a new "tab."
- **`search_videos(query)` / `search_audio(query)`** → two steps, not one. First, find
  candidates (Brave's video vertical, or YouTube Data API's `search` endpoint — a normal,
  currently-supported Google API with a free tier, unrelated to the Bing retirement above).
  Then turn the specific URL you land on into a player via **oEmbed** — a small, open,
  no-API-key protocol that YouTube, Vimeo, and SoundCloud all support:
  `GET youtube.com/oembed?url=<video_url>` hands back a title, thumbnail, and a ready
  `<iframe>` embed. That iframe, scoped to exactly one video, is the only "browser-shaped"
  thing anywhere in this feature — nothing about general navigation.

Reserve an actual hidden/background Tauri webview (rendered off-screen, text pulled out
into your own UI) for the minority of pages your extractor can't parse cleanly — typically
JS-heavy sites. That's a fallback, not the primary path.

**On copyright, since this app's whole job is showing people other people's work:**
summarize and link, don't reproduce. A short snippet plus a source link — the same
discipline any AI answering from search results should follow. Full-text scraping and
redisplay is both a legal problem and a worse product; nobody actually wants a Jarvis that
pirates paywalled articles.

**The capability ladder — build it in the order you already described:**

| Level                                                                                | What it does                                                                                                            | Risk                                                                                                                                                                                                                                        | Build when                                             |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0 — Read-only retrieval                                                              | `search_web`, `fetch_article`, `search_images`, `search_videos`/`search_audio` via oEmbed                               | Low — no credentials, no actions taken on the user's behalf                                                                                                                                                                                 | First — this alone is most of "Jarvis pulls things up" |
| 1 — Render-only fallback                                                             | Hidden webview renders JS-heavy pages the extractor can't parse; still shown in your own UI                             | Low-medium — still read-only, just harder rendering                                                                                                                                                                                         | Once real sites start beating Level 0's extraction     |
| 2 — Interactive browsing (Playwright-style: clicks, fills forms, logs into accounts) | High — real actions with real consequences: credential handling, confirmation gates, a materially bigger attack surface | Treat as a separate, later project decision, not a natural "next increment" — going from "shows you things" to "acts on the web as you" is a different risk category, and deserves its own scoping conversation when you actually get there |

Level 0 alone is already a genuinely impressive, safe, and useful thing to ship — that's the
right place to stop expanding for a while.

---

## 12. Sources

- Tauri v2 + FastAPI sidecar templates: [dieharders/example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar), [fudanglp/tauri-fastapi-full-stack-template](https://github.com/fudanglp/tauri-fastapi-full-stack-template)
- Tauri window/webview APIs: [v2.tauri.app/reference/javascript/api/namespacewebviewwindow](https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/)
- SQLite plugin: [v2.tauri.app/plugin/sql](https://v2.tauri.app/plugin/sql/)
- MediaPipe Tasks Vision (gesture/hand landmarker, web): [ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- `windows-rs`: [github.com/microsoft/windows-rs](https://github.com/microsoft/windows-rs)
- `komorebi`: [github.com/LGUG2Z/komorebi](https://github.com/LGUG2Z/komorebi)
- macOS Accessibility API + sandboxing constraint: [Apple Developer Forums thread](https://developer.apple.com/forums/thread/810677)
- `yabai` feature matrix / SIP requirements: [yabai wiki](https://github.com/asmvik/yabai/wiki)
- `Hammerspoon` `hs.axuielement`: [Hammerspoon wiki](https://github.com/asmagill/hammerspoon/wiki/hs.axuielement-Overview)
- `wlr-foreign-toplevel-management` protocol: [wayland.app/protocols/wlr-foreign-toplevel-management-unstable-v1](https://wayland.app/protocols/wlr-foreign-toplevel-management-unstable-v1)
- Hyprland IPC / `hyprctl`: [wiki.hypr.land/IPC](https://wiki.hypr.land/IPC/)
- Ollama's Anthropic Messages API compatibility (`/v1/messages`, shipped in v0.14.0): [docs.ollama.com/api/anthropic-compatibility](https://docs.ollama.com/api/anthropic-compatibility)
- Ollama tool calling / which models support it: [docs.ollama.com/capabilities/tool-calling](https://docs.ollama.com/capabilities/tool-calling)
- Ollama on Windows — install, service behavior, model storage: [docs.ollama.com/windows](https://docs.ollama.com/windows)
- daedalOS: [github.com/DustinBrett/daedalOS](https://github.com/DustinBrett/daedalOS)
- Anthropic computer use tool: [platform.claude.com/docs — computer use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- Search API landscape, Bing Search API retirement (Aug 2025): [apipick.com — best web search APIs for AI agents 2026](https://www.apipick.com/blog/best-web-search-apis-for-ai-agents-2026)
- Tavily (search + extract for agents): [tavily.com](https://www.tavily.com/)
- Brave Search API verticals (web/news/image/video): [contextstudios.ai — best AI search APIs](https://www.contextstudios.ai/guides/best-ai-search-apis-agents-2026)
- YouTube oEmbed endpoint: [oembed.com](https://oembed.com/) / `youtube.com/oembed`

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3af1dd5c-6dec-4ded-8baf-d68066847723).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
