<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
</script>

<span class="conn-status" class:online={runtimeStore.connected} class:offline={!runtimeStore.connected}>
  <span class="dot"></span>
  {runtimeStore.connected ? 'Connected' : 'Disconnected'}
</span>

<style>
  .conn-status {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--mono);
    font-size: var(--font-sm);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  .online .dot { background: var(--success); }
  .offline .dot { background: var(--error); }
  .online { color: var(--success); }
  .offline { color: var(--error); }
</style>
