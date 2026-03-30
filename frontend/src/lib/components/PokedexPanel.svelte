<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';
  import { padDex } from '../utils/format';

  let searchText = $state('');
  let selectedType = $state('all');
  let selectedStatus = $state('all');

  let pokedex = $derived(runtimeStore.latestState?.pokedex ?? { seen: [], owned: [], seen_count: 0, owned_count: 0 });
  let seen = $derived(new SvelteSet(pokedex.seen));
  let owned = $derived(new SvelteSet(pokedex.owned));

  let allTypes = $derived.by(() => {
    const typeSet = new SvelteSet<string>();
    for (const e of runtimeStore.pokemonCatalog) {
      for (const t of e.types) typeSet.add(t);
    }
    return [...typeSet].sort();
  });

  let filtered = $derived.by(() => {
    const q = searchText.trim().toLowerCase();
    const entries = [...runtimeStore.pokemonCatalog].sort((a, b) => a.dex_no - b.dex_no);
    return entries.filter((e) => {
      const matchSearch = !q
        || e.name.toLowerCase().includes(q)
        || padDex(e.dex_no).includes(q)
        || e.types.some((t) => t.toLowerCase().includes(q));
      const matchType = selectedType === 'all' || e.types.includes(selectedType);
      const isSeen = seen.has(e.dex_no);
      const isOwned = owned.has(e.dex_no);
      const matchStatus =
        selectedStatus === 'all'
        || (selectedStatus === 'owned' && isOwned)
        || (selectedStatus === 'seen' && isSeen)
        || (selectedStatus === 'unseen' && !isSeen)
        || (selectedStatus === 'unowned' && !isOwned);
      return matchSearch && matchType && matchStatus;
    });
  });
</script>

<PanelChrome title="Pokédex">
  <div class="dex-filters">
    <input type="search" placeholder="Search name, #, or type…" bind:value={searchText} />
    <select bind:value={selectedType}>
      <option value="all">All types</option>
      {#each allTypes as type (type)}
        <option value={type}>{type}</option>
      {/each}
    </select>
    <select bind:value={selectedStatus}>
      <option value="all">All</option>
      <option value="owned">Owned</option>
      <option value="seen">Seen</option>
      <option value="unowned">Not owned</option>
      <option value="unseen">Unseen</option>
    </select>
  </div>
  <div class="dex-summary mono text-muted">
    {filtered.length} / {runtimeStore.pokemonCatalog.length} · {seen.size} seen · {owned.size} owned
  </div>
  {#if filtered.length === 0}
    <div class="empty-state">No Pokémon match the current filters.</div>
  {:else}
    {#each filtered as entry (entry.dex_no)}
      {@const isSeen = seen.has(entry.dex_no)}
      {@const isOwned = owned.has(entry.dex_no)}
      <article class="card dex-card">
        <div class="card-header">
          <div>
            <div class="card-title">{entry.name}</div>
            <div class="card-subtitle">Internal {entry.internal_id} · {entry.growth_rate}</div>
          </div>
          <span class="mono text-muted"># {padDex(entry.dex_no)}</span>
        </div>
        <div class="badge-row">
          <div class="type-row" style="margin:0">
            {#each entry.types as type, i (`${entry.dex_no}-${type}-${i}`)}
              <span class="type-chip">{type}</span>
            {/each}
          </div>
          <span class="chip" class:chip-success={isOwned} class:chip-accent={isSeen && !isOwned}>
            {isOwned ? 'Owned' : isSeen ? 'Seen' : 'Unknown'}
          </span>
        </div>
        <div class="dex-stats">
          {#each [['HP', entry.base_stats.hp], ['Atk', entry.base_stats.attack], ['Def', entry.base_stats.defense], ['Spd', entry.base_stats.speed], ['Spc', entry.base_stats.special], ['Catch', entry.catch_rate], ['Base EXP', entry.base_exp]] as [label, val] (label)}
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
  .dex-filters {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
    margin-bottom: var(--sp-3);
  }
  .dex-filters input { flex: 1; min-width: 140px; }
  .dex-filters select { min-width: 100px; }
  .dex-summary { font-size: var(--font-xs); margin-bottom: var(--sp-3); }
  .dex-stats { margin-top: var(--sp-2); }
  .dex-card .badge-row { margin-top: var(--sp-2); }
</style>
