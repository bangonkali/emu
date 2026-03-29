# NEXT: Flexible Workspace Layout System

## Completed

- **Phase 1 — Svelte Replatform (DONE):** The plain-JS dashboard has been fully replaced by a Bun + Vite 8 + Svelte 5 + TypeScript workspace. Feature parity confirmed. Multi-stage Docker build (oven/bun builder → python:3.10-slim runtime) is in production. All panel tools (Play, Map, Party, Items, Saves, Pokédex, Logs, Battle) are implemented as Svelte 5 components.

## Current Initiative

Build a fully user-configurable workspace shell where every panel layout is defined at runtime by the user. Each workspace tab contains a recursive tree of resizable split panes. Any leaf pane can be assigned a tool from the catalog or left empty.

## Goals (Phase 2)

1. User can create, rename, and remove named workspace tabs (double-click to rename, + to add, × to close).
2. Each tab has a recursive split-pane layout: any leaf pane can be split horizontally or vertically producing N-ary trees.
3. Each leaf pane is assigned a tool from the tool catalog, or left empty (shows a centered placeholder).
4. Empty panes display an affordance to assign a tool or split the pane further.
5. Workspace layout (tabs, splits, tool assignments, divider sizes) persists to `localStorage`.
6. Dark and light theme toggle with `localStorage` persistence (default: dark).
7. No extra npm dependencies — split pane layout is implemented in-house using CSS flex and pointer events.

## Flexible Layout Data Model

### Types (`workspaceStore.svelte.ts`)

```typescript
type ToolboxId = 'play' | 'map' | 'party' | 'items' | 'saves' | 'pokedex' | 'logs' | 'battle';

interface LeafPaneNode  { type: 'leaf';  id: string; toolboxId: ToolboxId | null; }
interface SplitPaneNode { type: 'split'; id: string; direction: 'horizontal' | 'vertical'; sizes: number[]; children: PaneNode[]; }
type PaneNode = LeafPaneNode | SplitPaneNode;

interface WorkspaceTab { id: string; label: string; layout: PaneNode; }
```

### Store operations

| Method | Effect |
|--------|--------|
| `addTab(label?)` | Append new tab with a single empty leaf, switch to it |
| `removeTab(id)` | Remove tab (minimum 1 remains) |
| `renameTab(id, label)` | Rename tab label |
| `setActiveTab(id)` | Switch active tab |
| `splitPane(paneId, direction)` | Replace leaf with a split (2 children: original leaf + new empty leaf). If parent split is in the same direction, adds sibling instead of nesting. |
| `removePane(paneId)` | Remove leaf from parent; sibling takes all space. If leaf is root, clears toolbox instead. |
| `assignToolbox(paneId, toolboxId\|null)` | Set or clear the tool in a leaf pane |
| `updateSizes(splitId, sizes)` | Update divider positions (called during drag) |
| `saveSizes()` | Persist sizes to localStorage (called on drag end) |

## Tool Catalog (Toolboxes)

| ToolboxId | Component | Purpose |
|-----------|-----------|---------|
| `play` | `PlayViewport` | Live Game Boy screen + input controls |
| `map` | `MapPanel` | Kanto map with player marker |
| `party` | `PartyPanel` | Party detail and live telemetry |
| `items` | `ItemsPanel` | Bag decoding and slot usage |
| `saves` | `SavesPanel` | Native `.state` explorer, save/load |
| `pokedex` | `PokedexPanel` | Catalog browser with search and filters |
| `logs` | `LogsPanel` | Runtime log stream |
| `battle` | `BattlePanel` | Live battle telemetry |

## Component Architecture

```
AppShell
├── TopBar            (status bar: connection, speed, frame, money, badges, theme toggle)
├── WorkspaceTabBar   (add/rename/close tabs)
└── PaneTree          (recursive; root = activeTab.layout)
    ├── SplitPaneNode → flex container + dividers + recursive PaneTree children
    └── LeafPaneNode  → LeafPaneView
                          ├── pane header: [ToolName] [Split→] [Split↓] [✕]
                          └── pane content:
                              ├── ToolboxPicker (when assigning a tool)
                              ├── Empty placeholder (when toolboxId === null)
                              └── Tool component (PlayViewport | MapPanel | ...)
```

## UX Design

- **Tab bar**: Compact 36 px row. Each tab has a label (double-click to rename) and a × close button visible on hover. The + button appends a new tab. Active tab is underlined with the accent color.
- **Pane header**: 26 px, shows the assigned tool name (clickable to change). Action buttons on the right: Split Right (⊢), Split Down (⊣), Close (✕). Clicking the tool name opens `ToolboxPicker`.
- **ToolboxPicker**: Replaces the pane content with a grid of available tools. Includes a "Clear" option.
- **Empty pane**: Centers a message "No tool assigned" with [Assign Tool], [Split →], [Split ↓] buttons.
- **Dividers**: 4 px wide/tall. On hover or drag: highlight with accent color. Cursor changes to `col-resize` or `row-resize`.
- **Resize**: Pointer-event-based drag. Keyboard: arrow keys on focused divider move by 2%. Sizes persist on drag end.

## Svelte Implementation Principles

1. Svelte 5 runes (`$state`, `$derived`, `$effect`) throughout — no legacy stores.
2. `workspaceStore.svelte.ts` — reactive class with `$state` for deep tree reactivity; direct tree mutation via Svelte proxies triggers re-renders automatically.
3. `PaneTree.svelte` — self-importing recursive component; renders either a flex split container or delegates to `LeafPaneView`.
4. `layoutStore.svelte.ts` — retains theme with `localStorage` persistence.
5. All layout CSS uses existing custom properties (`--bg-*`, `--border`, `--accent`, `--sp-*`).

## Non-Goals (Phase 2)

1. Drag-and-drop reordering of tabs or panes (planned for Phase 3).
2. Layout presets or import/export.
3. Backend protocol changes.
4. Mobile layout.

## Verification

```
bun run check    # 0 errors
bun run build    # clean dist/
docker compose build && docker compose up -d
docker ps        # confirm container running
```

## References

- Dashboard baseline: [docs/dashboard_baseline.md](../docs/dashboard_baseline.md)
- Replatform plan: [docs/frontend_replatform_plan.md](../docs/frontend_replatform_plan.md)
- Docker setup: [docs/docker_setup.md](../docs/docker_setup.md)
