<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';
  import type { PartyMember } from '../types/protocol';
  import { formatNumber, formatPercent, padDex } from '../utils/format';

  let party = $derived(runtimeStore.latestState?.party ?? []);

  function getCatalogEntry(speciesId: number) {
    return runtimeStore.catalogByInternalId.get(speciesId) ?? null;
  }

  function hpPercent(m: PartyMember) {
    return formatPercent(m.hp, m.max_hp || m.hp || 1);
  }
</script>

<PanelChrome title="Party">
  <div class="summary text-muted mono">
    {party.length} active slot{party.length === 1 ? '' : 's'}
  </div>
  {#if party.length === 0}
    <div class="empty-state">No party data available yet.</div>
  {:else}
    {#each party as member (member.slot)}
      {@const entry = getCatalogEntry(member.species_id)}
      {@const pct = hpPercent(member)}
      <article class="card">
        <div class="card-header">
          <div>
            <div class="badge-row">
              <span class="chip mono">Slot {member.slot}</span>
              <span class="chip" class:chip-success={member.status === 'Healthy'} class:chip-warning={member.status !== 'Healthy'}>
                {member.status}
              </span>
            </div>
            <div class="card-title">{entry ? entry.name : `Species ${member.species_id}`}</div>
            <div class="card-subtitle">{entry ? `Dex ${padDex(entry.dex_no)}` : `Species ${member.species_id}`} · Lv {member.level}</div>
          </div>
          <span class="mono text-muted" style="font-size:var(--font-sm)">{formatNumber(member.experience)} XP</span>
        </div>
        {#if entry}
          <div class="type-row">
            {#each entry.types as type (type)}
              <span class="type-chip">{type}</span>
            {/each}
          </div>
        {/if}
        <div class="hp-bar">
          <div class="hp-fill" class:low={pct < 25} style="width:{pct}%"></div>
        </div>
        <div class="stats">
          {#each [['HP', `${member.hp} / ${member.max_hp}`], ['Atk', member.attack], ['Def', member.defense], ['Spd', member.speed], ['Spc', member.special]] as [label, val] (label)}
            <div class="stat-row">
              <span class="stat-label">{label}</span>
              <span class="stat-value mono">{val}</span>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  {/if}
</PanelChrome>

<style>
  .summary { font-size: var(--font-xs); margin-bottom: var(--sp-3); }
  .stats { margin-top: var(--sp-2); }
</style>
