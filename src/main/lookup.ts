import type { CallsignLookupResult } from "../shared/types";

const QRZ_URL = "https://xmldata.qrz.com/xml/current/";
const CALLOOK_URL = "https://callook.info";
const USER_AGENT = "W5CDN-NTSTraffic/0.1.0";

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function extractXmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  if (!m) return "";
  return m[1]
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (entity) => XML_ENTITIES[entity] ?? entity)
    .trim();
}

export class CallsignLookupClient {
  private qrzKey: string | null = null;
  private qrzKeyUser = "";

  resetSession(): void {
    this.qrzKey = null;
    this.qrzKeyUser = "";
  }

  async testQrzLogin(user: string, pass: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; message: string }> {
    const cleanUser = user.trim().toUpperCase();
    if (!cleanUser || !pass) {
      return { ok: false, message: "Enter both QRZ Username and Password to test login." };
    }
    try {
      const url = `${QRZ_URL}?username=${encodeURIComponent(cleanUser)};password=${encodeURIComponent(pass)};agent=${encodeURIComponent(USER_AGENT)}`;
      const resp = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
      if (!resp.ok) {
        return { ok: false, message: `QRZ HTTP ${resp.status}` };
      }
      const xml = await resp.text();
      const key = extractXmlTag(xml, "Key");
      const err = extractXmlTag(xml, "Error");
      const subExp = extractXmlTag(xml, "SubExp");
      if (key) {
        this.qrzKey = key;
        this.qrzKeyUser = cleanUser;
        return {
          ok: true,
          message: `QRZ XML login succeeded for ${cleanUser}${subExp ? ` (SubExp: ${subExp})` : ""}.`,
        };
      }
      return { ok: false, message: err || "QRZ XML login failed (no session key returned)." };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `QRZ connection failed: ${msg}` };
    }
  }

  private async ensureQrzKey(user: string, pass: string, fetchImpl: typeof fetch): Promise<string | null> {
    const cleanUser = user.trim().toUpperCase();
    if (!cleanUser || !pass) return null;
    if (this.qrzKey && this.qrzKeyUser === cleanUser) return this.qrzKey;
    const res = await this.testQrzLogin(cleanUser, pass, fetchImpl);
    return res.ok ? this.qrzKey : null;
  }

  async lookup(
    rawCallsign: string,
    qrzUser: string,
    qrzPass: string,
    fetchImpl: typeof fetch = fetch
  ): Promise<CallsignLookupResult> {
    const call = rawCallsign.trim().toUpperCase();
    if (!call) {
      return {
        found: false,
        source: "none",
        callsign: "",
        name: "",
        address: "",
        city_state_zip: "",
        qth: "",
        grid: "",
        email: "",
        message: "Enter a callsign to look up.",
      };
    }

    // 1. Try QRZ XML API when configured
    const key = await this.ensureQrzKey(qrzUser, qrzPass, fetchImpl);
    if (key) {
      try {
        const url = `${QRZ_URL}?s=${encodeURIComponent(key)};callsign=${encodeURIComponent(call)}`;
        const resp = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
        if (resp.ok) {
          const xml = await resp.text();
          const returnedCall = extractXmlTag(xml, "call");
          if (returnedCall) {
            const fname = extractXmlTag(xml, "fname");
            const lname = extractXmlTag(xml, "name");
            const name = [fname, lname].filter(Boolean).join(" ").trim();
            const addr1 = extractXmlTag(xml, "addr1");
            const addr2 = extractXmlTag(xml, "addr2");
            const state = extractXmlTag(xml, "state");
            const zip = extractXmlTag(xml, "zip");
            const csz = [addr2, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
            const qth = [addr2, state].filter(Boolean).join(", ");
            return {
              found: true,
              source: "qrz",
              callsign: returnedCall.toUpperCase(),
              name: name.toUpperCase(),
              address: addr1.toUpperCase(),
              city_state_zip: csz.toUpperCase(),
              qth: qth.toUpperCase(),
              grid: extractXmlTag(xml, "grid").toUpperCase(),
              email: extractXmlTag(xml, "email"),
            };
          }
        }
      } catch {
        // Fall through to Callook.info
      }
    }

    // 2. Fallback to Callook.info (free US FCC database)
    try {
      const resp = await fetchImpl(`${CALLOOK_URL}/${encodeURIComponent(call)}/json`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          status?: string;
          name?: string;
          current?: { callsign?: string };
          address?: { line1?: string; line2?: string };
          location?: { gridsquare?: string };
        };
        if (data.status === "VALID") {
          const line2 = (data.address?.line2 || "").trim();
          const qth = line2.replace(/\s+\d{5}(?:-\d{4})?$/, "").trim();
          return {
            found: true,
            source: "callook",
            callsign: (data.current?.callsign || call).toUpperCase(),
            name: (data.name || "").trim().toUpperCase(),
            address: (data.address?.line1 || "").trim().toUpperCase(),
            city_state_zip: line2.toUpperCase(),
            qth: qth.toUpperCase(),
            grid: (data.location?.gridsquare || "").trim().toUpperCase(),
            email: "",
          };
        }
      }
    } catch {
      // Offline or unreachable
    }

    return {
      found: false,
      source: "none",
      callsign: call,
      name: "",
      address: "",
      city_state_zip: "",
      qth: "",
      grid: "",
      email: "",
      message: `No record found for ${call}.`,
    };
  }
}
