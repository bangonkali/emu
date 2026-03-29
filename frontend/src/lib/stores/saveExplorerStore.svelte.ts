import type { SaveState } from '../types/protocol';

export type StatusTone = 'neutral' | 'success' | 'error';

class SaveExplorerStore {
  saves = $state.raw<SaveState[]>([]);
  status = $state('Ready. Saving uses PyBoy native state snapshots with .state files.');
  statusTone = $state<StatusTone>('neutral');
  pendingReason = $state<string | null>(null);

  handleListReceived(saves: SaveState[]): void {
    this.saves = saves ?? [];
    if (this.pendingReason === 'refresh') {
      this.setStatus(`Loaded ${this.saves.length} snapshot${this.saves.length === 1 ? '' : 's'}.`, 'success');
    } else if (this.pendingReason === 'connect') {
      this.setStatus(
        `Connected to save explorer. ${this.saves.length} snapshot${this.saves.length === 1 ? '' : 's'} available.`,
        'neutral',
      );
    }
    this.pendingReason = null;
  }

  handleSaved(save: SaveState): void {
    this.setStatus(`Saved ${save.filename || 'snapshot'}.`, 'success');
  }

  handleLoaded(save: SaveState): void {
    this.setStatus(`Loaded ${save.filename || 'snapshot'}.`, 'success');
  }

  setStatus(message: string, tone: StatusTone = 'neutral'): void {
    this.status = message;
    this.statusTone = tone;
  }

  setPendingReason(reason: string): void {
    this.pendingReason = reason;
  }
}

export const saveExplorerStore = new SaveExplorerStore();
