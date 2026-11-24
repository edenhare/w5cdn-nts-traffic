# Specification: Standalone ARRL NTS Radiogram & Traffic Manager App

> **Status:** Draft Proposal for Review  
> **Working Name:** `w5cdn-nts-traffic` (W5CDN NTS Traffic Manager)  
> **Companion App:** `w5cdn-net-logger` (Net Control Station Logger)

---

## 1. Purpose & Separation of Concerns

During an active Amateur Radio net (ARES, RACES, Skywarn, or NTS section/local nets), the **Net Control Station (NCS)** and the **Traffic Handler / Relay / Liaison Station** perform two fundamentally different operational roles:

| Role | Primary Focus | Best Tool |
|---|---|---|
| **NCS Operator** | Fast check-ins, roll calls, chronological Net Report, Skywarn/NWS alerts, ICS-214, assigning stations off-frequency to pass traffic | **`w5cdn-net-logger`** (focused on running the net) |
| **Traffic Handler / Liaison / EOC Message Desk** | Copying formal ARRL Radiograms at voice/CW/digital speed, handling **Book Messages**, tracking relay/delivery queues, generating `HXC`/`HXD` service messages, sending via Packet BBS / Winlink / FLMSG, and compiling monthly SAR / PSHR / BPL reports | **`w5cdn-nts-traffic`** (dedicated standalone app) |

Splitting heavy formal traffic handling into its own dedicated application keeps `w5cdn-net-logger` lean and uncluttered for NCS operations, while giving traffic handlers a purpose-built, keyboard-first workspace designed around the full ARRL National Traffic System (NTS) lifecycle.

---

## 2. Target Users & Operational Scenarios

1. **NTS Traffic Handlers & Relay Stations** — Receiving 5–20 messages on a section/region net, holding them in an outbound queue, relaying via VHF/HF voice, CW, Packet BBS (LinBPQ), or Winlink, and tracking `HXC`/`HXD` service replies.
2. **EOC / ARES / RACES Message Center Operators** — Rapidly entering inbound and outbound formal traffic (ARRL Radiogram + ICS-213), printing hard copies for served-agency clipboards, and logging delivery times and recipient confirmations.
3. **Traffic Managers & Net Managers** — Generating monthly **SAR** (Station Activity Report), **BPL** (Brass Pounders League), **PSHR** (Public Service Honor Roll), and Net Traffic summaries without manual counting.
4. **Occasional NCS / Small-Net Operators** — Can either use the lightweight built-in radiogram modal in `w5cdn-net-logger` or point both apps at the same shared `radiograms/` routing folder.

---

## 3. Core Functional Requirements

### 3.1 Keyboard-First ARRL Radiogram Composer & Fast Copy Mode
- **Full ARRL Preamble:**
  - `NR` (auto-incrementing per operator/station, editable for copied inbound traffic)
  - `Precedence` (`R`, `W`, `P`, `EMERGENCY`, plus `TEST R` / `TEST P` for drills/SET)
  - `HX` Handling Instructions (`HXA`–`HXG` with quick-toggle chips & tooltips; auto-normalizes `C` → `HXC`)
  - `Station of Origin`, `Check` (live auto-calculated ARRL word count with automatic `ARL` prefix when ARL numbered texts are used), `Place of Origin`, `Time Filed (UTC)`, `Date Filed (MMM DD)`
- **Addressee & Contact Block:**
  - Name, Street Address, City/State/ZIP, Telephone, Email, Amateur Callsign (optional)
  - Local **Address Book / Served Agency Directory** autocomplete (frequent EOCs, Section Traffic Managers, Red Cross chapters, repeat recipients)
- **Message Body (`BT ... BT`):**
  - Native spellcheck enabled (`spellcheck="true"`), uppercase display/export option (classic NTS format) with readable input
  - Live ARRL Check word counter + 25-word advisory indicator
  - One-keystroke **`X`** period separator shortcut (e.g., `Ctrl+.` or toolbar button) and searchable **Complete ARL Numbered Radiogram Text** library (`ARL ONE` through `ARL SEVENTY`, with fill-in-the-blank prompts)
  - Voice phonetics helper panel (optional toggle for reading out tricky callsigns/groups on-air)
- **Rapid Multi-Message Entry (`Save & Add Another`):**
  - Preserves `Received From`, `Rcvd Net / Freq`, and optionally `Station/Place of Origin` while clearing addressee/body and stamping fresh UTC time so an operator can copy a whole stack of inbound traffic back-to-back without touching the mouse.

### 3.2 Book Messages (High-Value NTS Feature)
- Create a **Book** (shared precedence, `HX`, origin, text, and signature) paired with a table of **2 to 50+ addressees** (entered manually or pasted from CSV).
- Automatically assigns sequential message numbers (`NR 101`–`NR 115`) and allows:
  - Sending/printing in official **ARRL Book Format** (shared header/text once + numbered list of addressees) to save air time.
  - Tracking **individual delivery/relay status per addressee** (e.g., 12 delivered, 2 relayed, 1 undeliverable).

### 3.3 Queue-Driven Traffic Board (Inbox / Outbox / Follow-Up)
Instead of a single flat list, organize traffic by operational action needed:
- **Needs Action (Inbox / Listed):** Received messages waiting to be delivered locally or relayed onward.
- **Ready for Relay (Outbox):** Grouped by destination state/zip/NTS region or target Packet BBS / Winlink route.
- **Follow-Up Required:** Automatically flags:
  - **`HXC` / `HXD` pending:** Message delivered/relayed, reminder to send the required `SVC` (Service Message) back to origin.
  - **`HXB` expiration countdown:** Visual warning before a time-limited message expires so the operator cancels and notifies origin on time.
- **Delivered / Relayed / Archived:** Searchable permanent history by callsign, recipient, date range, net name, or message text.

### 3.4 Automatic Service Message (`SVC`) Generator
- One-click **"Generate SVC Reply"** button on any message:
  - Pre-fills a properly formatted `SVC` radiogram addressed back to the `Station of Origin`, referencing `YOUR NR <N> <DATE> TO <NAME>` with standard templates (`DELIVERED <TIME> <DATE>`, `RELAYED TO <CALL> <TIME>`, `UNDELIVERABLE — NO ANSWER`, `CANCELLED PER HXB`).

### 3.5 Digital Modes & External Format Interoperability
- **Packet BBS (LinBPQ / JNOS / FBB):**
  - Direct Telnet or KISS/AX.25 queue push with `SP` (private) / `ST` (NTS traffic) selector, explicit **Receiving Station / BBS Address** (e.g., `W5ABC@W5CDN.#ETX.TX.USA.NOAM` — never recipient email), and standard NTS subject format (`ZIP/CITY ST PRECEDENCE CALL`).
- **Winlink Express / Pat:**
  - Export/drop properly formatted Winlink Radiogram XML/text into Winlink Express Outbox or send via Pat/Telnet gateway.
- **FLMSG Compatibility:**
  - Import & export `.213` (ICS-213) and `.k2s` / Radiogram files so operators using NBEMS (`fldigi`/`flmsg`) can seamlessly exchange traffic.
- **Printable Forms:**
  - Official ARRL Radiogram PDF/print layout (**1-up** full sheet and **2-up** half-sheet for EOC clipboards) plus ICS-213 print view.

### 3.6 Monthly NTS Reporting & Scoring
- Automated monthly tally for any selected `YYYY-MM`:
  - **Originated (O)**, **Received (R)**, **Sent (S)**, **Delivered (D)** counts
  - **SAR** (Station Activity Report) total & **BPL** (Brass Pounders League) eligibility check
  - **PSHR** (Public Service Honor Roll) helper worksheet
  - One-click **"Create Monthly SAR Radiogram to STM"** (pre-filled with your Section Traffic Manager's saved address).

### 3.7 Loose Interoperability with `w5cdn-net-logger`
- **Shared Folder Bridge (Zero Coupling):**
  - Both apps can point to the same local `radiograms/` folder (storing canonical `.txt` ARRL Radiogram files + optional `.json` metadata sidecars).
  - `w5cdn-net-logger` can optionally watch or import radiograms created during an active net's time window so they appear in the chronological **Net Report** without requiring the NCS to re-type them.
- **Independent Operation:** `w5cdn-nts-traffic` works 100% standalone even if `w5cdn-net-logger` is not installed.

---

## 4. Architecture & Tech Stack Options

A key goal — based on lessons learned packaging `w5cdn-net-logger` — is eliminating the fragile two-process/two-layer local HTTP server architecture where possible.

| Option | Stack | Single-Process (No Separate Backend)? | Installer Size | Native Spellcheck & Print | Auto-Update Story | Best Fit |
|---|---|---|---|---|---|---|
| **Option A (Recommended)** | **Electron** + TypeScript + `better-sqlite3` + Node `net.Socket` (LinBPQ/Telnet) | **Yes** (IPC directly from renderer to main process — no localhost HTTP port or firewall/AV issues) | ~75–95 MB | Built-in Chromium spellcheck & print-to-PDF | Mature (`electron-updater` + GitHub Releases, zero batch-script hacks) | Best Windows/Linux reliability, zero backend disconnect bugs, fastest UI iteration |
| **Option B** | **Tauri v2** (Rust core + OS WebView2) + `rusqlite` | **Yes** (native IPC commands in Rust, no localhost HTTP port) | ~8–15 MB | Uses OS WebView2 spellcheck & print | Built-in `tauri-plugin-updater` | Smallest binary & lowest RAM, requires Rust toolchain |
| **Option C** | **Python + FastAPI + PyWebView** (same stack as `w5cdn-net-logger`) | No (embedded Uvicorn thread + loopback port) | ~45–65 MB | WebView2 spellcheck | Custom batch updater | Maximum copy-paste reuse of existing Python radiogram code |

### Recommendation
- **Option A (Electron + TypeScript + SQLite)** is the lowest-friction choice if your top priority is **rock-solid Windows packaging, no separate backend server, effortless auto-updates, and rich native spellcheck/printing** — and it handles direct TCP sockets (LinBPQ Telnet) and file watching (`radiograms/`) natively in Node.js with zero extra dependencies.
- **Option B (Tauri v2)** is the best alternative if you prioritize **minimal disk/RAM footprint** on older field laptops/go-box Toughbooks.

---

## 5. Proposed Data Model (SQLite — WAL Mode)

```sql
-- Individual radiograms (standalone or members of a Book)
CREATE TABLE radiograms (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id            INTEGER REFERENCES radiogram_books(id),
    net_name           TEXT DEFAULT '',
    msg_number         TEXT NOT NULL,
    precedence         TEXT NOT NULL DEFAULT 'R',       -- R, W, P, EMERGENCY, TEST R, TEST P
    hx                 TEXT DEFAULT '',                 -- e.g. HXC HXG
    station_of_origin  TEXT NOT NULL,
    check_text         TEXT NOT NULL DEFAULT '0',       -- e.g. 12 or ARL 12
    place_of_origin    TEXT DEFAULT '',
    time_filed         TEXT DEFAULT '',                 -- HHMMZ
    date_filed         TEXT DEFAULT '',                 -- MMM DD
    to_name            TEXT DEFAULT '',
    to_callsign        TEXT DEFAULT '',
    to_address         TEXT DEFAULT '',
    to_city_state_zip  TEXT DEFAULT '',
    to_phone           TEXT DEFAULT '',
    to_email           TEXT DEFAULT '',
    message_text       TEXT NOT NULL DEFAULT '',
    signature          TEXT DEFAULT '',
    direction          TEXT NOT NULL DEFAULT 'INBOUND', -- ORIGINATED, INBOUND, RELAY
    status             TEXT NOT NULL DEFAULT 'LISTED',  -- LISTED, ASSIGNED, RELAYED, DELIVERED, CANCELLED
    received_from      TEXT DEFAULT '',
    received_at        TEXT DEFAULT '',
    received_mode      TEXT DEFAULT '',                 -- VOICE, CW, PACKET, WINLINK, FLMSG
    sent_to            TEXT DEFAULT '',
    sent_at            TEXT DEFAULT '',
    sent_mode          TEXT DEFAULT '',
    delivered_at       TEXT DEFAULT '',
    delivery_method    TEXT DEFAULT '',                 -- PHONE, EMAIL, IN_PERSON, RADIO, MAIL
    delivery_notes     TEXT DEFAULT '',
    svc_required       INTEGER NOT NULL DEFAULT 0,      -- auto-set when HXC/HXD present
    svc_sent_at        TEXT DEFAULT '',
    hxb_expires_at     TEXT DEFAULT '',                 -- computed deadline when HXB<N> present
    file_path          TEXT DEFAULT '',                 -- synced .txt file in radiograms/ folder
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
);

-- Shared metadata for Book Messages (1 text -> N addressees)
CREATE TABLE radiogram_books (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    title              TEXT NOT NULL,
    precedence         TEXT NOT NULL DEFAULT 'R',
    hx                 TEXT DEFAULT '',
    station_of_origin  TEXT NOT NULL,
    place_of_origin    TEXT DEFAULT '',
    time_filed         TEXT DEFAULT '',
    date_filed         TEXT DEFAULT '',
    message_text       TEXT NOT NULL,
    signature          TEXT DEFAULT '',
    created_at         TEXT NOT NULL
);

-- Reusable Served Agency / STM / Frequent Recipient Address Book
CREATE TABLE contacts (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    label              TEXT NOT NULL,
    callsign           TEXT DEFAULT '',
    name               TEXT DEFAULT '',
    address            TEXT DEFAULT '',
    city_state_zip     TEXT DEFAULT '',
    phone              TEXT DEFAULT '',
    email              TEXT DEFAULT '',
    packet_address     TEXT DEFAULT '',
    winlink_address    TEXT DEFAULT '',
    notes              TEXT DEFAULT ''
);

-- Audit log of every handling/relay/delivery event (for SAR/BPL/PSHR & audit trail)
CREATE TABLE handling_log (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    radiogram_id       INTEGER NOT NULL REFERENCES radiograms(id) ON DELETE CASCADE,
    action             TEXT NOT NULL,                   -- ORIGINATED, RECEIVED, RELAYED, DELIVERED, SVC_SENT, PRINTED
    counterparty       TEXT DEFAULT '',
    mode               TEXT DEFAULT '',
    timestamp_utc      TEXT NOT NULL,
    notes              TEXT DEFAULT ''
);
```

---

## 6. Phased Delivery Roadmap

### Phase 1 — MVP (Fast Local Traffic Desk)
- Standalone desktop shell (no separate backend server) + local SQLite DB + auto-sync `.txt` files to configurable `radiograms/` folder.
- Keyboard-first ARRL Radiogram composer with live `ARL` check count, `HX` chips, ARL numbered text picker, spellcheck, and `Save & Add Another`.
- Queue views: **Needs Action**, **Ready for Relay**, **Follow-Up (`HXC`/`HXD`/`HXB`)**, and **Archive**.
- Official 1-up and 2-up printable ARRL Radiogram forms + one-click copy plain text.

### Phase 2 — Book Messages, Service Messages & Digital Routing
- Full **Book Message** composer & per-recipient delivery tracker.
- One-click **`SVC` Service Message** generator for `HXC` / `HXD` / `HXB`.
- Direct **LinBPQ Packet BBS** push (`SP` / `ST` with receiving station address), **Winlink** export, and **FLMSG** import/export.
- Reusable **Address Book** (STM, EOCs, frequent recipients).

### Phase 3 — Monthly NTS Reporting & Net Logger Bridge
- Automated **SAR / BPL / PSHR** monthly calculations + one-click Monthly SAR Radiogram generator.
- Shared-folder bridge with `w5cdn-net-logger` so radiograms logged during an active net can be pulled into the chronological Net Report automatically.
- Backup/restore archive (`.zip`) + automatic GitHub Release updates.

---

## 7. Open Decisions for Your Review

Before starting a new repository for this app, here are the key choices to confirm:
1. **Tech Stack:** **Electron** (recommended for zero backend-disconnect bugs & easiest auto-updater), **Tauri v2** (smallest footprint), or **Python/PyWebView** (shared stack with `w5cdn-net-logger`)?
2. **Scope in `w5cdn-net-logger`:** Once the standalone app exists, should `w5cdn-net-logger` keep its lightweight Radiogram modal (for occasional quiet-net traffic) or hide/remove it to keep the NCS UI even simpler?
3. **ICS-213 Support:** Should Phase 1 focus strictly on **ARRL Radiograms**, or include **FEMA ICS-213** side-by-side from day one?
4. **Repository Name:** Separate GitHub repo (e.g., `edenhare/w5cdn-nts-traffic`) or a workspace folder/monorepo?
