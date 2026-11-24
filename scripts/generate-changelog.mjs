import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const COMMIT_RE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<desc>.+)$/;

export function formatReleaseNotes({ version, repo, commits, prevTag = "", releaseDate }) {
  const dateStr = releaseDate || new Date().toISOString().slice(0, 10);
  const breaking = [];
  const sections = {
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    docs: [],
    security: [],
    other: [],
  };

  for (const c of commits) {
    const subj = (c.subject || "").trim();
    if (!subj || subj.startsWith("Merge ") || subj.startsWith("chore(release):")) continue;
    const m = COMMIT_RE.exec(subj);
    const shortSha = (c.sha || "").slice(0, 7);
    const shaLink = repo && shortSha ? ` ([\`${shortSha}\`](https://github.com/${repo}/commit/${c.sha}))` : "";
    if (!m || !m.groups) {
      sections.other.push(`- ${subj}${shaLink}`);
      continue;
    }
    const { type, scope, breaking: bang, desc } = m.groups;
    const prefix = scope ? `**${scope}:** ` : "";
    const line = `- ${prefix}${desc}${shaLink}`;
    if (bang || /BREAKING CHANGE:/i.test(c.body || "")) {
      breaking.push(line);
    }
    if (type === "feat") sections.feat.push(line);
    else if (type === "fix") sections.fix.push(line);
    else if (type === "perf") sections.perf.push(line);
    else if (type === "refactor") sections.refactor.push(line);
    else if (type === "docs") sections.docs.push(line);
    else if (type === "security") sections.security.push(line);
    else if (type !== "chore" && type !== "ci" && type !== "test") sections.other.push(line);
  }

  const out = [`## ${version} (${dateStr})`, ""];
  const pushSection = (title, items) => {
    if (!items.length) return;
    out.push(`### ${title}`, "", ...items, "");
  };
  pushSection("Breaking Changes", breaking);
  pushSection("Features", sections.feat);
  pushSection("Bug Fixes", sections.fix);
  pushSection("Security", sections.security);
  pushSection("Performance & Refactoring", [...sections.perf, ...sections.refactor]);
  pushSection("Documentation", sections.docs);
  pushSection("Other Changes", sections.other);

  if (out.length === 2) {
    out.push("- Maintenance release.", "");
  }
  if (repo && prevTag) {
    out.push(`**Full Changelog:** https://github.com/${repo}/compare/${prevTag}...${version}`, "");
  }
  return out.join("\n");
}

function getPreviousTag(toRef) {
  try {
    return execFileSync("git", ["describe", "--tags", "--abbrev=0", `${toRef}^`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function readGitCommits(fromRef, toRef) {
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const raw = execFileSync("git", ["log", range, "--format=%H%x1f%s%x1f%b%x1e"], {
    encoding: "utf-8",
  });
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha = "", subject = "", body = ""] = entry.split("\x1f");
      return { sha: sha.trim(), subject: subject.trim(), body: body.trim() };
    });
}

function main() {
  const args = process.argv.slice(2);
  const getArg = (flag, fallback = "") => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const version = getArg("--version", "Unreleased");
  const repo = getArg("--repo", "");
  const toRef = getArg("--to", "HEAD");
  const fromRef = getArg("--from", "") || getPreviousTag(toRef);
  const output = getArg("--output", "");
  const notes = formatReleaseNotes({
    version,
    repo,
    prevTag: fromRef,
    commits: readGitCommits(fromRef, toRef),
  });
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, notes, "utf-8");
  } else {
    process.stdout.write(notes);
  }
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  main();
}
