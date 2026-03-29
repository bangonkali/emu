import type { ClientMessage } from '../types/protocol';

const VALID_BUTTONS = new Set(['a', 'b', 'start', 'select', 'up', 'down', 'left', 'right']);

export class InputController {
  private _buttons = $state(new Set<string>());
  private _sequence = 0;
  private sendFn: (msg: ClientMessage) => void;

  constructor(sendFn: (msg: ClientMessage) => void) {
    this.sendFn = sendFn;
  }

  get snapshot(): string[] {
    return [...this._buttons].sort();
  }

  get activeButtons(): ReadonlySet<string> {
    return this._buttons;
  }

  press(button: string): void {
    if (!VALID_BUTTONS.has(button) || this._buttons.has(button)) return;
    this._buttons.add(button);
    this._sequence++;
    this.sendFn({ type: 'input_event', button, pressed: true, sequence: this._sequence });
  }

  release(button: string): void {
    if (!this._buttons.has(button)) return;
    this._buttons.delete(button);
    this._sequence++;
    this.sendFn({ type: 'input_event', button, pressed: false, sequence: this._sequence });
  }

  clear(): void {
    if (this._buttons.size === 0) return;
    this._buttons.clear();
    this._sequence++;
    this.sendFn({ type: 'input_snapshot', buttons: [], sequence: this._sequence });
  }

  sync(): void {
    this._sequence++;
    this.sendFn({ type: 'input_snapshot', buttons: this.snapshot, sequence: this._sequence });
  }

  resetLocalState(): void {
    this._buttons.clear();
  }
}
