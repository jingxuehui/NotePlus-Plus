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
import { t } from "@/i18n";
import { isMac } from "@/utils/platform";
import HintTip from "@/components/HintTip.vue";
import ThemeIcon from "@/components/ThemeIcon.vue";
import LocaleFlag from "@/components/LocaleFlag.vue";

const emit = defineEmits<{ close: [] }>();

type SectionKey = "appearance" | "updates" | "about";
const navItems: { key: SectionKey; label: string }[] = [
  { key: "appearance", label: "set.navAppearance" },
  { key: "updates", label: "set.navUpdates" },
  { key: "about", label: "set.navAbout" },
];

const section = ref<SectionKey>("appearance");
const search = ref("");

// 配色主题：与 DBX 一致的 13 套主题（原生 select 的 option 无法渲染彩色圆点）
const ACCENT_LABELS: Record<AccentName, string> = {
  pearl: "accent.pearl",
  mist: "accent.mist",
  graphite: "accent.graphite",
  cobalt: "accent.cobalt",
  sage: "accent.sage",
  amber: "accent.amber",
  blush: "accent.blush",
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
    label: t(ACCENT_LABELS[key]),
    color: ACCENT_PREVIEW[key] ?? (draft.theme === "light" ? ACCENTS[key].light : ACCENTS[key].dark),
  }))
);

// 与 DBX 一致的语言 / 缩放档位 / 界面字体选项
// 不使用旗帜 emoji：Windows WebView2 缺少彩色旗帜字体，会退化成字母码；改用自绘 CSS 徽章
// 仅保留已完整实现的三种语言；其余语言尚未翻译，暂不提供选项
const LANGUAGE_OPTIONS = [
  { value: "en-US", flag: "🇺🇸", flagIcon: "us", label: "English" },
  { value: "zh-CN", flag: "🇨🇳", flagIcon: "cn", label: "简体中文" },
  { value: "zh-TW", flag: "繁", label: "繁體中文" },
];
function langOpt(value: string) {
  return LANGUAGE_OPTIONS.find((l) => l.value === value) ?? LANGUAGE_OPTIONS[0];
}
const ZOOM_OPTIONS = [75, 90, 95, 100, 105, 110, 115, 120, 125, 150, 175];
const UI_FONT_OPTIONS = [
  { value: "system", label: "font.system" },
  { value: "mono", label: "font.mono" },
  { value: '"PingFang SC", "Helvetica Neue", sans-serif', label: "font.pingFang" },
  { value: '"Microsoft YaHei", sans-serif', label: "font.yahei" },
  { value: '"Helvetica Neue", Arial, sans-serif', label: "Helvetica Neue" },
  { value: '"Noto Sans CJK SC", sans-serif', label: "font.noto" },
  { value: "Menlo, Consolas, monospace", label: "Menlo" },
  { value: "Arial, sans-serif", label: "Arial" },
];
const accentOpen = ref(false);
const accentWrap = ref<HTMLElement | null>(null);
const langOpen = ref(false);
const langWrap = ref<HTMLElement | null>(null);
function onDocClick(e: MouseEvent) {
  if (accentOpen.value && accentWrap.value && !accentWrap.value.contains(e.target as Node)) {
    accentOpen.value = false;
    endPreview();
  }
  if (langOpen.value && langWrap.value && !langWrap.value.contains(e.target as Node)) {
    langOpen.value = false;
    endPreview();
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
    title: "tb.groupMain",
    items: [
      { key: "sidebar", label: "tb.sidebar" },
      { key: "newFile", label: "tb.newFile" },
      { key: "openFile", label: "tb.openFile" },
      { key: "openFolder", label: "tb.openFolder" },
      { key: "save", label: "tb.save" },
      { key: "saveAs", label: "tb.saveAs" },
      { key: "saveAll", label: "tb.saveAll" },
      { key: "format", label: "tb.format" },
    ],
  },
  {
    title: "tb.groupMore",
    items: [{ key: "tools", label: "more.tools" }],
  },
  {
    title: "tb.groupRight",
    items: [
      { key: "updateButton", label: "tb.updateButton" },
      { key: "github", label: "tb.github" },
      { key: "gitee", label: "tb.gitee" },
      { key: "shortcutHint", label: "tb.shortcutHint" },
      { key: "statusBar", label: "tb.statusBar" },
      { key: "themeToggle", label: "tb.themeToggle" },
    ],
  },
  {
    title: "tb.groupSystem",
    items: [{ key: "systemSettings", label: "tb.settings" }],
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
    title: "tm.groupTabs",
    items: [
      { key: "rename", label: "tab.rename" },
      { key: "pin", label: "tm.pinToggle" },
      { key: "reveal", label: "tab.reveal" },
    ],
  },
  {
    title: "tm.groupClose",
    items: [
      { key: "close", label: "tab.close" },
      { key: "closeOthers", label: "tab.closeOthers" },
      { key: "closeAll", label: "tab.closeAll" },
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

// 语言 / 配色 / 主题 / 圆角：改动即时生效并持久化（不依赖「应用」按钮）。
// 其余设置仍走草稿模型：改动仅预览，点「应用」才提交。
watch(() => draft.language, (v) => { settings.language = v; });
watch(() => draft.accent, (v) => { settings.accent = v; });
watch(
  () => draft.themeChoice,
  (v) => {
    settings.themeChoice = v;
    settings.theme = v === "system" ? systemTheme() : (v as "dark" | "light");
  }
);
watch(() => draft.radius, (v) => { settings.radius = v; });

// ---------- 悬停预览：语言 / 配色 / 主题 / 圆角 ----------
let previewBackup: Pick<Settings, "language" | "accent" | "theme" | "themeChoice" | "radius"> | null = null;
/** 临时应用预览值；多次 hover 只备份最初的真实设置 */
function previewSetting(patch: Partial<Settings>) {
  if (!previewBackup) {
    previewBackup = {
      language: settings.language,
      accent: settings.accent,
      theme: settings.theme,
      themeChoice: settings.themeChoice,
      radius: settings.radius,
    };
  }
  Object.assign(settings, patch);
}
/** 鼠标移出选项区时恢复真实设置 */
function endPreview() {
  if (!previewBackup) return;
  Object.assign(settings, previewBackup);
  previewBackup = null;
}
/** 点击确认时清除备份，避免随后的 mouseleave 把新选择撤销 */
function commitPreview() {
  previewBackup = null;
}

function matches(...words: string[]) {
  const q = search.value.trim().toLowerCase();
  if (!q) return true;
  return words.some((w) => w.toLowerCase().includes(q));
}

function setThemeChoice(choice: ThemeChoice) {
  commitPreview();
  draft.themeChoice = choice;
  draft.theme =
    choice === "system" ? systemTheme() : (choice as "dark" | "light");
}

/** 提交草稿时深拷贝，避免 settings 与 draft 共享嵌套对象引用（共享后再次修改草稿会同步改动已保存设置，dirty 恒为 false） */
function commitDraft() {
  Object.assign(settings, structuredClone(toRaw(draft)));
}

function apply() {
  commitDraft();
  notify(t("set.appliedToast"), false);
}

function applyAndClose() {
  commitDraft();
  close();
}

function restoreDefaults() {
  Object.assign(settings, structuredClone(toRaw(DEFAULT_SETTINGS)));
  Object.assign(draft, structuredClone(toRaw(DEFAULT_SETTINGS)));
  notify(t("set.resetToast"), false);
}

function close() {
  endPreview();
  applyVisual(settings); // 撤销未应用的预览
  toggleSettings(false);
  emit("close");
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    if (previewBackup) endPreview();
    else close();
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
        <span class="win-title">{{ t("set.title") }}</span>
        <span class="win-close" :title="t('set.closeTip')" @click="close">
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
            {{ t(item.label) }}
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
              <input v-model="search" :placeholder="t('set.searchPlaceholder')" />
            </div>

            <div class="content-scroll">
              <!-- 通用 -->
              <div class="group-title" v-show="matches('通用') || !search.trim()">{{ t("set.grpGeneral") }}</div>
              <div class="grid">
                <div class="field" v-show="matches('语言', 'Language')">
                  <label class="field-label">{{ t("set.language") }}</label>
                  <div class="select-wrap lang-select" ref="langWrap">
                    <button type="button" class="lang-trigger" @click="langOpen = !langOpen">
                      <LocaleFlag :option="langOpt(draft.language)" />
                      <span>{{ langOpt(draft.language).label }}</span>
                    </button>
                    <div class="lang-menu" v-if="langOpen" @mouseleave="endPreview">
                      <button
                        v-for="l in LANGUAGE_OPTIONS"
                        :key="l.value"
                        type="button"
                        :class="{ on: draft.language === l.value }"
                        @mouseenter="previewSetting({ language: l.value })"
                        @click="commitPreview(); draft.language = l.value; langOpen = false"
                      >
                        <LocaleFlag :option="l" />
                        <span>{{ l.label }}</span>
                        <span class="accent-check" v-if="draft.language === l.value">✓</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="field" v-show="matches('配色', '主题')">
                  <label class="field-label">{{ t("set.accent") }}</label>
                  <div class="select-wrap accent-select" ref="accentWrap">
                    <button type="button" class="accent-trigger" @click="accentOpen = !accentOpen">
                      <span class="accent-dot" :style="{ background: accentOptions.find((o) => o.key === draft.accent)?.color }"></span>
                      <span>{{ t(ACCENT_LABELS[draft.accent]) }}</span>
                    </button>
                    <div class="accent-menu" v-if="accentOpen" @mouseleave="endPreview">
                      <button
                        v-for="o in accentOptions"
                        :key="o.key"
                        type="button"
                        :class="{ on: draft.accent === o.key }"
                        @mouseenter="previewSetting({ accent: o.key })"
                        @click="commitPreview(); draft.accent = o.key; accentOpen = false"
                      >
                        <span class="accent-dot" :style="{ background: o.color }"></span>
                        <span>{{ o.label }}</span>
                        <span class="accent-check" v-if="draft.accent === o.key">✓</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div class="field" v-show="matches('界面缩放', '缩放')">
                  <label class="field-label">{{ t("set.zoom") }} <HintTip :text="t('tip.zoom')" /></label>
                  <div class="select-wrap">
                    <select v-model.number="draft.zoom">
                      <option v-for="z in ZOOM_OPTIONS" :key="z" :value="z">{{ z }}%</option>
                    </select>
                  </div>
                </div>
                <div class="field field-inline" v-show="matches('字体平滑')">
                  <label class="field-label">{{ t("set.fontSmoothing") }} <HintTip :text="t('tip.fontSmoothing')" /></label>
                  <button class="switch" :class="{ on: draft.fontSmoothing }" role="switch"
                    :aria-checked="draft.fontSmoothing" @click="draft.fontSmoothing = !draft.fontSmoothing">
                    <span class="knob"></span>
                  </button>
                </div>
                <div class="field" v-show="matches('界面字体', '字体')">
                  <label class="field-label">{{ t("set.uiFont") }} <HintTip :text="t('tip.uiFont')" /></label>
                  <div class="select-wrap">
                    <select v-model="draft.uiFont">
                      <option v-for="f in UI_FONT_OPTIONS" :key="f.value" :value="f.value">{{ t(f.label) }}</option>
                    </select>
                  </div>
                </div>
                <div class="field" v-show="matches('编辑器字号', '字号')">
                  <label class="field-label">{{ t("set.editorFontSize") }}</label>
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
                  <label class="field-label mt">{{ t("set.theme") }}</label>
                  <div class="segmented">
                    <button :class="{ on: draft.themeChoice === 'light' }" @click="setThemeChoice('light')">
                      <ThemeIcon mode="light" :size="15" /> {{ t("set.themeLight") }}
                    </button>
                    <button :class="{ on: draft.themeChoice === 'dark' }" @click="setThemeChoice('dark')">
                      <ThemeIcon mode="dark" :size="15" /> {{ t("set.themeDark") }}
                    </button>
                    <button :class="{ on: draft.themeChoice === 'system' }" @click="setThemeChoice('system')">
                      <ThemeIcon mode="system" :size="15" /> {{ t("set.themeSystem") }}
                    </button>
                  </div>
                </div>
                <div v-show="matches('圆角')">
                  <label class="field-label mt">{{ t("set.radius") }}</label>
                  <div class="segmented">
                    <button :class="{ on: draft.radius === 'none' }" @click="draft.radius = 'none'">{{ t("set.radiusNone") }}</button>
                    <button :class="{ on: draft.radius === 'small' }" @click="draft.radius = 'small'">{{ t("set.radiusSmall") }}</button>
                    <button :class="{ on: draft.radius === 'large' }" @click="draft.radius = 'large'">{{ t("set.radiusLarge") }}</button>
                  </div>
                </div>
              </div>

              <!-- 界面布局 -->
              <div class="section-divider" v-show="matches('界面布局', '布局')"></div>
              <div v-show="matches('界面布局', '布局')">
                <label class="field-label mt">{{ t("set.layout") }}</label>
                <div class="choice-row">
                  <button class="choice-card" :class="{ on: draft.layout === 'modern' }" @click="draft.layout = 'modern'">
                    <span class="choice-title">{{ t("set.layoutModern") }}</span>
                    <span class="choice-desc">{{ t("set.layoutModernDesc") }}</span>
                  </button>
                  <button class="choice-card" :class="{ on: draft.layout === 'classic' }" @click="draft.layout = 'classic'">
                    <span class="choice-title">{{ t("set.layoutClassic") }}</span>
                    <span class="choice-desc">{{ t("set.layoutClassicDesc") }}</span>
                  </button>
                </div>
              </div>

              <!-- 标签栏溢出 -->
              <div v-show="matches('标签栏溢出', '标签')">
                <label class="field-label mt">{{ t("set.tabOverflow") }}</label>
                <div class="choice-row">
                  <button class="choice-card" :class="{ on: draft.tabOverflow === 'scroll' }" @click="draft.tabOverflow = 'scroll'">
                    <span class="choice-title">{{ t("set.tabScroll") }}</span>
                    <span class="choice-desc">{{ t("set.tabScrollDesc") }}</span>
                  </button>
                  <button class="choice-card" :class="{ on: draft.tabOverflow === 'wrap' }" @click="draft.tabOverflow = 'wrap'">
                    <span class="choice-title">{{ t("set.tabWrap") }}</span>
                    <span class="choice-desc">{{ t("set.tabWrapDesc") }}</span>
                  </button>
                </div>
              </div>

              <!-- 关闭主窗口行为（macOS：Dock 驻留机制，Windows 无此概念） -->
              <div class="pref-row boxed-pref" v-show="isMac && matches('关闭窗口', '退出程序', 'Dock')">
                <div>
                  <div class="pref-title">{{ t("set.exitOnClose") }}</div>
                  <div class="pref-desc">{{ t("set.exitOnCloseDesc") }}</div>
                </div>
                <button class="switch" :class="{ on: draft.exitOnClose }" role="switch" :aria-checked="draft.exitOnClose"
                  @click="draft.exitOnClose = !draft.exitOnClose"><span class="knob"></span></button>
              </div>

              <!-- 图标与 Logo 样式（macOS：Dock 图标，Windows 无此机制） -->
              <div v-show="isMac && matches('图标', 'Logo', '黑色')">
                <label class="field-label mt">{{ t("set.iconStyle") }}</label>
                <div class="choice-row">
                  <button class="choice-card icon-choice" :class="{ on: draft.iconStyle === 'default' }" @click="draft.iconStyle = 'default'">
                    <span class="logo-preview default">
                      <svg width="26" height="26" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <rect x="7" y="4" width="20" height="26" rx="4" />
                        <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
                        <line x1="12" y1="22" x2="18" y2="22" />
                      </svg>
                    </span>
                    <span class="choice-title">{{ t("set.iconDefault") }}</span>
                    <span class="choice-desc">{{ t("set.iconDefaultDesc") }}</span>
                  </button>
                  <button class="choice-card icon-choice" :class="{ on: draft.iconStyle === 'black' }" @click="draft.iconStyle = 'black'">
                    <span class="logo-preview black">
                      <svg width="26" height="26" viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <rect x="7" y="4" width="20" height="26" rx="4" />
                        <line x1="12" y1="12" x2="22" y2="12" /><line x1="12" y1="17" x2="22" y2="17" />
                        <line x1="12" y1="22" x2="18" y2="22" />
                      </svg>
                    </span>
                    <span class="choice-title">{{ t("set.iconBlack") }}</span>
                    <span class="choice-desc">{{ t("set.iconBlackDesc") }}</span>
                  </button>
                </div>
              </div>


              <!-- 编辑器行为 -->
              <div class="group-title" v-show="matches('编辑器') || !search.trim()">{{ t("set.grpEditor") }}</div>
              <div class="grid">
                <div class="field" v-show="matches('自动换行', '换行')">
                  <label class="field-label">{{ t("set.wordWrap") }}</label>
                  <div class="field-switch">
                    <button class="switch" :class="{ on: draft.wordWrap }" role="switch" :aria-checked="draft.wordWrap"
                      @click="draft.wordWrap = !draft.wordWrap"><span class="knob"></span></button>
                  </div>
                </div>
                <div class="field" v-show="matches('显示侧边栏', '侧边栏')">
                  <label class="field-label">{{ t("set.showSidebar") }}</label>
                  <div class="field-switch">
                    <button class="switch" :class="{ on: draft.sidebarVisible }" role="switch" :aria-checked="draft.sidebarVisible"
                      @click="draft.sidebarVisible = !draft.sidebarVisible"><span class="knob"></span></button>
                  </div>
                </div>
              </div>

              <!-- 工具栏显示项 -->
              <div class="section-divider" v-show="matches('工具栏', '主操作栏', '更多菜单', '右侧工具栏', '系统入口')"></div>
              <div class="toolbar-settings" v-show="matches('工具栏', '主操作栏', '更多菜单', '右侧工具栏', '系统入口')">
                <div class="toolbar-desc">{{ t("set.toolbarDesc") }}</div>
                <div class="toolbar-grid">
                  <div class="toolbar-group" v-for="(group, gi) in toolbarGroups" :key="group.title">
                    <div class="toolbar-group-title">
                      <span>{{ t(group.title) }}</span>
                      <button
                        v-if="group.title === 'tb.groupMore'"
                        class="switch group-switch"
                        :class="{ on: draft.toolbar.moreMenu }"
                        role="switch"
                        :title="t('tb.moreSwitchTip')"
                        :aria-checked="draft.toolbar.moreMenu"
                        @click="draft.toolbar.moreMenu = !draft.toolbar.moreMenu"
                      ><span class="knob"></span></button>
                    </div>
                    <div class="toolbar-empty" v-if="!group.items.length && group.title !== 'tb.groupMore'">{{ t("tb.noItems") }}</div>
                    <div class="toolbar-hint" v-if="group.title === 'tb.groupMore'">{{ t("tb.moreHint") }}</div>
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
                      <span class="toolbar-row-label">{{ t(item.label) }}</span>
                      <span class="move-btns">
                        <button class="move-btn" :title="t('tb.moveUp')" :disabled="ii === 0" @click="moveItem('toolbar', gi, ii, -1)">↑</button>
                        <button class="move-btn" :title="t('tb.moveDown')" :disabled="ii === group.items.length - 1" @click="moveItem('toolbar', gi, ii, 1)">↓</button>
                      </span>
                      <span class="drag-handle" :title="t('tb.dragSort')" @pointerdown="startSort('toolbar', gi, ii, $event)" @pointermove="onSortMove" @pointerup="endSort" @pointercancel="endSort">⠿</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 标签页右键菜单显示项 -->
              <div class="section-divider" v-show="matches('右键', '标签页', '菜单')"></div>
              <div class="toolbar-settings" v-show="matches('右键', '标签页', '菜单')">
                <div class="toolbar-desc">{{ t("tm.desc") }}</div>
                <div class="toolbar-grid">
                  <div class="toolbar-group" v-for="(group, gi) in tabMenuGroups" :key="group.title">
                    <div class="toolbar-group-title">{{ t(group.title) }}</div>
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
                      <span class="toolbar-row-label">{{ t(item.label) }}</span>
                      <span class="move-btns">
                        <button class="move-btn" :title="t('tb.moveUp')" :disabled="ii === 0" @click="moveItem('tabMenu', gi, ii, -1)">↑</button>
                        <button class="move-btn" :title="t('tb.moveDown')" :disabled="ii === group.items.length - 1" @click="moveItem('tabMenu', gi, ii, 1)">↓</button>
                      </span>
                      <span class="drag-handle" :title="t('tb.dragSort')" @pointerdown="startSort('tabMenu', gi, ii, $event)" @pointermove="onSortMove" @pointerup="endSort" @pointercancel="endSort">⠿</span>
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
                  <div class="update-sub">{{ t("set.channelNow", { channel: draft.updateChannel === "preview" ? t("set.channelPreview") : t("set.channelStable") }) }}</div>
                </div>
                <button class="btn" @click="toggleUpdateCenter(true)">{{ t("titlebar.checkUpdate") }}</button>
              </div>

              <div class="group-title">{{ t("set.grpUpdatePref") }}</div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">{{ t("set.autoUpdate") }}</div>
                  <div class="pref-desc">{{ t("set.autoUpdateDesc") }}</div>
                </div>
                <button class="switch" :class="{ on: draft.autoUpdate }" role="switch" :aria-checked="draft.autoUpdate"
                  @click="draft.autoUpdate = !draft.autoUpdate"><span class="knob"></span></button>
              </div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">{{ t("set.updateChannel") }}</div>
                  <div class="pref-desc">{{ t("set.channelDesc") }}</div>
                </div>
                <div class="select-wrap narrow">
                  <select v-model="draft.updateChannel">
                    <option value="stable">{{ t("set.channelStable") }}</option>
                    <option value="preview">{{ t("set.channelPreview") }}</option>
                  </select>
                </div>
              </div>
              <div class="pref-row">
                <div>
                  <div class="pref-title">{{ t("set.releaseNotes") }}</div>
                  <div class="pref-desc">{{ t("set.releaseNotesDesc") }}</div>
                </div>
                <button class="btn" @click="toggleUpdateCenter(true)">{{ t("set.view") }}</button>
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
              <div class="about-ver">v{{ appVersion }} · {{ isMac ? "macOS" : "Windows" }}</div>
              <div class="about-desc">{{ t("about.desc") }}</div>
              <div class="group-title">{{ t("about.techStack") }}</div>
              <div class="stack-list">
                <span class="stack-chip">Tauri 2</span>
                <span class="stack-chip">Rust</span>
                <span class="stack-chip">Vue 3</span>
                <span class="stack-chip">TypeScript</span>
                <span class="stack-chip">CodeMirror 6</span>
                <span class="stack-chip">Tailwind CSS</span>
              </div>
              <div class="group-title">{{ t("about.versionInfo") }}</div>
              <div class="info-table">
                <div><span>{{ t("about.appVersion") }}</span><span>{{ appVersion }} ({{ copyrightYear }})</span></div>
                <div><span>{{ t("about.buildTarget") }}</span><span>{{ isMac ? "macOS · Apple Silicon" : "Windows x64" }}</span></div>
                <div><span>{{ t("about.license") }}</span><span>MIT License</span></div>
              </div>
              <div class="about-copy">© {{ copyrightYear }} NotePlus+ · {{ t("about.builtWith") }}</div>
            </div>
          </template>
        </main>
      </div>

      <!-- 底部按钮栏 -->
      <footer class="win-footer">
        <button class="btn ghost" @click="restoreDefaults">{{ t("set.restoreDefaults") }}</button>
        <span class="dirty-hint" v-if="dirty">{{ t("set.dirtyHint") }}</span>
        <span class="spacer"></span>
        <button class="btn" @click="close">{{ t("common.close") }}</button>
        <button class="btn" :class="{ primary: dirty }" :disabled="!dirty" @click="apply">{{ t("set.apply") }}</button>
        <button class="btn primary" @click="applyAndClose">{{ t("set.applyAndClose") }}</button>
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
  /* 遮罩只压暗主界面；弹窗自身用实色主题面板，避免半透明叠遮罩后发灰 */
  background: rgba(0, 0, 0, 0.26);
  backdrop-filter: blur(3px);
}

.settings-window {
  width: min(1000px, 94vw);
  height: min(700px, 90vh);
  display: flex;
  flex-direction: column;
  /* 用接近实色的主题面板色：颜色干净且随配色主题变化，磨砂质感由模糊与边缘透出体现 */
  background: var(--panel-solid, var(--panel));
  backdrop-filter: blur(28px) saturate(1.3);
  -webkit-backdrop-filter: blur(28px) saturate(1.3);
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
  /* 红框区域：不做颜色填充，直接透出磨砂背景 */
  background: transparent;
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
  /* 红框区域：不做颜色填充，只保留边框 */
  background: transparent;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.group-switch { transform: scale(0.82); transform-origin: right center; }
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  border-radius: calc(var(--ui-radius, 6px) - 1px);
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
  border-radius: calc(var(--ui-radius, 6px) - 2px);
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
  border-radius: calc(var(--ui-radius, 6px) + 2px);
  /* 红框区域（语言等设置卡片）：不做颜色填充，透出磨砂背景 */
  background: transparent;
  transition: border-color 0.15s;
}
.grid > .field:hover {
  border-color: var(--muted);
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

/* 语言选择：自绘徽章下拉（不依赖旗帜 emoji，Windows WebView2 也能显示） */
.lang-select { position: relative; }
.lang-trigger {
  width: 100%;
  height: 36px;
  padding: 0 30px 0 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.lang-trigger::after {
  content: "▾";
  margin-left: auto;
  color: var(--muted);
  font-size: 11px;
}
.lang-trigger:hover { border-color: var(--muted); }
.lang-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  max-height: 320px;
  overflow: auto;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.lang-menu > button {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
}
.lang-menu > button:hover { background: var(--hover); }
.lang-menu > button.on { color: var(--accent); font-weight: 600; }

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
  border-radius: calc(var(--ui-radius, 6px) + 2px);
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
  border-radius: calc(var(--ui-radius, 6px) + 4px);
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
  border-radius: calc(var(--ui-radius, 6px) + 4px);
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
