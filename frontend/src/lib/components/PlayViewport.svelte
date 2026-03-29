<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import ScreenImage from './ScreenImage.svelte';
  import ControlPad from './ControlPad.svelte';
  import QuickSaveButton from './QuickSaveButton.svelte';
  import WorldMapCanvas from './WorldMapCanvas.svelte';

  let state = $derived(runtimeStore.latestState);
  let combat = $derived(state?.combat ?? null);
  let mapName = $derived(state?.map_name ?? '—');
  let coords = $derived(state ? `X:${state.x} Y:${state.y}` : '—');
  let leadHp = $derived(state ? `${state.lead_hp}/${state.lead_max_hp}` : '—');
  let party = $derived(state?.party_count ?? 0);
  let pokedex = $derived(state ? `${state.pokedex?.seen_count ?? 0}s/${state.pokedex?.owned_count ?? 0}o` : '—');
</script>

<div class="play-viewport">
  <div class="play-left">
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

  <div class="play-right">
    <div class="map-label panel-head">
      <span class="panel-title">Kanto Map</span>
      <span class="mono text-muted" style="font-size:var(--font-xs)">{mapName}</span>
    </div>
    <div class="map-canvas-wrap">
      <WorldMapCanvas />
    </div>
  </div>
</div>

<style>
  .play-viewport {
    display: grid;
    grid-template-columns: minmax(280px, 380px) 1fr;
    height: 100%;
    overflow: hidden;
    gap: 0;
  }
  .play-left {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4);
    overflow-y: auto;
    border-right: 1px solid var(--border);
    background: var(--bg-panel);
  }
  .status-row {
    display: flex;
    gap: var(--sp-4);
    flex-wrap: wrap;
    font-size: var(--font-xs);
    padding: var(--sp-1) 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
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
  }
  .quick-save-row {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--sp-2);
  }
  .play-right {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-main);
  }
  .map-canvas-wrap {
    flex: 1;
    min-height: 0;
    padding: var(--sp-4);
    display: flex;
  }
</style>
