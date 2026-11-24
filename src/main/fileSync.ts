import fs from "node:fs";
import path from "node:path";
import { formatArrlRadiogramText } from "../shared/arrl";
import type { Radiogram } from "../shared/types";

function sanitizeSlug(raw: string, fallback: string): string {
  const cleaned = (raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return cleaned || fallback;
}

export function buildRadiogramFilename(rg: Radiogram): string {
  const datePart = (rg.created_at || "").slice(0, 10).replace(/[^0-9-]/g, "") || "undated";
  const nr = sanitizeSlug(rg.msg_number, String(rg.id));
  const origin = sanitizeSlug(rg.station_of_origin, "ORIG");
  const prec = sanitizeSlug(rg.precedence, "R");
  return `${datePart}_NR${nr}_${prec}_${origin}_id${rg.id}.txt`;
}

export function syncRadiogramToFolder(rg: Radiogram, folderPath: string): string {
  const resolvedDir = path.resolve(folderPath);
  fs.mkdirSync(resolvedDir, { recursive: true });
  const fileName = buildRadiogramFilename(rg);
  const targetPath = path.resolve(resolvedDir, fileName);
  if (!targetPath.startsWith(resolvedDir + path.sep)) {
    throw new Error("Refused to write radiogram outside configured folder");
  }
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, formatArrlRadiogramText(rg), "utf-8");
  fs.renameSync(tmpPath, targetPath);

  if (rg.file_path && path.resolve(rg.file_path) !== targetPath) {
    const oldResolved = path.resolve(rg.file_path);
    if (oldResolved.startsWith(resolvedDir + path.sep) && fs.existsSync(oldResolved)) {
      try {
        fs.unlinkSync(oldResolved);
      } catch {
        // Ignore stale file cleanup failure
      }
    }
  }
  return targetPath;
}

export function deleteRadiogramFile(filePath: string, folderPath: string): void {
  if (!filePath || !folderPath) return;
  const resolvedDir = path.resolve(folderPath);
  const resolvedFile = path.resolve(filePath);
  if (resolvedFile.startsWith(resolvedDir + path.sep) && fs.existsSync(resolvedFile)) {
    try {
      fs.unlinkSync(resolvedFile);
    } catch {
      // Ignore cleanup error
    }
  }
}
