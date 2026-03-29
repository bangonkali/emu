<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import { runtimeSocket } from '../services/runtimeSocket';

  const SPEEDS = ['1x', '2x', '4x', '8x', 'max'] as const;

  function setSpeed(speed: string) {
    runtimeSocket.send({ type: 'set_speed', speed });
  }

  let activeSpeed = $derived(runtimeStore.latestState?.speed ?? '1x');
</script>

<div class="speed-controls">
  {#each SPEEDS as speed (speed)}
    <button
      class="speed-btn"
      class:active={activeSpeed === speed}
      onclick={() => setSpeed(speed)}
    >
      {speed}
    </button>
  {/each}
</div>

<style>
  .speed-controls {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }
  .speed-btn {
    padding: var(--sp-1) var(--sp-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-active);
    color: var(--text-muted);
    font-size: var(--font-sm);
    font-family: var(--mono);
    transition: background 0.1s, color 0.1s;
  }
  .speed-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .speed-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
