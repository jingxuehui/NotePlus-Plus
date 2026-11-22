<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from "vue";
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
} from "@/stores/settings";
import { toggleSettings } from "@/stores/ui";
import { notify } from "@/stores/toast";

const emit = defineEmits<{ close: [] }>();

type SectionKey = "appearance" | "updates" | "about";
const navItems: { key: SectionKey; label: string }[] = [
  { key: "appearance", label: "外观" },
  { key: "updates", label: "更新管理" },
  { key: "about", label: "关于我们" },
];

const section = ref<SectionKey>("appearance");
const search = ref("");

// 配色主题：自定义下拉（原生 select 的 option 无法渲染彩色圆点）
const ACCENT_LABELS: Record<AccentName, string> = {
  blue: "钴蓝",
  indigo: "靛蓝",
  teal: "青绿",
};
const accentOptions = computed(() =>
  (Object.keys(ACCENT_LABELS) as AccentName[]).map((key) => ({
    key,
    label: ACCENT_LABELS[key],
    color: draft.theme === "light" ? ACCENTS[key].light : ACCENTS[key].dark,
  }))
);
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
const draft = reactive<Settings>({ ...settings });
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(settings));

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
  Object.assign(settings, DEFAULT_SETTINGS);
  Object.assign(draft, DEFAULT_SETTINGS);
  notify("已恢复默认设置", false);
}

function close() {
  applyVisual(settings); // 撤销未应用的预览
  toggleSettings(false);
  emit("close");
}

function checkUpdate() {
  notify(draft.updateChannel === "preview" ? "预览版已是最新" : "当前已是最新版本", false);
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
                  <label class="field-label">语言 / Language <span class="hint">ⓘ</span></label>
                  <div class="select-wrap">
                    <select v-model="draft.language">
                      <option value="zh-CN">🇨🇳 简体中文</option>
                      <option value="en-US">🇺🇸 English</option>
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
                  <label class="field-label">界面缩放 <span class="hint">ⓘ</span></label>
                  <div class="select-wrap">
                    <select v-model="draft.zoom">
                      <option :value="80">80%</option>
                      <option :value="100">100%</option>
                      <option :value="120">120%</option>
                      <option :value="140">140%</option>
                    </select>
                  </div>
                </div>
                <div class="field" v-show="matches('字体平滑')">
                  <label class="field-label">字体平滑 <span class="hint">ⓘ</span></label>
                  <div class="field-switch">
                    <button class="switch" :class="{ on: draft.fontSmoothing }" role="switch"
                      :aria-checked="draft.fontSmoothing" @click="draft.fontSmoothing = !draft.fontSmoothing">
                      <span class="knob"></span>
                    </button>
                  </div>
                </div>
                <div class="field" v-show="matches('界面字体', '字体')">
                  <label class="field-label">界面字体 <span class="hint">ⓘ</span></label>
                  <div class="select-wrap">
                    <select v-model="draft.uiFont">
                      <option value="system">系统默认</option>
                      <option value="mono">等宽字体</option>
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
                    <button :class="{ on: draft.themeChoice === 'light' }" @click="setThemeChoice('light')">☀ 亮色</button>
                    <button :class="{ on: draft.themeChoice === 'dark' }" @click="setThemeChoice('dark')">☾ 暗色</button>
                    <button :class="{ on: draft.themeChoice === 'system' }" @click="setThemeChoice('system')">◐ 跟随系统</button>
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
                <button class="btn" @click="checkUpdate">检查更新</button>
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
                <button class="btn" @click="notify('暂无发布说明', false)">查看</button>
              </div>
            </div>
          </template>

          <!-- 关于我们 -->
          <template v-else>
            <div class="content-scroll page-pad about-page">
              <div class="about-logo">
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
        <button class="btn" @click="apply">应用</button>
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
  width: min(940px, 92vw);
  height: min(620px, 86vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: calc(var(--ui-radius, 6px) + 4px);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: pop 0.16s ease-out;
  font-size: 12px;
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
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.win-gear { color: var(--accent); }
.win-title { font-size: 13px; font-weight: 600; color: var(--text); }
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
  width: 152px;
  flex-shrink: 0;
  padding: 10px 8px;
  background: var(--panel-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  height: 30px;
  padding: 0 10px;
  text-align: left;
  border: none;
  border-radius: var(--ui-radius, 6px);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
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
  height: 34px;
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
  font-size: 12px;
  user-select: text;
}
.search-box input::placeholder { color: var(--muted); }

.content-scroll { flex: 1; overflow-y: auto; padding: 4px 2px 20px; }
.page-pad { padding-top: 8px; }

.group-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  margin: 16px 0 10px;
}
.group-title:first-child { margin-top: 8px; }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 22px;
}
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field-label { font-size: 11.5px; color: var(--text); }
.field-label.mt { margin: 16px 0 8px; display: block; }
.hint { color: var(--muted); font-size: 10px; margin-left: 2px; }
.field-switch { height: 32px; display: flex; align-items: center; }

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
  height: 32px;
  padding: 0 28px 0 10px;
  appearance: none;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  outline: none;
  cursor: pointer;
}
select:focus { border-color: var(--accent); }

/* 配色主题：带彩色圆点的自定义下拉 */
.accent-select { position: relative; }
.accent-trigger {
  width: 100%;
  height: 32px;
  padding: 0 28px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}
.accent-trigger:hover { border-color: var(--muted); }
.accent-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
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
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: calc(var(--ui-radius, 6px) - 2px);
  background: transparent;
  color: var(--text);
  font-size: 12px;
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
  gap: 12px 22px;
  align-items: start;
}
.segmented { display: inline-flex; gap: 4px; }
.segmented button {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--muted);
  font-size: 11.5px;
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
.step-value { min-width: 48px; text-align: center; font-size: 12px; color: var(--text); }

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
  padding: 10px 12px;
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
.choice-title { font-size: 12px; font-weight: 600; color: var(--text); }
.choice-card.on .choice-title { color: var(--accent); }
.choice-desc { font-size: 10.5px; color: var(--muted); line-height: 1.5; }

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
.update-title { font-size: 14px; font-weight: 600; color: var(--text); }
.ver-chip {
  font-size: 10px; font-weight: 500;
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1px 7px;
  margin-left: 6px;
}
.update-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
.pref-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.pref-title { font-size: 12px; color: var(--text); }
.pref-desc { font-size: 10.5px; color: var(--muted); margin-top: 4px; }

/* 关于我们 */
.about-page { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 18px; }
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
.about-name { font-size: 21px; font-weight: 700; color: var(--text); margin-top: 16px; }
.about-ver { font-size: 11px; color: var(--muted); margin-top: 4px; }
.about-desc { font-size: 12px; color: var(--muted); margin-top: 10px; }
.about-page .group-title { align-self: flex-start; width: 100%; text-align: left; }
.stack-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; }
.stack-chip {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 11px;
}
.info-table { width: 100%; }
.info-table > div {
  display: flex; justify-content: space-between;
  padding: 9px 2px;
  border-bottom: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--text);
}
.info-table > div > span:first-child { color: var(--muted); }
.about-copy { font-size: 10.5px; color: var(--muted); margin: 20px 0 8px; }

/* 底部 */
.win-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.spacer { flex: 1; }
.dirty-hint { font-size: 10.5px; color: var(--accent); margin-left: 6px; }
.btn {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--ui-radius, 6px);
  background: var(--panel-2);
  color: var(--text);
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover { background: var(--hover); }
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
