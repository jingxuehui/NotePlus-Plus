import { reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ThemeMode = "dark" | "light";
export type ThemeChoice = "dark" | "light" | "system";
export type AccentName = "blue" | "indigo" | "teal";
export type RadiusName = "none" | "small" | "large";

export interface Settings {
  theme: ThemeMode; // 实际生效的主题
  themeChoice: ThemeChoice; // 用户在设置里的选择
  fontSize: number;
  wordWrap: boolean;
  sidebarVisible: boolean;
  language: "zh-CN" | "en-US";
  accent: AccentName;
  zoom: 80 | 100 | 120 | 140;
  fontSmoothing: boolean;
  uiFont: "system" | "mono";
  radius: RadiusName;
  layout: "modern" | "classic";
  tabOverflow: "scroll" | "wrap";
  autoUpdate: boolean;
  updateChannel: "stable" | "preview";
}

const STORAGE_KEY = "noteplus.settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  themeChoice: "dark",
  fontSize: 14,
  wordWrap: false,
  sidebarVisible: true,
  language: "zh-CN",
  accent: "blue",
  zoom: 100,
  fontSmoothing: true,
  uiFont: "system",
  radius: "small",
  layout: "modern",
  tabOverflow: "scroll",
  autoUpdate: true,
  updateChannel: "stable",
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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

export const ACCENTS: Record<AccentName, AccentColors> = {
  blue: {
    dark: "#4fc3f7",
    light: "#0b6cb5",
    tintDark: "#4fc3f740",
    tintLight: "#0b6cb533",
    edgeDark: "#4fc3f766",
    edgeLight: "#0b6cb55c",
  },
  indigo: {
    dark: "#a9a3ff",
    light: "#5b4bd6",
    tintDark: "#a9a3ff40",
    tintLight: "#5b4bd633",
    edgeDark: "#a9a3ff66",
    edgeLight: "#5b4bd65c",
  },
  teal: {
    dark: "#5ee0b5",
    light: "#0f8a68",
    tintDark: "#5ee0b540",
    tintLight: "#0f8a6833",
    edgeDark: "#5ee0b566",
    edgeLight: "#0f8a685c",
  },
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

  const accent = ACCENTS[s.accent] ?? ACCENTS.blue;
  const light = s.theme === "light";
  body.style.setProperty("--accent", light ? accent.light : accent.dark);
  body.style.setProperty("--accent-tint", light ? accent.tintLight : accent.tintDark);
  body.style.setProperty("--accent-edge", light ? accent.edgeLight : accent.edgeDark);
  // 文本选中底色跟随主题：深色用更实的强调色，浅色用浅淡的强调色
  body.style.setProperty("--selection-bg", light ? `${accent.light}4d` : `${accent.dark}8c`);
  body.style.setProperty("--ui-radius", s.radius === "none" ? "0px" : s.radius === "large" ? "12px" : "6px");
  document.documentElement.style.fontSize = `${(s.zoom / 100) * 16}px`;
}

// 真实系统外观由 Rust 侧提供，WKWebView 的 prefers-color-scheme 在 macOS 上不可靠
let systemIsDark = true;

/** 解析「跟随系统」主题（同步，供设置弹框预览使用） */
export function systemTheme(): ThemeMode {
  return systemIsDark ? "dark" : "light";
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
});

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
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
