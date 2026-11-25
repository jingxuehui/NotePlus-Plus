// 把本地构建的 Windows 安装包补传到 Gitee 上对应 tag 的发行版
// 用法：node scripts/upload-gitee-assets.mjs <tag> <文件...>
// 依赖环境变量 GITEE_TOKEN；发行版需已存在（由本机 pnpm release 创建），不存在则报错退出
import { readFileSync } from "node:fs";

const [tag, ...files] = process.argv.slice(2);
if (!tag || !files.length) {
  console.error("用法: node scripts/upload-gitee-assets.mjs <tag> <文件...>");
  process.exit(1);
}
const token = process.env.GITEE_TOKEN;
if (!token) {
  console.error("缺少 GITEE_TOKEN 环境变量");
  process.exit(1);
}
const owner = "jingxuehui";
const repo = "NotePlus-Plus";
const norm = (s) => s.replace(/\+/g, " ").replace(/\s+/g, " ").trim();

// 注意：Gitee 对不存在的 tag 返回 200 + "null"；token 放 body/query 均可读取公开仓库
const res = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/releases/tags/${tag}`);
const text = await res.text();
let release;
try {
  release = JSON.parse(text);
} catch {
  release = null;
}
if (!release || !release.id) {
  console.error(`Gitee 上不存在 ${tag} 发行版（请先在 macOS 上执行 pnpm release）`);
  process.exit(1);
}

for (const file of files) {
  const name = file.split(/[/\\]/).pop();
  const exists = (release.assets ?? []).some((a) => norm(a.name) === norm(name));
  if (exists) {
    console.log(`Gitee: ${name} 已存在，跳过`);
    continue;
  }
  const form = new FormData();
  form.append("access_token", token);
  form.append("file", new Blob([readFileSync(file)]), name);
  const up = await fetch(
    `https://gitee.com/api/v5/repos/${owner}/${repo}/releases/${release.id}/attach_files`,
    { method: "POST", body: form }
  );
  if (!up.ok) {
    console.error(`Gitee: ${name} 上传失败: ${up.status} ${await up.text()}`);
    process.exit(1);
  }
  console.log(`Gitee: 已上传 ${name}`);
}
console.log("Gitee 补传完成");
