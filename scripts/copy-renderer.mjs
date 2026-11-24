import fs from "node:fs";
import path from "node:path";

const srcDir = path.resolve("src", "renderer");
const outDir = path.resolve("dist", "renderer");

fs.mkdirSync(outDir, { recursive: true });
for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
  const srcPath = path.join(srcDir, entry.name);
  const dstPath = path.join(outDir, entry.name);
  if (entry.isFile()) {
    fs.copyFileSync(srcPath, dstPath);
  }
}
