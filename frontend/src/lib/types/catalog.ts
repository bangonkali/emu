export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
}

export interface PokemonEntry {
  name: string;
  dex_no: number;
  internal_id: number;
  types: string[];
  base_stats: BaseStats;
  catch_rate: number;
  base_exp: number;
  growth_rate: string;
}

export interface PokemonCatalogMeta {
  total_pokemon: number;
}

export interface PokemonCatalog {
  meta?: PokemonCatalogMeta;
  pokemon: PokemonEntry[];
}

export interface MapRegion {
  id: number;
  name: string;
  coordinates: [number, number];
  tileSize: [number, number];
}

export interface MapData {
  regions: MapRegion[];
}
