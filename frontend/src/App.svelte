<script lang="ts">
  import { runtimeSocket } from './lib/services/runtimeSocket';
  import { runtimeStore } from './lib/stores/runtimeStore.svelte';
  import { layoutStore } from './lib/stores/layoutStore.svelte';
  import './lib/services/init';
  import AppShell from './lib/components/AppShell.svelte';
  import './app.css';

  $effect(() => {
    document.documentElement.dataset.theme = layoutStore.theme;
  });

  $effect(() => {
    void runtimeStore.loadMapData();
    void runtimeStore.loadPokemonCatalog();
    runtimeSocket.connect();
  });
</script>

<AppShell />
