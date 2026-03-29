<script lang="ts">
  import type { PaneNode, SplitPaneNode } from '../../stores/workspaceStore.svelte';
  import { workspaceStore } from '../../stores/workspaceStore.svelte';
  import PaneTree from './PaneTree.svelte';
  import LeafPaneView from './LeafPaneView.svelte';

  interface Props {
    node: PaneNode;
  }

  let { node }: Props = $props();

  let containerEl = $state<HTMLDivElement | undefined>(undefined);
  let draggingIndex = $state<number | null>(null);

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function onMove(e: PointerEvent, index: number) {
    if (node.type !== 'split' || !containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const isHorizontal = node.direction === 'horizontal';
    const totalPx = isHorizontal ? rect.width : rect.height;
    const containerStart = isHorizontal ? rect.left : rect.top;
    const clientPos = isHorizontal ? e.clientX : e.clientY;

    const posPct = ((clientPos - containerStart) / totalPx) * 100;
    const prevSumPct = node.sizes.slice(0, index).reduce((a, b) => a + b, 0);
    const sumAvailPct = node.sizes[index] + node.sizes[index + 1];
    const minPx = isHorizontal ? 80 : 60;
    const minPct = Math.max(2, (minPx / totalPx) * 100);

    const newI = clamp(posPct - prevSumPct, minPct, sumAvailPct - minPct);
    const newI1 = sumAvailPct - newI;

    const newSizes = [...node.sizes];
    newSizes[index] = newI;
    newSizes[index + 1] = newI1;

    workspaceStore.updateSizes(node.id, newSizes);
  }

  function startDrag(e: PointerEvent, index: number) {
    if (node.type !== 'split') return;
    e.preventDefault();
    draggingIndex = index;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = node.direction === 'horizontal' ? 'col-resize' : 'row-resize';

    function handleMove(ev: PointerEvent) {
      onMove(ev, index);
    }

    function handleUp() {
      draggingIndex = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      workspaceStore.saveSizes();
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    }

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }

  function onDividerKeydown(e: KeyboardEvent, index: number) {
    if (node.type !== 'split') return;
    const isHorizontal = node.direction === 'horizontal';
    let delta = 0;

    if (isHorizontal && e.key === 'ArrowRight') delta = 2;
    else if (isHorizontal && e.key === 'ArrowLeft') delta = -2;
    else if (!isHorizontal && e.key === 'ArrowDown') delta = 2;
    else if (!isHorizontal && e.key === 'ArrowUp') delta = -2;
    else return;

    e.preventDefault();
    const sumAvailPct = node.sizes[index] + node.sizes[index + 1];
    const newI = clamp(node.sizes[index] + delta, 2, sumAvailPct - 2);
    const newI1 = sumAvailPct - newI;
    const newSizes = [...node.sizes];
    newSizes[index] = newI;
    newSizes[index + 1] = newI1;
    workspaceStore.updateSizes(node.id, newSizes);
    workspaceStore.saveSizes();
  }
</script>

{#if node.type === 'split'}
  {@const splitNode = node as SplitPaneNode}
  <div
    bind:this={containerEl}
    class="split-container"
    class:split-h={splitNode.direction === 'horizontal'}
    class:split-v={splitNode.direction === 'vertical'}
  >
    {#each splitNode.children as child, i (child.id)}
      <div
        class="pane-slot"
        style:flex-grow={splitNode.sizes[i]}
        style:flex-shrink="0"
        style:flex-basis="0"
        style:min-width={splitNode.direction === 'horizontal' ? '80px' : undefined}
        style:min-height={splitNode.direction === 'vertical' ? '60px' : undefined}
        style:overflow="hidden"
      >
        <PaneTree node={child} />
      </div>
      {#if i < splitNode.children.length - 1}
        <button
          type="button"
          class="divider"
          class:divider-h={splitNode.direction === 'horizontal'}
          class:divider-v={splitNode.direction === 'vertical'}
          class:active={draggingIndex === i}
          aria-label={splitNode.direction === 'horizontal' ? 'Resize panes horizontally' : 'Resize panes vertically'}
          onpointerdown={(e) => startDrag(e, i)}
          onkeydown={(e) => onDividerKeydown(e, i)}
        ></button>
      {/if}
    {/each}
  </div>
{:else}
  <LeafPaneView node={node} />
{/if}

<style>
  .split-container {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .split-h {
    flex-direction: row;
  }

  .split-v {
    flex-direction: column;
  }

  .pane-slot {
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .divider {
    background: var(--border);
    flex-shrink: 0;
    transition: background 0.1s;
    border: none;
    padding: 0;
    margin: 0;
    outline: none;
    border-radius: 0;
  }

  .divider:hover,
  .divider.active {
    background: var(--accent);
  }

  .divider-h {
    flex: 0 0 4px;
    cursor: col-resize;
    width: 4px;
  }

  .divider-v {
    flex: 0 0 4px;
    cursor: row-resize;
    height: 4px;
  }
</style>
