import { reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setAppLanguage, setExitOnClose, setIconStyle } from "@/commands";
import { isMac } from "@/utils/platform";

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

export interface ContextMenuVisibility {
  rename: boolean;
  pin: boolean;
  reveal: boolean;
  close: boolean;
  closeOthers: boolean;
  closeAll: boolean;
}

export interface ToolbarVisibility {
  sidebar: boolean;
  newFile: boolean;
  openFile: boolean;
  openFolder: boolean;
  save: boolean;
  saveAs: boolean;
  saveAll: boolean;
  format: boolean;
  shortcutHint: boolean;
  statusBar: boolean;
  themeToggle: boolean;
  updateButton: boolean;
  github: boolean;
  gitee: boolean;
  moreMenu: boolean;
  /** 更多菜单中的「工具箱」入口 */
  tools: boolean;
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
  /** 已忽略的更新版本 tag */
  ignoredVersion: string;
  /** 关闭窗口时退出程序（关闭则只隐藏到 Dock） */
  exitOnClose: boolean;
  /** 图标与 Logo 样式 */
  iconStyle: IconStyle;
  /** 工具栏 / 菜单入口显示项 */
  toolbar: ToolbarVisibility;
  /** 标签页右键菜单显示项 */
  tabMenu: ContextMenuVisibility;
  /** 标题栏各入口的显示顺序（key 列表，拖拽排序后持久化） */
  toolbarOrder: string[];
  /** 标签页右键菜单项的显示顺序 */
  tabMenuOrder: string[];
}

const STORAGE_KEY = "noteplus.settings";
/** 已完整实现的语言；旧配置中的其它语言值自动回退到默认语言 */
const SUPPORTED_LANGUAGES = ["en-US", "zh-CN", "zh-TW"];

function normalizeLoaded(s: Settings): Settings {
  if (!SUPPORTED_LANGUAGES.includes(s.language)) s.language = DEFAULT_SETTINGS.language;
  return s;
}

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
  ignoredVersion: "",
  exitOnClose: false,
  iconStyle: "default",
  toolbar: {
    sidebar: true,
    newFile: true,
    openFile: true,
    openFolder: true,
    save: true,
    saveAll: true,
    format: true,
    saveAs: true,
    shortcutHint: true,
    statusBar: true,
    themeToggle: true,
    updateButton: true,
    github: true,
    gitee: true,
    moreMenu: true,
    tools: true,
    systemSettings: true,
  },
  tabMenu: {
    rename: true,
    pin: true,
    reveal: true,
    close: true,
    closeOthers: true,
    closeAll: true,
  },
  toolbarOrder: [
    "sidebar", "newFile", "openFile", "openFolder",
    "save", "saveAs", "saveAll",
    "format", "moreMenu",
    "updateButton", "github", "gitee", "themeToggle", "shortcutHint", "systemSettings",
  ],
  tabMenuOrder: ["rename", "pin", "reveal", "close", "closeOthers", "closeAll"],
};

/** 合并旧配置的顺序数组：保留已知项顺序，新增项插回默认相对位置 */
function mergeOrder(defaults: string[], saved: unknown): string[] {
  if (!Array.isArray(saved)) return [...defaults];
  const result = [...new Set(saved.filter((k): k is string => typeof k === "string" && defaults.includes(k)))];
  for (const key of defaults) {
    if (result.includes(key)) continue;
    const pos = defaults.indexOf(key);
    let insertAt = result.length;
    for (let i = pos - 1; i >= 0; i--) {
      const idx = result.indexOf(defaults[i]);
      if (idx >= 0) {
        insertAt = idx + 1;
        break;
      }
    }
    result.splice(insertAt, 0, key);
  }
  return result;
}

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
      // 旧版「更多菜单」里的项目已迁移：另存为 → 主操作栏，在 Finder 中显示 / 关闭* → 标签页右键菜单
      if (saved.toolbar) {
        const legacy = saved.toolbar as unknown as Record<string, unknown>;
        delete legacy.reveal;
        delete legacy.closeTab;
        delete legacy.closeOthers;
        delete legacy.closeAll;
        // 查找替换按钮已整体移除
        delete legacy.find;
      }
      // 更多入口统一迁移到左侧主操作栏末尾（从旧顺序中移除，让 mergeOrder 按新默认位置插入）
      if (Array.isArray(saved.toolbarOrder)) {
        saved.toolbarOrder = saved.toolbarOrder.filter((k) => k !== "moreMenu");
      }
      return normalizeLoaded({
        ...DEFAULT_SETTINGS,
        ...saved,
        toolbar: { ...DEFAULT_SETTINGS.toolbar, ...(saved.toolbar ?? {}) },
        tabMenu: { ...DEFAULT_SETTINGS.tabMenu, ...(saved.tabMenu ?? {}) },
        toolbarOrder: mergeOrder(DEFAULT_SETTINGS.toolbarOrder, saved.toolbarOrder),
        tabMenuOrder: mergeOrder(DEFAULT_SETTINGS.tabMenuOrder, saved.tabMenuOrder),
      });
    }
  } catch {
    /* ignore */
  }
  return normalizeLoaded({
    ...DEFAULT_SETTINGS,
    toolbarOrder: [...DEFAULT_SETTINGS.toolbarOrder],
    tabMenuOrder: [...DEFAULT_SETTINGS.tabMenuOrder],
  });
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

/** 十六进制颜色混合：把强调色按 amount 比例混入基础色（WKWebView 不支持 color-mix，故手动算） */
function mixHex(base: string, accent: string, amount: number): string {
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  };
  const [r1, g1, b1] = parse(base);
  const [r2, g2, b2] = parse(accent);
  const ch = (a: number, b: number) =>
    Math.round(a + (b - a) * amount).toString(16).padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

interface SurfacePalette {
  bg: string;
  panel: string;
  panel2: string;
  hover: string;
  border: string;
  gutter: string;
  editor: string;
  text: string;
  muted: string;
  sidebar: string;
  primary: string;
}

/** 13 套配色的完整表面色板：色值取自 DBX 的 html.theme-* 主题（浅/深各一套） */
export const THEME_PALETTES: Record<AccentName, { light: SurfacePalette; dark: SurfacePalette }> = {
  pearl: {
    light: { bg: "#ecf0f5", panel: "#ffffff", panel2: "#edf1f6", hover: "#e2e9f2", border: "#d0d7e0", gutter: "#e5eaf1", editor: "#ffffff", text: "#282c34", muted: "#68717e", sidebar: "#eff2f6", primary: "#2e5fa6" },
    dark: { bg: "#272b31", panel: "#26292e", panel2: "#2f333a", hover: "#373c45", border: "#68707e", gutter: "#1b1e22", editor: "#212429", text: "#caced6", muted: "#9299a4", sidebar: "#22252a", primary: "#9db1cd" },
  },
  mist: {
    light: { bg: "#ecf0f5", panel: "#ffffff", panel2: "#edf1f6", hover: "#e2e9f2", border: "#d0d7e0", gutter: "#e5eaf1", editor: "#ffffff", text: "#282c34", muted: "#68717e", sidebar: "#eff2f6", primary: "#2e5fa6" },
    dark: { bg: "#272b31", panel: "#26292e", panel2: "#2f333a", hover: "#373c45", border: "#68707e", gutter: "#1b1e22", editor: "#212429", text: "#caced6", muted: "#9299a4", sidebar: "#22252a", primary: "#9db1cd" },
  },
  graphite: {
    light: { bg: "#e8ecf2", panel: "#ffffff", panel2: "#eef0f4", hover: "#e2e6ec", border: "#d2d7e0", gutter: "#e0e5ed", editor: "#ffffff", text: "#2a2d33", muted: "#6a707b", sidebar: "#ebeef3", primary: "#48505d" },
    dark: { bg: "#26292f", panel: "#26282d", panel2: "#2f3239", hover: "#373a42", border: "#686e7a", gutter: "#1b1d21", editor: "#202227", text: "#c6c9cf", muted: "#9096a0", sidebar: "#212328", primary: "#aeb5c0" },
  },
  cobalt: {
    light: { bg: "#e4ecf7", panel: "#ffffff", panel2: "#e8f0fa", hover: "#d8e5f6", border: "#c8d4e5", gutter: "#dae5f3", editor: "#ffffff", text: "#202b3a", muted: "#606f82", sidebar: "#e8eff8", primary: "#2b63b7" },
    dark: { bg: "#202836", panel: "#1f2633", panel2: "#2b3546", hover: "#313e52", border: "#657790", gutter: "#161c26", editor: "#1b222e", text: "#c6cfdb", muted: "#8f9bab", sidebar: "#1c2330", primary: "#89addf" },
  },
  sage: {
    light: { bg: "#e7efeb", panel: "#ffffff", panel2: "#e9f1ed", hover: "#dbeae3", border: "#cbd9d3", gutter: "#dde9e3", editor: "#ffffff", text: "#24302b", muted: "#61716a", sidebar: "#ebf2ee", primary: "#3a7b6a" },
    dark: { bg: "#222d29", panel: "#222b28", panel2: "#2c3935", hover: "#32413c", border: "#647a71", gutter: "#181f1d", editor: "#1d2623", text: "#c6d0cc", muted: "#8f9d97", sidebar: "#1e2724", primary: "#8ab8a9" },
  },
  amber: {
    light: { bg: "#f4e9cb", panel: "#fffffa", panel2: "#f7eed5", hover: "#efdbae", border: "#e0cfa8", gutter: "#ebdbb5", editor: "#fffffa", text: "#383020", muted: "#7b6946", sidebar: "#f7eed5", primary: "#955f1c" },
    dark: { bg: "#302b21", panel: "#2d2920", panel2: "#3b3528", hover: "#473d2b", border: "#81704d", gutter: "#201d17", editor: "#27241c", text: "#d9d0bc", muted: "#a3967b", sidebar: "#29251d", primary: "#d5a94b" },
  },
  blush: {
    light: { bg: "#f6e6ee", panel: "#ffffff", panel2: "#f6e8ef", hover: "#efd5e2", border: "#e2cad6", gutter: "#edd8e3", editor: "#ffffff", text: "#3d3038", muted: "#7e6273", sidebar: "#f8eaf1", primary: "#b8567b" },
    dark: { bg: "#372c34", panel: "#342a31", panel2: "#43343e", hover: "#523b48", border: "#8b6c7c", gutter: "#251e23", editor: "#2c242a", text: "#ddcdd6", muted: "#a68c9a", sidebar: "#2f262d", primary: "#e2a0b8" },
  },
  vscode: {
    light: { bg: "#dddddd", panel: "#ffffff", panel2: "#f3f3f3", hover: "#e5f1fb", border: "#e0e0e0", gutter: "#e5e5e5", editor: "#ffffff", text: "#333333", muted: "#6a6a6a", sidebar: "#f3f3f3", primary: "#007acc" },
    dark: { bg: "#333333", panel: "#252526", panel2: "#2d2d30", hover: "#264f78", border: "#3c3c3c", gutter: "#1b1b1c", editor: "#1e1e1e", text: "#cccccc", muted: "#858585", sidebar: "#252526", primary: "#007acc" },
  },
  idea: {
    light: { bg: "#e6e7eb", panel: "#ffffff", panel2: "#eff0f2", hover: "#dae7f9", border: "#d5d7db", gutter: "#dee1e7", editor: "#ffffff", text: "#2b2b2b", muted: "#6a6d71", sidebar: "#ebecf0", primary: "#4b6eaf" },
    dark: { bg: "#3c3f41", panel: "#3c3f41", panel2: "#3c3f41", hover: "#484e56", border: "#555657", gutter: "#262626", editor: "#2b2b2b", text: "#bbbbbb", muted: "#8b8d8f", sidebar: "#313335", primary: "#6a87c5" },
  },
  xcode: {
    light: { bg: "#e9edf3", panel: "#ffffff", panel2: "#ebeff5", hover: "#dbecff", border: "#cfd8e4", gutter: "#dde5ef", editor: "#ffffff", text: "#1f2937", muted: "#626e7e", sidebar: "#f2f5fa", primary: "#0a84ff" },
    dark: { bg: "#2d333b", panel: "#252932", panel2: "#2d333b", hover: "#1d4575", border: "#5e6a7c", gutter: "#191d22", editor: "#1f2329", text: "#d7dde7", muted: "#959ead", sidebar: "#252932", primary: "#0a84ff" },
  },
  jetbrains: {
    light: { bg: "#ebedf1", panel: "#ffffff", panel2: "#ebedf1", hover: "#e5e1fb", border: "#d3d8e0", gutter: "#e0e4eb", editor: "#ffffff", text: "#1f2328", muted: "#646c77", sidebar: "#f2f3f5", primary: "#6c5dd3" },
    dark: { bg: "#2b2d30", panel: "#2b2d30", panel2: "#2b2d30", hover: "#3d3a59", border: "#4d5056", gutter: "#18191c", editor: "#1e1f22", text: "#dfe1e5", muted: "#a1a4ab", sidebar: "#2b2d30", primary: "#7b61ff" },
  },
  cursor: {
    light: { bg: "#f2f3f5", panel: "#ffffff", panel2: "#eff1f5", hover: "#deebff", border: "#d5dae2", gutter: "#e4e8ef", editor: "#ffffff", text: "#1f242d", muted: "#656f7e", sidebar: "#f4f5f7", primary: "#3b82f6" },
    dark: { bg: "#1b1e27", panel: "#151821", panel2: "#1b1e27", hover: "#1f3352", border: "#525b6f", gutter: "#0b0d14", editor: "#0f111a", text: "#d5d7de", muted: "#8e95a4", sidebar: "#151821", primary: "#6ba4ff" },
  },
  claude: {
    light: { bg: "#f1e7db", panel: "#fffdf8", panel2: "#f2e7db", hover: "#ead8c6", border: "#ddcdbb", gutter: "#e6d8c7", editor: "#fffdf8", text: "#332b23", muted: "#756251", sidebar: "#efe7dc", primary: "#b86b3c" },
    dark: { bg: "#312d28", panel: "#2a2723", panel2: "#37312b", hover: "#44382f", border: "#7f6c5b", gutter: "#1b1917", editor: "#211f1c", text: "#d8d0c4", muted: "#a39686", sidebar: "#2a2723", primary: "#d28a5f" },
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

  const accent = ACCENTS[s.accent] ?? ACCENTS.cobalt;
  const light = s.theme === "light";
  const accentHex = light ? accent.light : accent.dark;
  // 与 DBX 一致：每套配色主题是一整套表面色板（背景/侧栏/边框/文字/编辑器），
  // 而不是把高饱和强调色混进固定中性灰——主题色调干净、彼此差异明显
  const p = (THEME_PALETTES[s.accent] ?? THEME_PALETTES.cobalt)[light ? "light" : "dark"];
  // 磨砂玻璃：UI 变量带 alpha，让窗口底层的原生毛玻璃透出来；
  // 编辑器内部使用同色但实色的 --editor-* 变量，视觉保持原样
  const glass = (hex: string, alpha: string) => `${hex}${alpha}`;
  // 主题色壁纸层：模拟 DBX 壁纸模式，让半透明磨砂透出的是柔和主题色画面，
  // 而不是深色桌面。用色板里柔和的 primary 主色，避免染成高饱和蓝
  const wash = mixHex(p.panel, p.primary, light ? 0.34 : 0.26);
  const accentVars: Array<[string, string]> = [
    ["--accent", accentHex],
    ["--accent-tint", light ? accent.tintLight : accent.tintDark],
    ["--accent-edge", light ? accent.edgeLight : accent.edgeDark],
    // 文本选中底色跟随主题：深色用更实的强调色，浅色用浅淡的强调色
    ["--selection-bg", light ? `${accent.light}4d` : `${accent.dark}8c`],
    // 当前行高亮必须是低透明度：CodeMirror 选区层绘制在内容层下方，
    // 不透明的行背景会把当前行的选区颜色完全盖住
    ["--active-line", light ? `${accent.light}1f` : `${accent.dark}22`],
    // 整套表面色取自当前配色主题色板，半透明叠出磨砂
    ["--bg", glass(p.bg, "b3")],
    ["--panel", glass(p.panel, "a6")],
    ["--panel-2", glass(p.panel2, "99")],
    ["--hover", glass(p.hover, "8c")],
    ["--border", p.border],
    ["--gutter", p.gutter],
    ["--text", p.text],
    ["--muted", p.muted],
    ["--sidebar", p.sidebar],
    // 弹窗/菜单等需要高可读性的表面：接近实色的主题面板色
    ["--panel-solid", `${p.panel}e6`],
    // DBX 同款实色分层：顶栏/标签栏/状态栏用 chrome 色，侧栏用 sidebar 色
    ["--chrome", p.bg],
    ["--sidebar-solid", p.sidebar],
    ["--editor-bg", p.editor],
    ["--editor-bg-2", p.panel2],
    ["--editor-hover", p.hover],
    ["--glass-wash", `radial-gradient(130% 110% at 6% -12%, ${wash}${light ? "66" : "59"} 0%, transparent 62%), radial-gradient(120% 100% at 100% 112%, ${wash}${light ? "40" : "3d"} 0%, transparent 60%)`],
    ["--ui-radius", s.radius === "none" ? "0px" : s.radius === "large" ? "12px" : "6px"],
  ];
  // 同时写到 html 根节点和 body：CodeMirror 等注入到页面中的样式从根节点继承
  const root = document.documentElement;
  for (const [key, value] of accentVars) {
    body.style.setProperty(key, value);
    root.style.setProperty(key, value);
  }
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
  // 启动时把关窗行为、Dock 图标样式、界面语言同步到 Rust
  setExitOnClose(settings.exitOnClose).catch(() => undefined);
  setIconStyle(settings.iconStyle === "black").catch(() => undefined);
  setAppLanguage(settings.language).catch(() => undefined);
  // Rust 侧只在 macOS 上检测系统外观；Windows 的 WebView2 媒体查询可靠，直接使用
  if (!isMac) {
    watchMediaTheme();
    return;
  }
  // 启动时读取真实系统外观
  invoke<boolean>("get_system_dark")
    .then(onSystemThemeChanged)
    .catch(watchMediaTheme); // 非 Tauri 环境（浏览器调试）用媒体查询兜底
  // 系统外观变化时由 Rust 广播
  listen<boolean>("system:theme-changed", (e) => onSystemThemeChanged(e.payload)).catch(
    () => undefined
  );
}

function watchMediaTheme() {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  onSystemThemeChanged(mq?.matches ?? true);
  mq?.addEventListener("change", (e) => onSystemThemeChanged(e.matches));
}

watch(settings, (s) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  applyVisual(s);
  setExitOnClose(s.exitOnClose).catch(() => undefined);
  setIconStyle(s.iconStyle === "black").catch(() => undefined);
});

// 语言变化时同步到 Rust：重启后原生菜单 / 系统对话框跟随应用内语言
watch(
  () => settings.language,
  (lang) => {
    setAppLanguage(lang).catch(() => undefined);
  }
);

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
