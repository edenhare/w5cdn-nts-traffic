import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import {
  computeArrlCheck,
  computeHxbExpiryIso,
  currentUtcCompact,
  currentUtcDateShort,
  normalizeArrlHx,
  parseHxFlags,
  utcNowIso,
} from "../shared/arrl";
import type {
  AppSettings,
  BookCreateInput,
  BpqNtsType,
  DigitalMethod,
  HandlingLogEntry,
  MonoFontId,
  MonthlySarStats,
  QueueCounts,
  QueueView,
  Radiogram,
  RadiogramBook,
  RadiogramInput,
  SettingsUpdatePatch,
  ThemeId,
  UiFontId,
} from "../shared/types";
import { deleteRadiogramFile, syncRadiogramToFolder } from "./fileSync";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS radiogram_books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  precedence TEXT NOT NULL DEFAULT 'R',
  hx TEXT NOT NULL DEFAULT '',
  station_of_origin TEXT NOT NULL,
  place_of_origin TEXT NOT NULL DEFAULT '',
  time_filed TEXT NOT NULL DEFAULT '',
  date_filed TEXT NOT NULL DEFAULT '',
  message_text TEXT NOT NULL,
  signature TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS radiograms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER REFERENCES radiogram_books(id),
  net_name TEXT NOT NULL DEFAULT '',
  msg_number TEXT NOT NULL,
  precedence TEXT NOT NULL DEFAULT 'R',
  hx TEXT NOT NULL DEFAULT '',
  station_of_origin TEXT NOT NULL,
  check_text TEXT NOT NULL DEFAULT '0',
  place_of_origin TEXT NOT NULL DEFAULT '',
  time_filed TEXT NOT NULL DEFAULT '',
  date_filed TEXT NOT NULL DEFAULT '',
  to_name TEXT NOT NULL DEFAULT '',
  to_callsign TEXT NOT NULL DEFAULT '',
  to_address TEXT NOT NULL DEFAULT '',
  to_city_state_zip TEXT NOT NULL DEFAULT '',
  to_phone TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL DEFAULT '',
  message_text TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'INBOUND',
  status TEXT NOT NULL DEFAULT 'LISTED',
  received_from TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT '',
  received_mode TEXT NOT NULL DEFAULT '',
  sent_to TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  sent_mode TEXT NOT NULL DEFAULT '',
  delivered_at TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL DEFAULT '',
  delivery_notes TEXT NOT NULL DEFAULT '',
  svc_required INTEGER NOT NULL DEFAULT 0,
  svc_sent_at TEXT NOT NULL DEFAULT '',
  hxb_expires_at TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handling_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  radiogram_id INTEGER NOT NULL REFERENCES radiograms(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  counterparty TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  timestamp_utc TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_rg_status ON radiograms(status);
CREATE INDEX IF NOT EXISTS idx_rg_book ON radiograms(book_id);
CREATE INDEX IF NOT EXISTS idx_rg_created ON radiograms(created_at);
CREATE INDEX IF NOT EXISTS idx_log_rg ON handling_log(radiogram_id);
`;

function cleanUpper(raw: string | undefined, maxLen = 200): string {
  return (raw || "").replace(/[\r\n]+/g, " ").trim().toUpperCase().slice(0, maxLen);
}

function cleanBody(raw: string | undefined, maxLen = 4000): string {
  return (raw || "").trim().toUpperCase().slice(0, maxLen);
}

export class TrafficDatabase {
  private db!: Database;
  private readonly dbPath: string;
  private readonly defaultRadiogramsDir: string;
  private readonly defaultOutboxDir: string;

  private constructor(dbPath: string, defaultRadiogramsDir: string, defaultOutboxDir?: string) {
    this.dbPath = dbPath;
    this.defaultRadiogramsDir = defaultRadiogramsDir;
    this.defaultOutboxDir = defaultOutboxDir || path.join(path.dirname(dbPath), "outbox");
  }

  static async open(
    dbPath: string,
    defaultRadiogramsDir: string,
    defaultOutboxDir?: string
  ): Promise<TrafficDatabase> {
    const instance = new TrafficDatabase(dbPath, defaultRadiogramsDir, defaultOutboxDir);
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      const bytes = fs.readFileSync(dbPath);
      instance.db = new SQL.Database(bytes);
    } else {
      instance.db = new SQL.Database();
    }
    instance.db.run("PRAGMA foreign_keys = ON;");
    instance.db.run(SCHEMA_SQL);
    instance.ensureDefaultSettings();
    instance.persist();
    return instance;
  }

  close(): void {
    this.persist();
    this.db.close();
  }

  private persist(): void {
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.dbPath}.tmp`;
    const data = this.db.export();
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, this.dbPath);
  }

  private queryAll<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  private queryOne<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | null {
    const rows = this.queryAll<T>(sql, params);
    return rows.length ? rows[0] : null;
  }

  private lastInsertRowId(): number {
    const row = this.queryOne<{ id: number }>("SELECT last_insert_rowid() AS id");
    return Number(row?.id || 0);
  }

  private ensureDefaultSettings(): void {
    const defaults: Record<string, string> = {
      operator_call: (process.env.OPERATOR_CALL || "W5CDN").trim().toUpperCase() || "W5CDN",
      operator_qth: "TYLER, TX",
      radiograms_dir: this.defaultRadiogramsDir,
      theme: "shack-dark",
      ui_font: "system",
      mono_font: "cascadia",
      font_size: "14",
      callsign_size: "15",
      default_precedence: "R",
      next_msg_number: "1",
      qrz_user: (process.env.QRZ_USER || "").trim(),
      qrz_pass: (process.env.QRZ_PASS || "").trim(),
      dig_packet_enabled: "0",
      dig_winlink_enabled: "0",
      dig_method: "bpq_telnet",
      dig_default_to: "",
      dig_bpq_host: "",
      dig_bpq_port: "8010",
      dig_bpq_bbs_cmd: "BBS",
      dig_bpq_user: "",
      dig_bpq_pass: (process.env.BPQ_PASS || "").trim(),
      dig_bpq_nts_type: "SP",
      dig_bpq_wl_prefix: "RMS:",
      dig_bpq_webmail_url: "",
      dig_pat_url: "",
      dig_outbox_dir: this.defaultOutboxDir,
    };
    for (const [k, v] of Object.entries(defaults)) {
      this.db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [k, v]);
    }
  }

  private getRawSettingsMap(): Record<string, string> {
    const rows = this.queryAll<{ key: string; value: string }>("SELECT key, value FROM settings");
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  getSecret(key: "qrz_pass" | "dig_bpq_pass"): string {
    const row = this.queryOne<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
    return row?.value || "";
  }

  getSettings(): AppSettings {
    const map = this.getRawSettingsMap();
    const nextNum = Number.parseInt(map.next_msg_number || "1", 10);
    const fontSize = Number.parseInt(map.font_size || "14", 10);
    const callSize = Number.parseInt(map.callsign_size || "15", 10);
    const bpqPort = Number.parseInt(map.dig_bpq_port || "8010", 10);
    return {
      operator_call: map.operator_call || "W5CDN",
      operator_qth: map.operator_qth || "",
      radiograms_dir: map.radiograms_dir || this.defaultRadiogramsDir,
      theme: (map.theme as ThemeId) || "shack-dark",
      ui_font: (map.ui_font as UiFontId) || "system",
      mono_font: (map.mono_font as MonoFontId) || "cascadia",
      font_size: Number.isFinite(fontSize) ? Math.min(22, Math.max(11, fontSize)) : 14,
      callsign_size: Number.isFinite(callSize) ? Math.min(26, Math.max(12, callSize)) : 15,
      default_precedence: (map.default_precedence as AppSettings["default_precedence"]) || "R",
      next_msg_number: Number.isFinite(nextNum) && nextNum > 0 ? nextNum : 1,
      qrz_user: map.qrz_user || "",
      qrz_pass_set: Boolean(map.qrz_pass),
      digital: {
        packet_enabled: map.dig_packet_enabled === "1",
        winlink_enabled: map.dig_winlink_enabled === "1",
        method: (map.dig_method as DigitalMethod) || "bpq_telnet",
        default_to: map.dig_default_to || "",
        bpq_host: map.dig_bpq_host || "",
        bpq_port: Number.isFinite(bpqPort) && bpqPort > 0 && bpqPort <= 65535 ? bpqPort : 8010,
        bpq_bbs_cmd: map.dig_bpq_bbs_cmd ?? "BBS",
        bpq_user: map.dig_bpq_user || "",
        bpq_pass_set: Boolean(map.dig_bpq_pass),
        bpq_nts_type: (map.dig_bpq_nts_type as BpqNtsType) === "ST" ? "ST" : "SP",
        bpq_wl_prefix: map.dig_bpq_wl_prefix ?? "RMS:",
        bpq_webmail_url: map.dig_bpq_webmail_url || "",
        pat_url: map.dig_pat_url || "",
        outbox_dir: map.dig_outbox_dir || this.defaultOutboxDir,
      },
    };
  }

  private setSetting(key: string, value: string): void {
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value]
    );
  }

  updateSettings(patch: SettingsUpdatePatch): AppSettings {
    if (patch.operator_call !== undefined) {
      this.setSetting("operator_call", cleanUpper(patch.operator_call, 24) || "W5CDN");
    }
    if (patch.operator_qth !== undefined) {
      this.setSetting("operator_qth", cleanUpper(patch.operator_qth, 120));
    }
    if (patch.radiograms_dir !== undefined) {
      this.setSetting("radiograms_dir", patch.radiograms_dir.trim() || this.defaultRadiogramsDir);
    }
    if (patch.theme !== undefined) this.setSetting("theme", patch.theme);
    if (patch.ui_font !== undefined) this.setSetting("ui_font", patch.ui_font);
    if (patch.mono_font !== undefined) this.setSetting("mono_font", patch.mono_font);
    if (patch.font_size !== undefined && Number.isFinite(patch.font_size)) {
      this.setSetting("font_size", String(Math.min(22, Math.max(11, Math.round(patch.font_size)))));
    }
    if (patch.callsign_size !== undefined && Number.isFinite(patch.callsign_size)) {
      this.setSetting("callsign_size", String(Math.min(26, Math.max(12, Math.round(patch.callsign_size)))));
    }
    if (patch.default_precedence !== undefined) this.setSetting("default_precedence", patch.default_precedence);
    if (patch.next_msg_number !== undefined && Number.isFinite(patch.next_msg_number) && patch.next_msg_number > 0) {
      this.setSetting("next_msg_number", String(Math.floor(patch.next_msg_number)));
    }
    if (patch.qrz_user !== undefined) {
      this.setSetting("qrz_user", cleanUpper(patch.qrz_user, 32));
    }
    if (patch.clear_qrz_pass) {
      this.setSetting("qrz_pass", "");
    } else if (patch.qrz_pass) {
      this.setSetting("qrz_pass", patch.qrz_pass);
    }

    if (patch.digital) {
      const d = patch.digital;
      if (d.packet_enabled !== undefined) this.setSetting("dig_packet_enabled", d.packet_enabled ? "1" : "0");
      if (d.winlink_enabled !== undefined) this.setSetting("dig_winlink_enabled", d.winlink_enabled ? "1" : "0");
      if (d.method !== undefined) this.setSetting("dig_method", d.method);
      if (d.default_to !== undefined) this.setSetting("dig_default_to", d.default_to.trim());
      if (d.bpq_host !== undefined) this.setSetting("dig_bpq_host", d.bpq_host.trim());
      if (d.bpq_port !== undefined && Number.isFinite(d.bpq_port)) {
        this.setSetting("dig_bpq_port", String(Math.min(65535, Math.max(1, Math.round(d.bpq_port)))));
      }
      if (d.bpq_bbs_cmd !== undefined) this.setSetting("dig_bpq_bbs_cmd", cleanUpper(d.bpq_bbs_cmd, 32));
      if (d.bpq_user !== undefined) this.setSetting("dig_bpq_user", d.bpq_user.trim());
      if (d.clear_bpq_pass) {
        this.setSetting("dig_bpq_pass", "");
      } else if (d.bpq_pass) {
        this.setSetting("dig_bpq_pass", d.bpq_pass);
      }
      if (d.bpq_nts_type !== undefined) this.setSetting("dig_bpq_nts_type", d.bpq_nts_type === "ST" ? "ST" : "SP");
      if (d.bpq_wl_prefix !== undefined) this.setSetting("dig_bpq_wl_prefix", cleanUpper(d.bpq_wl_prefix, 16));
      if (d.bpq_webmail_url !== undefined) this.setSetting("dig_bpq_webmail_url", d.bpq_webmail_url.trim());
      if (d.pat_url !== undefined) this.setSetting("dig_pat_url", d.pat_url.trim());
      if (d.outbox_dir !== undefined) this.setSetting("dig_outbox_dir", d.outbox_dir.trim());
    }
    this.persist();
    return this.getSettings();
  }

  exportBackupBytes(): Uint8Array {
    return this.db.export();
  }

  async restoreBackupFromFile(backupFilePath: string): Promise<void> {
    const bytes = fs.readFileSync(backupFilePath);
    const SQL = await initSqlJs();
    const candidate = new SQL.Database(bytes);
    candidate.run("PRAGMA foreign_keys = ON;");
    candidate.run(SCHEMA_SQL);
    this.db.close();
    this.db = candidate;
    this.ensureDefaultSettings();
    this.persist();
  }

  private mapRadiogram(row: Record<string, unknown>): Radiogram {
    return {
      id: Number(row.id),
      book_id: row.book_id === null || row.book_id === undefined ? null : Number(row.book_id),
      net_name: String(row.net_name || ""),
      msg_number: String(row.msg_number || ""),
      precedence: String(row.precedence || "R") as Radiogram["precedence"],
      hx: String(row.hx || ""),
      station_of_origin: String(row.station_of_origin || ""),
      check_text: String(row.check_text || "0"),
      place_of_origin: String(row.place_of_origin || ""),
      time_filed: String(row.time_filed || ""),
      date_filed: String(row.date_filed || ""),
      to_name: String(row.to_name || ""),
      to_callsign: String(row.to_callsign || ""),
      to_address: String(row.to_address || ""),
      to_city_state_zip: String(row.to_city_state_zip || ""),
      to_phone: String(row.to_phone || ""),
      to_email: String(row.to_email || ""),
      message_text: String(row.message_text || ""),
      signature: String(row.signature || ""),
      direction: String(row.direction || "INBOUND") as Radiogram["direction"],
      status: String(row.status || "LISTED") as Radiogram["status"],
      received_from: String(row.received_from || ""),
      received_at: String(row.received_at || ""),
      received_mode: String(row.received_mode || ""),
      sent_to: String(row.sent_to || ""),
      sent_at: String(row.sent_at || ""),
      sent_mode: String(row.sent_mode || ""),
      delivered_at: String(row.delivered_at || ""),
      delivery_method: String(row.delivery_method || ""),
      delivery_notes: String(row.delivery_notes || ""),
      svc_required: Boolean(row.svc_required),
      svc_sent_at: String(row.svc_sent_at || ""),
      hxb_expires_at: String(row.hxb_expires_at || ""),
      file_path: String(row.file_path || ""),
      created_at: String(row.created_at || ""),
      updated_at: String(row.updated_at || ""),
    };
  }

  getRadiogram(id: number): Radiogram | null {
    const row = this.queryOne("SELECT * FROM radiograms WHERE id = ?", [id]);
    return row ? this.mapRadiogram(row) : null;
  }

  private allocateNextNumber(explicit: string | undefined): string {
    const cleaned = cleanUpper(explicit, 20);
    const settings = this.getSettings();
    if (cleaned) {
      if (/^\d+$/.test(cleaned)) {
        const numeric = Number.parseInt(cleaned, 10);
        if (numeric >= settings.next_msg_number) {
          this.db.run(
            "INSERT INTO settings (key, value) VALUES ('next_msg_number', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [String(numeric + 1)]
          );
        }
      }
      return cleaned;
    }
    const assigned = String(settings.next_msg_number);
    this.db.run(
      "INSERT INTO settings (key, value) VALUES ('next_msg_number', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(settings.next_msg_number + 1)]
    );
    return assigned;
  }

  addHandlingLog(radiogramId: number, action: string, counterparty = "", mode = "", notes = ""): void {
    this.db.run(
      "INSERT INTO handling_log (radiogram_id, action, counterparty, mode, timestamp_utc, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [radiogramId, cleanUpper(action, 32), cleanUpper(counterparty, 48), cleanUpper(mode, 32), utcNowIso(), notes.trim()]
    );
  }

  getHandlingLog(radiogramId: number): HandlingLogEntry[] {
    return this.queryAll<Record<string, unknown>>(
      "SELECT * FROM handling_log WHERE radiogram_id = ? ORDER BY id DESC",
      [radiogramId]
    ).map((r) => ({
      id: Number(r.id),
      radiogram_id: Number(r.radiogram_id),
      action: String(r.action || ""),
      counterparty: String(r.counterparty || ""),
      mode: String(r.mode || ""),
      timestamp_utc: String(r.timestamp_utc || ""),
      notes: String(r.notes || ""),
    }));
  }

  createRadiogram(input: RadiogramInput): Radiogram {
    const settings = this.getSettings();
    const nowIso = utcNowIso();
    const msgNumber = this.allocateNextNumber(input.msg_number);
    const hx = normalizeArrlHx(input.hx || "");
    const hxFlags = parseHxFlags(hx);
    const body = cleanBody(input.message_text);
    const checkText = computeArrlCheck(body).label;
    const hxbExpiresAt = computeHxbExpiryIso(hx, nowIso);
    const origin = cleanUpper(input.station_of_origin, 24) || settings.operator_call;
    const direction = input.direction || (input.received_from ? "INBOUND" : "ORIGINATED");
    const status = input.status || "LISTED";

    this.db.run(
      `INSERT INTO radiograms (
        book_id, net_name, msg_number, precedence, hx, station_of_origin, check_text,
        place_of_origin, time_filed, date_filed, to_name, to_callsign, to_address,
        to_city_state_zip, to_phone, to_email, message_text, signature, direction,
        status, received_from, received_at, received_mode, sent_to, sent_at, sent_mode,
        delivered_at, delivery_method, delivery_notes, svc_required, svc_sent_at,
        hxb_expires_at, file_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
      [
        input.book_id ?? null,
        cleanUpper(input.net_name, 120),
        msgNumber,
        input.precedence || settings.default_precedence,
        hx,
        origin,
        checkText,
        cleanUpper(input.place_of_origin, 120) || (direction === "ORIGINATED" ? settings.operator_qth : ""),
        cleanUpper(input.time_filed, 16) || currentUtcCompact(),
        cleanUpper(input.date_filed, 24) || currentUtcDateShort(),
        cleanUpper(input.to_name, 120),
        cleanUpper(input.to_callsign, 24),
        cleanUpper(input.to_address, 200),
        cleanUpper(input.to_city_state_zip, 160),
        cleanUpper(input.to_phone, 60),
        cleanUpper(input.to_email, 120),
        body,
        cleanUpper(input.signature, 120),
        direction,
        status,
        cleanUpper(input.received_from, 24),
        cleanUpper(input.received_at, 32),
        cleanUpper(input.received_mode, 32),
        cleanUpper(input.sent_to, 24),
        cleanUpper(input.sent_at, 32),
        cleanUpper(input.sent_mode, 32),
        cleanUpper(input.delivered_at, 32),
        cleanUpper(input.delivery_method, 32),
        (input.delivery_notes || "").trim().slice(0, 1000),
        hxFlags.svcRequired ? 1 : 0,
        cleanUpper(input.svc_sent_at, 32),
        hxbExpiresAt,
        nowIso,
        nowIso,
      ]
    );

    const id = this.lastInsertRowId();
    this.addHandlingLog(
      id,
      direction === "ORIGINATED" ? "ORIGINATED" : "RECEIVED",
      cleanUpper(input.received_from, 24) || origin,
      cleanUpper(input.received_mode, 32)
    );

    const created = this.getRadiogram(id)!;
    const syncedPath = syncRadiogramToFolder(created, settings.radiograms_dir);
    this.db.run("UPDATE radiograms SET file_path = ? WHERE id = ?", [syncedPath, id]);
    this.persist();
    return this.getRadiogram(id)!;
  }

  updateRadiogram(id: number, patch: RadiogramInput): Radiogram {
    const existing = this.getRadiogram(id);
    if (!existing) throw new Error(`Radiogram #${id} not found`);
    const settings = this.getSettings();
    const nowIso = utcNowIso();

    const hx = patch.hx !== undefined ? normalizeArrlHx(patch.hx) : existing.hx;
    const hxFlags = parseHxFlags(hx);
    const body = patch.message_text !== undefined ? cleanBody(patch.message_text) : existing.message_text;
    const checkText = computeArrlCheck(body).label;
    const hxbExpiresAt = patch.hx !== undefined ? computeHxbExpiryIso(hx, existing.created_at) : existing.hxb_expires_at;
    const nextStatus = patch.status || existing.status;

    this.db.run(
      `UPDATE radiograms SET
        net_name = ?, msg_number = ?, precedence = ?, hx = ?, station_of_origin = ?,
        check_text = ?, place_of_origin = ?, time_filed = ?, date_filed = ?,
        to_name = ?, to_callsign = ?, to_address = ?, to_city_state_zip = ?,
        to_phone = ?, to_email = ?, message_text = ?, signature = ?, direction = ?,
        status = ?, received_from = ?, received_at = ?, received_mode = ?,
        sent_to = ?, sent_at = ?, sent_mode = ?, delivered_at = ?, delivery_method = ?,
        delivery_notes = ?, svc_required = ?, svc_sent_at = ?, hxb_expires_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        patch.net_name !== undefined ? cleanUpper(patch.net_name, 120) : existing.net_name,
        patch.msg_number !== undefined ? cleanUpper(patch.msg_number, 20) || existing.msg_number : existing.msg_number,
        patch.precedence || existing.precedence,
        hx,
        patch.station_of_origin !== undefined ? cleanUpper(patch.station_of_origin, 24) || existing.station_of_origin : existing.station_of_origin,
        checkText,
        patch.place_of_origin !== undefined ? cleanUpper(patch.place_of_origin, 120) : existing.place_of_origin,
        patch.time_filed !== undefined ? cleanUpper(patch.time_filed, 16) : existing.time_filed,
        patch.date_filed !== undefined ? cleanUpper(patch.date_filed, 24) : existing.date_filed,
        patch.to_name !== undefined ? cleanUpper(patch.to_name, 120) : existing.to_name,
        patch.to_callsign !== undefined ? cleanUpper(patch.to_callsign, 24) : existing.to_callsign,
        patch.to_address !== undefined ? cleanUpper(patch.to_address, 200) : existing.to_address,
        patch.to_city_state_zip !== undefined ? cleanUpper(patch.to_city_state_zip, 160) : existing.to_city_state_zip,
        patch.to_phone !== undefined ? cleanUpper(patch.to_phone, 60) : existing.to_phone,
        patch.to_email !== undefined ? cleanUpper(patch.to_email, 120) : existing.to_email,
        body,
        patch.signature !== undefined ? cleanUpper(patch.signature, 120) : existing.signature,
        patch.direction || existing.direction,
        nextStatus,
        patch.received_from !== undefined ? cleanUpper(patch.received_from, 24) : existing.received_from,
        patch.received_at !== undefined ? cleanUpper(patch.received_at, 32) : existing.received_at,
        patch.received_mode !== undefined ? cleanUpper(patch.received_mode, 32) : existing.received_mode,
        patch.sent_to !== undefined ? cleanUpper(patch.sent_to, 24) : existing.sent_to,
        patch.sent_at !== undefined ? cleanUpper(patch.sent_at, 32) : existing.sent_at,
        patch.sent_mode !== undefined ? cleanUpper(patch.sent_mode, 32) : existing.sent_mode,
        patch.delivered_at !== undefined ? cleanUpper(patch.delivered_at, 32) : existing.delivered_at,
        patch.delivery_method !== undefined ? cleanUpper(patch.delivery_method, 32) : existing.delivery_method,
        patch.delivery_notes !== undefined ? patch.delivery_notes.trim().slice(0, 1000) : existing.delivery_notes,
        hxFlags.svcRequired ? 1 : 0,
        patch.svc_sent_at !== undefined ? cleanUpper(patch.svc_sent_at, 32) : existing.svc_sent_at,
        hxbExpiresAt,
        nowIso,
        id,
      ]
    );

    if (nextStatus !== existing.status) {
      this.addHandlingLog(
        id,
        nextStatus,
        patch.sent_to || existing.sent_to || existing.to_name,
        patch.sent_mode || patch.delivery_method || ""
      );
    }
    if (patch.svc_sent_at && !existing.svc_sent_at) {
      this.addHandlingLog(id, "SVC_SENT", existing.station_of_origin, "");
    }

    const updated = this.getRadiogram(id)!;
    const syncedPath = syncRadiogramToFolder(updated, settings.radiograms_dir);
    this.db.run("UPDATE radiograms SET file_path = ? WHERE id = ?", [syncedPath, id]);
    this.persist();
    return this.getRadiogram(id)!;
  }

  deleteRadiogram(id: number): boolean {
    const existing = this.getRadiogram(id);
    if (!existing) return false;
    const settings = this.getSettings();
    this.db.run("DELETE FROM radiograms WHERE id = ?", [id]);
    deleteRadiogramFile(existing.file_path, settings.radiograms_dir);
    this.persist();
    return true;
  }

  createBook(input: BookCreateInput): { book: RadiogramBook; members: Radiogram[] } {
    if (!input.addressees || input.addressees.length === 0) {
      throw new Error("A Book Message requires at least one addressee");
    }
    const settings = this.getSettings();
    const nowIso = utcNowIso();
    const hx = normalizeArrlHx(input.hx || "");
    const origin = cleanUpper(input.station_of_origin, 24) || settings.operator_call;
    const place = cleanUpper(input.place_of_origin, 120) || settings.operator_qth;
    const timeFiled = cleanUpper(input.time_filed, 16) || currentUtcCompact();
    const dateFiled = cleanUpper(input.date_filed, 24) || currentUtcDateShort();
    const body = cleanBody(input.message_text);
    const sig = cleanUpper(input.signature, 120);
    const prec = input.precedence || settings.default_precedence;

    this.db.run(
      `INSERT INTO radiogram_books (
        title, precedence, hx, station_of_origin, place_of_origin,
        time_filed, date_filed, message_text, signature, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanUpper(input.title, 120) || "BOOK MESSAGE", prec, hx, origin, place, timeFiled, dateFiled, body, sig, nowIso]
    );
    const bookId = this.lastInsertRowId();

    let nextExplicit = input.start_number && input.start_number > 0 ? Math.floor(input.start_number) : null;
    const members: Radiogram[] = [];
    for (const addr of input.addressees) {
      const explicitNum = addr.msg_number || (nextExplicit !== null ? String(nextExplicit++) : undefined);
      const rg = this.createRadiogram({
        book_id: bookId,
        net_name: input.net_name,
        msg_number: explicitNum,
        precedence: prec,
        hx,
        station_of_origin: origin,
        place_of_origin: place,
        time_filed: timeFiled,
        date_filed: dateFiled,
        to_name: addr.to_name,
        to_callsign: addr.to_callsign,
        to_address: addr.to_address,
        to_city_state_zip: addr.to_city_state_zip,
        to_phone: addr.to_phone,
        to_email: addr.to_email,
        message_text: body,
        signature: sig,
        direction: input.direction || (input.received_from ? "INBOUND" : "ORIGINATED"),
        status: "LISTED",
        received_from: input.received_from,
        received_at: input.received_at,
      });
      members.push(rg);
    }

    const book = this.listBooks().find((b) => b.id === bookId)!;
    return { book, members };
  }

  listBooks(): RadiogramBook[] {
    const rows = this.queryAll<Record<string, unknown>>(
      `SELECT b.*,
        COUNT(r.id) AS member_count,
        SUM(CASE WHEN r.status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered_count,
        SUM(CASE WHEN r.status = 'RELAYED' THEN 1 ELSE 0 END) AS relayed_count
       FROM radiogram_books b
       LEFT JOIN radiograms r ON r.book_id = b.id
       GROUP BY b.id
       ORDER BY b.id DESC`
    );
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title || ""),
      precedence: String(r.precedence || "R") as RadiogramBook["precedence"],
      hx: String(r.hx || ""),
      station_of_origin: String(r.station_of_origin || ""),
      place_of_origin: String(r.place_of_origin || ""),
      time_filed: String(r.time_filed || ""),
      date_filed: String(r.date_filed || ""),
      message_text: String(r.message_text || ""),
      signature: String(r.signature || ""),
      created_at: String(r.created_at || ""),
      member_count: Number(r.member_count || 0),
      delivered_count: Number(r.delivered_count || 0),
      relayed_count: Number(r.relayed_count || 0),
    }));
  }

  getBookMembers(bookId: number): Radiogram[] {
    return this.queryAll("SELECT * FROM radiograms WHERE book_id = ? ORDER BY id ASC", [bookId]).map((r) =>
      this.mapRadiogram(r)
    );
  }

  private matchesQueue(rg: Radiogram, queue: QueueView): boolean {
    if (queue === "all") return true;
    if (queue === "needs_action") {
      return rg.status === "LISTED" || rg.status === "ASSIGNED";
    }
    if (queue === "ready_relay") {
      return (rg.status === "LISTED" || rg.status === "ASSIGNED") && rg.direction !== "INBOUND"
        ? true
        : (rg.status === "LISTED" || rg.status === "ASSIGNED") && Boolean(rg.sent_to || rg.to_city_state_zip);
    }
    if (queue === "followup") {
      const needsSvc = rg.svc_required && !rg.svc_sent_at && rg.status !== "CANCELLED";
      const hasHxb = Boolean(rg.hxb_expires_at) && (rg.status === "LISTED" || rg.status === "ASSIGNED");
      return needsSvc || hasHxb;
    }
    if (queue === "archive") {
      return rg.status === "DELIVERED" || rg.status === "RELAYED" || rg.status === "CANCELLED";
    }
    return true;
  }

  listRadiograms(queue: QueueView = "all", search = "", bookId: number | null = null): Radiogram[] {
    const all = this.queryAll("SELECT * FROM radiograms ORDER BY id DESC").map((r) => this.mapRadiogram(r));
    const q = search.trim().toLowerCase();
    return all.filter((rg) => {
      if (bookId !== null && rg.book_id !== bookId) return false;
      if (!this.matchesQueue(rg, queue)) return false;
      if (!q) return true;
      const hay = [
        rg.msg_number,
        rg.station_of_origin,
        rg.place_of_origin,
        rg.to_name,
        rg.to_callsign,
        rg.to_city_state_zip,
        rg.message_text,
        rg.received_from,
        rg.sent_to,
        rg.net_name,
        rg.hx,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  getQueueCounts(): QueueCounts {
    const all = this.queryAll("SELECT * FROM radiograms").map((r) => this.mapRadiogram(r));
    return {
      needs_action: all.filter((rg) => this.matchesQueue(rg, "needs_action")).length,
      ready_relay: all.filter((rg) => this.matchesQueue(rg, "ready_relay")).length,
      followup: all.filter((rg) => this.matchesQueue(rg, "followup")).length,
      archive: all.filter((rg) => this.matchesQueue(rg, "archive")).length,
      all: all.length,
    };
  }

  getMonthlySarStats(month: string): MonthlySarStats {
    const rows = this.queryAll("SELECT * FROM radiograms WHERE created_at LIKE ?", [`${month}%`]).map((r) =>
      this.mapRadiogram(r)
    );
    let originated = 0;
    let received = 0;
    let sent = 0;
    let delivered = 0;
    for (const rg of rows) {
      if (rg.direction === "ORIGINATED") originated += 1;
      if (rg.direction === "INBOUND" || rg.received_from) received += 1;
      if (rg.status === "RELAYED" || rg.sent_to) sent += 1;
      if (rg.status === "DELIVERED") delivered += 1;
    }
    const total = originated + received + sent + delivered;
    const bpl_eligible = total >= 500 || originated + delivered >= 100;
    return { month, originated, received, sent, delivered, total, bpl_eligible };
  }
}
