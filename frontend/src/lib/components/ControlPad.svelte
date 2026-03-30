<script lang="ts">
  import { onMount } from 'svelte';
  import { inputController } from '../services/init';

  const KEY_MAP: Record<string, string> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    x: 'a', X: 'a', y: 'b', Y: 'b', Enter: 'start', Shift: 'select',
  };

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const editableParent = target.closest('input, textarea, select, [contenteditable="true"]');
    return editableParent instanceof HTMLElement;
  }

  function resolveGameButton(e: KeyboardEvent): string | null {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return null;
    }

    if (isEditableTarget(e.target)) {
      return null;
    }

    return KEY_MAP[e.key] ?? null;
  }

  function blurNonEditableActiveElement(): void {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (activeElement === document.body || isEditableTarget(activeElement)) {
      return;
    }

    activeElement.blur();
  }

  function onKeyDown(e: KeyboardEvent) {
    const btn = resolveGameButton(e);
    if (!btn || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    blurNonEditableActiveElement();
    inputController.press(btn);
  }

  function onKeyUp(e: KeyboardEvent) {
    const btn = resolveGameButton(e);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    inputController.release(btn);
  }

  function makeHoldHandlers(btn: string) {
    return {
      onpointerdown(e: PointerEvent) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        inputController.press(btn);
      },
      onpointerup(_e: PointerEvent) { inputController.release(btn); },
      onpointercancel(_e: PointerEvent) { inputController.release(btn); },
      onlostpointercapture(_e: PointerEvent) { inputController.release(btn); },
      onpointerleave(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.buttons === 0) inputController.release(btn);
      },
    };
  }

  function isHeld(btn: string) { return inputController.activeButtons.has(btn); }

  onMount(() => {
    const options: AddEventListenerOptions = { capture: true };
    window.addEventListener('keydown', onKeyDown, options);
    window.addEventListener('keyup', onKeyUp, options);

    return () => {
      window.removeEventListener('keydown', onKeyDown, options);
      window.removeEventListener('keyup', onKeyUp, options);
    };
  });
</script>

<svelte:window onblur={() => inputController.clear()} />
<svelte:document onvisibilitychange={() => { if (document.hidden) inputController.clear(); }} />

<div class="control-pad">
  <div class="dpad">
    <div class="dpad-row">
      <button class="dpad-btn up" class:held={isHeld('up')} {...makeHoldHandlers('up')}>▲</button>
    </div>
    <div class="dpad-row mid">
      <button class="dpad-btn left" class:held={isHeld('left')} {...makeHoldHandlers('left')}>◀</button>
      <div class="dpad-center"></div>
      <button class="dpad-btn right" class:held={isHeld('right')} {...makeHoldHandlers('right')}>▶</button>
    </div>
    <div class="dpad-row">
      <button class="dpad-btn down" class:held={isHeld('down')} {...makeHoldHandlers('down')}>▼</button>
    </div>
  </div>

  <div class="action-group">
    <div class="ab-row">
      <button class="action-btn b-btn" class:held={isHeld('b')} {...makeHoldHandlers('b')}>B</button>
      <button class="action-btn a-btn" class:held={isHeld('a')} {...makeHoldHandlers('a')}>A</button>
    </div>
    <div class="sys-row">
      <button class="sys-btn" class:held={isHeld('select')} {...makeHoldHandlers('select')}>Select</button>
      <button class="sys-btn" class:held={isHeld('start')} {...makeHoldHandlers('start')}>Start</button>
    </div>
  </div>
</div>

<div class="inputs-display mono text-muted">
  Held: {[...inputController.activeButtons].sort().join(', ') || 'none'}
</div>

<style>
  .control-pad {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-8);
    padding: var(--sp-4) var(--sp-6);
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    user-select: none;
    touch-action: none;
  }
  .dpad { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .dpad-row { display: flex; justify-content: center; gap: 2px; }
  .dpad-row.mid { align-items: center; }
  .dpad-btn {
    width: 36px; height: 36px;
    background: var(--bg-active);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.05s;
  }
  .dpad-center { width: 36px; height: 36px; }
  .dpad-btn.held {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .action-group { display: flex; flex-direction: column; gap: var(--sp-3); }
  .ab-row { display: flex; gap: var(--sp-3); align-items: center; }
  .action-btn {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: var(--bg-active);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: var(--font-sm);
    font-weight: 600;
    transition: background 0.05s, box-shadow 0.05s;
  }
  .action-btn.held {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .sys-row { display: flex; gap: var(--sp-2); justify-content: center; }
  .sys-btn {
    padding: var(--sp-1) var(--sp-4);
    background: var(--bg-active);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-muted);
    font-size: var(--font-xs);
    transition: background 0.05s, box-shadow 0.05s;
  }
  .sys-btn.held {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .inputs-display {
    font-size: var(--font-xs);
    margin-top: var(--sp-2);
    padding: 0 var(--sp-2);
  }
</style>
