# NEXT: Frontend Replatform To Svelte + TypeScript

## Current Status

- The current dashboard baseline is shipped and documented in [docs/dashboard_baseline.md](../docs/dashboard_baseline.md).
- The backend runtime and WebSocket protocol are the production baseline for the replatform effort.
- The next initiative is a frontend-only reimplementation and redesign direction, not a backend rewrite.

## Current Initiative

Reimplement the existing dashboard as a Bun + Vite + Svelte + TypeScript application, keeping backend behavior stable while preparing for a dense desktop debugging workbench.

## Goals

1. Replace the current plain frontend with a typed Svelte 5 codebase.
2. Keep the Python backend protocol unchanged for the first migration pass.
3. Use Bun `1.3.11` for frontend package management and local development.
4. Support host-side frontend development without restarting the Dockerized backend.
5. Ensure production Docker images contain only compiled frontend assets.
6. Shift the design direction toward a compact, full-screen, desktop-first debugging workbench with no browser-level page scroll in the primary desktop layout.

## Design Direction

The redesign target is a dense operator UI for AI bot debugging, closer to a trading workstation than a consumer app.

Planned interaction model:

1. Dedicated toolboxes rendered into boxes or windows in a desktop-like workspace.
2. Drag-and-drop layout changes.
3. Snap-to-grid placement.
4. Grid guides that can be toggled on or off.
5. Configurable grid density on both X and Y axes.
6. Toolboxes able to consume multiple grid cells.
7. Multiple desktops / workspaces for different debugging workflows.
8. A toolbox palette for adding modules to the active desktop.

The first implementation pass should still prioritize feature parity before the full workspace/window-manager system lands.

## Svelte Implementation Principles

1. Follow idiomatic Svelte 5 component patterns with `<script lang="ts">`.
2. Keep shared runtime state in typed stores and local UI concerns local to components.
3. Favor declarative rendering over imperative DOM mutation.
4. Keep runtime memory footprint small by isolating high-frequency updates and avoiding unnecessary cloning.
5. Preserve a single shared WebSocket client for runtime interactions.
6. Use minimal dependencies and avoid large UI frameworks in the first pass.

## Execution Plan

The detailed implementation plan lives in [docs/frontend_replatform_plan.md](../docs/frontend_replatform_plan.md).

High-level execution order:

1. Scaffold the Bun + Vite + Svelte + TypeScript workspace.
2. Define typed models for the current backend protocol.
3. Rebuild the current desktop dashboard with Svelte feature parity.
4. Wire host-side Vite development to the live backend through proxying.
5. Integrate a production build flow that copies only compiled assets into Docker.
6. Introduce the dense desktop workbench shell and grid-based toolbox system.
7. Add multiple desktops and layout persistence.

## Explicit Non-Goals For Phase 1

1. Backend protocol redesign.
2. Mobile-first redesign.
3. SSR or route-heavy application structure.
4. Shipping Svelte or TypeScript sources inside the runtime image.

## Verification Expectations

When the replatform begins, the new frontend should be validated with:

1. `bun install`
2. `bun run check`
3. `bun run build`
4. Existing Docker validation for backend stability
5. Live verification against the current WebSocket backend

## References

- Completed dashboard baseline: [docs/dashboard_baseline.md](../docs/dashboard_baseline.md)
- Detailed replatform plan: [docs/frontend_replatform_plan.md](../docs/frontend_replatform_plan.md)
