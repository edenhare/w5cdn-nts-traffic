# W5CDN NTS Traffic Manager

Standalone **ARRL National Traffic System (NTS) Radiogram & Traffic Manager** desktop application for **Windows** and **Linux**, built with **Electron + TypeScript + SQLite** — zero separate backend server, zero loopback port conflicts, and native OS spellcheck & printing.

Part of the **W5CDN Amateur Radio Suite** alongside [`w5cdn-net-logger`](https://github.com/edenhare/w5cdn-net-logger).

## Key Features
- **Keyboard-First ARRL Radiogram Composer** (`Ctrl+N` new, `Ctrl+.` insert `X` period, `Ctrl+K` search)
  - Live ARRL Check word counter with automatic `ARL` prefix when ARL numbered texts are included
  - Quick `HX` chips (`HXA`, `HXB24`, `HXC`, `HXD`, `HXE`, `HXG`) + shorthand normalization (`c` → `HXC`)
  - Complete built-in ARL Numbered Radiogram Text picker (`ARL ONE` – `ARL SEVENTY`)
  - Native Chromium spellcheck with right-click spelling suggestions
  - **`Save & Add Another`** workflow for rapid multi-message copying from a sending station
- **ARRL Book Messages** — enter shared preamble/text/signature once for multiple addressees, auto-number sequentially, copy official ARRL Book format, and track per-recipient delivery/relay status
- **Action-Driven Traffic Queues** — `Needs Action`, `Ready for Relay`, `Follow-Up (HXC/HXD/HXB)`, `Archive`, and `All Messages`
- **One-Click `SVC` Service Message Generator** — pre-fills `ARL FORTY SEVEN` (delivered), relayed, `ARL SIXTY SEVEN` (undeliverable), or `HXB` cancelled service replies
- **1-Up & 2-Up Printable ARRL Radiogram Forms** — official grid layout via native OS print dialog
- **Shared W5CDN Suite Folder Sync** — every radiogram auto-syncs as an official ARRL `.txt` file into the shared `W5CDN/shared/radiograms/` folder so both **W5CDN Net Logger** and **W5CDN NTS Traffic Manager** can access traffic without SQLite conflicts
- **Full W5CDN Suite Theme & Configuration Parity:**
  - All **9 cockpit themes** (`Daylight`, `Warm Paper`, `EOC Mint`, `Arctic Blue`, `High Contrast`, `Shack Dark`, `Night Ops Red`, `Amber Terminal`, `Tactical Green`)
  - Interface font family, monospace font, base UI font size (`11–22px`), callsign font size (`12–26px`), and live preview
  - **QRZ.com XML API** credentials (with Callook.info fallback) + one-click addressee **Lookup**
  - **Packet BBS / Winlink Delivery** (LinBPQ/BPQ32 Telnet with `SP`/`ST` & `RMS:` prefix + Connection Test, Pat Winlink, or Outbox drop folder)
  - Database **Backup & Restore (`.db`)**
- **Monthly SAR / BPL Tally** — Originated, Received, Sent, Delivered counts and BPL eligibility

---

## Shared W5CDN Suite Directory Layout

To avoid SQLite write conflicts when running multiple W5CDN desktop apps side-by-side while still sharing plain-text radiograms, outbox files, and optional default credentials:

```text
%APPDATA%\W5CDN\                 # Windows (or ~/.config/W5CDN/ on Linux)
├── shared\                      # Shared safely across all W5CDN apps
│   ├── radiograms\              # Plain-text ARRL Radiogram .txt files
│   ├── outbox\                  # Staged Packet BBS / Winlink drop files
│   └── config.txt               # Optional shared defaults (OPERATOR_CALL, QRZ_USER/PASS, BPQ_PASS)
├── net-logger\
│   └── net_logger.db            # Private to W5CDN Net Logger
└── nts-traffic\
    └── nts_traffic.db           # Private to W5CDN NTS Traffic Manager
```

Override the suite root with `W5CDN_SUITE_DIR`, or override individual folders in **Preferences** or via `NTS_TRAFFIC_DATA_DIR` / `RADIOGRAMS_DIR` / `OUTBOX_DIR`.

---

## Development, Testing & Packaging

Requires **Node.js 22 LTS+**.

```bash
npm install          # Installs deps & activates Husky git hooks automatically
npm run typecheck    # TypeScript check
npm run test:cov     # Vitest unit & integration suite with coverage
npm run version:check
npm run smoke        # Live Electron desktop smoke test
npm start            # Launch W5CDN NTS Traffic Manager

# Package desktop installers
npm run package:dir
npm run package:win   # Output: release/W5CDN NTS Traffic Manager Setup <ver>.exe
npm run package:linux # Output: release/W5CDN NTS Traffic Manager-<ver>.AppImage
```

---

## Cutting a Release (On-Demand)

1. Run **GitHub Actions → Prepare Release PR** (`patch`, `minor`, `major`, or explicit `X.Y.Z`).
2. Review and merge the generated `release/vX.Y.Z` PR into `main`.
3. **Publish Release** automatically tags `main`, builds & smoke-tests the Windows `.exe` installer and Linux `.AppImage`, generates `CHANGELOG.md` and `SHA256SUMS.txt`, and publishes the GitHub Release.
