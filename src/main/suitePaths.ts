import fs from "node:fs";
import path from "node:path";

export interface SuitePaths {
  suiteRoot: string;
  sharedDir: string;
  sharedRadiogramsDir: string;
  sharedOutboxDir: string;
  sharedConfigPath: string;
  appDataDir: string;
  dbPath: string;
}

export function resolveSuitePaths(
  osAppDataDir: string,
  env: Record<string, string | undefined> = process.env
): SuitePaths {
  const suiteRoot = env.W5CDN_SUITE_DIR
    ? path.resolve(env.W5CDN_SUITE_DIR)
    : path.join(path.resolve(osAppDataDir), "W5CDN");
  const sharedDir = path.join(suiteRoot, "shared");
  const appDataDir = env.NTS_TRAFFIC_DATA_DIR
    ? path.resolve(env.NTS_TRAFFIC_DATA_DIR)
    : path.join(suiteRoot, "nts-traffic");

  const sharedRadiogramsDir = env.RADIOGRAMS_DIR
    ? path.resolve(env.RADIOGRAMS_DIR)
    : env.NTS_TRAFFIC_DATA_DIR
      ? path.join(appDataDir, "radiograms")
      : path.join(sharedDir, "radiograms");

  const sharedOutboxDir = env.OUTBOX_DIR
    ? path.resolve(env.OUTBOX_DIR)
    : env.NTS_TRAFFIC_DATA_DIR
      ? path.join(appDataDir, "outbox")
      : path.join(sharedDir, "outbox");

  return {
    suiteRoot,
    sharedDir,
    sharedRadiogramsDir,
    sharedOutboxDir,
    sharedConfigPath: path.join(sharedDir, "config.txt"),
    appDataDir,
    dbPath: path.join(appDataDir, "nts_traffic.db"),
  };
}

export function loadConfigFile(
  filePath: string,
  env: Record<string, string | undefined> = process.env
): void {
  if (!fs.existsSync(filePath)) return;
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eqIdx = line.indexOf("=");
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (val.length >= 2 && val[0] === val[val.length - 1] && (val[0] === "'" || val[0] === '"')) {
      val = val.slice(1, -1);
    }
    if (key && env[key] === undefined) {
      env[key] = val;
    }
  }
}
