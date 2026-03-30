<script lang="ts">
  import type { MapRegion } from '../types/catalog';
  import { drawWorldMap } from '../utils/map';

  const props = $props<{
    mapData: Record<number, MapRegion>;
    activeMapId?: number | null;
    playerX?: number | null;
    playerY?: number | null;
  }>();

  let canvas: HTMLCanvasElement | undefined = $state(undefined);

  $effect(() => {
    const mapData = props.mapData ?? {};
    const activeMapId = props.activeMapId ?? null;
    const playerX = props.playerX ?? null;
    const playerY = props.playerY ?? null;

    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWorldMap(ctx, canvas, mapData, activeMapId, playerX, playerY);
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
