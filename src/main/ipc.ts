import fs from "node:fs";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
  ARL_TEXTS,
  buildPrintableHtml,
  buildServiceMessageDraft,
  currentUtcCompact,
  formatArrlBookText,
  formatArrlRadiogramText,
} from "../shared/arrl";
import type {
  BookCreateInput,
  DigitalPushRequest,
  QueueView,
  RadiogramInput,
  SettingsUpdatePatch,
  SvcTemplateKind,
} from "../shared/types";
import type { TrafficDatabase } from "./db";
import { buildNtsBbsSubject, pushRadiogramDigital, testBpqTelnetConnection } from "./digital";
import { CallsignLookupClient } from "./lookup";

export function registerIpcHandlers(
  db: TrafficDatabase,
  getMainWindow: () => BrowserWindow | null
): void {
  const lookupClient = new CallsignLookupClient();

  ipcMain.handle("settings:get", () => db.getSettings());
  ipcMain.handle("settings:update", (_e, patch: SettingsUpdatePatch) => {
    if (patch.qrz_user !== undefined || patch.qrz_pass !== undefined || patch.clear_qrz_pass) {
      lookupClient.resetSession();
    }
    return db.updateSettings(patch);
  });
  ipcMain.handle("settings:pickFolder", async (_e, title?: string) => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: title || "Select Folder",
      properties: ["openDirectory", "createDirectory"],
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });
  ipcMain.handle("settings:openFolder", async () => {
    const { radiograms_dir } = db.getSettings();
    await shell.openPath(radiograms_dir);
    return radiograms_dir;
  });
  ipcMain.handle("settings:exportBackup", async () => {
    const win = getMainWindow();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const opts: Electron.SaveDialogOptions = {
      title: "Export NTS Traffic Backup",
      defaultPath: `nts_traffic_backup_${dateStamp}.db`,
      filters: [{ name: "SQLite Database Backup", extensions: ["db"] }],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { ok: false, message: "Backup cancelled." };
    fs.writeFileSync(res.filePath, Buffer.from(db.exportBackupBytes()));
    return { ok: true, message: `Backup saved to ${res.filePath}` };
  });
  ipcMain.handle("settings:restoreBackup", async () => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: "Restore NTS Traffic Backup (.db)",
      properties: ["openFile"],
      filters: [{ name: "SQLite Database Backup", extensions: ["db"] }],
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (res.canceled || !res.filePaths.length) return { ok: false, message: "Restore cancelled." };
    await db.restoreBackupFromFile(res.filePaths[0]);
    lookupClient.resetSession();
    return { ok: true, message: `Restored database from ${res.filePaths[0]}` };
  });

  ipcMain.handle("lookup:callsign", async (_e, callsign: string) => {
    const s = db.getSettings();
    return lookupClient.lookup(callsign, s.qrz_user, db.getSecret("qrz_pass"));
  });
  ipcMain.handle("lookup:testQrz", async (_e, creds?: { user?: string; pass?: string }) => {
    const s = db.getSettings();
    const user = creds?.user !== undefined ? creds.user : s.qrz_user;
    const pass = creds?.pass ? creds.pass : db.getSecret("qrz_pass");
    return lookupClient.testQrzLogin(user, pass);
  });

  ipcMain.handle("digital:test", async (_e, override?: { bpq_pass?: string }) => {
    const s = db.getSettings();
    if (s.digital.method === "outbox") {
      const target = s.digital.outbox_dir || "outbox";
      fs.mkdirSync(target, { recursive: true });
      return { ok: true, message: `Outbox folder ready: ${target}`, transcript: "" };
    }
    if (s.digital.method === "pat") {
      if (!s.digital.pat_url) {
        return { ok: false, message: "Enter your Pat Web UI URL first.", transcript: "" };
      }
      try {
        const resp = await fetch(s.digital.pat_url);
        return {
          ok: resp.ok,
          message: resp.ok ? `Pat Web UI reachable (${resp.status}).` : `Pat Web UI returned HTTP ${resp.status}.`,
          transcript: "",
        };
      } catch (err) {
        return {
          ok: false,
          message: `Could not reach Pat Web UI: ${err instanceof Error ? err.message : String(err)}`,
          transcript: "",
        };
      }
    }
    const pass = override?.bpq_pass ? override.bpq_pass : db.getSecret("dig_bpq_pass");
    return testBpqTelnetConnection(s.digital, pass);
  });

  ipcMain.handle("digital:defaultSubject", (_e, id: number) => {
    const rg = db.getRadiogram(id);
    if (!rg) throw new Error(`Radiogram #${id} not found`);
    return buildNtsBbsSubject(rg);
  });

  ipcMain.handle("digital:push", async (_e, req: DigitalPushRequest) => {
    const rg = db.getRadiogram(req.radiogram_id);
    if (!rg) throw new Error(`Radiogram #${req.radiogram_id} not found`);
    const s = db.getSettings();
    const pass = db.getSecret("dig_bpq_pass");
    const result = await pushRadiogramDigital(rg, req, s.digital, pass);
    if (result.ok) {
      db.updateRadiogram(rg.id, {
        status: "RELAYED",
        sent_to: req.to_address.trim().toUpperCase(),
        sent_at: currentUtcCompact(),
        sent_mode: req.mode.toUpperCase(),
      });
    }
    return result;
  });

  ipcMain.handle("arl:list", () => ARL_TEXTS);

  ipcMain.handle("rg:list", (_e, opts?: { queue?: QueueView; search?: string; bookId?: number | null }) => {
    return db.listRadiograms(opts?.queue || "all", opts?.search || "", opts?.bookId ?? null);
  });
  ipcMain.handle("rg:counts", () => db.getQueueCounts());
  ipcMain.handle("rg:get", (_e, id: number) => db.getRadiogram(id));
  ipcMain.handle("rg:create", (_e, input: RadiogramInput) => db.createRadiogram(input));
  ipcMain.handle("rg:update", (_e, id: number, patch: RadiogramInput) => db.updateRadiogram(id, patch));
  ipcMain.handle("rg:delete", (_e, id: number) => db.deleteRadiogram(id));
  ipcMain.handle("rg:logs", (_e, id: number) => db.getHandlingLog(id));
  ipcMain.handle("rg:formatText", (_e, id: number) => {
    const rg = db.getRadiogram(id);
    if (!rg) throw new Error(`Radiogram #${id} not found`);
    return formatArrlRadiogramText(rg);
  });
  ipcMain.handle("rg:buildSvcDraft", (_e, id: number, kind: SvcTemplateKind) => {
    const rg = db.getRadiogram(id);
    if (!rg) throw new Error(`Radiogram #${id} not found`);
    const s = db.getSettings();
    return buildServiceMessageDraft(rg, kind, s.operator_call, s.operator_qth);
  });

  ipcMain.handle("book:list", () => db.listBooks());
  ipcMain.handle("book:create", (_e, input: BookCreateInput) => db.createBook(input));
  ipcMain.handle("book:formatText", (_e, bookId: number) => {
    const book = db.listBooks().find((b) => b.id === bookId);
    if (!book) throw new Error(`Book #${bookId} not found`);
    return formatArrlBookText(book.title, db.getBookMembers(bookId));
  });

  ipcMain.handle("stats:sar", (_e, month: string) => db.getMonthlySarStats(month));

  ipcMain.handle("print:radiograms", async (_e, ids: number[], layout: "1up" | "2up" = "1up") => {
    const items = ids
      .map((id) => db.getRadiogram(id))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (!items.length) throw new Error("No radiograms selected for printing");

    const html = buildPrintableHtml(items, layout);
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise<boolean>((resolve) => {
      printWin.webContents.print({ silent: false, printBackground: true }, (success) => {
        if (success) {
          for (const item of items) {
            db.addHandlingLog(item.id, "PRINTED", "", layout.toUpperCase());
          }
        }
        printWin.close();
        resolve(success);
      });
    });
  });
}
