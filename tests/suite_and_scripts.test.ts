import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfigFile, resolveSuitePaths } from "../src/main/suitePaths";
import { applyVersion, checkVersionsConsistent, computeNextVersion } from "../scripts/bump-version.mjs";
import { formatReleaseNotes } from "../scripts/generate-changelog.mjs";
import { validateCommitMessage, validateStagedFiles } from "../scripts/git-hooks.mjs";

describe("W5CDN Suite paths, release scripts & Husky hooks", () => {
  const dirs: string[] = [];

  afterEach(() => {
    while (dirs.length) {
      fs.rmSync(dirs.pop()!, { recursive: true, force: true });
    }
  });

  it("resolves shared W5CDN suite layout and loads shared config.txt", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "w5cdn-suite-"));
    dirs.push(tmp);

    const paths = resolveSuitePaths(tmp, {});
    expect(paths.suiteRoot).toBe(path.join(tmp, "W5CDN"));
    expect(paths.appDataDir).toBe(path.join(tmp, "W5CDN", "NTS"));
    expect(paths.dbPath).toBe(path.join(tmp, "W5CDN", "NTS", "nts_traffic.db"));
    expect(paths.sharedRadiogramsDir).toBe(path.join(tmp, "W5CDN", "shared", "radiograms"));
    expect(paths.sharedOutboxDir).toBe(path.join(tmp, "W5CDN", "shared", "outbox"));

    fs.mkdirSync(paths.sharedDir, { recursive: true });
    fs.writeFileSync(paths.sharedConfigPath, '# Shared W5CDN config\nOPERATOR_CALL="W5CDN"\nQRZ_USER=W5CDN\n');
    const env: Record<string, string | undefined> = { OPERATOR_CALL: "K5OVERRIDE" };
    loadConfigFile(paths.sharedConfigPath, env);
    expect(env.OPERATOR_CALL).toBe("K5OVERRIDE");
    expect(env.QRZ_USER).toBe("W5CDN");
  });

  it("validates version consistency, changelog formatting, and Husky hook guards", () => {
    expect(checkVersionsConsistent()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(computeNextVersion("0.1.0", "minor")).toBe("0.2.0");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nts-ver-"));
    dirs.push(tmp);
    fs.mkdirSync(path.join(tmp, "src", "renderer"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "package.json"), '{\n  "version": "0.1.0"\n}\n');
    fs.writeFileSync(path.join(tmp, "src", "renderer", "index.html"), '<span id="appVersionPill">v0.1.0</span>\n');
    expect(applyVersion("0.2.0", tmp)).toEqual(["package.json", "src/renderer/index.html"]);
    expect(checkVersionsConsistent(tmp)).toBe("0.2.0");

    const notes = formatReleaseNotes({
      version: "v0.1.0",
      repo: "edenhare/w5cdn-nts-traffic",
      releaseDate: "2026-11-24",
      commits: [{ sha: "abc1234", subject: "feat(composer): add ARRL radiogram composer", body: "" }],
    });
    expect(notes).toContain("### Features");
    expect(notes).toContain("abc1234");

    expect(validateCommitMessage("feat(ui): add book messages").ok).toBe(true);
    expect(validateCommitMessage("bad message").ok).toBe(false);
    const errs = validateStagedFiles(["nts_traffic.db", ".env"], tmp);
    expect(errs).toHaveLength(2);
  });
});
