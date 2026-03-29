<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';

  function autoScroll(node: HTMLDivElement) {
    $effect(() => {
      const _len = runtimeStore.logs.length;
      node.scrollTop = node.scrollHeight;
    });
  }
</script>

<PanelChrome title="Logs">
  <div class="log-output" {@attach autoScroll}>
    {#if runtimeStore.logs.length === 0}
      <div class="empty-state">No log entries yet.</div>
    {:else}
      {#each runtimeStore.logs as entry, i (i)}
        <div class="log-line mono">[{entry.timestamp}] {entry.message}</div>
      {/each}
    {/if}
  </div>
</PanelChrome>

<style>
  .log-output {
    height: 100%;
    overflow-y: auto;
    font-family: var(--mono);
    font-size: var(--font-xs);
    color: var(--text-muted);
    line-height: 1.6;
    padding-bottom: var(--sp-4);
  }
  .log-line {
    padding: 1px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
    word-break: break-all;
  }
  .log-line:last-child { border-bottom: none; }
</style>
