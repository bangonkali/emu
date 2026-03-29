<script lang="ts">
  import type { LeafPaneNode, ToolboxId } from '../../stores/workspaceStore.svelte';
  import { workspaceStore } from '../../stores/workspaceStore.svelte';
  import ToolboxPicker from './ToolboxPicker.svelte';
  import PlayViewport from '../PlayViewport.svelte';
  import MapPanel from '../MapPanel.svelte';
  import PartyPanel from '../PartyPanel.svelte';
  import ItemsPanel from '../ItemsPanel.svelte';
  import SavesPanel from '../SavesPanel.svelte';
  import PokedexPanel from '../PokedexPanel.svelte';
  import LogsPanel from '../LogsPanel.svelte';
  import BattlePanel from '../BattlePanel.svelte';

  interface Props {
    node: LeafPaneNode;
  }

  let { node }: Props = $props();

  let showPicker = $state(false);

  const TOOL_LABELS: Record<ToolboxId, string> = {
    play: 'Play',
    map: 'Map',
    party: 'Party',
    items: 'Items',
    saves: 'Saves',
    pokedex: 'Pokédex',
    logs: 'Logs',
    battle: 'Battle',
  };

  let toolLabel = $derived(node.toolboxId ? TOOL_LABELS[node.toolboxId] : null);

  function handleSelect(id: ToolboxId) {
    workspaceStore.assignToolbox(node.id, id);
    showPicker = false;
  }

  function handleClear() {
    workspaceStore.assignToolbox(node.id, null);
    showPicker = false;
  }

  function handleClose() {
    showPicker = false;
  }
</script>

<div class="leaf-pane">
  <div class="leaf-header">
    <button
      type="button"
      class="tool-name-btn"
      onclick={() => (showPicker = !showPicker)}
    >
      {toolLabel ?? '· Empty ·'}
    </button>
    <div class="header-actions">
      <button
        type="button"
        class="icon-btn"
        title="Split right"
        onclick={() => workspaceStore.splitPane(node.id, 'horizontal')}
      >
        ⊢
      </button>
      <button
        type="button"
        class="icon-btn"
        title="Split down"
        onclick={() => workspaceStore.splitPane(node.id, 'vertical')}
      >
        ⊣
      </button>
      <button
        type="button"
        class="icon-btn close-btn"
        title="Close pane"
        onclick={() => workspaceStore.removePane(node.id)}
      >
        ✕
      </button>
    </div>
  </div>

  <div class="leaf-content">
    {#if showPicker}
      <ToolboxPicker
        onSelect={handleSelect}
        onClear={handleClear}
        onClose={handleClose}
      />
    {:else if node.toolboxId === null}
      <div class="empty-state">
        <span class="empty-text text-muted">No tool assigned</span>
        <button type="button" class="empty-btn" onclick={() => (showPicker = true)}>
          Assign Tool
        </button>
        <button
          type="button"
          class="empty-btn"
          onclick={() => workspaceStore.splitPane(node.id, 'horizontal')}
        >
          Split →
        </button>
        <button
          type="button"
          class="empty-btn"
          onclick={() => workspaceStore.splitPane(node.id, 'vertical')}
        >
          Split ↓
        </button>
      </div>
    {:else if node.toolboxId === 'play'}
      <PlayViewport />
    {:else if node.toolboxId === 'map'}
      <MapPanel />
    {:else if node.toolboxId === 'party'}
      <PartyPanel />
    {:else if node.toolboxId === 'items'}
      <ItemsPanel />
    {:else if node.toolboxId === 'saves'}
      <SavesPanel />
    {:else if node.toolboxId === 'pokedex'}
      <PokedexPanel />
    {:else if node.toolboxId === 'logs'}
      <LogsPanel />
    {:else if node.toolboxId === 'battle'}
      <BattlePanel />
    {/if}
  </div>
</div>

<style>
  .leaf-pane {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .leaf-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--panel-head-h);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 0 var(--sp-2);
    gap: var(--sp-2);
  }

  .tool-name-btn {
    padding: 0 var(--sp-4);
    height: 100%;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    transition: color 0.1s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tool-name-btn:hover {
    color: var(--text-accent);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin-left: auto;
  }

  .icon-btn {
    padding: 0 var(--sp-2);
    height: 20px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background 0.1s, color 0.1s;
    line-height: 1;
    display: flex;
    align-items: center;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .close-btn:hover {
    color: var(--error);
  }

  .leaf-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-4);
    height: 100%;
    width: 100%;
  }

  .empty-text {
    font-size: var(--font-sm);
  }

  .empty-btn {
    padding: var(--sp-2) var(--sp-6);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    min-width: 100px;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .empty-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
    border-color: var(--accent);
  }
</style>
