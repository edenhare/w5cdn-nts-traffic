import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(raw) {
  const m = SEMVER_RE.exec(String(raw || "").trim());
  if (!m) throw new Error(`Invalid semantic version: ${raw}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function computeNextVersion(current, bump) {
  const [major, minor, patch] = parseSemver(current);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unsupported bump kind: ${bump}`);
}

export function readVersions(rootDir = process.cwd()) {
  const pkgPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const found = { "package.json": String(pkg.version || "") };

  const lockPath = path.join(rootDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    found["package-lock.json"] = String(lock.version || "");
  }

  const htmlPath = path.join(rootDir, "src", "renderer", "index.html");
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, "utf-8");
    const m = html.match(/id="appVersionPill">v(\d+\.\d+\.\d+)</);
    if (m) found["src/renderer/index.html"] = m[1];
  }
  return found;
}

export function checkVersionsConsistent(rootDir = process.cwd()) {
  const versions = readVersions(rootDir);
  const uniq = new Set(Object.values(versions));
  if (uniq.size !== 1) {
    throw new Error(`Version mismatch across files: ${JSON.stringify(versions)}`);
  }
  const [ver] = [...uniq];
  parseSemver(ver);
  return ver;
}

export function applyVersion(newVersion, rootDir = process.cwd()) {
  const [maj, min, pat] = parseSemver(newVersion);
  const normalized = `${maj}.${min}.${pat}`;
  const changed = [];

  const pkgPath = path.join(rootDir, "package.json");
  const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
  const pkgNext = pkgRaw.replace(/"version":\s*"\d+\.\d+\.\d+"/, `"version": "${normalized}"`);
  if (pkgNext !== pkgRaw) {
    fs.writeFileSync(pkgPath, pkgNext, "utf-8");
    changed.push("package.json");
  }

  const lockPath = path.join(rootDir, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    lock.version = normalized;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = normalized;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf-8");
    changed.push("package-lock.json");
  }

  const htmlPath = path.join(rootDir, "src", "renderer", "index.html");
  if (fs.existsSync(htmlPath)) {
    const htmlRaw = fs.readFileSync(htmlPath, "utf-8");
    const htmlNext = htmlRaw.replace(
      /(id="appVersionPill">)v\d+\.\d+\.\d+(<)/,
      `$1v${normalized}$2`
    );
    if (htmlNext !== htmlRaw) {
      fs.writeFileSync(htmlPath, htmlNext, "utf-8");
      changed.push("src/renderer/index.html");
    }
  }
  return changed;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--check")) {
    console.log(checkVersionsConsistent());
    return;
  }
  if (args.includes("--print-current")) {
    console.log(checkVersionsConsistent());
    return;
  }
  const bumpIdx = args.indexOf("--bump");
  if (bumpIdx !== -1 && args[bumpIdx + 1]) {
    const cur = checkVersionsConsistent();
    const next = computeNextVersion(cur, args[bumpIdx + 1]);
    applyVersion(next);
    console.log(next);
    return;
  }
  const verIdx = args.indexOf("--version");
  if (verIdx !== -1 && args[verIdx + 1]) {
    const [a, b, c] = parseSemver(args[verIdx + 1]);
    const next = `${a}.${b}.${c}`;
    applyVersion(next);
    console.log(next);
    return;
  }
  throw new Error("Usage: node scripts/bump-version.mjs [--check|--print-current|--bump patch|minor|major|--version X.Y.Z]");
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  main();
}
