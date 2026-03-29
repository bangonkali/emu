<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';
  import WorldMapCanvas from './WorldMapCanvas.svelte';

  let mapName = $derived(runtimeStore.latestState?.map_name ?? '—');
  let x = $derived(runtimeStore.latestState?.x ?? 0);
  let y = $derived(runtimeStore.latestState?.y ?? 0);
</script>

<PanelChrome title="World Map">
  <div class="map-info mono text-muted">
    {mapName} · X:{x} Y:{y}
  </div>
  <div class="map-wrap">
    <WorldMapCanvas />
  </div>
</PanelChrome>

<style>
  .map-info {
    font-size: var(--font-xs);
    padding: var(--sp-2) 0 var(--sp-3) 0;
  }
  .map-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
  }
</style>
