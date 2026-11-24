export type RadiogramPrecedence =
  | "R"
  | "W"
  | "P"
  | "EMERGENCY"
  | "TEST R"
  | "TEST P";

export type RadiogramStatus =
  | "LISTED"
  | "ASSIGNED"
  | "RELAYED"
  | "DELIVERED"
  | "CANCELLED";

export type RadiogramDirection = "ORIGINATED" | "INBOUND" | "RELAY";

export type QueueView =
  | "needs_action"
  | "ready_relay"
  | "followup"
  | "archive"
  | "all";

export type ThemeId =
  | "shack-dark"
  | "night-red"
  | "amber-crt"
  | "forest-eoc"
  | "daylight"
  | "paper-warm"
  | "eoc-light"
  | "sky-breeze"
  | "high-contrast";

export type UiFontId = "system" | "humanist" | "geometric" | "serif" | "mono";
export type MonoFontId = "cascadia" | "consolas" | "courier";
export type DigitalMethod = "bpq_telnet" | "pat" | "outbox";
export type BpqNtsType = "SP" | "ST";

export interface Radiogram {
  id: number;
  book_id: number | null;
  net_name: string;
  msg_number: string;
  precedence: RadiogramPrecedence;
  hx: string;
  station_of_origin: string;
  check_text: string;
  place_of_origin: string;
  time_filed: string;
  date_filed: string;
  to_name: string;
  to_callsign: string;
  to_address: string;
  to_city_state_zip: string;
  to_phone: string;
  to_email: string;
  message_text: string;
  signature: string;
  direction: RadiogramDirection;
  status: RadiogramStatus;
  received_from: string;
  received_at: string;
  received_mode: string;
  sent_to: string;
  sent_at: string;
  sent_mode: string;
  delivered_at: string;
  delivery_method: string;
  delivery_notes: string;
  svc_required: boolean;
  svc_sent_at: string;
  hxb_expires_at: string;
  file_path: string;
  created_at: string;
  updated_at: string;
}

export interface RadiogramInput {
  id?: number;
  book_id?: number | null;
  net_name?: string;
  msg_number?: string;
  precedence?: RadiogramPrecedence;
  hx?: string;
  station_of_origin?: string;
  place_of_origin?: string;
  time_filed?: string;
  date_filed?: string;
  to_name?: string;
  to_callsign?: string;
  to_address?: string;
  to_city_state_zip?: string;
  to_phone?: string;
  to_email?: string;
  message_text?: string;
  signature?: string;
  direction?: RadiogramDirection;
  status?: RadiogramStatus;
  received_from?: string;
  received_at?: string;
  received_mode?: string;
  sent_to?: string;
  sent_at?: string;
  sent_mode?: string;
  delivered_at?: string;
  delivery_method?: string;
  delivery_notes?: string;
  svc_sent_at?: string;
}

export interface BookAddresseeInput {
  msg_number?: string;
  to_name: string;
  to_callsign?: string;
  to_address?: string;
  to_city_state_zip?: string;
  to_phone?: string;
  to_email?: string;
}

export interface BookCreateInput {
  title: string;
  net_name?: string;
  precedence?: RadiogramPrecedence;
  hx?: string;
  station_of_origin?: string;
  place_of_origin?: string;
  time_filed?: string;
  date_filed?: string;
  message_text: string;
  signature?: string;
  direction?: RadiogramDirection;
  received_from?: string;
  received_at?: string;
  start_number?: number;
  addressees: BookAddresseeInput[];
}

export interface RadiogramBook {
  id: number;
  title: string;
  precedence: RadiogramPrecedence;
  hx: string;
  station_of_origin: string;
  place_of_origin: string;
  time_filed: string;
  date_filed: string;
  message_text: string;
  signature: string;
  created_at: string;
  member_count: number;
  delivered_count: number;
  relayed_count: number;
}

export interface HandlingLogEntry {
  id: number;
  radiogram_id: number;
  action: string;
  counterparty: string;
  mode: string;
  timestamp_utc: string;
  notes: string;
}

export interface DigitalRoutingSettings {
  packet_enabled: boolean;
  winlink_enabled: boolean;
  method: DigitalMethod;
  default_to: string;
  bpq_host: string;
  bpq_port: number;
  bpq_bbs_cmd: string;
  bpq_user: string;
  bpq_pass_set: boolean;
  bpq_nts_type: BpqNtsType;
  bpq_wl_prefix: string;
  bpq_webmail_url: string;
  pat_url: string;
  outbox_dir: string;
}

export interface AppSettings {
  operator_call: string;
  operator_qth: string;
  radiograms_dir: string;
  theme: ThemeId;
  ui_font: UiFontId;
  mono_font: MonoFontId;
  font_size: number;
  callsign_size: number;
  default_precedence: RadiogramPrecedence;
  next_msg_number: number;
  qrz_user: string;
  qrz_pass_set: boolean;
  digital: DigitalRoutingSettings;
}

export interface SettingsUpdatePatch {
  operator_call?: string;
  operator_qth?: string;
  radiograms_dir?: string;
  theme?: ThemeId;
  ui_font?: UiFontId;
  mono_font?: MonoFontId;
  font_size?: number;
  callsign_size?: number;
  default_precedence?: RadiogramPrecedence;
  next_msg_number?: number;
  qrz_user?: string;
  qrz_pass?: string;
  clear_qrz_pass?: boolean;
  digital?: Partial<DigitalRoutingSettings> & {
    bpq_pass?: string;
    clear_bpq_pass?: boolean;
  };
}

export interface CallsignLookupResult {
  found: boolean;
  source: "qrz" | "callook" | "none";
  callsign: string;
  name: string;
  address: string;
  city_state_zip: string;
  qth: string;
  grid: string;
  email: string;
  message?: string;
}

export interface DigitalTestResult {
  ok: boolean;
  message: string;
  transcript: string;
}

export interface DigitalPushRequest {
  radiogram_id: number;
  mode: "packet" | "winlink";
  to_address: string;
  bbs_type?: BpqNtsType;
  subject?: string;
}

export interface DigitalPushResult {
  ok: boolean;
  message: string;
  transcript?: string;
  file_path?: string;
}

export interface QueueCounts {
  needs_action: number;
  ready_relay: number;
  followup: number;
  archive: number;
  all: number;
}

export interface MonthlySarStats {
  month: string;
  originated: number;
  received: number;
  sent: number;
  delivered: number;
  total: number;
  bpl_eligible: boolean;
}

export type SvcTemplateKind =
  | "delivered"
  | "relayed"
  | "undeliverable"
  | "cancelled_hxb";
