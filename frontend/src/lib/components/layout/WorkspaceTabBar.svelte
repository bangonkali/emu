<script lang="ts">
  import { workspaceStore } from '../../stores/workspaceStore.svelte';

  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let renameInputEl = $state<HTMLInputElement | undefined>(undefined);

  $effect(() => {
    if (renamingId && renameInputEl) {
      renameInputEl.focus();
    }
  });

  function startRename(id: string, currentLabel: string) {
    renamingId = id;
    renameValue = currentLabel;
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      workspaceStore.renameTab(renamingId, renameValue.trim());
    }
    renamingId = null;
    renameValue = '';
  }

  function cancelRename() {
    renamingId = null;
    renameValue = '';
  }

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }
</script>

<div class="tab-bar">
  {#each workspaceStore.tabs as tab (tab.id)}
    <div class="tab" class:active={workspaceStore.activeTabId === tab.id}>
      {#if renamingId === tab.id}
        <input
          bind:this={renameInputEl}
          class="tab-rename"
          type="text"
          bind:value={renameValue}
          onblur={commitRename}
          onkeydown={onRenameKeydown}
        />
      {:else}
        <button
          type="button"
          class="tab-label"
          onclick={() => workspaceStore.setActiveTab(tab.id)}
          ondblclick={() => startRename(tab.id, tab.label)}
        >
          {tab.label}
        </button>
      {/if}
      <button
        type="button"
        class="tab-close"
        title="Close tab"
        disabled={workspaceStore.tabs.length <= 1}
        onclick={() => workspaceStore.removeTab(tab.id)}
      >
        ×
      </button>
    </div>
  {/each}
  <button
    type="button"
    class="tab-add menu-btn"
    title="New tab"
    onclick={() => workspaceStore.addTab()}
  >
    +
  </button>
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: stretch;
    height: 36px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tab {
    display: flex;
    align-items: center;
    position: relative;
    border-bottom: 2px solid transparent;
    flex-shrink: 0;
  }

  .tab.active {
    border-bottom-color: var(--accent);
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-label {
    padding: 0 var(--sp-4) 0 var(--sp-6);
    height: 100%;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.1s;
  }

  .tab-label:hover {
    color: var(--text);
  }

  .tab.active .tab-label {
    color: var(--text-bright);
  }

  .tab-rename {
    margin: 0 var(--sp-2);
    padding: 2px var(--sp-2);
    background: var(--bg-input);
    border: 1px solid var(--border-focus);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: var(--font-sm);
    outline: none;
    width: 100px;
  }

  .tab-close {
    padding: 0 var(--sp-2);
    height: 100%;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-md);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s, color 0.1s;
    line-height: 1;
    flex-shrink: 0;
  }

  .tab-close:hover:not(:disabled) {
    color: var(--error);
    opacity: 1;
  }

  .tab-close:disabled {
    cursor: not-allowed;
    opacity: 0 !important;
  }

  .tab-add {
    margin: auto var(--sp-2);
    padding: 0 var(--sp-4);
    font-size: var(--font-md);
    flex-shrink: 0;
  }
</style>
