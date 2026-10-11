# Living OS Core architecture

## Goal

Turn the supplied holographic avatar into MiniOS’s always-visible AI core. It occupies one of seven anchors, reflects the copilot’s live activity, and becomes part of window layout rather than floating over app content.

## Interaction model

- Seven anchors: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right, and screen center.
- Two placement policies:
  - **Auto:** choose the least disruptive anchor whenever windows open, close, move, snap, tile, or restore.
  - **Locked:** a spoken or typed position request stays fixed until the user asks for automatic placement again.
- Clicking the core opens the copilot beside it; the panel flips inward at edges so it always remains on-screen.
- The core reflects real activity with the supplied visual language: idle, listening/input, thinking/planning, speaking/result, and sleep/reduced-motion states.
- Position changes and layout changes use the same action system as windows, keyboard controls, and copilot plans, so they remain reversible and persist locally.

## Layout architecture

1. Add `CoreState` to desktop state: anchor, placement policy, interaction mode, and compact/expanded presentation.
2. Create one geometry module as the source of truth for:
   - Core center, visual radius, safe radius, and edge offsets at every anchor.
   - Occupied circular region and candidate scoring for automatic placement.
   - Window geometry constrained around that region.
3. Route snapping, tiling, fullscreen, restored layouts, dragging, and resizing through this geometry layer. This prevents each feature from inventing different collision rules.
4. Use a circular exclusion contour when a tiled or maximized window meets the core. The window surface and border receive a matching curved notch with a small safety gap, so content cannot sit beneath the avatar and the border visibly follows its curve.
5. Free-floating windows remain draggable, but settle outside the exclusion region on release. If the core moves, affected windows reflow while unaffected windows keep their geometry.
6. Auto placement scores all seven anchors by overlap cost, movement cost, focused-window priority, and available panel space. It only relocates when a new anchor is meaningfully better, preventing visual hopping.

## Core component

- Rebuild the uploaded avatar as a reusable, responsive SVG/CSS component rather than embedding the saved webpage.
- Preserve its concentric rings, orbital ticks, glyph ring, luminous center, scan motion, and cyan holographic character.
- Scale it down for edge anchors and use the full presentation at screen center.
- Keep a stable hit target and separate visual radius from layout-safe radius.
- Respect the existing reduced-motion setting; sleep mode stops nonessential loops.
- Add accessible labels for current state and position.

## Copilot integration

- Move copilot visibility and activity into shared core state so the avatar and command surface cannot disagree.
- Transition automatically:
  - open/focused input → listening
  - AI request in progress → thinking
  - successful plan/result → speaking briefly, then idle
  - closed with reduced motion or explicit sleep request → sleep
- Add capabilities for `move_core`, `set_core_auto`, `set_core_mode`, and `show_core`/`hide_core` only if hiding is later requested; always-on remains the default here.
- Understand requests such as “move yourself top right,” “stay in the bottom center,” and “position yourself automatically.”
- Include current core position and policy in the AI capability catalog.

## Persistence and compatibility

- Persist core placement with the existing local desktop state.
- Include core placement in named layout snapshots, while preserving a user’s current locked policy unless the restored layout explicitly contains one.
- Migrate older saved local state safely by filling missing core defaults.
- Keep all existing app, snapping, workspace, keyboard, and undo behavior working.

## Implementation sequence

1. Add core types, defaults, actions, migration, and copilot capabilities.
2. Build the shared geometry and collision/scoring tests.
3. Build the holographic core and activity-state transitions.
4. Integrate curved window contours into snap, tile, fullscreen, drag, resize, and restore flows.
5. Anchor the copilot surface to the core and add direct position controls.
6. Verify all seven anchors, auto placement, locked placement, multi-window tiling, restored layouts, desktop/mobile sizing, reduced motion, and natural-language moves.

## Acceptance checks

- The core is visible with zero, one, or many windows.
- Every anchor remains fully inside the usable desktop above the taskbar.
- No tiled, snapped, maximized, or restored app paints beneath the core’s safe circle.
- Adjacent window borders visibly follow the same circular contour.
- Manual placement stays locked through later window changes; “automatic position” restores smart movement.
- Chained requests can move the core and rearrange apps in one plan, and undo restores both.
