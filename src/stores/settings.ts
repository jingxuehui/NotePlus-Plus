import { reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setExitOnClose, setIconStyle } from "@/commands";

export type ThemeMode = "dark" | "light";
export type ThemeChoice = "dark" | "light" | "system";
export type AccentName =
  | "pearl"
  | "mist"
  | "graphite"
  | "cobalt"
  | "sage"
  | "amber"
  | "blush"
  | "vscode"
  | "idea"
  | "xcode"
  | "jetbrains"
  | "cursor"
  | "claude";
export type RadiusName = "none" | "small" | "large";
export type IconStyle = "default" | "black";

export interface ToolbarVisibility {
  sidebar: boolean;
  newFile: boolean;
  openFile: boolean;
  openFolder: boolean;
  save: boolean;
  saveAll: boolean;
  find: boolean;
  format: boolean;
  saveAs: boolean;
  reveal: boolean;
  closeTab: boolean;
  closeOthers: boolean;
  closeAll: boolean;
  shortcutHint: boolean;
  statusBar: boolean;
  themeToggle: boolean;
  systemSettings: boolean;
}

export interface Settings {
  theme: ThemeMode; // 实际生效的主题
  themeChoice: ThemeChoice; // 用户在设置里的选择
  fontSize: number;
  wordWrap: boolean;
  sidebarVisible: boolean;
  language: string;
  accent: AccentName;
  zoom: number;
  fontSmoothing: boolean;
  uiFont: string;
  radius: RadiusName;
  layout: "modern" | "classic";
  tabOverflow: "scroll" | "wrap";
  autoUpdate: boolean;
  updateChannel: "stable" | "preview";
  /** 关闭窗口时退出程序（关闭则只隐藏到 Dock） */
  exitOnClose: boolean;
  /** 图标与 Logo 样式 */
  iconStyle: IconStyle;
  /** 工具栏 / 菜单入口显示项 */
  toolbar: ToolbarVisibility;
}

const STORAGE_KEY = "noteplus.settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  themeChoice: "dark",
  fontSize: 14,
  wordWrap: false,
  sidebarVisible: true,
  language: "zh-CN",
  accent: "cobalt",
  zoom: 100,
  fontSmoothing: true,
  uiFont: "system",
  radius: "small",
  layout: "modern",
  tabOverflow: "scroll",
  autoUpdate: true,
  updateChannel: "stable",
  exitOnClose: false,
  iconStyle: "default",
  toolbar: {
    sidebar: true,
    newFile: true,
    openFile: true,
    openFolder: true,
    save: true,
    saveAll: true,
    find: true,
    format: true,
    saveAs: true,
    reveal: true,
    closeTab: true,
    closeOthers: true,
    closeAll: true,
    shortcutHint: true,
    statusBar: true,
    themeToggle: true,
    systemSettings: true,
  },
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Settings> & { keepInDock?: boolean };
      // 兼容旧版「关闭窗口时驻留 Dock」字段（语义与 exitOnClose 相反）
      if (typeof saved.keepInDock === "boolean") {
        saved.exitOnClose = !saved.keepInDock;
        delete saved.keepInDock;
      }
      // 旧版 3 套配色映射到 DBX 调色板
      const legacyAccents: Record<string, AccentName> = {
        blue: "cobalt",
        indigo: "jetbrains",
        teal: "sage",
      };
      if (saved.accent && legacyAccents[saved.accent]) {
        saved.accent = legacyAccents[saved.accent];
      }
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        toolbar: { ...DEFAULT_SETTINGS.toolbar, ...(saved.toolbar ?? {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export const settings = reactive<Settings>(load());

// tint / edge 为带 alpha 的强调色，用于标签胶囊等（WKWebView 不支持 color-mix）
interface AccentColors {
  dark: string;
  light: string;
  tintDark: string;
  tintLight: string;
  edgeDark: string;
  edgeLight: string;
}

function accentColors(dark: string, light: string): AccentColors {
  return {
    dark,
    light,
    tintDark: `${dark}40`,
    tintLight: `${light}33`,
    edgeDark: `${dark}66`,
    edgeLight: `${light}5c`,
  };
}

/** 与 DBX 的 13 套配色对应（色值取自其预览色 / 主题强调色） */
export const ACCENTS: Record<AccentName, AccentColors> = {
  pearl: accentColors("#e8f1fa", "#0b6cb5"),
  mist: accentColors("#a9c4e2", "#37618f"),
  graphite: accentColors("#b7bdc9", "#4a5261"),
  cobalt: accentColors("#4fc3f7", "#0b6cb5"),
  sage: accentColors("#7fd6ad", "#2b7a5b"),
  amber: accentColors("#f0bc63", "#a86a12"),
  blush: accentColors("#f0a4c4", "#a83a6b"),
  vscode: accentColors("#4fc1ff", "#007acc"),
  idea: accentColors("#9bb7ee", "#4b6eaf"),
  xcode: accentColors("#5ab4ff", "#0a84ff"),
  jetbrains: accentColors("#b3a1ff", "#7b61ff"),
  cursor: accentColors("#9cc8ff", "#4c8fe0"),
  claude: accentColors("#e0a37d", "#b5653d"),
};

/** 把一组设置应用到界面（支持设置弹框的实时预览） */
export function applyVisual(s: Settings) {
  const body = document.body;
  if (!body) return;
  body.classList.toggle("theme-light", s.theme === "light");
  body.classList.toggle("no-font-smoothing", !s.fontSmoothing);
  body.classList.toggle("mono-ui", s.uiFont === "mono");
  body.classList.toggle("layout-modern", s.layout === "modern");
  body.classList.toggle("tab-wrap", s.tabOverflow === "wrap");

  const accent = ACCENTS[s.accent] ?? ACCENTS.cobalt;
  const light = s.theme === "light";
  body.style.setProperty("--accent", light ? accent.light : accent.dark);
  body.style.setProperty("--accent-tint", light ? accent.tintLight : accent.tintDark);
  body.style.setProperty("--accent-edge", light ? accent.edgeLight : accent.edgeDark);
  // 文本选中底色跟随主题：深色用更实的强调色，浅色用浅淡的强调色
  body.style.setProperty("--selection-bg", light ? `${accent.light}4d` : `${accent.dark}8c`);
  body.style.setProperty("--ui-radius", s.radius === "none" ? "0px" : s.radius === "large" ? "12px" : "6px");
  document.documentElement.style.fontSize = `${(s.zoom / 100) * 16}px`;

  const uiFonts: Record<string, string> = {
    system: "",
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  };
  body.style.setProperty("--ui-font-family", uiFonts[s.uiFont] ?? s.uiFont);
}

// 真实系统外观由 Rust 侧提供，WKWebView 的 prefers-color-scheme 在 macOS 上不可靠
let systemIsDark = true;

/** 解析「跟随系统」主题（同步，供设置弹框预览使用） */
export function systemTheme(): ThemeMode {
  return systemIsDark ? "dark" : "light";
}

/** 直接选择主题（设置面板与标题栏主题菜单共用） */
export function chooseTheme(choice: ThemeChoice): void {
  settings.themeChoice = choice;
  settings.theme = choice === "system" ? systemTheme() : choice;
}

/** 顶栏主题按钮：点击按 亮色 → 暗色 → 跟随系统 循环切换 */
export function cycleTheme(): void {
  const order: ThemeChoice[] = ["light", "dark", "system"];
  const next = order[(order.indexOf(settings.themeChoice) + 1) % order.length];
  chooseTheme(next);
}

function onSystemThemeChanged(dark: boolean) {
  systemIsDark = dark;
  if (settings.themeChoice === "system") {
    settings.theme = dark ? "dark" : "light";
  }
}

/** 初始化视觉设置，并监听系统主题变化 */
export function initVisualSettings() {
  applyVisual(settings);
  // 启动时把关窗行为、Dock 图标样式同步到 Rust
  setExitOnClose(settings.exitOnClose).catch(() => undefined);
  setIconStyle(settings.iconStyle === "black").catch(() => undefined);
  // 启动时读取真实系统外观
  invoke<boolean>("get_system_dark")
    .then(onSystemThemeChanged)
    .catch(() => {
      // 非 Tauri 环境（浏览器调试）用媒体查询兜底
      const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
      onSystemThemeChanged(dark);
      window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", (e) =>
        onSystemThemeChanged(e.matches)
      );
    });
  // 系统外观变化时由 Rust 广播
  listen<boolean>("system:theme-changed", (e) => onSystemThemeChanged(e.payload)).catch(
    () => undefined
  );
}

watch(settings, (s) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  applyVisual(s);
  setExitOnClose(s.exitOnClose).catch(() => undefined);
  setIconStyle(s.iconStyle === "black").catch(() => undefined);
});

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
}

/** 一键切换亮色 / 暗色（同时把主题选择固定为对应值，不再跟随系统） */
export function toggleTheme() {
  const next: ThemeMode = settings.theme === "dark" ? "light" : "dark";
  settings.themeChoice = next;
  settings.theme = next;
}

export function zoomIn() {
  settings.fontSize = Math.min(28, settings.fontSize + 1);
}

export function zoomOut() {
  settings.fontSize = Math.max(9, settings.fontSize - 1);
}

export function zoomReset() {
  settings.fontSize = DEFAULT_SETTINGS.fontSize;
}
