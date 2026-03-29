<script lang="ts">
  import { workspaceStore } from '../stores/workspaceStore.svelte';
  import TopBar from './TopBar.svelte';
  import WorkspaceTabBar from './layout/WorkspaceTabBar.svelte';
  import PaneTree from './layout/PaneTree.svelte';
</script>

<div class="app-shell">
  <TopBar />
  <WorkspaceTabBar />
  <main class="panel-area">
    {#key workspaceStore.activeTabId}
      {#if workspaceStore.activeTab}
        <PaneTree node={workspaceStore.activeTab.layout} />
      {/if}
    {/key}
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
