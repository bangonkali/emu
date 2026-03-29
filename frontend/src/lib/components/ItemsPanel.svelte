<script lang="ts">
  import { runtimeStore } from '../stores/runtimeStore.svelte';
  import PanelChrome from './PanelChrome.svelte';
  import { getItemName, getItemCategory } from '../data/items';
  import type { InventoryItem } from '../types/protocol';

  let inventory = $derived(runtimeStore.latestState?.inventory ?? null);
  let items = $derived(inventory?.items ?? []);
  let usedSlots = $derived(inventory?.count ?? 0);
  let capacity = $derived(inventory?.capacity ?? 20);
  let freeSlots = $derived(Math.max(capacity - usedSlots, 0));
  let totalQty = $derived(inventory?.total_quantity ?? 0);

  function hexId(item: InventoryItem) {
    return `0x${item.item_id.toString(16).toUpperCase().padStart(2, '0')}`;
  }
</script>

<PanelChrome title="Items">
  <div class="inv-summary">
    <div class="stat-row"><span class="stat-label">Slots used</span><span class="stat-value mono">{usedSlots} / {capacity}</span></div>
    <div class="stat-row"><span class="stat-label">Free slots</span><span class="stat-value mono">{freeSlots}</span></div>
    <div class="stat-row"><span class="stat-label">Total qty</span><span class="stat-value mono">{totalQty}</span></div>
  </div>
  {#if items.length === 0}
    <div class="empty-state">No bag items available yet.</div>
  {:else}
    {#each items as item (item.slot)}
      <article class="card">
        <div class="card-header">
          <div>
            <div class="badge-row">
              <span class="chip mono">Bag {item.slot}</span>
              <span class="chip chip-success">x{item.quantity}</span>
            </div>
            <div class="card-title">{getItemName(item.item_id)}</div>
            <div class="card-subtitle">{getItemCategory(item.item_id)}</div>
          </div>
          <span class="mono text-muted">{hexId(item)}</span>
        </div>
        <div class="stats">
          <div class="stat-row"><span class="stat-label">Quantity</span><span class="stat-value mono">{item.quantity}</span></div>
          <div class="stat-row"><span class="stat-label">Slot</span><span class="stat-value mono">{item.slot}</span></div>
          <div class="stat-row"><span class="stat-label">Item ID</span><span class="stat-value mono">{hexId(item)}</span></div>
        </div>
      </article>
    {/each}
  {/if}
</PanelChrome>

<style>
  .inv-summary { margin-bottom: var(--sp-4); }
  .stats { margin-top: var(--sp-2); }
</style>
