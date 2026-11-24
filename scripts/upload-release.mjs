// 正式版打包后自动推送安装包到 GitHub Release 与 Gitee Release
// 用法：pnpm release:upload  （或 pnpm release && pnpm release:upload）
// Token 来源（二选一，不写入仓库）：
//   1. 环境变量 GH_TOKEN / GITEE_TOKEN
//   2. 本机文件 ~/.noteplus-release.env，内容格式：
//      GH_TOKEN=github_pat_xxx
//      GITEE_TOKEN=xxx
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { releaseNotesFor } from "./changelog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Release 正文取自 CHANGELOG.md 对应版本段落；缺失时回退到简单文案
function releaseBody(version) {
  return releaseNotesFor(version) ?? `NotePlus+ 正式版 ${version}`;
}

// ---------- 读取 token ----------
function loadTokens() {
  let tokens = { GH_TOKEN: process.env.GH_TOKEN, GITEE_TOKEN: process.env.GITEE_TOKEN };
  const envFile = join(homedir(), ".noteplus-release.env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m && !tokens[m[1]]) tokens[m[1]] = m[2];
    }
  }
  return tokens;
}

// ---------- 版本号 ----------
function getVersion() {
  const conf = readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8");
  return conf.match(/"version"\s*:\s*"([^"]+)"/)[1];
}

// ---------- 查找 dmg 产物 ----------
function findArtifacts() {
  const dir = join(root, "src-tauri", "target", "release", "bundle");
  const out = [];
  for (const sub of ["dmg", "macos"]) {
    const p = join(dir, sub);
    if (!existsSync(p)) continue;
    for (const f of readdirSync(p)) {
      if (f.endsWith(".dmg") || f.endsWith(".app.tar.gz")) out.push(join(p, f));
    }
  }
  if (out.length === 0) throw new Error("未找到打包产物，请先执行 pnpm release");
  return out;
}

async function request(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}\n${text.slice(0, 500)}`);
  return json ?? text;
}

// ---------- GitHub Release ----------
async function pushGitHub(version, artifacts, token) {
  const repo = "jingxuehui/NotePlus-Plus";
  const tag = `v${version}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  // 若 release 已存在则复用
  let release;
  try {
    release = await request(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { headers });
  } catch {
    release = await request(`https://api.github.com/repos/${repo}/releases`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        tag_name: tag,
        name: `NotePlus+ ${version}`,
        body: releaseBody(version),
        draft: false,
        prerelease: false,
      }),
    });
  }
  const uploadUrl = release.upload_url.split("{")[0];
  for (const file of artifacts) {
    const name = file.split("/").pop();
    const existing = (release.assets ?? []).find((a) => a.name === name);
    if (existing) {
      console.log(`GitHub: ${name} 已存在，跳过`);
      continue;
    }
    await request(`${uploadUrl}?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: readFileSync(file),
    });
    console.log(`GitHub: 已上传 ${name}`);
  }
  console.log(`GitHub Release: https://github.com/${repo}/releases/tag/${tag}`);
}

// ---------- Gitee Release ----------
async function pushGitee(version, artifacts, token) {
  const owner = "jingxuehui";
  const repo = "NotePlus-Plus";
  const tag = `v${version}`;
  const headers = { "Content-Type": "application/json" };
  // 注意：Gitee 的 token 放 query 参数会返回 null，必须放在 body 中；
  // 且 tag 不存在时该接口返回 200 + "null" 而非 404
  let release = null;
  try {
    const r = await request(`https://gitee.com/api/v5/repos/${owner}/${repo}/releases/tags/${tag}`);
    if (r && typeof r === "object" && r.id) release = r;
  } catch { /* tag 不存在 */ }
  if (!release) {
    release = await request(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/releases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          access_token: token,
          tag_name: tag,
          name: `NotePlus+ ${version}`,
          body: releaseBody(version),
          target_commitish: "main",
          prerelease: false,
        }),
      }
    );
  }
  if (!release?.id) throw new Error(`Gitee 创建发行版失败: ${JSON.stringify(release).slice(0, 300)}`);
  // 精确匹配正式 dmg 命名，排除 hdiutil 的 rw.* 残留临时文件
  const dmgRe = /^NotePlus\+_\d+\.\d+\.\d+_aarch64\.dmg$/;
  for (const file of artifacts.filter((f) => dmgRe.test(f.split("/").pop()))) {
    const name = file.split("/").pop();
    const norm = (s) => s.replace(/\+/g, " ").replace(/\s+/g, " ").trim();
    const existing = (release.assets ?? []).some((a) => norm(a.name) === norm(name));
    if (existing) {
      console.log(`Gitee: ${name} 已存在，跳过`);
      continue;
    }
    // Gitee attach 需要 multipart
    const form = new FormData();
    form.append("access_token", token);
    const buf = readFileSync(file);
    form.append("file", new Blob([buf]), name);
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/releases/${release.id}/attach_files`,
      { method: "POST", body: form }
    );
    if (!res.ok) throw new Error(`Gitee 上传失败 ${name}: ${res.status}\n${await res.text()}`);
    console.log(`Gitee: 已上传 ${name}`);
  }
  console.log(`Gitee Release: https://gitee.com/${owner}/${repo}/releases/tag/${tag}`);
}

// ---------- 主流程 ----------
const tokens = loadTokens();
const version = getVersion();
const artifacts = findArtifacts();
console.log(`版本 ${version}，产物: ${artifacts.map((f) => f.split("/").pop()).join(", ")}`);

const failed = [];
if (tokens.GH_TOKEN) {
  try { await pushGitHub(version, artifacts, tokens.GH_TOKEN); }
  catch (e) { failed.push(`GitHub: ${e.message}`); }
} else failed.push("GitHub: 未配置 GH_TOKEN");

if (tokens.GITEE_TOKEN) {
  try { await pushGitee(version, artifacts, tokens.GITEE_TOKEN); }
  catch (e) { failed.push(`Gitee: ${e.message}`); }
} else failed.push("Gitee: 未配置 GITEE_TOKEN");

if (failed.length) {
  console.error("\n以下推送失败:\n" + failed.join("\n---\n"));
  process.exit(1);
}
console.log("\n全部推送完成");
