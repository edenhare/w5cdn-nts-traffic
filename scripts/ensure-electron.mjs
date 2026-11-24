import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const electronDir = path.resolve("node_modules", "electron");
const pathTxt = path.join(electronDir, "path.txt");
const distDir = path.join(electronDir, "dist");
const exeName = process.platform === "win32" ? "electron.exe" : process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron";

if (fs.existsSync(pathTxt) && fs.existsSync(path.join(distDir, exeName))) {
  process.exit(0);
}

// Node 26+ workaround: extract-zip inside electron's postinstall can exit early before writing path.txt.
const { downloadArtifact } = await import("@electron/get");
const pkg = JSON.parse(fs.readFileSync(path.join(electronDir, "package.json"), "utf-8"));
const zipPath = await downloadArtifact({
  version: pkg.version,
  artifactName: "electron",
  platform: process.platform,
  arch: process.arch,
});

fs.mkdirSync(distDir, { recursive: true });
if (process.platform === "win32") {
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${distDir.replace(/'/g, "''")}' -Force`],
    { stdio: "inherit" }
  );
} else {
  execFileSync("unzip", ["-qo", zipPath, "-d", distDir], { stdio: "inherit" });
}
fs.writeFileSync(pathTxt, exeName, "utf-8");
console.log(`Electron ${pkg.version} extracted and verified.`);
