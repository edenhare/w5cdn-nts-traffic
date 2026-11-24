import type {
  Radiogram,
  RadiogramInput,
  SvcTemplateKind,
} from "./types";

export interface ArlTextItem {
  code: string;
  meaning: string;
}

export const ARL_TEXTS: ArlTextItem[] = [
  { code: "ARL ONE", meaning: "Everyone safe here. Please don't worry." },
  { code: "ARL TWO", meaning: "Coming home as soon as possible." },
  { code: "ARL THREE", meaning: "Am in ___ hospital. Receiving excellent care and recovering fine." },
  { code: "ARL FOUR", meaning: "Only slight property damage here. Do not be concerned about disaster reports." },
  { code: "ARL FIVE", meaning: "Am moving to new location. Send no further mail or communication." },
  { code: "ARL SIX", meaning: "Will contact you as soon as possible." },
  { code: "ARL SEVEN", meaning: "Please reply by Amateur Radio through the amateur delivering this message." },
  { code: "ARL EIGHT", meaning: "Need additional ___ mobile or portable equipment for immediate emergency use." },
  { code: "ARL NINE", meaning: "Additional ___ radio operators needed to assist with emergency at this location." },
  { code: "ARL TEN", meaning: "Please contact ___. Advise to standby and provide further emergency information." },
  { code: "ARL ELEVEN", meaning: "Establish Amateur Radio emergency communications with ___ on ___ MHz." },
  { code: "ARL TWELVE", meaning: "Anxious to hear from you. No word in some time. Please contact me as soon as possible." },
  { code: "ARL THIRTEEN", meaning: "Medical emergency situation exists here." },
  { code: "ARL FOURTEEN", meaning: "Situation here becoming critical. Losses and damage from ___ increasing." },
  { code: "ARL FIFTEEN", meaning: "Please advise your condition and what help is needed." },
  { code: "ARL SIXTEEN", meaning: "Property damage very severe in this area." },
  { code: "ARL SEVENTEEN", meaning: "REACT communications services also available. Establish REACT communication with ___ on channel ___." },
  { code: "ARL EIGHTEEN", meaning: "Please contact me as soon as possible at ___." },
  { code: "ARL NINETEEN", meaning: "Request health and welfare report on ___. (State name, address and telephone number.)" },
  { code: "ARL TWENTY", meaning: "Temporarily stranded. Will need some assistance. Please contact me at ___." },
  { code: "ARL TWENTY ONE", meaning: "Search and Rescue assistance is needed by local authorities here." },
  { code: "ARL TWENTY TWO", meaning: "Need accurate information on the extent and type of conditions now existing at your location." },
  { code: "ARL TWENTY THREE", meaning: "Report at once the accessibility and best way to reach your location." },
  { code: "ARL TWENTY FOUR", meaning: "Evacuation of residents from this area urgently needed." },
  { code: "ARL TWENTY FIVE", meaning: "Furnish as soon as possible the weather conditions at your location." },
  { code: "ARL TWENTY SIX", meaning: "Help and care for evacuation of sick and injured from this location needed at once." },
  { code: "ARL FORTY SIX", meaning: "Greetings on your birthday and best wishes for many more to come." },
  { code: "ARL FORTY SEVEN", meaning: "Reference your message number ___ to ___ delivered on ___ at ___ UTC." },
  { code: "ARL FIFTY", meaning: "Greetings by Amateur Radio." },
  { code: "ARL FIFTY ONE", meaning: "Greetings by Amateur Radio. This message is sent as a free public service by ham radio operators." },
  { code: "ARL FIFTY TWO", meaning: "Really enjoyed being with you. Looking forward to getting together again." },
  { code: "ARL FIFTY THREE", meaning: "Received your ___. It's appreciated; many thanks." },
  { code: "ARL FIFTY FOUR", meaning: "Many thanks for your good wishes." },
  { code: "ARL FIFTY FIVE", meaning: "Good news is always welcome. Very delighted to hear about yours." },
  { code: "ARL FIFTY SIX", meaning: "Congratulations on your ___, a most worthy and deserved achievement." },
  { code: "ARL FIFTY SEVEN", meaning: "Wish we could be together." },
  { code: "ARL FIFTY EIGHT", meaning: "Have a wonderful time. Let us know when you return." },
  { code: "ARL FIFTY NINE", meaning: "Congratulations on the new arrival. Hope mother and child are well." },
  { code: "ARL SIXTY", meaning: "Wishing you the best of everything on ___." },
  { code: "ARL SIXTY ONE", meaning: "Wishing you a very Merry Christmas and a Happy New Year." },
  { code: "ARL SIXTY TWO", meaning: "Greetings and best wishes to you for a pleasant ___ holiday season." },
  { code: "ARL SIXTY THREE", meaning: "Victory or defeat, our best wishes are with you. Hope you win." },
  { code: "ARL SIXTY FOUR", meaning: "Arrived safely at ___." },
  { code: "ARL SIXTY FIVE", meaning: "Arriving ___ on ___. Please arrange to meet me there." },
  { code: "ARL SIXTY SIX", meaning: "DX QSLs are on hand for you at the ___ QSL Bureau." },
  { code: "ARL SIXTY SEVEN", meaning: "Your message number ___ undeliverable because of ___. Please advise." },
  { code: "ARL SIXTY EIGHT", meaning: "Sorry to hear you are ill. Best wishes for a speedy recovery." },
  { code: "ARL SIXTY NINE", meaning: "Welcome to the ___. We are glad to have you with us." },
  { code: "ARL SEVENTY", meaning: "Congratulations on your new amateur license. Welcome to the hobby." },
];

const ARL_NUMBER_WORDS = new Set([
  "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
  "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN",
  "EIGHTEEN", "NINETEEN", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY",
]);

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function utcNowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function currentUtcCompact(date: Date = new Date()): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}${mm}Z`;
}

export function currentUtcDateShort(date: Date = new Date()): string {
  const mon = MONTHS_SHORT[date.getUTCMonth()];
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${mon} ${day}`;
}

export function normalizeArrlHx(raw: string): string {
  const cleaned = (raw || "").trim().toUpperCase();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map((tok) => (/^[A-G]\d*$/.test(tok) ? `HX${tok}` : tok))
    .join(" ");
}

export function computeArrlCheck(text: string): { count: number; isArl: boolean; label: string } {
  const tokens = (text || "").trim().split(/\s+/).filter(Boolean);
  const count = tokens.length;
  const upper = tokens.map((t) => t.toUpperCase());
  const isArl = upper.some(
    (tok, i) =>
      tok === "ARL" &&
      i + 1 < upper.length &&
      (ARL_NUMBER_WORDS.has(upper[i + 1]) || /^\d+$/.test(upper[i + 1]))
  );
  const label = isArl && count > 0 ? `ARL ${count}` : String(count);
  return { count, isArl, label };
}

export interface HxFlags {
  svcRequired: boolean;
  hxbHours: number | null;
  hasHxc: boolean;
  hasHxd: boolean;
}

export function parseHxFlags(hxRaw: string): HxFlags {
  const tokens = normalizeArrlHx(hxRaw).split(/\s+/).filter(Boolean);
  let hasHxc = false;
  let hasHxd = false;
  let hxbHours: number | null = null;
  for (const tok of tokens) {
    if (tok === "HXC") hasHxc = true;
    if (tok === "HXD") hasHxd = true;
    const bMatch = /^HXB(\d+)$/.exec(tok);
    if (bMatch) {
      const hrs = Number.parseInt(bMatch[1], 10);
      if (hrs > 0 && hrs <= 720) hxbHours = hrs;
    }
  }
  return {
    svcRequired: hasHxc || hasHxd,
    hxbHours,
    hasHxc,
    hasHxd,
  };
}

export function computeHxbExpiryIso(hxRaw: string, baseIso: string): string {
  const { hxbHours } = parseHxFlags(hxRaw);
  if (!hxbHours) return "";
  const baseMs = Date.parse(baseIso);
  if (Number.isNaN(baseMs)) return "";
  return new Date(baseMs + hxbHours * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function wrapArrlWords(text: string, wordsPerLine = 5): string[] {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(" "));
  }
  return lines;
}

export function formatArrlRadiogramText(rg: Radiogram): string {
  const preambleParts = [
    rg.msg_number || "1",
    rg.precedence || "R",
    rg.hx || "",
    rg.station_of_origin || "",
    rg.check_text || computeArrlCheck(rg.message_text).label,
    rg.place_of_origin || "",
    rg.time_filed || "",
    rg.date_filed || "",
  ].filter(Boolean);

  const lines: string[] = [preambleParts.join(" ")];

  const addresseeLines = [
    [rg.to_name, rg.to_callsign].filter(Boolean).join(" "),
    rg.to_address,
    rg.to_city_state_zip,
    rg.to_phone,
    rg.to_email,
  ]
    .map((ln) => (ln || "").trim())
    .filter(Boolean);

  lines.push(...addresseeLines);
  lines.push("BT");
  lines.push(...wrapArrlWords(rg.message_text, 5));
  lines.push("BT");
  if (rg.signature) lines.push(rg.signature.trim());
  lines.push("AR");

  const handling: string[] = [];
  if (rg.received_from || rg.received_at) {
    handling.push(`RCVD: ${[rg.received_from, rg.received_at, rg.received_mode].filter(Boolean).join(" ")}`);
  }
  if (rg.sent_to || rg.sent_at) {
    handling.push(`SENT: ${[rg.sent_to, rg.sent_at, rg.sent_mode].filter(Boolean).join(" ")}`);
  }
  if (rg.delivered_at || rg.delivery_method) {
    handling.push(`DLVD: ${[rg.delivery_method, rg.delivered_at].filter(Boolean).join(" ")}`);
  }
  if (handling.length) {
    lines.push("");
    lines.push("--- HANDLING ---");
    lines.push(...handling);
  }
  return lines.join("\n") + "\n";
}

export function formatArrlBookText(title: string, members: Radiogram[]): string {
  if (!members.length) return "";
  const first = members[0];
  const sharedHeader = [
    "BOOK OF",
    String(members.length),
    first.precedence || "R",
    first.hx || "",
    first.station_of_origin || "",
    first.check_text || computeArrlCheck(first.message_text).label,
    first.place_of_origin || "",
    first.time_filed || "",
    first.date_filed || "",
  ]
    .filter(Boolean)
    .join(" ");

  const lines: string[] = [
    `=== ARRL BOOK MESSAGE: ${title.toUpperCase()} ===`,
    sharedHeader,
    "BT",
    ...wrapArrlWords(first.message_text, 5),
    "BT",
  ];
  if (first.signature) lines.push(first.signature.trim());
  lines.push("BT");
  lines.push("");
  for (const m of members) {
    const addr = [
      `NR ${m.msg_number}`,
      [m.to_name, m.to_callsign].filter(Boolean).join(" "),
      m.to_address,
      m.to_city_state_zip,
      m.to_phone,
      `[${m.status}]`,
    ]
      .filter(Boolean)
      .join(" / ");
    lines.push(addr);
  }
  lines.push("AR");
  return lines.join("\n") + "\n";
}

export function buildServiceMessageDraft(
  source: Radiogram,
  kind: SvcTemplateKind,
  operatorCall: string,
  operatorQth: string,
  now: Date = new Date()
): RadiogramInput {
  const timeNow = currentUtcCompact(now);
  const dateNow = currentUtcDateShort(now);
  const target = source.to_name || "ADDRESSEE";
  let body = "";
  if (kind === "delivered") {
    body = `ARL FORTY SEVEN ${source.msg_number} TO ${target} DELIVERED ${source.delivered_at || timeNow} ${dateNow}`;
  } else if (kind === "relayed") {
    body = `YOUR NR ${source.msg_number} ${source.date_filed} TO ${target} RELAYED TO ${source.sent_to || "NEXT STATION"} AT ${source.sent_at || timeNow}`;
  } else if (kind === "cancelled_hxb") {
    body = `YOUR NR ${source.msg_number} ${source.date_filed} TO ${target} CANCELLED PER HXB UNABLE TO DELIVER IN TIME`;
  } else {
    body = `ARL SIXTY SEVEN ${source.msg_number} UNDELIVERABLE BECAUSE NO ANSWER X PLEASE ADVISE`;
  }

  return {
    net_name: source.net_name,
    precedence: "R",
    hx: "",
    station_of_origin: operatorCall.toUpperCase(),
    place_of_origin: operatorQth.toUpperCase(),
    time_filed: timeNow,
    date_filed: dateNow,
    to_name: `SVC ${source.station_of_origin}`,
    to_callsign: source.station_of_origin,
    to_city_state_zip: source.place_of_origin,
    message_text: body.toUpperCase(),
    signature: operatorCall.toUpperCase(),
    direction: "ORIGINATED",
    status: "LISTED",
  };
}

function escHtml(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSingleRadiogramCardHtml(rg: Radiogram): string {
  const words = (rg.message_text || "").trim().split(/\s+/).filter(Boolean);
  const gridCells: string[] = [];
  const totalSlots = Math.max(25, Math.ceil(words.length / 5) * 5);
  for (let i = 0; i < totalSlots; i += 1) {
    gridCells.push(`<div class="rg-word-cell"><span>${escHtml(words[i] || "")}</span></div>`);
  }
  return `
  <section class="rg-sheet">
    <header class="rg-sheet-head">
      <div class="rg-sheet-title">ARRL RADIOGRAM</div>
      <div class="rg-sheet-sub">VIA AMATEUR RADIO — NATIONAL TRAFFIC SYSTEM</div>
    </header>
    <table class="rg-preamble">
      <thead>
        <tr>
          <th>NUMBER</th><th>PRECEDENCE</th><th>HX</th><th>STATION OF ORIGIN</th>
          <th>CHECK</th><th>PLACE OF ORIGIN</th><th>TIME FILED</th><th>DATE</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escHtml(rg.msg_number)}</td>
          <td>${escHtml(rg.precedence)}</td>
          <td>${escHtml(rg.hx)}</td>
          <td>${escHtml(rg.station_of_origin)}</td>
          <td>${escHtml(rg.check_text)}</td>
          <td>${escHtml(rg.place_of_origin)}</td>
          <td>${escHtml(rg.time_filed)}</td>
          <td>${escHtml(rg.date_filed)}</td>
        </tr>
      </tbody>
    </table>
    <div class="rg-to-block">
      <div class="rg-label">TO:</div>
      <div class="rg-to-lines">
        <div><strong>${escHtml([rg.to_name, rg.to_callsign].filter(Boolean).join(" "))}</strong></div>
        <div>${escHtml(rg.to_address)}</div>
        <div>${escHtml(rg.to_city_state_zip)}</div>
        <div>${escHtml([rg.to_phone, rg.to_email].filter(Boolean).join(" • "))}</div>
      </div>
    </div>
    <div class="rg-grid">${gridCells.join("")}</div>
    <div class="rg-sig"><strong>SIGNATURE:</strong> ${escHtml(rg.signature)}</div>
    <div class="rg-handling">
      <div><strong>RCVD FROM:</strong> ${escHtml(rg.received_from)} &nbsp; <strong>UTC:</strong> ${escHtml(rg.received_at)} &nbsp; <strong>MODE:</strong> ${escHtml(rg.received_mode)}</div>
      <div><strong>SENT TO:</strong> ${escHtml(rg.sent_to)} &nbsp; <strong>UTC:</strong> ${escHtml(rg.sent_at)} &nbsp; <strong>STATUS:</strong> ${escHtml(rg.status)}</div>
    </div>
  </section>`;
}

export function buildPrintableHtml(radiograms: Radiogram[], layout: "1up" | "2up" = "1up"): string {
  const cards = radiograms.map(renderSingleRadiogramCardHtml).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>ARRL Radiogram Print (${layout})</title>
<style>
  @page { size: letter portrait; margin: 0.4in; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  .rg-sheet {
    border: 2px solid #111; padding: 12px 14px; margin-bottom: 14px;
    page-break-inside: avoid;
    ${layout === "2up" ? "font-size: 11px; padding: 8px 10px; margin-bottom: 10px;" : "font-size: 13px;"}
  }
  .rg-sheet-head { text-align: center; border-bottom: 1.5px solid #111; padding-bottom: 4px; margin-bottom: 8px; }
  .rg-sheet-title { font-size: 1.35em; font-weight: 800; letter-spacing: 0.08em; }
  .rg-sheet-sub { font-size: 0.78em; letter-spacing: 0.06em; }
  .rg-preamble { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .rg-preamble th, .rg-preamble td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
  .rg-preamble th { font-size: 0.7em; background: #eee; }
  .rg-preamble td { font-family: Consolas, monospace; font-weight: 700; }
  .rg-to-block { display: flex; gap: 8px; border: 1px solid #333; padding: 6px 8px; margin-bottom: 8px; min-height: 46px; }
  .rg-label { font-weight: 800; }
  .rg-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }
  .rg-word-cell { border-bottom: 1px solid #333; min-height: 22px; padding: 2px 3px; font-family: Consolas, monospace; font-weight: 600; }
  .rg-sig { border-top: 1px solid #333; padding-top: 5px; margin-bottom: 6px; font-family: Consolas, monospace; }
  .rg-handling { display: flex; justify-content: space-between; gap: 8px; border-top: 1px dashed #666; padding-top: 5px; font-size: 0.85em; }
</style>
</head>
<body>${cards}</body>
</html>`;
}
