import { contextBridge, ipcRenderer } from "electron";
import type {
  BookCreateInput,
  DigitalPushRequest,
  QueueView,
  RadiogramInput,
  SettingsUpdatePatch,
  SvcTemplateKind,
} from "../shared/types";

const ntsApi = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch: SettingsUpdatePatch) => ipcRenderer.invoke("settings:update", patch),
  pickFolder: (title?: string) => ipcRenderer.invoke("settings:pickFolder", title),
  openRadiogramsFolder: () => ipcRenderer.invoke("settings:openFolder"),
  exportBackup: () => ipcRenderer.invoke("settings:exportBackup"),
  restoreBackup: () => ipcRenderer.invoke("settings:restoreBackup"),

  lookupCallsign: (callsign: string) => ipcRenderer.invoke("lookup:callsign", callsign),
  testQrzLogin: (creds?: { user?: string; pass?: string }) => ipcRenderer.invoke("lookup:testQrz", creds),

  testDigitalConnection: (override?: { bpq_pass?: string }) => ipcRenderer.invoke("digital:test", override),
  getDefaultBbsSubject: (id: number) => ipcRenderer.invoke("digital:defaultSubject", id),
  pushRadiogramDigital: (req: DigitalPushRequest) => ipcRenderer.invoke("digital:push", req),

  listArlTexts: () => ipcRenderer.invoke("arl:list"),

  listRadiograms: (opts?: { queue?: QueueView; search?: string; bookId?: number | null }) =>
    ipcRenderer.invoke("rg:list", opts),
  getQueueCounts: () => ipcRenderer.invoke("rg:counts"),
  getRadiogram: (id: number) => ipcRenderer.invoke("rg:get", id),
  createRadiogram: (input: RadiogramInput) => ipcRenderer.invoke("rg:create", input),
  updateRadiogram: (id: number, patch: RadiogramInput) => ipcRenderer.invoke("rg:update", id, patch),
  deleteRadiogram: (id: number) => ipcRenderer.invoke("rg:delete", id),
  getHandlingLog: (id: number) => ipcRenderer.invoke("rg:logs", id),
  formatRadiogramText: (id: number) => ipcRenderer.invoke("rg:formatText", id),
  buildSvcDraft: (id: number, kind: SvcTemplateKind) => ipcRenderer.invoke("rg:buildSvcDraft", id, kind),

  listBooks: () => ipcRenderer.invoke("book:list"),
  createBook: (input: BookCreateInput) => ipcRenderer.invoke("book:create", input),
  formatBookText: (bookId: number) => ipcRenderer.invoke("book:formatText", bookId),

  getMonthlySarStats: (month: string) => ipcRenderer.invoke("stats:sar", month),
  printRadiograms: (ids: number[], layout: "1up" | "2up" = "1up") =>
    ipcRenderer.invoke("print:radiograms", ids, layout),
};

contextBridge.exposeInMainWorld("ntsApi", ntsApi);
