import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { formatArrlRadiogramText } from "../shared/arrl";
import type {
  BpqNtsType,
  DigitalPushRequest,
  DigitalPushResult,
  DigitalRoutingSettings,
  DigitalTestResult,
  Radiogram,
} from "../shared/types";

export function buildNtsBbsSubject(rg: Radiogram): string {
  const csz = (rg.to_city_state_zip || "").trim().toUpperCase();
  const zipMatch = /\b(\d{5})\b/.exec(csz);
  const zip = zipMatch ? zipMatch[1] : "";
  const cityState = csz.replace(/\b\d{5}(?:-\d{4})?\b/, "").replace(/,/g, "").trim();
  const loc = [zip, cityState].filter(Boolean).join(" ").trim() || rg.to_name || "NTS";
  const prec = rg.precedence || "R";
  const destCall = rg.to_callsign || rg.to_name || "";
  return `${loc} ${prec} NR ${rg.msg_number}${destCall ? ` ${destCall}` : ""}`.trim().slice(0, 60);
}

class TelnetSession {
  private socket: net.Socket;
  private buffer = "";
  private transcript = "";
  private waiters: Array<{
    check: (buf: string) => boolean;
    resolve: (buf: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];
  private closed = false;

  constructor(host: string, port: number) {
    this.socket = net.createConnection({ host, port });
    this.socket.setEncoding("utf-8");
    this.socket.on("data", (chunk: string) => {
      const cleaned = chunk.replace(/\r/g, "");
      this.buffer += cleaned;
      this.transcript += cleaned;
      this.flushWaiters();
    });
    this.socket.on("error", (err) => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) {
        clearTimeout(w.timer);
        w.reject(err);
      }
    });
    this.socket.on("close", () => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) {
        clearTimeout(w.timer);
        w.resolve(this.buffer);
      }
    });
  }

  private flushWaiters(): void {
    for (let i = this.waiters.length - 1; i >= 0; i -= 1) {
      const w = this.waiters[i];
      if (w.check(this.buffer)) {
        clearTimeout(w.timer);
        this.waiters.splice(i, 1);
        w.resolve(this.buffer);
      }
    }
  }

  waitConnect(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Telnet connection timed out")), timeoutMs);
      this.socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  waitFor(pattern: RegExp, timeoutMs = 4500): Promise<string> {
    if (pattern.test(this.buffer) || this.closed) {
      const out = this.buffer;
      this.buffer = "";
      return Promise.resolve(out);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) this.waiters.splice(idx, 1);
        const out = this.buffer;
        this.buffer = "";
        resolve(out);
      }, timeoutMs);
      this.waiters.push({
        check: (b) => pattern.test(b),
        resolve: (b) => {
          this.buffer = "";
          resolve(b);
        },
        reject,
        timer,
      });
    });
  }

  sendLine(line: string): void {
    if (!this.closed) {
      this.socket.write(`${line}\r\n`);
      this.transcript += `> ${line}\n`;
    }
  }

  getTranscript(): string {
    return this.transcript.trim();
  }

  close(): void {
    this.closed = true;
    this.socket.destroy();
  }
}

export async function testBpqTelnetConnection(
  cfg: DigitalRoutingSettings,
  bpqPass: string
): Promise<DigitalTestResult> {
  if (!cfg.bpq_host || !cfg.bpq_port || !cfg.bpq_user) {
    return {
      ok: false,
      message: "Enter BBS Host, Port, and Telnet Username first.",
      transcript: "",
    };
  }
  const sess = new TelnetSession(cfg.bpq_host, cfg.bpq_port);
  try {
    await sess.waitConnect(5000);
    await sess.waitFor(/user|callsign|login|:/i, 3000);
    sess.sendLine(cfg.bpq_user);
    const afterUser = await sess.waitFor(/pass|connected|de\s|>/i, 3000);
    if (/pass/i.test(afterUser) && bpqPass) {
      sess.sendLine(bpqPass);
      await sess.waitFor(/connected|de\s|>|\$/i, 3000);
    }
    if (cfg.bpq_bbs_cmd.trim()) {
      sess.sendLine(cfg.bpq_bbs_cmd.trim());
      await sess.waitFor(/de\s|>|\$/i, 3000);
    }
    sess.sendLine("B");
    await sess.waitFor(/bye|73/i, 1200);
    const transcript = sess.getTranscript();
    if (/invalid|denied|bad\s+pass/i.test(transcript)) {
      return { ok: false, message: "BBS rejected username or password.", transcript };
    }
    return {
      ok: true,
      message: `Connected to ${cfg.bpq_host}:${cfg.bpq_port} as ${cfg.bpq_user}.`,
      transcript,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Telnet test failed: ${msg}`, transcript: sess.getTranscript() };
  } finally {
    sess.close();
  }
}

export async function pushRadiogramDigital(
  rg: Radiogram,
  req: DigitalPushRequest,
  cfg: DigitalRoutingSettings,
  bpqPass: string
): Promise<DigitalPushResult> {
  const dest = (req.to_address || cfg.default_to || "").trim().toUpperCase();
  if (!dest) {
    return {
      ok: false,
      message:
        req.mode === "packet"
          ? "Enter a Packet receiving station ID / BBS address."
          : "Enter a Winlink destination address.",
    };
  }

  const subject = (req.subject || buildNtsBbsSubject(rg)).trim();
  const body = formatArrlRadiogramText(rg);

  if (cfg.method === "outbox" || cfg.method === "pat") {
    const outDir = path.resolve(cfg.outbox_dir || "outbox");
    fs.mkdirSync(outDir, { recursive: true });
    const slug = `${req.mode}_NR${rg.msg_number}_${Date.now()}.txt`.replace(/[^A-Za-z0-9._-]/g, "_");
    const target = path.join(outDir, slug);
    const content = `TO: ${dest}\nSUBJECT: ${subject}\nMODE: ${req.mode.toUpperCase()}\n\n${body}`;
    fs.writeFileSync(target, content, "utf-8");
    return {
      ok: true,
      message: `Staged ${req.mode.toUpperCase()} message to ${dest} in ${outDir}.`,
      file_path: target,
    };
  }

  // Direct LinBPQ / BPQ32 Telnet push
  if (!cfg.bpq_host || !cfg.bpq_port || !cfg.bpq_user) {
    return { ok: false, message: "Configure LinBPQ Host, Port, and Username in Settings → Packet / Winlink." };
  }

  const bbsType: BpqNtsType = req.mode === "winlink" ? "SP" : req.bbs_type || cfg.bpq_nts_type || "SP";
  const wlPrefix = (cfg.bpq_wl_prefix || "RMS:").trim().toUpperCase();
  const bbsDest =
    req.mode === "winlink" && wlPrefix && !dest.startsWith(wlPrefix) ? `${wlPrefix}${dest}` : dest;

  const sess = new TelnetSession(cfg.bpq_host, cfg.bpq_port);
  try {
    await sess.waitConnect(5000);
    await sess.waitFor(/user|callsign|login|:/i, 3000);
    sess.sendLine(cfg.bpq_user);
    const afterUser = await sess.waitFor(/pass|connected|de\s|>/i, 3000);
    if (/pass/i.test(afterUser) && bpqPass) {
      sess.sendLine(bpqPass);
      await sess.waitFor(/connected|de\s|>|\$/i, 3000);
    }
    if (cfg.bpq_bbs_cmd.trim()) {
      sess.sendLine(cfg.bpq_bbs_cmd.trim());
      await sess.waitFor(/de\s|>|\$/i, 3000);
    }
    sess.sendLine(`${bbsType} ${bbsDest}`);
    await sess.waitFor(/title|subject|:/i, 3000);
    sess.sendLine(subject);
    await sess.waitFor(/enter|text|\/ex|ctrl/i, 3000);
    for (const line of body.split(/\r?\n/)) {
      sess.sendLine(line);
    }
    sess.sendLine("/EX");
    await sess.waitFor(/saved|message|de\s|>/i, 3000);
    sess.sendLine("B");
    await sess.waitFor(/bye|73/i, 1200);
    return {
      ok: true,
      message: `Submitted ${bbsType} ${bbsDest} via LinBPQ (${cfg.bpq_host}:${cfg.bpq_port}).`,
      transcript: sess.getTranscript(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `LinBPQ push failed: ${msg}`,
      transcript: sess.getTranscript(),
    };
  } finally {
    sess.close();
  }
}
