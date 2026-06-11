export interface Driver {
  id: string;
  name: string;
  phone: string;
  role: string;
  outsourced: boolean;
  active?: boolean;
  offDay?: string | number;
  leave?: LeavePeriod[];
}

export interface Crew {
  id: string;
  name: string;
  outsourced: boolean;
  active?: boolean;
  offDay?: string | number;
  leave?: LeavePeriod[];
  phone?: string;
  role?: string;
  company?: string;
}

export interface Truck {
  id: string;
  plate: string;
  model: string;
  tonnage: number;
  capFrac: number;
  lPer100: number;
  outsourced: boolean;
  rate?: number | string;
  active?: boolean;
  offDay?: string | number;
  leave?: LeavePeriod[];
  doubleCab?: boolean;
}

export interface Team {
  id: string;
  label: string;
  colorIdx: number;
  area: string;
  driverId: string | null;
  crew1Id: string | null;
  crew2Id: string | null;
  truckId: string | null;
  outsourced?: boolean;
  supplier?: string;
  _c?: number; // Cost evaluated by optimizer
}

export interface LeavePeriod {
  from: string; // YYYY-MM-DD
  to?: string;  // YYYY-MM-DD
}

export interface Venue {
  id: string;
  name: string;
  setup: number;
  colSetup?: number | string;
}

export interface Job {
  _id: string; // Internal temporary ID used for React keys and operations
  id?: string; // Original database ID
  date: string; // YYYY-MM-DD
  order_no: string; // e.g. D-57550 or C-57550
  type: string; // "Delivery" or "Collection"
  client: string;
  venue_type?: string;
  address: string;
  size: string; // XS, S, M, L, XL
  time_window: string; // e.g. "09:00-11:00" or "--:--"
  setup_mins?: number;
  buffer_mins?: number;
  trucks?: number; // count of trucks needed
  crew?: number; // count of crew needed
  status: string; // "active", "cancelled", etc.
  team_id: string | null;
  notes?: string;
  phone?: string;
  items?: string;
  
  // Optimizer & continuity fields
  continuity?: string; // "same_team", "split_crew", etc.
  split_note?: string;
  split?: boolean;
  linked_order?: string;
  _lockTeam?: boolean;
  _unsched?: boolean;
  _portionOf?: string;
  _portionIdx?: number;
  _portionCount?: number;
  _customSetup?: boolean;
  _customBuf?: boolean;
  _backhaul?: boolean;
  prog?: string;
  truckOverride?: string;
  crewNote?: string;
  _tr?: number | null;
  _trKm?: number | null;
  _buf?: number | null;
  _bufOk?: boolean;
  _need?: number;
  _teamClash?: boolean;
  _teamClashMin?: number;
  _helpers?: any[];
  _helperShort?: number;
  _helperInhouse?: number;
  _helperOut?: number;
  _leaderUnfit?: boolean;
  _convoyRoster?: any[];
  _setupEnd?: number;
}

export interface AppDefaults {
  del: number;
  col: number;
  buf: number;
}

export interface FuelConfig {
  dieselAED: number;
  lPer100: number;
}

export interface ShowPreferences {
  orderNo: boolean;
  phone: boolean;
  venue: boolean;
  items: boolean;
  notes: boolean;
}

export interface AppStateData {
  v: number;
  savedAt: string;
  app: string;
  selDate: string;
  jobs: Job[];
  teams: Team[];
  drivers: Driver[];
  crew: Crew[];
  trucks: Truck[];
  venues: Venue[];
  def: AppDefaults;
  fuel: FuelConfig;
  crewRate: number;
  show: ShowPreferences;
}
