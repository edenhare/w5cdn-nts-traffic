import { describe, expect, it } from "vitest";
import {
  ARL_TEXTS,
  buildPrintableHtml,
  buildServiceMessageDraft,
  computeArrlCheck,
  computeHxbExpiryIso,
  formatArrlBookText,
  formatArrlRadiogramText,
  normalizeArrlHx,
  parseHxFlags,
  wrapArrlWords,
} from "../src/shared/arrl";
import type { Radiogram } from "../src/shared/types";

function sampleRadiogram(overrides: Partial<Radiogram> = {}): Radiogram {
  return {
    id: 1,
    book_id: null,
    net_name: "TX TRAFFIC NET",
    msg_number: "101",
    precedence: "P",
    hx: "HXC HXB24",
    station_of_origin: "WM5Q",
    check_text: "ARL 6",
    place_of_origin: "TYLER, TX",
    time_filed: "1620Z",
    date_filed: "NOV 24",
    to_name: "EOC TYLER",
    to_callsign: "W5CDN",
    to_address: "100 E ELM ST",
    to_city_state_zip: "TYLER TX 75702",
    to_phone: "903-555-0100",
    to_email: "",
    message_text: "ARL ONE X SHELTER IS OPEN",
    signature: "WAYNE WM5Q",
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
    hxb_expires_at: "2026-11-25T16:20:00Z",
    file_path: "",
    created_at: "2026-11-24T16:20:00Z",
    updated_at: "2026-11-24T16:20:00Z",
    ...overrides,
  };
}

describe("ARRL NTS engine", () => {
  it("normalizes shorthand HX prosigns", () => {
    expect(normalizeArrlHx("c b24 g")).toBe("HXC HXB24 HXG");
    expect(normalizeArrlHx("HXA   hxd")).toBe("HXA HXD");
    expect(normalizeArrlHx("")).toBe("");
  });

  it("computes plain and ARL-prefixed word checks", () => {
    expect(computeArrlCheck("HELLO WORLD X ALL CLEAR")).toEqual({
      count: 5,
      isArl: false,
      label: "5",
    });
    expect(computeArrlCheck("ARL ONE X EVERYONE SAFE HERE")).toEqual({
      count: 6,
      isArl: true,
      label: "ARL 6",
    });
    expect(computeArrlCheck("ARL 46 BIRTHDAY WISHES")).toEqual({
      count: 4,
      isArl: true,
      label: "ARL 4",
    });
    expect(computeArrlCheck("   ")).toEqual({ count: 0, isArl: false, label: "0" });
  });

  it("parses HXC/HXD service requirements and HXB expiration deadlines", () => {
    expect(parseHxFlags("c b24")).toEqual({
      svcRequired: true,
      hxbHours: 24,
      hasHxc: true,
      hasHxd: false,
    });
    expect(parseHxFlags("HXG")).toEqual({
      svcRequired: false,
      hxbHours: null,
      hasHxc: false,
      hasHxd: false,
    });
    expect(computeHxbExpiryIso("HXB12", "2026-11-24T10:00:00Z")).toBe("2026-11-24T22:00:00Z");
    expect(computeHxbExpiryIso("HXG", "2026-11-24T10:00:00Z")).toBe("");
  });

  it("formats official ARRL plain text, 5-word lines, and Book text", () => {
    expect(wrapArrlWords("ONE TWO THREE FOUR FIVE SIX SEVEN", 5)).toEqual([
      "ONE TWO THREE FOUR FIVE",
      "SIX SEVEN",
    ]);

    const rg = sampleRadiogram();
    const txt = formatArrlRadiogramText(rg);
    expect(txt).toContain("101 P HXC HXB24 WM5Q ARL 6 TYLER, TX 1620Z NOV 24");
    expect(txt).toContain("EOC TYLER W5CDN");
    expect(txt).toContain("BT\nARL ONE X SHELTER IS\nOPEN\nBT");
    expect(txt).toContain("WAYNE WM5Q\nAR");
    expect(txt).toContain("RCVD: WM5Q 1622Z VOICE");

    const bookTxt = formatArrlBookText("SET DRILL", [
      rg,
      sampleRadiogram({ id: 2, msg_number: "102", to_name: "RED CROSS", to_callsign: "K5RC" }),
    ]);
    expect(bookTxt).toContain("BOOK OF 2 P HXC HXB24 WM5Q ARL 6");
    expect(bookTxt).toContain("NR 101 / EOC TYLER W5CDN");
    expect(bookTxt).toContain("NR 102 / RED CROSS K5RC");
  });

  it("builds SVC service message drafts and safe 1-up / 2-up printable HTML", () => {
    const rg = sampleRadiogram({ delivered_at: "1705Z", sent_to: "K5ABC", sent_at: "1650Z" });
    const now = new Date("2026-11-24T17:10:00Z");

    const svcDlvd = buildServiceMessageDraft(rg, "delivered", "W5CDN", "TYLER, TX", now);
    expect(svcDlvd.to_name).toBe("SVC WM5Q");
    expect(svcDlvd.message_text).toContain("ARL FORTY SEVEN 101 TO EOC TYLER DELIVERED 1705Z NOV 24");

    const svcRly = buildServiceMessageDraft(rg, "relayed", "W5CDN", "TYLER, TX", now);
    expect(svcRly.message_text).toContain("RELAYED TO K5ABC AT 1650Z");

    const svcUndel = buildServiceMessageDraft(rg, "undeliverable", "W5CDN", "TYLER, TX", now);
    expect(svcUndel.message_text).toContain("ARL SIXTY SEVEN 101 UNDELIVERABLE");

    const svcHxb = buildServiceMessageDraft(rg, "cancelled_hxb", "W5CDN", "TYLER, TX", now);
    expect(svcHxb.message_text).toContain("CANCELLED PER HXB");

    const html = buildPrintableHtml([sampleRadiogram({ to_name: "A <script> & B" })], "2up");
    expect(html).toContain("ARRL RADIOGRAM");
    expect(html).toContain("A &lt;script&gt; &amp; B");
    expect(html).not.toContain("<script>");
    expect(ARL_TEXTS.length).toBeGreaterThanOrEqual(40);
  });
});
