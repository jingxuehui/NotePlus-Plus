# NotePlus+

English | **简体中文**

<div align="center">

**轻如羽，快如风 — 新一代 macOS / Windows 编辑器**

Tauri 2 · Vue 3 · CodeMirror 6 · 约 5 MB 安装包 · 三语界面

![NotePlus+](screenshots/banner.png)

</div>

NotePlus+ 是一款 Notepad++ 风格的轻量级代码编辑器，使用 Tauri 2 构建，不内置 Chromium，安装包仅约 5 MB。提供多标签编辑、文件树、独立查找窗口、深浅色主题（含跟随系统）、现代分窗布局、三种界面语言以及真实的应用内更新。

---

## 目录

- [Why NotePlus+?](#why-noteplus)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Getting Started](#getting-started)
- [Release](#release)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [License](#license)

## Why NotePlus+?

- 🪶 **约 5 MB，零运行时负担** — 无内置浏览器内核、无 Java / Python 依赖，单一程序即可运行（macOS 10.15+ / Windows 10+）。
- 🎨 **原生观感的深浅色主题** — 主题切换不止改 CSS：窗口标题栏外观由 Rust 侧同步设置；「跟随系统」通过原生外观检测 + 事件广播实现，系统切换深浅色后约 1.5 秒内自动跟随，查找窗口一并同步。
- 🪟 **现代分窗布局** — 侧边栏、编辑区、状态栏成为带间隙的独立圆角窗格，标签页变为强调色胶囊；随时可切回经典紧凑布局。
- 🔍 **独立查找窗口** — 查找 / 替换在独立原生窗口中进行，与编辑器双向同步高亮与匹配位置，支持 `⌘G` / `Ctrl+G` 快速跳转。
- 🧩 **设置即预览** — 设置弹框采用草稿模型：改动实时预览，「应用」提交、「关闭」自动丢弃未应用的预览。
- 🌍 **三语即时切换** — 简体中文 / 繁體中文 / English，覆盖文案、悬停提示、弹窗、快捷键速查以及查找窗口原生标题；macOS 系统对话框在重启后跟随应用内语言。
- ⚡ **真实应用内更新** — 发布说明、稳定 / 预览渠道、后台下载安装 `.dmg` / `.msi` / `.exe`，按平台自动挑选安装包。
- 🧠 **CodeMirror 6 内核** — 多语言语法高亮、自动补全、括号匹配、Lint、搜索，均为按需加载的模块化能力。

## Features

### 编辑器
- 基于 CodeMirror 6：语法高亮、基于上下文的自动补全、括号匹配、活动行高亮、行号、当前行/列指示
- 内置语言支持：JavaScript / TypeScript、Vue、HTML、CSS、JSON、Markdown、Python、Rust、Go、Java、C/C++、PHP、SQL、XML、YAML 等
- 编辑器字号独立调节（`⌘+` / `Ctrl+`），与界面缩放相互独立
- 自动换行开关、未保存更改标记（黄色圆点）、关闭前保存确认
- 右键弹出自定义菜单（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 查找），不再触发 WebKit 的「自动选中光标处单词」，行末右键光标也不会消失

### 文件与标签页
- 多标签编辑：新建、切换、中键关闭、一键关闭全部
- 文件树侧边栏：打开文件夹后浏览并快速打开文件
- 拖拽即开：将文件拖入窗口即可打开
- 在 Finder（macOS）/ 资源管理器（Windows）中显示当前文件
- 欢迎页：无标签时提供打开文件 / 文件夹入口与快捷键速查

### 查找与替换
- 独立查找窗口（`⌘F` / `Ctrl+F`）：查找、替换、高亮全部匹配
- 编辑器与查找窗口双向同步，`⌘G` / `Ctrl+G` 在匹配间跳转
- 查找历史本地持久化，`Esc` 即关即走；原生窗口标题跟随界面语言
- macOS 上查找窗口随应用失去焦点自动隐藏（原生 `hidesOnDeactivate`）

### 外观个性化
- 主题：亮色 / 暗色 / **跟随系统**（原生级实时跟随）
- 7 种配色主题，贯穿界面高亮、标签胶囊、按钮
- 圆角样式（无 / 小 / 大）全局联动，界面缩放 80%–140%
- 字体平滑开关、系统 / 等宽 UI 字体切换
- 启动时展示短暂的渐变动画：品牌 Logo、应用名与本地化标语


### 状态栏
- 当前文件、行列位置、行数与字符数、换行符（LF / CRLF）、文件编码、语言模式

## Keyboard Shortcuts

`⌘` 为 macOS 写法，`Ctrl` 为 Windows 写法（两个平台都接受对方修饰键作为兜底）。

| macOS | Windows | 功能 |
| --- | --- | --- |
| `⌘+S` / `⇧+⌘+S` / `⌥+⌘+S` | `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+Alt+S` | 保存 / 另存为 / 全部保存 |
| `⌘+N` | `Ctrl+N` | 新建标签 |
| `⌘+O` / `⇧+⌘+O` | `Ctrl+O` / `Ctrl+Shift+O` | 打开文件 / 打开文件夹 |
| `⌘+W` / `⇧+⌘+W` | `Ctrl+W` / `Ctrl+Shift+W` | 关闭标签 / 关闭全部标签 |
| `⌘+F` | `Ctrl+F` | 打开查找窗口 |
| `⌘+G` / `⇧+⌘+G` | `Ctrl+G` / `Ctrl+Shift+G` | 下一个 / 上一个匹配 |
| `⌘+` / `⌘-` / `⌘0` | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 放大 / 缩小 / 重置编辑器字号 |
| `⌘+B` | `Ctrl+B` | 显示 / 隐藏侧边栏 |
| `⌘+,` | `Ctrl+,` | 打开设置 |
| `⇧+⌥+F` | `Shift+Alt+F` | 格式化 JSON |
| `Esc` | `Esc` | 关闭弹框 / 查找窗口 |


## Getting Started

### 前置条件

- Node.js >= 20
- pnpm >= 9
- Rust >= 1.77（含 `cargo`）
- macOS 10.15+ 或 Windows 10+；Windows 构建需要 MSVC 工具链

### 开发

```bash
pnpm install          # 安装前端依赖
pnpm tauri dev        # 启动桌面开发环境（Vite 热更新 + Tauri 窗口）
```

仅前端调试（浏览器环境，无 Tauri 命令，主题会走媒体查询兜底）：

```bash
pnpm dev              # http://localhost:1420
```

### 构建

```bash
pnpm tauri build      # macOS: .app + .dmg；Windows: NSIS .exe + .msi
```

构建前会自动执行 `vue-tsc --noEmit` 类型检查。平台配置由 `src-tauri/tauri.conf.json` 与 `tauri.windows.conf.json`（无边框窗口 + 自绘窗控 + Windows 打包目标）合并而成。

### Rust 侧能力说明

`src-tauri/src/lib.rs` 除常规文件 IO / 目录树命令外，还包含：

- `get_system_dark` / `system:theme-changed` 事件 — 原生检测系统外观并广播（WKWebView 的 `prefers-color-scheme` 在 Tauri 下不可靠）
- `open_find_window` / `close_find_window` / `set_find_theme` — 独立查找窗口的创建、Esc 关闭与标题栏主题同步；标题由前端传入以跟随界面语言
- 平台分支：Finder / 资源管理器中显示、打开外部链接、更新安装、关窗行为
- macOS：Dock 图标样式、关窗隐藏驻留；Windows：关窗即退出

## Release（发版）

一条命令完成 macOS 侧发版：

```bash
pnpm release
```

依次执行：

1. `scripts/release.mjs` — 以 `src-tauri/tauri.conf.json` 为权威版本号，patch 位 +1 并同步写入 `package.json` 与 `src-tauri/Cargo.toml`
2. `tauri build` — 自动执行 `vue-tsc` 类型检查；macOS 上由 `scripts/post-build.sh` 完成本地化声明、ad-hoc 签名与 dmg 重打包
3. `scripts/upload-release.mjs` — 将 macOS 产物推送到 GitHub Release 与 Gitee Release（tag 为 `v<版本号>`）
4. `.github/workflows/build-windows.yml` — 由 tag 触发，在 `windows-latest` 上构建并补传 `.exe` / `.msi` 到两个 Release

不发版、仅重新上传现有产物：

```bash
pnpm release:upload
```

推送需要 Token（二选一，不写入仓库）：环境变量 `GH_TOKEN` / `GITEE_TOKEN`，或本机文件 `~/.noteplus-release.env`：

```env
GH_TOKEN=github_pat_xxx
GITEE_TOKEN=xxx
```

## Tech Stack

| 层级 | 技术 |
| --- | --- |
| 框架 | Tauri 2（macOS & Windows） |
| 前端 | Vue 3 + TypeScript |
| UI | Tailwind CSS 4 + 自研组件（设置弹框 / 确认框 / Toast） |
| 编辑器 | CodeMirror 6（`@codemirror/lang-*` 多语言包） |
| 后端 | Rust（文件 IO、窗口管理、系统外观检测） |
| 状态 | Vue reactive stores（设置 / 标签页 / 文件树 / UI / Toast） |
| 国际化 | 自建 `t()` 词典：zh-CN / zh-TW / en-US，支持 `{参数}` 插值 |

## Roadmap

- [ ] 编辑器分栏（左右对照编辑）
- [ ] 文件树重命名 / 新建 / 删除
- [x] 真实更新分发（发布说明、更新渠道、后台下载与安装）
- [x] 多语言界面（简体中文 / 繁體中文 / English）

## License

本项目尚未附带开源许可证，默认保留所有权利。如需开源，建议采用 Apache-2.0 或 MIT。
