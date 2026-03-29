<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, actions, children }: {
    title: string;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="panel-chrome">
  <div class="panel-head">
    <span class="panel-title">{title}</span>
    {#if actions}
      <div class="panel-actions">{@render actions()}</div>
    {/if}
  </div>
  <div class="panel-body">
    {@render children()}
  </div>
</div>

<style>
  .panel-chrome {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .panel-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
</style>
