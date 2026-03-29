// --- Game state sub-types ---

export interface PartyMember {
  slot: number;
  species_id: number;
  level: number;
  hp: number;
  max_hp: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  experience: number;
  status: string;
}

export interface InventoryItem {
  slot: number;
  item_id: number;
  quantity: number;
}

export interface Inventory {
  count: number;
  capacity: number;
  total_quantity: number;
  items: InventoryItem[];
}

export interface Pokedex {
  seen: number[];
  owned: number[];
  seen_count: number;
  owned_count: number;
}

export interface Combat {
  active: boolean;
  kind: 'wild' | 'trainer' | 'safari';
  player_active: PartyMember | null;
  player_active_slot: number | null;
  enemy_active: PartyMember | null;
  enemy_active_slot: number | null;
  player_party: PartyMember[];
  enemy_party: PartyMember[];
  enemy_party_count: number;
}

// --- Server → Client message types ---

export interface StateMessage {
  type: 'state';
  screen: string;
  map_id: number;
  map_name: string;
  x: number;
  y: number;
  party_count: number;
  badges: number;
  money: number;
  lead_hp: number;
  lead_max_hp: number;
  state: string;
  frame: number;
  speed: string;
  active_inputs: string[];
  party: PartyMember[];
  inventory: Inventory | null;
  pokedex: Pokedex;
  combat: Combat | null;
}

export interface LogMessage {
  type: 'log';
  timestamp: string;
  message: string;
}

export interface SaveState {
  filename: string;
  display_name: string;
  label: string | null;
  size_bytes: number;
  created_at: string;
  game_name: string;
  active: boolean;
}

export interface SaveStateListMessage {
  type: 'save_state_list';
  saves: SaveState[];
}

export interface SaveStateSavedMessage {
  type: 'save_state_saved';
  save: SaveState;
}

export interface SaveStateLoadedMessage {
  type: 'save_state_loaded';
  save: SaveState;
}

export interface SaveStateErrorMessage {
  type: 'save_state_error';
  message: string;
}

export interface InputResetMessage {
  type: 'input_reset';
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | StateMessage
  | LogMessage
  | SaveStateListMessage
  | SaveStateSavedMessage
  | SaveStateLoadedMessage
  | SaveStateErrorMessage
  | InputResetMessage
  | ErrorMessage;

// --- Client → Server message types ---

export interface InputEventMessage {
  type: 'input_event';
  button: string;
  pressed: boolean;
  sequence: number;
}

export interface InputSnapshotMessage {
  type: 'input_snapshot';
  buttons: string[];
  sequence: number;
}

export interface SetSpeedMessage {
  type: 'set_speed';
  speed: string;
}

export interface SaveStateCreateMessage {
  type: 'save_state_create';
  name?: string | null;
}

export interface SaveStateLoadMessage {
  type: 'save_state_load';
  filename: string;
}

export interface RequestSaveStateListMessage {
  type: 'save_state_list';
}

export type ClientMessage =
  | InputEventMessage
  | InputSnapshotMessage
  | SetSpeedMessage
  | SaveStateCreateMessage
  | SaveStateLoadMessage
  | RequestSaveStateListMessage;
