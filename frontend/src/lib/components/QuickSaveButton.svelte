<script lang="ts">
  import { runtimeSocket } from '../services/runtimeSocket';
  import { saveExplorerStore } from '../stores/saveExplorerStore.svelte';

  function quickSave() {
    saveExplorerStore.setStatus('Saving quick snapshot...', 'neutral');
    runtimeSocket.send({ type: 'save_state_create', name: null });
  }
</script>

<button class="menu-btn" onclick={quickSave}>Quick Save</button>
