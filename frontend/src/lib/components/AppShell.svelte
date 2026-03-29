<script lang="ts">
  import { layoutStore } from '../stores/layoutStore.svelte';
  import TopBar from './TopBar.svelte';
  import PlayViewport from './PlayViewport.svelte';
  import PartyPanel from './PartyPanel.svelte';
  import ItemsPanel from './ItemsPanel.svelte';
  import SavesPanel from './SavesPanel.svelte';
  import PokedexPanel from './PokedexPanel.svelte';
  import LogsPanel from './LogsPanel.svelte';
</script>

<div class="app-shell">
  <TopBar />
  <main class="panel-area">
    {#if layoutStore.activeTab === 'play'}
      <PlayViewport />
    {:else if layoutStore.activeTab === 'party'}
      <PartyPanel />
    {:else if layoutStore.activeTab === 'items'}
      <ItemsPanel />
    {:else if layoutStore.activeTab === 'saves'}
      <SavesPanel />
    {:else if layoutStore.activeTab === 'pokedex'}
      <PokedexPanel />
    {:else if layoutStore.activeTab === 'logs'}
      <LogsPanel />
    {/if}
  </main>
</div>

<style>
  .app-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-main);
  }
  .panel-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg-panel);
  }
</style>
