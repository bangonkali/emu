<script lang="ts">
  import { saveExplorerStore } from '../stores/saveExplorerStore.svelte';
  import { runtimeSocket } from '../services/runtimeSocket';
  import PanelChrome from './PanelChrome.svelte';
  import { formatTimestamp, formatBytes } from '../utils/format';
  import type { SaveState } from '../types/protocol';

  let saveName = $state('');

  function quickSave() {
    saveExplorerStore.setStatus('Saving quick snapshot...', 'neutral');
    runtimeSocket.send({ type: 'save_state_create', name: null });
  }

  function namedSave() {
    const response = window.prompt('Name this save. Leave blank for timestamp-only filename.', saveName);
    if (response === null) {
      saveExplorerStore.setStatus('Named save canceled.', 'neutral');
      return;
    }
    saveName = response.trim();
    saveExplorerStore.setStatus('Saving named snapshot...', 'neutral');
    runtimeSocket.send({ type: 'save_state_create', name: saveName || null });
  }

  function refresh() {
    saveExplorerStore.setStatus('Refreshing save explorer...', 'neutral');
    saveExplorerStore.setPendingReason('refresh');
    runtimeSocket.send({ type: 'save_state_list' });
  }

  function loadSave(save: SaveState) {
    saveExplorerStore.setStatus(`Loading ${save.filename}...`, 'neutral');
    runtimeSocket.send({ type: 'save_state_load', filename: save.filename });
  }

  let statusClass = $derived(
    saveExplorerStore.statusTone === 'success' ? 'text-success'
    : saveExplorerStore.statusTone === 'error' ? 'text-error'
    : 'text-muted'
  );
</script>

<PanelChrome title="Saves">
  <div class="save-controls">
    <button class="menu-btn accent" onclick={quickSave}>Quick Save</button>
    <button class="menu-btn" onclick={namedSave}>Named Save…</button>
    <button class="menu-btn" onclick={refresh}>Refresh</button>
  </div>
  <div class="save-status mono {statusClass}">{saveExplorerStore.status}</div>
  <div class="summary text-muted mono">
    {saveExplorerStore.saves.length} snapshot{saveExplorerStore.saves.length === 1 ? '' : 's'}
  </div>
  {#if saveExplorerStore.saves.length === 0}
    <div class="empty-state">No native emulator snapshots have been created yet.</div>
  {:else}
    {#each saveExplorerStore.saves as save (save.filename)}
      <article class="card" class:active-save={save.active}>
        <div class="card-header">
          <div>
            <div class="badge-row">
              <span class="chip mono">{save.active ? 'Current' : 'Snapshot'}</span>
              {#if save.label}
                <span class="chip chip-success">Named</span>
              {:else}
                <span class="chip">Auto</span>
              {/if}
            </div>
            <div class="card-title">{save.display_name || save.filename}</div>
            <div class="card-subtitle">{save.filename}</div>
          </div>
          <span class="mono text-muted" style="font-size:var(--font-sm)">{formatBytes(save.size_bytes)}</span>
        </div>
        <div class="save-meta">
          <div class="stat-row"><span class="stat-label">Created</span><span class="stat-value mono">{formatTimestamp(save.created_at)}</span></div>
          <div class="stat-row"><span class="stat-label">Game</span><span class="stat-value mono">{save.game_name || 'unknown'}</span></div>
          <div class="stat-row"><span class="stat-label">Status</span><span class="stat-value mono">{save.active ? 'Loaded' : 'Available'}</span></div>
        </div>
        <div class="save-actions">
          <button class="menu-btn" onclick={() => loadSave(save)}>
            {save.active ? 'Reload Snapshot' : 'Load Snapshot'}
          </button>
        </div>
      </article>
    {/each}
  {/if}
</PanelChrome>

<style>
  .save-controls { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-3); }
  .save-status { font-size: var(--font-xs); margin-bottom: var(--sp-2); }
  .summary { font-size: var(--font-xs); margin-bottom: var(--sp-3); }
  .active-save { border-color: var(--accent); }
  .save-meta { margin-top: var(--sp-2); }
  .save-actions { margin-top: var(--sp-3); }
</style>
