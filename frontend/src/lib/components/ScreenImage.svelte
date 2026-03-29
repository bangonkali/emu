<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';

  let src = $derived(runtimeStore.latestState?.screen ?? '');
</script>

<div class="screen-wrap">
  {#if src}
    <img class="screen-img" {src} alt="Game Boy screen" />
  {:else}
    <div class="screen-placeholder">
      <span>Waiting for stream...</span>
    </div>
  {/if}
</div>

<style>
  .screen-wrap {
    width: 100%;
    aspect-ratio: 160 / 144;
    background: #000;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .screen-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;
    display: block;
  }
  .screen-placeholder {
    color: var(--text-muted);
    font-size: var(--font-sm);
    font-style: italic;
  }
</style>
