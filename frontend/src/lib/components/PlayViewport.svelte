<script lang="ts">
  import { audioService } from '../services/audioService';
  import { audioStore } from '../stores/audioStore.svelte';
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
  let audioStatus = $derived.by(() => {
    if (!audioStore.supported) {
      return audioStore.blockedReason ?? 'Audio unsupported';
    }
    if (!audioStore.available) {
      return audioStore.blockedReason ?? 'Waiting for runtime audio';
    }
    if (!audioStore.enabled) {
      return 'Audio off';
    }
    if (audioStore.blockedReason) {
      return audioStore.blockedReason;
    }
    if (audioStore.ready && !audioStore.muted) {
      return `Live audio ${audioStore.sampleRate} Hz`;
    }
    return 'Starting audio...';
  });

  async function toggleAudio(): Promise<void> {
    await audioService.toggle();
  }

  function updateVolume(event: Event): void {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    audioService.setVolume(value);
  }
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

  <div class="audio-row">
    <button class="menu-btn audio-btn" onclick={toggleAudio} disabled={!audioStore.supported || !audioStore.available}>
      {audioStore.enabled ? 'Disable Audio' : 'Enable Audio'}
    </button>

    <label class="audio-volume mono">
      <span>Vol</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={audioStore.volume}
        onchange={updateVolume}
        disabled={!audioStore.supported || !audioStore.available}
      />
    </label>

    <span class="chip" class:chip-success={audioStore.ready && !audioStore.muted && !audioStore.blockedReason} class:chip-warning={Boolean(audioStore.blockedReason)}>
      {audioStatus}
    </span>
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
  .audio-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
    flex-shrink: 0;
  }
  .audio-btn[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .audio-volume {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--font-xs);
    color: var(--text-muted);
  }
  .audio-volume input {
    width: 120px;
  }
  .quick-save-row {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--sp-2);
    flex-shrink: 0;
  }
</style>
