<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MarkdownIt from "markdown-it";
import { convertFileSrc } from "@tauri-apps/api/core";
import { activeTab } from "@/stores/tabs";

const props = defineProps<{ source: string }>();

const md = new MarkdownIt({
  // 不放行原始 HTML：本地笔记也避免粘贴的 HTML 片段注入脚本
  html: false,
  linkify: true,
  typographer: false,
});

/** 解析相对/绝对本地路径为 asset 协议 URL（依赖 tauri.conf 的 assetProtocol） */
function toAssetUrl(src: string): string {
  if (!src || /^(https?:|data:|blob:)/i.test(src)) return src;
  let decoded = src;
  try {
    decoded = decodeURI(src);
  } catch {
    /* 保留原值 */
  }
  const base = activeTab.value?.path;
  if (!base || !decoded) return decoded;
  if (/^~|^([a-zA-Z]:[\\/])|^\/+/.test(decoded)) {
    // 绝对路径（Unix 根路径 / Windows 盘符 / ~ 开头交给 asset 协议处理）
    return assetUrl(decoded);
  }
  // 相对路径：基于当前 Markdown 文件所在目录归一化
  const sep = Math.max(base.lastIndexOf("/"), base.lastIndexOf("\\"));
  const dir = sep > 0 ? base.slice(0, sep) : "";
  const joined = dir ? `${dir}/${decoded}` : decoded;
  const stack: string[] = [];
  for (const part of joined.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return assetUrl("/" + stack.join("/"));
}

function assetUrl(absPath: string): string {
  try {
    return convertFileSrc(absPath);
  } catch {
    // 浏览器调试环境（无 Tauri 运行时）直接回退原路径
    return absPath;
  }
}

// 重写图片链接为 asset 协议（Markdown 里的本地截图/配图才能显示）
const defaultRenderImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src");
  if (typeof src === "string" && src) token.attrSet("src", toAssetUrl(src));
  return defaultRenderImage
    ? defaultRenderImage(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

// 渲染结果用内部 ref 承载并做轻防抖：分屏模式下输入不逐键重排整篇文档
const rendered = ref("");
let timer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.source,
  (v) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      rendered.value = md.render(v ?? "");
    }, 180);
  },
  { immediate: true },
);

const html = computed(() => rendered.value);
const empty = computed(() => !(props.source ?? "").trim());
</script>

<template>
  <div class="md-preview-root">
    <div v-if="empty" class="md-empty">…</div>
    <!-- markdown-it 关闭了原始 HTML，输出可控；样式全部经由 .md-preview 作用域约束 -->
    <article class="md-preview" v-html="html"></article>
  </div>
</template>

<style scoped>
.md-preview-root {
  height: 100%;
  overflow: auto;
  background: var(--editor-bg);
  color: var(--text);
}

.md-empty {
  padding: 40px 24px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.md-preview {
  max-width: 820px;
  margin: 0 auto;
  padding: 28px 40px 64px;
  font-size: 15px;
  line-height: 1.75;
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}

.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3),
.md-preview :deep(h4),
.md-preview :deep(h5),
.md-preview :deep(h6) {
  margin: 1.4em 0 0.6em;
  font-weight: 650;
  line-height: 1.35;
}
.md-preview :deep(h1) { font-size: 1.9em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.md-preview :deep(h2) { font-size: 1.5em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
.md-preview :deep(h3) { font-size: 1.25em; }
.md-preview :deep(h4) { font-size: 1.1em; }
.md-preview :deep(h1:first-child),
.md-preview :deep(h2:first-child),
.md-preview :deep(p:first-child) { margin-top: 0; }

.md-preview :deep(p) { margin: 0.7em 0; }

.md-preview :deep(a) {
  color: var(--accent);
  text-decoration: none;
}
.md-preview :deep(a:hover) { text-decoration: underline; }

.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.6em;
}
.md-preview :deep(li) { margin: 0.25em 0; }
.md-preview :deep(li > input[type="checkbox"]) { margin-right: 0.45em; }

.md-preview :deep(blockquote) {
  margin: 0.9em 0;
  padding: 2px 16px;
  border-left: 3px solid var(--accent);
  border-radius: 2px;
  background: var(--editor-bg-2);
  color: var(--muted);
}

.md-preview :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 4px;
  background: var(--editor-bg-2);
  font-family: var(--editor-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 0.88em;
}

.md-preview :deep(pre) {
  margin: 0.9em 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--editor-bg-2);
  overflow: auto;
}
.md-preview :deep(pre code) {
  padding: 0;
  background: none;
  font-size: 0.85em;
  line-height: 1.6;
}

.md-preview :deep(table) {
  margin: 0.9em 0;
  border-collapse: collapse;
  width: 100%;
  font-size: 0.92em;
}
.md-preview :deep(th),
.md-preview :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.md-preview :deep(th) {
  background: var(--editor-bg-2);
  font-weight: 600;
}

.md-preview :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}

.md-preview :deep(hr) {
  margin: 1.6em 0;
  border: none;
  border-top: 1px solid var(--border);
}
</style>
