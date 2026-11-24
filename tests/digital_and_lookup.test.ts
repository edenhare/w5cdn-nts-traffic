import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildNtsBbsSubject, pushRadiogramDigital, testBpqTelnetConnection } from "../src/main/digital";
import { CallsignLookupClient } from "../src/main/lookup";
import type { DigitalRoutingSettings, Radiogram } from "../src/shared/types";

function sampleRg(): Radiogram {
  return {
    id: 7,
    book_id: null,
    net_name: "TX TRAFFIC NET",
    msg_number: "105",
    precedence: "P",
    hx: "HXC",
    station_of_origin: "WM5Q",
    check_text: "5",
    place_of_origin: "TYLER, TX",
    time_filed: "1620Z",
    date_filed: "NOV 24",
    to_name: "EOC TYLER",
    to_callsign: "W5CDN",
    to_address: "100 E ELM",
    to_city_state_zip: "TYLER, TX 75702",
    to_phone: "903-555-0100",
    to_email: "eoc@example.org",
    message_text: "SHELTER OPEN X ALL CLEAR",
    signature: "WM5Q",
    direction: "INBOUND",
    status: "LISTED",
    received_from: "WM5Q",
    received_at: "1622Z",
    received_mode: "VOICE",
    sent_to: "",
    sent_at: "",
    sent_mode: "",
    delivered_at: "",
    delivery_method: "",
    delivery_notes: "",
    svc_required: true,
    svc_sent_at: "",
    hxb_expires_at: "",
    file_path: "",
    created_at: "2026-11-24T16:20:00Z",
    updated_at: "2026-11-24T16:20:00Z",
  };
}

function startMockBpqServer(): Promise<{ port: number; received: string[]; close: () => Promise<void> }> {
  const received: string[] = [];
  const server = net.createServer((socket) => {
    socket.setEncoding("utf-8");
    let stage = "user";
    socket.write("user:");
    let buf = "";
    socket.on("data", (chunk: string) => {
      buf += chunk;
      while (buf.includes("\n")) {
        const idx = buf.indexOf("\n");
        const line = buf.slice(0, idx).replace(/\r/g, "");
        buf = buf.slice(idx + 1);
        received.push(line);
        if (stage === "user") {
          stage = "pass";
          socket.write("password:");
        } else if (stage === "pass") {
          stage = "node";
          socket.write("Connected to W5CDN Node\r\n");
        } else if (line.toUpperCase() === "BBS") {
          stage = "bbs";
          socket.write("de W5CDN>\r\n");
        } else if (/^S[PT]\s+/i.test(line)) {
          stage = "subject";
          socket.write("Enter Title (only):\r\n");
        } else if (stage === "subject") {
          stage = "body";
          socket.write("Enter Message Text (end with /ex):\r\n");
        } else if (stage === "body" && line.trim().toUpperCase() === "/EX") {
          stage = "bbs";
          socket.write("Message: 42 Saved\r\nde W5CDN>\r\n");
        } else if (line.trim().toUpperCase() === "B") {
          socket.write("73 Bye\r\n");
          socket.end();
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        received,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

describe("QRZ / Callook lookup & Digital Packet/Winlink delivery", () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length) {
      await cleanups.pop()?.();
    }
  });

  it("supports QRZ XML login + lookup and Callook.info fallback", async () => {
    const mockFetch = (async (input: string | URL | Request) => {
      const parsed = new URL(String(input));
      if (parsed.hostname === "xmldata.qrz.com" && parsed.search.includes("password=")) {
        return new Response(
          "<QRZDatabase><Session><Key>KEY123</Key><SubExp>2027-01-01</SubExp></Session></QRZDatabase>",
          { status: 200 }
        );
      }
      if (parsed.hostname === "xmldata.qrz.com" && parsed.search.includes("callsign=W5CDN")) {
        return new Response(
          "<QRZDatabase><Callsign><call>W5CDN</call><fname>Eden</fname><name>Hare</name><addr1>100 Main</addr1><addr2>Tyler</addr2><state>TX</state><zip>75701</zip><grid>EM22</grid><email>w5cdn@example.org</email></Callsign></QRZDatabase>",
          { status: 200 }
        );
      }
      if (parsed.hostname === "callook.info" && parsed.pathname === "/K5TST/json") {
        return new Response(
          JSON.stringify({
            status: "VALID",
            name: "TEST OPERATOR",
            current: { callsign: "K5TST" },
            address: { line1: "200 Oak St", line2: "Austin, TX 78701" },
            location: { gridsquare: "EM10dg" },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    const client = new CallsignLookupClient();
    const login = await client.testQrzLogin("W5CDN", "secret", mockFetch);
    expect(login.ok).toBe(true);

    const qrzRes = await client.lookup("w5cdn", "W5CDN", "secret", mockFetch);
    expect(qrzRes.found).toBe(true);
    expect(qrzRes.source).toBe("qrz");
    expect(qrzRes.name).toBe("EDEN HARE");
    expect(qrzRes.city_state_zip).toBe("TYLER, TX 75701");

    const callookRes = await client.lookup("k5tst", "", "", mockFetch);
    expect(callookRes.found).toBe(true);
    expect(callookRes.source).toBe("callook");
    expect(callookRes.name).toBe("TEST OPERATOR");
    expect(callookRes.qth).toBe("AUSTIN, TX");
  });

  it("tests LinBPQ Telnet connection and pushes Packet (ST) & Winlink (SP RMS:) radiograms", async () => {
    const bpq = await startMockBpqServer();
    cleanups.push(bpq.close);

    const cfg: DigitalRoutingSettings = {
      packet_enabled: true,
      winlink_enabled: true,
      method: "bpq_telnet",
      default_to: "TXNTS",
      bpq_host: "127.0.0.1",
      bpq_port: bpq.port,
      bpq_bbs_cmd: "BBS",
      bpq_user: "W5CDN",
      bpq_pass_set: true,
      bpq_nts_type: "ST",
      bpq_wl_prefix: "RMS:",
      bpq_webmail_url: "",
      pat_url: "",
      outbox_dir: "",
    };

    const testRes = await testBpqTelnetConnection(cfg, "pass123");
    expect(testRes.ok).toBe(true);
    expect(testRes.transcript).toContain("Connected to W5CDN Node");

    const rg = sampleRg();
    expect(buildNtsBbsSubject(rg)).toBe("75702 TYLER TX P NR 105 W5CDN");

    const pktRes = await pushRadiogramDigital(
      rg,
      { radiogram_id: rg.id, mode: "packet", to_address: "TXNTS", bbs_type: "ST" },
      cfg,
      "pass123"
    );
    expect(pktRes.ok).toBe(true);
    expect(bpq.received).toContain("ST TXNTS");

    const wlRes = await pushRadiogramDigital(
      rg,
      { radiogram_id: rg.id, mode: "winlink", to_address: "W5STM@WINLINK.ORG" },
      cfg,
      "pass123"
    );
    expect(wlRes.ok).toBe(true);
    expect(bpq.received).toContain("SP RMS:W5STM@WINLINK.ORG");
  });

  it("stages radiogram files in Outbox folder mode", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nts-outbox-"));
    cleanups.push(() => fs.rmSync(tmp, { recursive: true, force: true }));

    const cfg: DigitalRoutingSettings = {
      packet_enabled: true,
      winlink_enabled: false,
      method: "outbox",
      default_to: "TXNTS",
      bpq_host: "",
      bpq_port: 8010,
      bpq_bbs_cmd: "BBS",
      bpq_user: "",
      bpq_pass_set: false,
      bpq_nts_type: "SP",
      bpq_wl_prefix: "RMS:",
      bpq_webmail_url: "",
      pat_url: "",
      outbox_dir: tmp,
    };

    const res = await pushRadiogramDigital(
      sampleRg(),
      { radiogram_id: 7, mode: "packet", to_address: "K5ABC@W5CDN" },
      cfg,
      ""
    );
    expect(res.ok).toBe(true);
    expect(res.file_path && fs.existsSync(res.file_path)).toBe(true);
    const txt = fs.readFileSync(res.file_path!, "utf-8");
    expect(txt).toContain("TO: K5ABC@W5CDN");
    expect(txt).toContain("SHELTER OPEN X ALL CLEAR");
  });
});
