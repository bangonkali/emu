<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import { drawWorldMap } from '../utils/map';

  let canvas: HTMLCanvasElement | undefined = $state(undefined);

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = runtimeStore.latestState;
    drawWorldMap(ctx, canvas, runtimeStore.mapData, state?.map_id, state?.x, state?.y);
  });
</script>

<canvas bind:this={canvas} width="436" height="444" class="world-map"></canvas>

<style>
  .world-map {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--radius);
    display: block;
  }
</style>
