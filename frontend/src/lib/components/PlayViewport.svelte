<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import ScreenImage from './ScreenImage.svelte';
  import ControlPad from './ControlPad.svelte';
  import QuickSaveButton from './QuickSaveButton.svelte';

  let state = $derived(runtimeStore.latestState);
  let combat = $derived(state?.combat ?? null);
  let mapName = $derived(state?.map_name ?? '—');
  let coords = $derived(state ? `X:${state.x} Y:${state.y}` : '—');
  let leadHp = $derived(state ? `${state.lead_hp}/${state.lead_max_hp}` : '—');
  let party = $derived(state?.party_count ?? 0);
  let pokedex = $derived(state ? `${state.pokedex?.seen_count ?? 0}s/${state.pokedex?.owned_count ?? 0}o` : '—');
</script>

<div class="play-viewport">
  <ScreenImage />

  <div class="status-row mono text-muted">
    <span>{mapName}</span>
    <span>{coords}</span>
    <span>HP:{leadHp}</span>
    <span>Party:{party}</span>
    <span>Dex:{pokedex}</span>
  </div>

  {#if combat?.active}
    <div class="combat-summary">
      <span class="chip chip-warning">⚔ Battle · {combat.kind}</span>
      {#if combat.player_active}
        <span class="mono">vs {combat.enemy_active ? `Lv${combat.enemy_active.level}` : '?'}</span>
      {/if}
    </div>
  {/if}

  <ControlPad />

  <div class="quick-save-row">
    <QuickSaveButton />
  </div>
</div>

<style>
  .play-viewport {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    height: 100%;
    overflow-y: auto;
    background: var(--bg-panel);
    box-sizing: border-box;
  }
  .status-row {
    display: flex;
    gap: var(--sp-4);
    flex-wrap: wrap;
    font-size: var(--font-xs);
    padding: var(--sp-1) 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .combat-summary {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    background: color-mix(in srgb, var(--warning) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
    border-radius: var(--radius);
    font-size: var(--font-sm);
    flex-shrink: 0;
  }
  .quick-save-row {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--sp-2);
    flex-shrink: 0;
  }
</style>
