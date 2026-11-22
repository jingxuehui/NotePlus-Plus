// 正式版打包前自动递增版本号（patch 位）
// 用法：pnpm release  （等价于 node scripts/release.mjs && tauri build）
// 逻辑：以 src-tauri/tauri.conf.json 为权威版本，patch +1 后同步写入
//       tauri.conf.json / package.json / src-tauri/Cargo.toml
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const confPath = join(root, "src-tauri", "tauri.conf.json");
const pkgPath = join(root, "package.json");
const cargoPath = join(root, "src-tauri", "Cargo.toml");

const bumpPatch = (v) => {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`无法解析版本号: ${v}`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
};

const conf = readFileSync(confPath, "utf8");
const m = conf.match(/"version"\s*:\s*"([^"]+)"/);
if (!m) throw new Error("tauri.conf.json 中未找到 version 字段");
const oldVersion = m[1];
const newVersion = bumpPatch(oldVersion);

// 仅替换版本值本身，保留原文件换行风格
const replaceIn = (text, re, version) => text.replace(re, (_, p1, _old, p3) => `${p1}${version}${p3}`);

writeFileSync(confPath, replaceIn(conf, /("version"\s*:\s*")([^"]*)(")/, newVersion));
writeFileSync(
  pkgPath,
  replaceIn(readFileSync(pkgPath, "utf8"), /("version"\s*:\s*")([^"]*)(")/, newVersion)
);
writeFileSync(
  cargoPath,
  replaceIn(readFileSync(cargoPath, "utf8"), /(^\s*version\s*=\s*")([^"]*)(")/m, newVersion)
);

console.log(`版本号: ${oldVersion} -> ${newVersion}`);
