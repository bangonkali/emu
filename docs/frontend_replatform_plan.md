# Frontend Replatform Plan

## Objective

Replace the current plain HTML, CSS, and JavaScript dashboard with a Vite-powered Svelte + TypeScript frontend while keeping the Python backend contract stable.

This initiative is not only a framework migration. It is also the first pass toward a denser desktop debugging workbench for AI bot development.

## Non-Negotiable Constraints

1. Preserve the existing backend protocol unless a backend change is explicitly justified and separately planned.
2. Use Bun `1.3.11` as the package manager and local frontend runtime.
3. Keep production Docker images limited to compiled frontend assets plus Python runtime code. No Svelte source, TypeScript source, Bun runtime, or node_modules should be needed in the final runtime image.
4. Optimize for desktop first. Mobile refinement is deferred.
5. Build a dense, whole-screen debugging UI where the full page avoids browser-level scrollbars in the normal desktop case.
6. Prefer small runtime memory footprint, direct data flow, and low-overhead rendering.

## Why Svelte

Svelte is the selected direction because it best matches the current dashboard workload:

- Strong TypeScript support without React-style hook overhead.
- Small runtime footprint relative to a component-heavy React app.
- Simple component authoring that remains readable to engineers who are not frontend specialists.
- Fine-grained update behavior that maps well onto live WebSocket telemetry.
- Good ergonomics for compact component composition, local state, and shared stores.

## Technical Direction

### Tooling Stack

- Framework: Svelte 5
- Language: TypeScript
- Build tool: Vite
- Package manager and scripts: Bun
- Linting and type-checking: Bun scripts invoking `tsc`, `vite build`, and optionally `svelte-check`
- Output target: static build artifacts copied into the Python-served web directory or a dedicated compiled-assets directory consumed by the Docker image

### Backend Contract

Backend behavior remains the baseline:

- HTTP serves the dashboard shell and static assets.
- WebSocket remains the transport for live state, logs, inputs, save actions, and future workspace actions.
- Existing message types should be preserved during the first migration pass.

### Development Workflow

The frontend should be independently iterable from the host machine without restarting the backend.

Planned workflow:

1. Run the Python backend exactly as it is now, typically in Docker on port `8765`.
2. Run Bun + Vite on the host machine for frontend development with hot reload.
3. Configure the Vite dev server to proxy runtime requests to the backend:
   - `/ws` -> backend WebSocket endpoint
   - static reference JSON endpoints such as `/map_data.json` and `/pokemon_catalog.json` -> backend
4. Keep frontend source of truth outside the Docker runtime during active development.
5. For production builds, emit compiled assets and copy only the compiled output into the Docker image.

### Production Build Strategy

Planned Docker direction:

1. Use a frontend build stage that runs Bun install and Bun build.
2. Emit a static production bundle.
3. Copy only the compiled bundle into the final Python runtime image.
4. The final image should not contain TypeScript files, `.svelte` files, Bun, or frontend dependency trees.

## Svelte Best Practices To Follow

### Component Architecture

- Prefer many small presentational components over a few sprawling files.
- Keep domain logic out of markup-heavy components.
- Separate protocol/state concerns from rendering concerns.
- Favor explicit props and typed events instead of cross-component mutation.
- Use Svelte stores only for genuinely shared application state.

### State Management

- Keep one typed runtime store for WebSocket-fed emulator state.
- Keep one typed layout/workspace store for desktop layout and snapping behavior.
- Keep ephemeral UI concerns local to components whenever possible.
- Derive filtered or aggregated state using derived stores rather than duplicating data.
- Avoid broad invalidation patterns that force unrelated panels to rerender.

### Performance and Memory Footprint

- Preserve a single WebSocket client shared through a service layer.
- Avoid unnecessary object cloning when state messages arrive.
- Keep image updates isolated to the screen component.
- Keep canvas rendering isolated to the map component.
- Use keyed lists for dynamic panel collections.
- Avoid large retained history in memory beyond the explicit log and save explorer requirements.
- Prefer lazy mounting or conditional rendering for panels not currently visible when practical.
- Keep bundle size small by avoiding heavyweight UI libraries during the first migration.

### Idiomatic Svelte Direction

- Use `.svelte` components with `<script lang="ts">`.
- Use Svelte stores for shared runtime state.
- Favor declarative rendering over imperative DOM mutation.
- Encapsulate DOM interop such as canvas drawing, drag handling, and WebSocket lifecycle in focused components or utilities.
- Use CSS variables and a small design token system instead of bringing in a large styling framework.

## UX and Design Direction

### Primary Use Case

This UI is a debugging workbench for investigating AI bot flows, not a consumer-facing game companion app.

Design goals:

- Information density over visual spaciousness.
- Immediate visibility of runtime state.
- Efficient operator scanning.
- Compact panel chrome.
- Whole-screen usage with minimal dead space.

### Visual Model

The interface should evolve toward a trading-terminal-style desktop workbench:

- Full-screen workspace.
- Dense panels.
- Minimal decorative padding.
- Persistent telemetry visibility.
- Flexible tool placement.

### Desktop Workbench Plan

The redesign plan should support these concepts:

1. Toolboxes as dedicated components rendered into desktop windows or boxes.
2. A desktop workspace that can host multiple toolboxes at once.
3. Drag-and-drop rearrangement of toolboxes.
4. Snap-to-grid behavior for placement.
5. Grid guides that can be shown or hidden.
6. Configurable grid dimensions on the X and Y axes.
7. Toolbox sizing that can span multiple grid cells.
8. Multiple desktops or workspaces that users can switch between.
9. A palette of available toolboxes that can be added to the active desktop.

This should still begin with feature parity before a full window-manager-style redesign. The layout system should be introduced in an incremental way.

## Migration Scope

### Phase 1: Replatform Without Backend Change

Goal: replace the frontend implementation but preserve behavior.

Deliverables:

- Bun + Vite + Svelte + TypeScript workspace.
- Static production build wired into the existing Python server.
- Feature parity for the current desktop dashboard.
- Same WebSocket protocol and same runtime interactions.

Recommended component map:

- `AppShell`
- `TopBar`
- `ConnectionStatus`
- `SpeedControls`
- `PlayViewport`
- `ControlPad`
- `QuickSaveButton`
- `BattlePanel`
- `MapPanel`
- `PartyPanel`
- `ItemsPanel`
- `SavesPanel`
- `PokedexPanel`
- `LogsPanel`
- `ScreenImage`
- `WorldMapCanvas`

Recommended services and stores:

- `runtimeSocket.ts`
- `inputController.ts`
- `runtimeStore.ts`
- `layoutStore.ts`
- `saveExplorerStore.ts`

### Phase 2: Dense Desktop Layout System

Goal: move from fixed tabs to a compact workbench optimized for debugging.

Deliverables:

- Desktop-only workspace shell.
- Grid-based placement engine.
- Toolbox registry.
- Drag, snap, resize, and span behavior.
- Configurable grid density.
- Toggleable grid guides.
- Persisted workspace layout state.

Toolboxes should initially be derived from the existing major surfaces:

- Screen / controls
- Map
- Party
- Combat
- Items
- Saves
- Pokédex
- Logs
- Summary telemetry

### Phase 3: Multi-Desktop Support

Goal: allow different debugging layouts for different workflows.

Deliverables:

- Named desktops / workspaces.
- Switcher UI.
- Persisted per-desktop layouts.
- Default desktop presets for common debugging tasks.

Suggested preset concepts:

- Navigation Debug
- Battle Debug
- Inventory / Save Investigation
- Agent Trace / Logs Heavy

## Implementation Order

1. Scaffold Bun + Vite + Svelte + TypeScript frontend workspace.
2. Define the typed runtime protocol models from the current WebSocket payloads.
3. Build the shared WebSocket service and typed stores.
4. Recreate the current desktop dashboard in Svelte with feature parity.
5. Wire Vite host development against the live Docker backend.
6. Build the production bundle integration into Docker with compiled assets only.
7. Introduce the compact desktop design system tokens and dense panel styling.
8. Replace the fixed desktop arrangement with a grid-aware workspace shell.
9. Add toolbox registry, snapping, and workspace persistence.
10. Add multi-desktop support.

## Verification Plan

### Frontend Tooling Verification

- `bun install`
- `bun run check`
- `bun run build`

### Runtime Verification

- Run Vite dev server on host machine with backend running separately.
- Confirm HMR works without restarting backend.
- Confirm WebSocket proxying works for live state, inputs, saves, and logs.

### Docker Verification

- Build the production image.
- Confirm the final runtime image only serves compiled assets.
- Confirm no `.svelte`, `.ts`, Bun binary, or frontend dependency tree is required in the runtime container.

### Behavior Verification

- Confirm screen updates, controls, speed changes, logs, battle telemetry, items, saves, and Pokédex still work.
- Confirm the dense desktop layout keeps the main desktop view within a full-screen viewport without browser-level page scroll under the standard desktop configuration.

## Deliverable Shape For The First Replatform Commit Series

The first practical implementation wave should likely be split into these checkpoints:

1. Frontend workspace scaffolding and production build integration.
2. Svelte feature-parity dashboard on desktop.
3. Dense desktop design pass and layout-shell groundwork.

## Out of Scope For The First Pass

- Backend protocol redesign.
- Mobile-first redesign.
- Large third-party UI frameworks.
- SSR or route-heavy application structure.
- Advanced backend-driven layout orchestration.

The first pass should prove that the current dashboard can be cleanly reauthored in typed, maintainable Svelte while preparing the ground for a workstation-style debugger UI.