<script setup lang="ts">
import { computed } from "vue";
import { fileExtension } from "@/editor/language";

const props = withDefaults(
  defineProps<{
    /** 文件路径（为空时按名称取后缀，都取不到则用通用文件图标） */
    path?: string | null;
    /** 文件名（未落盘的新文件用） */
    name?: string;
    /** 图标尺寸（px） */
    size?: number;
    /** 是否未保存（未保存时图标外圈用强调色提示） */
    dirty?: boolean;
  }>(),
  { path: null, name: "", size: 14, dirty: false }
);

interface FileTypeDef {
  /** 徽标文字 */
  label: string;
  /** 主色：深浅主题通用（取中间饱和度，保证两种主题都清晰） */
  color: string;
}

/** 扩展名 → 图标徽标 */
const FILE_TYPES: Record<string, FileTypeDef> = {
  // 数据 / 配置
  json: { label: "{}", color: "#c9922a" },
  jsonc: { label: "{}", color: "#c9922a" },
  json5: { label: "{}", color: "#c9922a" },
  yaml: { label: "Y", color: "#b83a3a" },
  yml: { label: "Y", color: "#b83a3a" },
  toml: { label: "T", color: "#9c5a2e" },
  xml: { label: "<>", color: "#d2691e" },
  svg: { label: "<>", color: "#c26a1c" },
  ini: { label: "INI", color: "#5f7d88" },
  conf: { label: "INI", color: "#5f7d88" },
  cfg: { label: "INI", color: "#5f7d88" },
  properties: { label: "INI", color: "#5f7d88" },
  env: { label: "ENV", color: "#7a8b46" },
  csv: { label: "CSV", color: "#3f8f52" },
  // 前端
  js: { label: "JS", color: "#c9a227" },
  mjs: { label: "JS", color: "#c9a227" },
  cjs: { label: "JS", color: "#c9a227" },
  jsx: { label: "JS", color: "#3fa9c9" },
  ts: { label: "TS", color: "#3b82c4" },
  mts: { label: "TS", color: "#3b82c4" },
  cts: { label: "TS", color: "#3b82c4" },
  tsx: { label: "TS", color: "#3f8fb9" },
  vue: { label: "V", color: "#2f9e63" },
  svelte: { label: "SV", color: "#c85a28" },
  html: { label: "<>", color: "#d0562c" },
  htm: { label: "<>", color: "#d0562c" },
  css: { label: "#", color: "#2f6fd0" },
  scss: { label: "#", color: "#c14b8f" },
  sass: { label: "#", color: "#c14b8f" },
  less: { label: "#", color: "#3f6fa8" },
  // 脚本 / 后端
  py: { label: "PY", color: "#3b6ea5" },
  pyw: { label: "PY", color: "#3b6ea5" },
  rb: { label: "RB", color: "#b83a33" },
  php: { label: "PHP", color: "#6b70ad" },
  java: { label: "J", color: "#c9761c" },
  kt: { label: "KT", color: "#8a5cc4" },
  swift: { label: "SW", color: "#d4761c" },
  go: { label: "GO", color: "#2a9dbd" },
  rs: { label: "RS", color: "#b9744a" },
  c: { label: "C", color: "#7d8ea3" },
  h: { label: "H", color: "#7d8ea3" },
  cpp: { label: "C++", color: "#c94a76" },
  cc: { label: "C++", color: "#c94a76" },
  cxx: { label: "C++", color: "#c94a76" },
  hpp: { label: "H++", color: "#c94a76" },
  cs: { label: "CS", color: "#4c8f5b" },
  sql: { label: "SQL", color: "#c8852a" },
  sh: { label: "$", color: "#4f9e33" },
  bash: { label: "$", color: "#4f9e33" },
  zsh: { label: "$", color: "#4f9e33" },
  lua: { label: "L", color: "#4a4a9e" },
  // 文本 / 其它
  md: { label: "MD", color: "#3f7fb5" },
  markdown: { label: "MD", color: "#3f7fb5" },
  txt: { label: "TXT", color: "#6e7681" },
  log: { label: "LOG", color: "#7a6a55" },
  dockerfile: { label: "DK", color: "#2a7fc1" },
  makefile: { label: "MK", color: "#8a7f5f" },
  lock: { label: "LOCK", color: "#6e7681" },
  // 图片
  png: { label: "IMG", color: "#a35bb8" },
  jpg: { label: "IMG", color: "#a35bb8" },
  jpeg: { label: "IMG", color: "#a35bb8" },
  gif: { label: "IMG", color: "#a35bb8" },
  webp: { label: "IMG", color: "#a35bb8" },
  bmp: { label: "IMG", color: "#a35bb8" },
  ico: { label: "IMG", color: "#a35bb8" },
  avif: { label: "IMG", color: "#a35bb8" },
  zip: { label: "ZIP", color: "#a08236" },
  pdf: { label: "PDF", color: "#b8453f" },
};

const type = computed<FileTypeDef | null>(() => {
  // 未落盘的新文件没有路径，退而按文件名取后缀
  const key = props.path ?? props.name;
  if (!key) return null;
  return FILE_TYPES[fileExtension(key)] ?? null;
});

const badgeStyle = computed(() => {
  const t = type.value;
  if (!t) return {};
  const c = t.color;
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${Math.round(props.size * 0.52 * 10) / 10}px`,
    color: c,
    background: `${c}26`,
    borderColor: `${c}59`,
  };
});
</script>

<template>
  <!-- 已知类型：彩色扩展名徽标 -->
  <span v-if="type" class="file-type-icon badge" :class="{ dirty }" :style="badgeStyle">
    {{ type.label }}
  </span>
  <!-- 未知类型：通用文件图标 -->
  <svg
    v-else
    class="file-type-icon plain"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
  >
    <path d="M9 1.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 14.5h8A1.5 1.5 0 0 0 13.5 13V6L9 1.5z" />
    <path d="M9 1.5V6h4.5" />
  </svg>
</template>

<style scoped>
.file-type-icon.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.2px;
  flex-shrink: 0;
  user-select: none;
}
/* 未保存：外圈用强调色提示 */
.file-type-icon.badge.dirty {
  box-shadow: 0 0 0 1px var(--accent);
}
</style>
