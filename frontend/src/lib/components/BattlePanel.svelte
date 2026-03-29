<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';
  import { formatPercent, padDex, capitalize } from '../utils/format';
  import type { PartyMember } from '../types/protocol';

  let combat = $derived(runtimeStore.latestState?.combat ?? null);

  function getCatalogEntry(speciesId: number) {
    return runtimeStore.catalogByInternalId.get(speciesId) ?? null;
  }

  function memberName(m: PartyMember) {
    const e = getCatalogEntry(m.species_id);
    return e ? e.name : `Species ${m.species_id}`;
  }

  function memberDex(m: PartyMember) {
    const e = getCatalogEntry(m.species_id);
    return e ? `Dex ${padDex(e.dex_no)}` : `Species ${m.species_id}`;
  }

  function hp(m: PartyMember) {
    return formatPercent(m.hp, m.max_hp || m.hp || 1);
  }
</script>

<PanelChrome title="Battle">
  {#if !combat || !combat.active}
    <div class="empty-state">
      No active battle. Combat telemetry appears automatically during encounters.
    </div>
  {:else}
    <div class="battle-kind">
      <span class="chip chip-warning">{capitalize(combat.kind)} battle</span>
      <span class="mono text-muted" style="font-size:var(--font-xs)">
        {(combat.enemy_party || []).length} foe{(combat.enemy_party || []).length === 1 ? '' : 's'}
      </span>
    </div>

    <div class="focus-grid">
      {#if combat.player_active}
        {@const m = combat.player_active}
        <article class="card focus-card player-active">
          <div class="card-header">
            <div>
              <div class="badge-row">
                {#if combat.player_active_slot}<span class="chip mono">Party {combat.player_active_slot}</span>{/if}
                <span class="chip chip-success">Active</span>
              </div>
              <div class="card-title">{memberName(m)}</div>
              <div class="card-subtitle">{memberDex(m)} · Lv {m.level}</div>
            </div>
            <span class="mono">{m.hp}/{m.max_hp}</span>
          </div>
          <div class="hp-bar"><div class="hp-fill" class:low={hp(m) < 25} style="width:{hp(m)}%"></div></div>
        </article>
      {/if}

      {#if combat.enemy_active}
        {@const m = combat.enemy_active}
        <article class="card focus-card enemy-active">
          <div class="card-header">
            <div>
              <div class="badge-row">
                <span class="chip chip-warning">{combat.kind === 'trainer' ? 'Enemy' : 'Wild'}</span>
                <span class="chip chip-warning">Active</span>
              </div>
              <div class="card-title">{memberName(m)}</div>
              <div class="card-subtitle">{memberDex(m)} · Lv {m.level}</div>
            </div>
            <span class="mono">{m.hp}/{m.max_hp}</span>
          </div>
          <div class="hp-bar"><div class="hp-fill" class:low={hp(m) < 25} style="width:{hp(m)}%"></div></div>
        </article>
      {/if}
    </div>

    {#if (combat.player_party || []).length > 0}
      <div class="section-label">Your Party</div>
      <div class="party-grid">
        {#each combat.player_party as m (m.slot)}
          {@const isActive = m.slot === combat.player_active_slot}
          <article class="card mini-card" class:active-member={isActive}>
            <div class="badge-row">
              <span class="chip mono">Party {m.slot}</span>
              {#if isActive}<span class="chip chip-success">Active</span>{/if}
              <span class="chip" class:chip-success={m.status === 'Healthy'} class:chip-warning={m.status !== 'Healthy'}>{m.status}</span>
            </div>
            <div class="card-title">{memberName(m)}</div>
            <div class="card-subtitle mono">Lv {m.level} · {m.hp}/{m.max_hp}</div>
            <div class="hp-bar"><div class="hp-fill" class:low={hp(m) < 25} style="width:{hp(m)}%"></div></div>
          </article>
        {/each}
      </div>
    {/if}

    {#if (combat.enemy_party || []).length > 0}
      <div class="section-label">{combat.kind === 'trainer' ? 'Enemy Party' : 'Opponent'}</div>
      <div class="party-grid">
        {#each combat.enemy_party as m, i (i)}
          {@const isActive = m.slot != null && m.slot === combat.enemy_active_slot}
          <article class="card mini-card" class:active-member={isActive}>
            <div class="badge-row">
              {#if m.slot != null}<span class="chip mono">Enemy {m.slot}</span>{/if}
              {#if isActive}<span class="chip chip-warning">Current Enemy</span>{/if}
            </div>
            <div class="card-title">{memberName(m)}</div>
            <div class="card-subtitle mono">Lv {m.level} · {m.hp}/{m.max_hp}</div>
            <div class="hp-bar"><div class="hp-fill" class:low={hp(m) < 25} style="width:{hp(m)}%"></div></div>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</PanelChrome>

<style>
  .battle-kind { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .focus-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .focus-card { border-width: 1px; }
  .player-active { border-color: var(--success); }
  .enemy-active { border-color: var(--warning); }
  .section-label { font-size: var(--font-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: var(--sp-4) 0 var(--sp-2); }
  .party-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--sp-2); margin-bottom: var(--sp-3); }
  .mini-card { padding: var(--sp-3); }
  .mini-card .card-title { font-size: var(--font-sm); margin-top: var(--sp-1); }
  .active-member { border-color: var(--accent); }
</style>
