import type { StateMessage } from '../types/protocol';
import type { PokemonEntry, MapRegion } from '../types/catalog';

const MAX_LOG_ROWS = 400;

export interface LogEntry {
  timestamp: string;
  message: string;
}

class RuntimeStore {
  connected = $state(false);
  latestState = $state.raw<StateMessage | null>(null);
  logs = $state<LogEntry[]>([]);
  mapData = $state.raw<Record<number, MapRegion>>({});
  pokemonCatalog = $state.raw<PokemonEntry[]>([]);
  catalogByDex = $state.raw(new Map<number, PokemonEntry>());
  catalogByInternalId = $state.raw(new Map<number, PokemonEntry>());
  remoteActiveInputs = $state.raw<string[]>([]);

  appendLog(timestamp: string, message: string): void {
    this.logs.push({ timestamp, message });
    if (this.logs.length > MAX_LOG_ROWS) {
      this.logs.shift();
    }
  }

  async loadMapData(): Promise<void> {
    try {
      const res = await fetch('/map_data.json');
      const payload = (await res.json()) as { regions: MapRegion[] };
      const data: Record<number, MapRegion> = {};
      for (const region of payload.regions) {
        data[Number(region.id)] = region;
      }
      this.mapData = data;
    } catch (err) {
      this.appendLog('client', `Failed to load map data: ${String(err)}`);
    }
  }

  async loadPokemonCatalog(): Promise<void> {
    try {
      const res = await fetch('/pokemon_catalog.json');
      const payload = (await res.json()) as { pokemon: PokemonEntry[]; meta?: { total_pokemon: number } };
      this.pokemonCatalog = payload.pokemon ?? [];
      this.catalogByDex = new Map(this.pokemonCatalog.map((e) => [Number(e.dex_no), e]));
      this.catalogByInternalId = new Map(this.pokemonCatalog.map((e) => [Number(e.internal_id), e]));
    } catch (err) {
      this.appendLog('client', `Failed to load Pokémon catalog: ${String(err)}`);
    }
  }
}

export const runtimeStore = new RuntimeStore();
