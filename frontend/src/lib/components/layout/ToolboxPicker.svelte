<script lang="ts">
  import type { ToolboxId } from '../../stores/workspaceStore.svelte';

  interface Props {
    onSelect: (id: ToolboxId) => void;
    onClear: () => void;
    onClose: () => void;
  }

  let { onSelect, onClear, onClose }: Props = $props();

  const tools: { id: ToolboxId; emoji: string; label: string }[] = [
    { id: 'play', emoji: '🎮', label: 'Play' },
    { id: 'map', emoji: '🗺️', label: 'Map' },
    { id: 'party', emoji: '👥', label: 'Party' },
    { id: 'items', emoji: '🎒', label: 'Items' },
    { id: 'saves', emoji: '💾', label: 'Saves' },
    { id: 'pokedex', emoji: '📖', label: 'Pokédex' },
    { id: 'logs', emoji: '📋', label: 'Logs' },
    { id: 'battle', emoji: '⚔️', label: 'Battle' },
  ];

  function onBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function onCardKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onclick={onClose}
  onkeydown={onBackdropKeydown}
>
  <div
    class="card"
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onkeydown={onCardKeydown}
  >
    <div class="grid">
      {#each tools as tool (tool.id)}
        <button
          type="button"
          class="tool-btn"
          onclick={() => onSelect(tool.id)}
        >
          <span class="tool-emoji">{tool.emoji}</span>
          <span class="tool-label">{tool.label}</span>
        </button>
      {/each}
    </div>
    <div class="footer">
      <button type="button" class="clear-btn" onclick={onClear}>
        Clear tool
      </button>
      <button type="button" class="cancel-link" onclick={onClose}>
        Cancel
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: var(--sp-8);
    min-width: 240px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--sp-3);
    margin-bottom: var(--sp-6);
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-4) var(--sp-3);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: var(--font-sm);
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }

  .tool-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
    color: var(--text-bright);
  }

  .tool-emoji {
    font-size: 20px;
    line-height: 1;
  }

  .tool-label {
    font-size: var(--font-xs);
    white-space: nowrap;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-8);
  }

  .clear-btn {
    padding: var(--sp-2) var(--sp-6);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
  }

  .clear-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .cancel-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-sm);
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  .cancel-link:hover {
    color: var(--text);
  }
</style>
