// 从 Git 提交记录自动生成 CHANGELOG.md（Keep a Changelog 风格，按版本分组）
// 用法：node scripts/changelog.mjs [--version X.Y.Z]
//   --version 指定最新版本标题；未指定时使用 tauri.conf.json 中的版本
// 版本边界来源：git tag vX.Y.Z，或提交信息中的「版本迭代至 X.Y.Z」/「发布 vX.Y.Z」
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = join(root, "CHANGELOG.md");

const TYPE_GROUPS = [
  { key: "feat", title: "新增" },
  { key: "fix", title: "修复" },
  { key: "perf", title: "性能" },
  { key: "refactor", title: "重构" },
  { key: "style", title: "样式" },
  { key: "docs", title: "文档" },
  { key: "chore", title: "构建" },
  { key: "other", title: "其他" },
];

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function currentVersion() {
  const conf = readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8");
  const m = conf.match(/"version"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error("tauri.conf.json 中未找到 version");
  return m[1];
}

function versionMark(subject) {
  const m = subject.match(/(?:版本迭代至\s*|发布\s*v)(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

/** 读取提交记录并按版本边界切分，新 -> 旧 */
function collectReleases() {
  const raw = git(["log", "--date=short", "--pretty=format:%H%x1f%ad%x1f%s"]);
  const commits = raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const [hash, date, subject] = line.split("\x1f");
    return { hash, date, subject };
  });

  const tagMap = new Map();
  try {
    for (const line of git(["tag", "--list", "v*"]).split(/\r?\n/).filter(Boolean)) {
      const hash = git(["rev-list", "-n", "1", line]).trim();
      tagMap.set(hash, line.replace(/^v/, ""));
    }
  } catch { /* 仓库可能没有 tag */ }

  const releases = [];
  let bucket = null;
  for (const c of commits) {
    // git log 为新 -> 旧：遇到版本边界时，把已收集的更新提交收拢为前一个版本
    const tagVersion = tagMap.get(c.hash);
    const markVersion = versionMark(c.subject);
    if ((tagVersion || markVersion) && bucket?.entries.length) {
      releases.push({ version: bucket.version, date: bucket.date, entries: bucket.entries });
      bucket = null;
    }
    if (!bucket) {
      bucket = { version: tagVersion || markVersion || "", date: c.date, entries: [] };
    }
    bucket.date = c.date;
    // 版本边界提交本身（chore: 发布 vX / 版本迭代至 X）不写进变更条目
    if (tagVersion || markVersion) continue;
    // 初始提交单独归类，避免被正则拆成 type="commit"
    if (/^Initial commit:/i.test(c.subject)) {
      bucket.entries.push({ ...c, subject: `chore: ${c.subject}` });
      continue;
    }
    bucket.entries.push(c);
  }
  if (bucket?.entries.length) {
    releases.push({ version: bucket.version || "", date: bucket.date, entries: bucket.entries });
  }
  // 未发布段落置顶，其余按版本号降序
  releases.sort((a, b) => {
    if (!a.version && b.version) return -1;
    if (a.version && !b.version) return 1;
    if (!a.version && !b.version) return 0;
    return compareVersion(b.version, a.version);
  });
  return releases;
}

function compareVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

function classify(subject) {
  const m = subject.match(/^(\w+)(?:\([^)]*\))?[!:]?\s*(.*)$/);
  const type = m ? m[1].toLowerCase() : "other";
  const known = TYPE_GROUPS.find((g) => g.key === type);
  return { title: known ? known.title : "其他", text: m && m[2] ? m[2] : subject };
}

function render(releases) {
  const lines = [
    "# 更新日志",
    "",
    "NotePlus+ 所有正式版本的变更记录。本文件由 `scripts/changelog.mjs` 从 Git 提交记录自动生成，",
    "执行 `pnpm release` 时会自动更新，发布到 GitHub / Gitee 的 Release 正文也取自这里。",
    "",
  ];
  for (const release of releases) {
    const title = release.version
      ? `[${release.version}] - ${release.date}`
      : `[未发布] - ${release.date}`;
    lines.push(`## ${title}`, "");
    const groups = new Map();
    for (const entry of release.entries) {
      const { title: group, text } = classify(entry.subject);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(text);
    }
    for (const { title: group } of TYPE_GROUPS) {
      const items = groups.get(group);
      if (!items?.length) continue;
      lines.push(`### ${group}`, "");
      for (const item of items) lines.push(`- ${item}`);
      lines.push("");
    }
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

/** 供 upload-release.mjs 使用：取指定版本的变更正文（不含二级标题） */
export function releaseNotesFor(version) {
  if (!existsSync(changelogPath)) return null;
  const text = readFileSync(changelogPath, "utf8");
  const escaped = version.replace(/\./g, "\\.");
  const header = text.match(new RegExp(`^## \\[${escaped}\\]\\s*-[^\\n]*\\n`, "m"));
  if (!header || header.index === undefined) return null;
  const rest = text.slice(header.index + header[0].length);
  const next = rest.search(/^## \[/m);
  const body = next < 0 ? rest : rest.slice(0, next);
  return body.trim() || null;
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const idx = process.argv.indexOf("--version");
  const version = idx >= 0 ? process.argv[idx + 1] : currentVersion();
  if (!version) throw new Error("请提供版本号（--version X.Y.Z）");
  const releases = collectReleases();
  // 最新分段尚无版本边界：release 时用新版本号，手动生成时用「未发布」
  if (releases[0] && !releases[0].version) {
    releases[0].version = idx >= 0 ? version : "未发布";
  }
  const content = render(releases);
  writeFileSync(changelogPath, content, "utf8");
  console.log(`CHANGELOG.md 已更新（${releases.length} 个版本，最新版本 ${version}）`);
}
