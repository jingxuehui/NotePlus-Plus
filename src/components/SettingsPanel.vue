<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  applyVisual,
  settings,
  systemTheme,
  type AccentName,
  type Settings,
  type ThemeChoice,
  type ToolbarVisibility,
} from "@/stores/settings";
import { toggleSettings, toggleUpdateCenter } from "@/stores/ui";
import { notify } from "@/stores/toast";
import HintTip from "@/components/HintTip.vue";
import ThemeIcon from "@/components/ThemeIcon.vue";

const emit = defineEmits<{ close: [] }>();

type SectionKey = "appearance" | "updates" | "about";
const navItems: { key: SectionKey; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "updates", label: "更新管理" },
  { key: "about", label: "关于我们" },
];

const section = ref<SectionKey>("appearance");
const search = ref("");

// 配色主题：与 DBX 一致的 13 套主题（原生 select 的 option 无法渲染彩色圆点）
const ACCENT_LABELS: Record<AccentName, string> = {
  pearl: "珍珠",
  mist: "薄雾",
  graphite: "石墨",
  cobalt: "钴蓝",
  sage: "鼠尾草",
  amber: "琥珀",
  blush: "粉色",
  vscode: "VS Code",
  idea: "IntelliJ IDEA",
  xcode: "Xcode",
  jetbrains: "JetBrains",
  cursor: "Cursor",
  claude: "Claude",
};
// DBX 配色预览色
const ACCENT_PREVIEW: Record<AccentName, string> = {
  pearl: "#ffffff",
  mist: "#e4eaf2",
  graphite: "#d8dce4",
  cobalt: "#d8e6f7",
  sage: "#dbe9e2",
  amber: "#f4e4b8",
  blush: "#f4d9e6",
  vscode: "#007acc",
  idea: "#4b6eaf",
  xcode: "#0a84ff",
  jetbrains: "#7b61ff",
  cursor: "#6ba4ff",
  claude: "#c47a50",
};
const accentOptions = computed(() =>
  (Object.keys(ACCENT_LABELS) as AccentName[]).map((key) => ({
    key,
    label: ACCENT_LABELS[key],
    color: ACCENT_PREVIEW[key] ?? (draft.theme === "light" ? ACCENTS[key].light : ACCENTS[key].dark),
  }))
);

// 与 DBX 一致的语言 / 缩放档位 / 界面字体选项
const LANGUAGE_OPTIONS = [
  { value: "en-US", flag: "🇺🇸", label: "English" },
  { value: "az", flag: "🇦🇿", label: "Azərbaycan" },
  { value: "es", flag: "🇪🇸", label: "Español" },
  { value: "id", flag: "🇮🇩", label: "Bahasa Indonesia" },
  { value: "it", flag: "🇮🇹", label: "Italiano" },
  { value: "ja", flag: "🇯🇵", label: "日本語" },
  { value: "ko", flag: "🇰🇷", label: "한국어" },
  { value: "pt-BR", flag: "🇧🇷", label: "Português" },
  { value: "pl", flag: "🇵🇱", label: "Polski" },
  { value: "ru", flag: "🇷🇺", label: "Русский" },
  { value: "th", flag: "🇹🇭", label: "ภาษาไทย" },
  { value: "tr", flag: "🇹🇷", label: "Türkçe" },
  { value: "zh-CN", flag: "🇨🇳", label: "简体中文" },
  { value: "zh-TW", flag: "繁", label: "繁體中文" },
];
const ZOOM_OPTIONS = [75, 90, 95, 100, 105, 110, 115, 120, 125, 150, 175];
const UI_FONT_OPTIONS = [
  { value: "system", label: "系统默认" },
  { value: "mono", label: "等宽字体" },
  { value: '"PingFang SC", "Helvetica Neue", sans-serif', label: "苹方 / PingFang SC" },
  { value: '"Microsoft YaHei", sans-serif', label: "微软雅黑" },
  { value: '"Helvetica Neue", Arial, sans-serif', label: "Helvetica Neue" },
  { value: '"Noto Sans CJK SC", sans-serif', label: "思源黑体" },
  { value: "Menlo, Consolas, monospace", label: "Menlo" },
  { value: "Arial, sans-serif", label: "Arial" },
];
const accentOpen = ref(false);
const accentWrap = ref<HTMLElement | null>(null);
function onDocClick(e: MouseEvent) {
  if (accentOpen.value && accentWrap.value && !accentWrap.value.contains(e.target as Node)) {
    accentOpen.value = false;
  }
}

// 应用版本：初值取 package.json，挂载后以 Tauri 打包元数据（tauri.conf.json）为准
const appVersion = ref<string>(__APP_VERSION__);
const copyrightYear = new Date().getFullYear();

// 草稿：控件只改草稿并实时预览，「应用」才提交到全局设置
const draft = reactive<Settings>(structuredClone(toRaw(settings)));
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(settings));

// ---------- 工具栏显示项（拖拽排序写入 toolbarOrder，应用后标题栏按此顺序渲染） ----------
type ToolbarKey = keyof ToolbarVisibility;
interface ToolbarItem {
  key: ToolbarKey;
  label: string;
}

/** 按保存的顺序数组排列条目 */
function orderItems<T extends { key: string }>(items: T[], order: string[]): T[] {
  return [...items].sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
  });
}

const toolbarGroupDefs: { title: string; items: ToolbarItem[] }[] = [
  {
    title: "主操作栏",
    items: [
      { key: "sidebar", label: "侧边栏" },
      { key: "newFile", label: "新建文件" },
      { key: "openFile", label: "打开文件" },
      { key: "openFolder", label: "打开文件夹" },
      { key: "save", label: "保存文件" },
      { key: "saveAs", label: "另存为" },
      { key: "saveAll", label: "全部保存" },
      { key: "find", label: "查找替换" },
      { key: "format", label: "格式化 JSON" },
    ],
  },
  {
    title: "更多菜单",
    items: [],
  },
  {
    title: "右侧工具栏",
    items: [
      { key: "updateButton", label: "更新按钮" },
      { key: "github", label: "GitHub 入口" },
      { key: "gitee", label: "Gitee 入口" },
      { key: "shortcutHint", label: "快捷键提示" },
      { key: "statusBar", label: "状态栏" },
      { key: "themeToggle", label: "主题切换按钮" },
    ],
  },
  {
    title: "系统入口",
    items: [{ key: "systemSettings", label: "设置" }],
  },
];
const toolbarGroups = reactive(
  toolbarGroupDefs.map((g) => ({ ...g, items: orderItems(g.items, draft.toolbarOrder) }))
);

// ---------- 通用拖拽排序（鼠标事件实现，兼容 Tauri WebView） ----------
type SortKind = "toolbar" | "tabMenu";
interface SortState {
  kind: SortKind;
  group: number;
  index: number;
}
const sortState = ref<SortState | null>(null);
const sortTarget = ref<{ group: number; index: number } | null>(null);
/** 按下时缓存各行的屏幕位置，避免被浮层遮挡时 elementFromPoint 失效 */
let sortRowRects: { group: number; index: number; top: number; bottom: number }[] = [];

function isSortSource(kind: SortKind, g: number, i: number) {
  const s = sortState.value;
  return !!s && s.kind === kind && s.group === g && s.index === i;
}
function isSortTarget(kind: SortKind, g: number, i: number) {
  const t = sortTarget.value;
  return !!t && sortState.value?.kind === kind && t.group === g && t.index === i;
}

function onSortMove(e: PointerEvent) {
  if (!sortState.value) return;
  const hit = sortRowRects.find((r) => e.clientY >= r.top && e.clientY <= r.bottom);
  sortTarget.value = hit ? { group: hit.group, index: hit.index } : null;
}

function endSort() {
  const s = sortState.value;
  const t = sortTarget.value;
  if (s && t && t.group === s.group && t.index !== s.index) {
    if (s.kind === "toolbar") {
      const items = toolbarGroups[s.group].items;
      const [moved] = items.splice(s.index, 1);
      items.splice(t.index, 0, moved);
      draft.toolbarOrder = toolbarGroups.flatMap((g) => g.items.map((i) => i.key));
    } else {
      const items = tabMenuGroups[s.group].items;
      const [moved] = items.splice(s.index, 1);
      items.splice(t.index, 0, moved);
      draft.tabMenuOrder = tabMenuGroups.flatMap((g) => g.items.map((i) => i.key));
    }
  }
  sortState.value = null;
  sortTarget.value = null;
  sortRowRects = [];
}

/** 点击上移 / 下移调整顺序（拖拽之外的可靠方式） */
function moveItem(kind: SortKind, g: number, i: number, delta: number) {
  const j = i + delta;
  const items = kind === "toolbar" ? toolbarGroups[g].items : tabMenuGroups[g].items;
  if (j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  if (kind === "toolbar") {
    draft.toolbarOrder = toolbarGroups.flatMap((group) => group.items.map((item) => item.key));
  } else {
    draft.tabMenuOrder = tabMenuGroups.flatMap((group) => group.items.map((item) => item.key));
  }
}

function startSort(kind: SortKind, g: number, i: number, e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  sortState.value = { kind, group: g, index: i };
  sortTarget.value = null;
  sortRowRects = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-sort-row][data-sort-kind="${kind}"]`)
  ).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      group: Number(el.dataset.sortGroup),
      index: Number(el.dataset.sortIndex),
      top: rect.top,
      bottom: rect.bottom,
    };
  });
}

// ---------- 标签页右键菜单显示项 ----------
type TabMenuKey = keyof Settings["tabMenu"];
interface TabMenuItem {
  key: TabMenuKey;
  label: string;
}
const tabMenuGroupDefs: { title: string; items: TabMenuItem[] }[] = [
  {
    title: "标签页操作",
    items: [
      { key: "rename", label: "重命名标签页" },
      { key: "pin", label: "固定 / 取消固定标签页" },
      { key: "reveal", label: "在 Finder 中显示" },
    ],
  },
  {
    title: "关闭操作",
    items: [
      { key: "close", label: "关闭标签页" },
      { key: "closeOthers", label: "关闭其他标签页" },
      { key: "closeAll", label: "关闭全部标签页" },
    ],
  },
];
const tabMenuGroups = reactive(
  tabMenuGroupDefs.map((g) => ({ ...g, items: orderItems(g.items, draft.tabMenuOrder) }))
);
watch(
  draft,
  (d) => applyVisual(d),
  { deep: true }
);

function matches(...words: string[]) {
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  return words.some((w) => w.toLowerCase().includes(q));
}

function setThemeChoice(choice: ThemeChoice) {
  draft.themeChoice = choice;
  draft.theme =
    choice === "system" ? systemTheme() : (choice as "dark" | "light");
}

function apply() {
  Object.assign(settings, draft);
  notify("设置已应用", false);
}

function applyAndClose() {
  Object.assign(settings, draft);
  close();
}

function restoreDefaults() {
  const defaults = {
    ...DEFAULT_SETTINGS,
    toolbarOrder: [...DEFAULT_SETTINGS.toolbarOrder],
    tabMenuOrder: [...DEFAULT_SETTINGS.tabMenuOrder],
  };
  Object.assign(settings, defaults);
  Object.assign(draft, defaults);
  notify("已恢复默认设置", false);
}

function close() {
  applyVisual(settings); // 撤销未应用的预览
  toggleSettings(false);
  emit("close");
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("click", onDocClick, true);
  // 与实际打包版本保持一致（tauri.conf.json 的 version）
  getVersion()
    .then((v) => {
      if (v) appVersion.value = v;
    })
    .catch(() => undefined);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("click", onDocClick, true);
});
</script>

<template>
  <div class="settings-overlay" @click="close">
    <div class="settings-window" @click.stop>
      <!-- 标题栏 -->
      <header class="win-header">
        <svg class="win-gear" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="8" cy="8" r="2.1" />
          <path d="M8 1.8l.55 1.7a4.6 4.6 0 0 1 1.6.66l1.72-.5 1.06 1.83-1.17 1.3a4.7 4.7 0 0 1 0 1.86l1.17 1.3-1.06 1.83-1.72-.5a4.6 4.6 0 0 1-1.6.66L8 14.2l-.55-1.7a4.6 4.6 0 0 1-1.6-.66l-1.72.5-1.06-1.83 1.17-1.3a4.7 4.7 0 0 1 0-1.86L3.07 5.5 4.13 3.67l1.72.5a4.6 4.6 0 0 1 1.6-.66z" stroke-linejoin="round" />
        </svg>
        <span class="win-title">设置</span>
        <span class="win-close" title="关闭 (Esc)" @click="close">
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.5">
            <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </span>
      </header>

      <div class="win-body">
        <!-- 左侧导航 -->
        <aside class="nav">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="nav-item"
            :class="{ active: section === item.key }"
            @click="section = item.key"
          >
            {{ item.label }}
          </button>
        </aside>

        <!-- 右侧内容 -->
        <main class="content">
          <!-- 外观 -->
          <template v-if="section === 'appearance'">
            <div class="search-box">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
              </svg>
              <input v-model="search" placeholder="搜索设置" />
            </div>

            <div class="content-scroll">
              <!-- 通用 -->
              <div class="group-title" v-show="matches('通用') || !search.trim()">通用</div>
              <div class="grid">
                <div class="field" v-show="matches('语言', 'Language')">
                  <label class="field-label">语言 / Language </label>
                  <div class="select-wrap">
                    <select v-model="draft.language">
                      <option v-for="l in LANGUAGE_OPTIONS" :key="l.value" :value="l.value">{{ l.flag }} {{ l.label }}</option>
                    </select>
                  </div>
                </div>
                <div class="field" v-show="matches('配色', '主题')">
                  <label class="field-label">配色主题</label>
                  <div class="select-wrap accent-select" ref="accentWrap">
                    <button type="button" class="accent-trigger" @click="accentOpen = !accentOpen">
                      <span class="accent-dot" :style="{ background: accentOptions.find((o) => o.key === draft.accent)?.color }"></span>
                      <span>{{ ACCENT_LABELS[draft.accent] }}</span>
                    </button>
                    <div class="accent-menu" v-if="accentOpen">
                      <button
                        v-for="o in accentOptions"
                        :key="o.key"
                        type="button"
                        :class="{ on: draft.accent === o.key }"
                        @click="draft.accent = o.key; accentOpen = false"
                      >
                        <span class="accent-dot" :style="{ background: o.color }"></span>
                        <span>{{ o.label }}</span>
                        <span class="accent-check" v-if="draft.accent === o.key">✓</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="field" v-show="matches('界面缩放', '缩放')">
                  <label class="field-label">界面缩放 <HintTip text="调整应用整体界面大小，不影响编辑器内的文字大小。" /></label>
                  <div class="select-wrap">
                    <select v-model.number="draft.zoom">
                      <option v-for="z in ZOOM_OPTIONS" :key="z" :value="z">{{ z }}%</option>
                    </select>
                  </div>
                </div>
                <div class="field field-inline" v-show="matches('字体平滑')">
                  <label class="field-label">字体平滑 <HintTip text="关闭后界面文字不使用抗锯齿，部分屏幕下显示更锐利。" /></label>
                  <button class="switch" :class="{ on: draft.fontSmoothing }" role="switch"
                    :aria-checked="draft.fontSmoothing" @click="draft.fontSmoothing = !draft.fontSmoothing">
                    <span class="knob"></span>
                  </button>
                </div>
                <div class="field" v-show="matches('界面字体', '字体')">
                  <label class="field-label">界面字体 <HintTip text="切换界面使用系统默认字体或等宽字体，不影响编辑器字体。" /></label>
                  <div class="select-wrap">
                    <select v-model="draft.uiFont">
                      <option v-for="f in UI_FONT_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
                    </select>
                  </div>
                </div>
                <div class="field" v-show="matches('编辑器字号', '字号')">
                  <label class="field-label">编辑器字号</label>
                  <div class="stepper">
                    <button class="step-btn" @click="draft.fontSize = Math.max(9, draft.fontSize - 1)">−</button>
                    <span class="step-value">{{ draft.fontSize }}px</span>
                    <button class="step-btn" @click="draft.fontSize = Math.min(28, draft.fontSize + 1)">+</button>
                  </div>
                </div>
              </div>

              <!-- 主题 + 圆角（一行） -->
              <div class="pair-row" v-show="matches('主题', '亮色', '暗色', '跟随系统', '圆角')">
                <div v-show="matches('主题', '亮色', '暗色', '跟随系统')">
                  <label class="field-label mt">主题</label>
                  <div class="segmented">
                    <button :class="{ on: draft.themeChoice === 'light' }" @click="setThemeChoice('light')">
                      <ThemeIcon mode="light" :size="15" /> 亮色
                    </button>
                    <button :class="{ on: draft.themeChoice === 'dark' }" @click="setThemeChoice('dark')">
                      <ThemeIcon mode="dark" :size="15" /> 暗色
                    </button>
                    <button :class="{ on: draft.themeChoice === 'system' }" @click="setThemeChoice('system')">
                      <ThemeIcon mode="system" :size="15" /> 跟随系统
                    </button>
                  </div>
                </div>
                <div v-show="matches('圆角')">
                  <label class="field-label mt">圆角样式</label>
                  <div class="segmented">
                    <button :class="{ on: draft.radius === 'none' }" @click="draft.radius = 'none'">无圆角</button>
                    <button :class="{ on: draft.radius === 'small' }" @click="draft.radius = 'small'">小圆角</button>
                    <button :class="{ on: draft.radius === 'large' }" @click="draft.radius = 'large'">大圆角</button>
                  </div>
                </div>
              </div>

              <!-- 界面布局 -->
              <div class="section-divider" v-show="matches('界面布局', '布局')"></div>
              <div v-show="matches('界面布局', '布局')">
                <label class="field-label mt">界面布局</label>
                <div class="choice-row">
                  <button class="choice-card" :class="{ on: draft.layout === 'modern' }" @click="draft.layout = 'modern'">
                    <span class="choice-title">现代分窗</span>
                    <span class="choice-desc">面板分窗更清晰，标签页为块状样式。</span>
                  </button>
                  <button class="choice-card" :class="{ on: draft.layout === 'classic' }" @click="draft.layout = 'classic'">
                    <span class="choice-title">经典紧凑</span>
                    <span class="choice-desc">使用连续标签栏和更紧凑的面板标题。</span>
                  </button>
                </div>
              </div>

              <!-- 标签栏溢出 -->
              <div v-show="matches('标签栏溢出', '标签')">
                <label class="field-label mt">标签栏溢出</label>
                <div class="choice-row">
                  <button class="choice-card" :class="{ on: draft.tabOverflow === 'scroll' }" @click="draft.tabOverflow = 'scroll'">
                    <span class="choice-title">单行滚动</span>
                    <span class="choice-desc">标签页超出一行时水平滚动显示。</span>
                  </button>
                  <button class="choice-card" :class="{ on: draft.tabOverflow === 'wrap' }" @click="draft.tabOverflow = 'wrap'">
                    <span class="choice-title">多行平铺</span>
                    <span class="choice-desc">标签页超出一行时自动换行，平铺显示所有标签。</span>
                  </button>
                </div>
              </div>

              <!-- 关闭主窗口行为 -->
              <div class="pref-row boxed-pref" v-show="matches('关闭窗口', '退出程序', 'Dock')">
                <div>
                  <div class="pref-title">关闭窗口时退出程序</div>
                  <div class="pref-desc">开启后，点击窗口关闭按钮将彻底退出 NotePlus+，而不是隐藏到 Dock。</div>
                </div>
                <button class="switch" :class="{ on: draft.exitOnClose }" role="switch" :aria-checked="draft.exitOnClose"
                  @click="draft.exitOnClose = !draft.exitOnClose"><span class="knob"></span></button>
              </div>

              <!-- 图标与 Logo 样式 -->
              <div v-show="matches('图标', 'Logo', '黑色')">
                <label class="field-label mt">图标与 Logo 样式</label>
                <div class="choice-row">
                  <button class="choice-card icon-choice" :class="{ on: draft.iconStyle === 'default' }" @click="draft.iconStyle = 'default'">
                    <span class="logo-preview default">
                      <svg width="26" height="26" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <rect x="7" y="4" width="20" height="26" rx="4" />
                        <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
                        <line x1="12" y1="22" x2="18" y2="22" />
                      </svg>
                    </span>
                    <span class="choice-title">默认</span>
                    <span class="choice-desc">使用彩色 NotePlus+ 应用图标。</span>
                  </button>
                  <button class="choice-card icon-choice" :class="{ on: draft.iconStyle === 'black' }" @click="draft.iconStyle = 'black'">
                    <span class="logo-preview black">
                      <svg width="26" height="26" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <rect x="7" y="4" width="20" height="26" rx="4" />
                        <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
                        <line x1="12" y1="22" x2="18" y2="22" />
                      </svg>
                    </span>
                    <span class="choice-title">黑色</span>
                    <span class="choice-desc">应用内使用黑色标识，Dock 使用黑色底板图标。</span>
                  </button>
                </div>
              </div>


              <!-- 编辑器行为 -->
              <div class="group-title" v-show="matches('编辑器') || !search.trim()">编辑器</div>
              <div class="grid">
                <div class="field" v-show="matches('自动换行', '换行')">
                  <label class="field-label">自动换行</label>
                  <div class="field-switch">
                    <button class="switch" :class="{ on: draft.wordWrap }" role="switch" :aria-checked="draft.wordWrap"
                      @click="draft.wordWrap = !draft.wordWrap"><span class="knob"></span></button>
                  </div>
                </div>
                <div class="field" v-show="matches('显示侧边栏', '侧边栏')">
                  <label class="field-label">显示侧边栏</label>
                  <div class="field-switch">
                    <button class="switch" :class="{ on: draft.sidebarVisible }" role="switch" :aria-checked="draft.sidebarVisible"
                      @click="draft.sidebarVisible = !draft.sidebarVisible"><span class="knob"></span></button>
                  </div>
                </div>
              </div>

              <!-- 工具栏显示项 -->
              <div class="section-divider" v-show="matches('工具栏', '主操作栏', '更多菜单', '右侧工具栏', '系统入口')"></div>
              <div class="toolbar-settings" v-show="matches('工具栏', '主操作栏', '更多菜单', '右侧工具栏', '系统入口')">
                <div class="toolbar-desc">用 ↑↓ 或拖拽手柄调整同一区域的顺序，关闭开关可隐藏对应入口。</div>
                <div class="toolbar-grid">
                  <div class="toolbar-group" v-for="(group, gi) in toolbarGroups" :key="group.title">
                    <div class="toolbar-group-title">{{ group.title }}</div>
                    <div class="toolbar-empty" v-if="!group.items.length">暂无项目</div>
                    <div
                      class="toolbar-row"
                      v-for="(item, ii) in group.items"
                      :key="item.key"
                      data-sort-row
                      data-sort-kind="toolbar"
                      :data-sort-group="gi"
                      :data-sort-index="ii"
                      :class="{
                        'sort-source': isSortSource('toolbar', gi, ii),
                        'sort-target': isSortTarget('toolbar', gi, ii),
                      }"
                    >
                      <button
                        class="switch"
                        :class="{ on: draft.toolbar[item.key] }"
                        role="switch"
                        :aria-checked="draft.toolbar[item.key]"
                        @click="draft.toolbar[item.key] = !draft.toolbar[item.key]"
                      ><span class="knob"></span></button>
                      <span class="toolbar-row-label">{{ item.label }}</span>
                      <span class="move-btns">
                        <button class="move-btn" title="上移" :disabled="ii === 0" @click="moveItem('toolbar', gi, ii, -1)">↑</button>
                        <button class="move-btn" title="下移" :disabled="ii === group.items.length - 1" @click="moveItem('toolbar', gi, ii, 1)">↓</button>
                      </span>
                      <span class="drag-handle" title="按住拖拽排序" @pointerdown="startSort('toolbar', gi, ii, $event)" @pointermove="onSortMove" @pointerup="endSort" @pointercancel="endSort">⠿</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 标签页右键菜单显示项 -->
              <div class="section-divider" v-show="matches('右键', '标签页', '菜单')"></div>
              <div class="toolbar-settings" v-show="matches('右键', '标签页', '菜单')">
                <div class="toolbar-desc">控制标签页鼠标右键菜单中显示的操作，用 ↑↓ 或拖拽手柄调整顺序。</div>
                <div class="toolbar-grid">
                  <div class="toolbar-group" v-for="(group, gi) in tabMenuGroups" :key="group.title">
                    <div class="toolbar-group-title">{{ group.title }}</div>
                    <div
                      class="toolbar-row"
                      v-for="(item, ii) in group.items"
                      :key="item.key"
                      data-sort-row
                      data-sort-kind="tabMenu"
                      :data-sort-group="gi"
                      :data-sort-index="ii"
                      :class="{
                        'sort-source': isSortSource('tabMenu', gi, ii),
                        'sort-target': isSortTarget('tabMenu', gi, ii),
                      }"
                    >
                      <button
                        class="switch"
                        :class="{ on: draft.tabMenu[item.key] }"
                        role="switch"
                        :aria-checked="draft.tabMenu[item.key]"
                        @click="draft.tabMenu[item.key] = !draft.tabMenu[item.key]"
                      ><span class="knob"></span></button>
                      <span class="toolbar-row-label">{{ item.label }}</span>
                      <span class="move-btns">
                        <button class="move-btn" title="上移" :disabled="ii === 0" @click="moveItem('tabMenu', gi, ii, -1)">↑</button>
                        <button class="move-btn" title="下移" :disabled="ii === group.items.length - 1" @click="moveItem('tabMenu', gi, ii, 1)">↓</button>
                      </span>
                      <span class="drag-handle" title="按住拖拽排序" @pointerdown="startSort('tabMenu', gi, ii, $event)" @pointermove="onSortMove" @pointerup="endSort" @pointercancel="endSort">⠿</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 更新管理 -->
          <template v-else-if="section === 'updates'">
            <div class="content-scroll page-pad">
              <div class="update-card">
                <div class="update-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M12 3a9 9 0 1 0 9 9" /><path d="M21 3v6h-6" />
                  </svg>
                </div>
                <div class="update-info">
                  <div class="update-title">NotePlus+ <span class="ver-chip">v{{ appVersion }}</span></div>
                  <div class="update-sub">当前为 {{ draft.updateChannel === "preview" ? "预览版" : "稳定版" }}最新构建</div>
                </div>
                <button class="btn" @click="toggleUpdateCenter(true)">检查更新</button>
              </div>

              <div class="group-title">更新偏好</div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">自动检查更新</div>
                  <div class="pref-desc">启动应用时自动检查是否有新版本</div>
                </div>
                <button class="switch" :class="{ on: draft.autoUpdate }" role="switch" :aria-checked="draft.autoUpdate"
                  @click="draft.autoUpdate = !draft.autoUpdate"><span class="knob"></span></button>
              </div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">更新渠道</div>
                  <div class="pref-desc">预览版包含最新功能，但可能不够稳定</div>
                </div>
                <div class="select-wrap narrow">
                  <select v-model="draft.updateChannel">
                    <option value="stable">稳定版</option>
                    <option value="preview">预览版</option>
                  </select>
                </div>
              </div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">发布说明</div>
                  <div class="pref-desc">查看每个版本的变更记录</div>
                </div>
                <button class="btn" @click="toggleUpdateCenter(true)">查看</button>
              </div>
            </div>
          </template>

          <!-- 关于我们 -->
          <template v-else>
            <div class="content-scroll page-pad about-page">
              <div class="about-logo" :class="{ black: draft.iconStyle === 'black' }">
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <rect x="7" y="4" width="20" height="26" rx="4" />
                  <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
                  <line x1="12" y1="22" x2="18" y2="22" />
                </svg>
                <span class="about-plus">+</span>
              </div>
              <div class="about-name">NotePlus+</div>
              <div class="about-ver">v{{ appVersion }} · macOS</div>
              <div class="about-desc">macOS 上的轻量级代码编辑器，为高效编辑而生。</div>
              <div class="group-title">技术栈</div>
              <div class="stack-list">
                <span class="stack-chip">Tauri 2</span>
                <span class="stack-chip">Rust</span>
                <span class="stack-chip">Vue 3</span>
                <span class="stack-chip">TypeScript</span>
                <span class="stack-chip">CodeMirror 6</span>
                <span class="stack-chip">Tailwind CSS</span>
              </div>
              <div class="group-title">版本信息</div>
              <div class="info-table">
                <div><span>应用版本</span><span>{{ appVersion }} ({{ copyrightYear }})</span></div>
                <div><span>构建目标</span><span>macOS · Apple Silicon</span></div>
                <div><span>许可协议</span><span>MIT License</span></div>
              </div>
              <div class="about-copy">© 2026 NotePlus+ · 使用 dbx 同源技术栈构建</div>
            </div>
          </template>
        </main>
      </div>

      <!-- 底部按钮栏 -->
      <footer class="win-footer">
        <button class="btn ghost" @click="restoreDefaults">恢复默认</button>
        <span class="dirty-hint" v-if="dirty">● 有未应用的更改</span>
        <span class="spacer"></span>
        <button class="btn" @click="close">关闭</button>
        <button class="btn" :class="{ primary: dirty }" :disabled="!dirty" @click="apply">应用</button>
        <button class="btn primary" @click="applyAndClose">应用并关闭</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(3px);
}

.settings-window {
  width: min(1000px, 94vw);
  height: min(700px, 90vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: pop 0.16s ease-out;
  font-size: 14px;
}

@keyframes pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 标题栏 */
.win-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.win-gear { color: var(--accent); }
.win-title { font-size: 16px; font-weight: 600; color: var(--text); }
.win-close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--ui-radius, 6px);
  color: var(--muted);
  cursor: pointer;
}
.win-close:hover { background: var(--hover); color: var(--text); }

/* 主体 */
.win-body { display: flex; flex: 1; min-height: 0; }

.nav {
  width: 176px;
  flex-shrink: 0;
  padding: 10px 8px;
  background: var(--panel-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  height: 36px;
  padding: 0 12px;
  text-align: left;
  border: none;
  border-radius: var(--ui-radius, 6px);
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.nav-item:hover { background: var(--hover); color: var(--text); }
.nav-item.active {
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}

.content { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 14px 20px 0; }

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--muted);
  flex-shrink: 0;
}
.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  user-select: text;
}
.search-box input::placeholder { color: var(--muted); }

.content-scroll { flex: 1; overflow-y: auto; padding: 4px 2px 20px; }
.page-pad { padding-top: 8px; }
.section-divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0 12px;
}
.toolbar-desc {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 12px;
}
.toolbar-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
}
.toolbar-group {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
}
.toolbar-group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  border-radius: 5px;
  user-select: none;
}
.toolbar-row.sort-source { opacity: 0.4; }
.toolbar-row.sort-target {
  background: var(--accent-tint);
  box-shadow: inset 0 0 0 1px var(--accent-edge);
}
.toolbar-row .switch { transform: scale(0.9); transform-origin: left center; }
.toolbar-row-label {
  flex: 1;
  font-size: 13px;
  color: var(--text);
}
.toolbar-empty {
  font-size: 12px;
  color: var(--muted);
  opacity: 0.7;
  padding: 4px 0 6px;
}
.move-btns { display: inline-flex; gap: 1px; }
.move-btn {
  width: 18px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.move-btn:hover:not(:disabled) { background: var(--hover); color: var(--text); }
.move-btn:disabled { opacity: 0.25; cursor: default; }
.drag-handle {
  color: var(--muted);
  font-size: 15px;
  cursor: grab;
  padding: 0 2px;
  user-select: none;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 18px 0 12px;
}
.group-title:first-child { margin-top: 8px; }

/* 与 DBX 外观设置一致：三列格子，每项独立成框 */
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 14px;
}
.grid > .field {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
  transition: border-color 0.15s, background-color 0.15s;
}
.grid > .field:hover {
  border-color: var(--muted);
  background: var(--hover);
}
.field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.field-inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.field-inline .field-label { flex: 1; }
.field-label { font-size: 14px; color: var(--text); }
.field-label.mt { margin: 18px 0 10px; display: block; }
.hint { color: var(--muted); font-size: 12px; margin-left: 4px; cursor: help; }
.field-switch { height: 34px; display: flex; align-items: center; }

/* 下拉 */
.select-wrap { position: relative; }
.select-wrap.narrow { width: 130px; }
.select-wrap::after {
  content: "";
  position: absolute;
  right: 11px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-right: 1.4px solid var(--muted);
  border-bottom: 1.4px solid var(--muted);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
select {
  width: 100%;
  height: 36px;
  padding: 0 30px 0 12px;
  appearance: none;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 14px;
  outline: none;
  cursor: pointer;
}
select:focus { border-color: var(--accent); }

/* 配色主题：带彩色圆点的自定义下拉 */
.accent-select { position: relative; }
.accent-trigger {
  width: 100%;
  height: 36px;
  padding: 0 30px 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.accent-trigger:hover { border-color: var(--muted); }
.accent-dot {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
}
.accent-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.accent-menu > button {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.accent-menu > button:hover { background: var(--hover); }
.accent-menu > button.on { color: var(--accent); font-weight: 600; }
.accent-check { margin-left: auto; font-size: 11px; }

/* 分段控件 */
/* 与「通用」区域一致的两列网格：左列主题、右列圆角样式 */
.pair-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
  align-items: stretch;
  margin-top: 12px;
}
.pair-row > div {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
  transition: border-color 0.15s, background-color 0.15s;
}
.pair-row > div:hover {
  border-color: var(--muted);
  background: var(--hover);
}
.pair-row .field-label.mt { margin: 0 0 10px; }
.segmented { display: inline-flex; gap: 4px; }
.segmented button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.segmented button:hover { background: var(--hover); color: var(--text); }
.segmented button.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, var(--panel-2));
  color: var(--accent);
  font-weight: 600;
}

/* 步进器 */
.stepper { display: flex; align-items: center; gap: 8px; height: 32px; }
.step-btn {
  width: 28px; height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.step-btn:hover { background: var(--hover); }
.step-value { min-width: 52px; text-align: center; font-size: 14px; color: var(--text); }

/* 开关 */
.switch {
  position: relative;
  width: 34px; height: 20px;
  border: none;
  border-radius: 10px;
  background: var(--hover);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}
.switch .knob {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transition: left 0.15s;
}
.switch.on { background: var(--accent); }
.switch.on .knob { left: 16px; }

/* 选择卡片 */
.choice-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.choice-card {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.choice-card:hover { border-color: var(--muted); }
.choice-card.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--panel-2));
}
.choice-title { font-size: 14px; font-weight: 600; color: var(--text); }
.choice-card.on .choice-title { color: var(--accent); }
.choice-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }

/* 图标样式卡片：图标居左，标题与说明居右 */
.icon-choice {
  display: grid;
  grid-template-columns: 42px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 4px;
  align-items: center;
}
.logo-preview {
  grid-row: 1 / 3;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  flex-shrink: 0;
}
.logo-preview.default { background: linear-gradient(145deg, #2b3f76, #16708f); }
.logo-preview.black { background: #000; }

/* 更新管理 */
.update-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
}
.update-icon {
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--ui-radius, 6px);
  background: color-mix(in srgb, var(--accent) 18%, var(--panel));
  color: var(--accent);
}
.update-info { flex: 1; }
.update-title { font-size: 16px; font-weight: 600; color: var(--text); }
.ver-chip {
  font-size: 12px; font-weight: 500;
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1px 7px;
  margin-left: 6px;
}
.update-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.pref-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.pref-title { font-size: 14px; color: var(--text); }
.pref-desc { font-size: 12px; color: var(--muted); margin-top: 4px; }
/* 「关闭窗口时退出程序」单独加边框强调 */
.boxed-pref {
  margin: 14px 0 4px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
}

/* 关于我们 */
.about-page { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 18px; }
.about-logo.black { background: #000; }
.about-logo {
  position: relative;
  width: 68px; height: 68px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px;
  background: linear-gradient(145deg, #2b3f76, #16708f);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.about-plus {
  position: absolute; right: -6px; bottom: -6px;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: #101820;
  font-size: 17px; font-weight: 700; line-height: 24px;
}
.about-name { font-size: 24px; font-weight: 700; color: var(--text); margin-top: 16px; }
.about-ver { font-size: 12px; color: var(--muted); margin-top: 4px; }
.about-desc { font-size: 13px; color: var(--muted); margin-top: 10px; }
.about-page .group-title { align-self: flex-start; width: 100%; text-align: left; }
.stack-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; }
.stack-chip {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
}
.info-table { width: 100%; }
.info-table > div {
  display: flex; justify-content: space-between;
  padding: 9px 2px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text);
}
.info-table > div > span:first-child { color: var(--muted); }
.about-copy { font-size: 12px; color: var(--muted); margin: 20px 0 8px; }

/* 底部 */
.win-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 18px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.spacer { flex: 1; }
.dirty-hint { font-size: 12px; color: var(--accent); margin-left: 6px; }
.btn {
  height: 32px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover { background: var(--hover); }
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn:disabled:hover { background: var(--panel-2); }
.btn.ghost { background: transparent; color: var(--muted); }
.btn.ghost:hover { background: var(--hover); color: var(--text); }
.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  font-weight: 600;
}
.btn.primary:hover { filter: brightness(1.1); }
</style>
