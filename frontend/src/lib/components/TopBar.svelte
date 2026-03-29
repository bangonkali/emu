<script lang="ts">
  import { layoutStore } from '../stores/layoutStore.svelte';
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import ConnectionStatus from './ConnectionStatus.svelte';
  import SpeedControls from './SpeedControls.svelte';
  import type { TabId } from '../stores/layoutStore.svelte';

  const TABS: { id: TabId; label: string }[] = [
    { id: 'play', label: 'Play' },
    { id: 'party', label: 'Party' },
    { id: 'items', label: 'Items' },
    { id: 'saves', label: 'Saves' },
    { id: 'pokedex', label: 'Pokédex' },
    { id: 'logs', label: 'Logs' },
  ];

  let frame = $derived(runtimeStore.latestState?.frame ?? 0);
  let botState = $derived(runtimeStore.latestState?.state ?? '—');
  let money = $derived(runtimeStore.latestState?.money ?? 0);
  let badges = $derived(runtimeStore.latestState?.badges ?? 0);
</script>

<header class="topbar">
  <div class="topbar-left">
    <span class="app-name">Poke Workbench</span>
    <ConnectionStatus />
    <SpeedControls />
    <span class="mono text-muted info-pill">Frame {frame}</span>
    <span class="mono text-muted info-pill">{botState}</span>
    <span class="mono text-muted info-pill">₽{money.toLocaleString()}</span>
    <span class="mono text-muted info-pill">{badges} badges</span>
  </div>
  <div class="topbar-right">
    <button class="theme-btn menu-btn" onclick={() => layoutStore.toggleTheme()}>
      {layoutStore.theme === 'dark' ? '☀ Light' : '🌙 Dark'}
    </button>
  </div>
</header>

<nav class="tabbar">
  {#each TABS as tab (tab.id)}
    <button
      class="tab-btn"
      class:active={layoutStore.activeTab === tab.id}
      onclick={() => layoutStore.setTab(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--topbar-h);
    padding: 0 var(--sp-4);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    gap: var(--sp-4);
    flex-shrink: 0;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    flex: 1;
    overflow: hidden;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-shrink: 0;
  }
  .app-name {
    font-weight: 700;
    font-size: var(--font-md);
    color: var(--text-bright);
    white-space: nowrap;
  }
  .info-pill {
    font-size: var(--font-xs);
    white-space: nowrap;
  }
  .theme-btn {
    font-size: var(--font-sm);
    white-space: nowrap;
  }
  .tabbar {
    display: flex;
    align-items: stretch;
    height: var(--tabbar-h);
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 0 var(--sp-2);
    gap: var(--sp-1);
  }
  .tab-btn {
    padding: 0 var(--sp-6);
    font-size: var(--font-sm);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    transition: color 0.1s, border-color 0.1s;
  }
  .tab-btn:hover {
    color: var(--text);
  }
  .tab-btn.active {
    color: var(--text-bright);
    border-bottom-color: var(--accent);
  }
</style>
