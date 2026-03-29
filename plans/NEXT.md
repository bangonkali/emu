# NEXT: Frontend Replatform To Svelte + TypeScript

## Current Status

- The current dashboard baseline is shipped and documented in [docs/dashboard_baseline.md](../docs/dashboard_baseline.md).
- The backend runtime and WebSocket protocol are the production baseline for the replatform effort.
- The next initiative is a frontend-only reimplementation and redesign direction, not a backend rewrite.

## Current Initiative

Reimplement the existing dashboard as a Bun + Vite + Svelte + TypeScript application, keeping backend behavior stable while preparing for a dense desktop debugging workbench.

## Stack stance

The workbench target is a **VS Code / Cursor–style pane shell**: resizable splits, tab groups, and many synchronized views driven by WebSocket state. **Svelte 5 + TypeScript remains the right stack** for that UI class: components and shared layout state map naturally onto panes and splitters, dense lists (“Problems”-style rows) stay maintainable with declarative rendering, and fine-grained updates suit live telemetry without hand-rolled DOM batching across every panel. Plain TypeScript and HTML is workable for spikes but scales poorly once rearrangeable layouts, keyboard focus, and repeated list shells land across the full [dashboard baseline](../docs/dashboard_baseline.md). Prefer minimal extra dependencies: theme and density via CSS custom properties, and a small in-house layout primitive layer (split panes, panel chrome) rather than a heavy window-manager library unless we deliberately add one later.

## Goals

1. Replace the current plain frontend with a typed Svelte 5 codebase.
2. Keep the Python backend protocol unchanged for the first migration pass.
3. Use Bun `1.3.11` for frontend package management and local development.
4. Support host-side frontend development without restarting the Dockerized backend.
5. Ensure production Docker images contain only compiled frontend assets.
6. Shift the design direction toward a compact, full-screen, desktop-first debugging workbench with no browser-level page scroll in the primary desktop layout.
7. Evolve the shell toward an IDE-inspired pane layout (VS Code / Cursor): purposeful panels, resizable splits, and dense list views; full rearrangement and layout persistence come after feature parity.

## Design Direction

The primary UX metaphor is a **compact IDE-style workbench** (Cursor / VS Code), not a free-form floating desktop.

Core principles:

1. **Full-viewport shell:** the primary layout fills the viewport with **no document-level scroll**; only individual panels scroll their own content when needed.
2. **Panes, not pages:** each capability is a **panel with one clear job**, aligned with the shipped baseline (play surface, map, party, items, saves, Pokédex, logs, battle, and diagnostics-style lists).
3. **Rearrangeable layout:** **resizable splitters** and, as a phased target, **dragging tabs between groups**—same mental model as editor areas and side bars in VS Code.
4. **Dense list / “Problems” pattern:** secondary data views use a **shared compact list shell** (tight rows, monospace where it helps) with **per-panel column schemas**—for example logs vs. catalog rows vs. structured events or diagnostics.
5. **Optional later:** snap-to-grid toolboxes, multi-cell modules, multiple desktops, or a floating toolbox palette are **out of scope for the primary metaphor**; if we revisit them, they sit **after** a solid split-pane workbench and **saved workspace layout / panel visibility**, not instead of it.

The first implementation pass should still prioritize **feature parity** before the full IDE shell (advanced tab drag, persistence, optional grid extras).

## Panel catalog

Each panel has a defined purpose and chrome (title, optional toolbar/actions, scrollable body). Map 1:1 to baseline behavior in [docs/dashboard_baseline.md](../docs/dashboard_baseline.md):

| Panel | Purpose |
|-------|---------|
| **Play** | Live Game Boy screen, authoritative held input, speed controls, quick save affordances. |
| **Map** | Kanto map with player marker. |
| **Party** | Party detail and live telemetry. |
| **Items** | Bag decoding, slot usage, per-item presentation. |
| **Saves** | Native `.state` explorer, refresh, save/load actions. |
| **Pokédex** | Catalog-driven browser with **search and filters** (existing JSON contract). |
| **Logs** | Runtime log stream in the shared dense list shell. |
| **Battle** | Live battle telemetry (desktop layout; mobile can remain a separate concern). |
| **Diagnostics / Problems-style** | One or more panels reusing the **same list shell** with **custom columns** for structured issues, events, or bot decisions—exact payloads TBD; pattern is fixed early. |

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
6. Introduce the **IDE-style workbench shell**: split panes, panel chrome, tab groups, and the shared dense list primitive for Problems-style views.
7. Add **layout persistence** and phased **tab drag-between-groups**; optional follow-up for grid-based or multi-desktop layouts if still desired.

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
