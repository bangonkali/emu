import { runtimeSocket } from './runtimeSocket';
import { InputController } from './inputController.svelte';
import { runtimeStore } from '../stores/runtimeStore.svelte';
import { saveExplorerStore } from '../stores/saveExplorerStore.svelte';

export const inputController = new InputController((msg) => runtimeSocket.send(msg));

runtimeSocket.onConnect(() => {
  runtimeStore.connected = true;
  inputController.sync();
  runtimeSocket.send({ type: 'save_state_list' });
  saveExplorerStore.setPendingReason('connect');
  saveExplorerStore.setStatus('Connected. Loading snapshots...', 'neutral');
});

runtimeSocket.onDisconnect(() => {
  runtimeStore.connected = false;
});

runtimeSocket.onMessage((msg) => {
  switch (msg.type) {
    case 'state':
      runtimeStore.latestState = msg;
      runtimeStore.remoteActiveInputs = msg.active_inputs ?? [];
      break;
    case 'log':
      runtimeStore.appendLog(msg.timestamp, msg.message);
      break;
    case 'save_state_list':
      saveExplorerStore.handleListReceived(msg.saves);
      break;
    case 'save_state_saved':
      saveExplorerStore.handleSaved(msg.save);
      break;
    case 'save_state_loaded':
      saveExplorerStore.handleLoaded(msg.save);
      break;
    case 'save_state_error':
      saveExplorerStore.setStatus(msg.message, 'error');
      runtimeStore.appendLog('client', msg.message);
      break;
    case 'input_reset':
      inputController.resetLocalState();
      break;
    case 'error':
      runtimeStore.appendLog('client', msg.message);
      break;
  }
});
