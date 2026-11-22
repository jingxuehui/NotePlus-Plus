use encoding_rs::{BIG5, EUC_JP, GBK, SHIFT_JIS, UTF_16BE, UTF_16LE};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// 真实系统外观缓存（由 Rust 侧维护，前端不依赖 WKWebView 媒体查询）
static SYSTEM_DARK: AtomicBool = AtomicBool::new(true);

/// 读取的文本文件信息
#[derive(Serialize)]
pub struct TextFileInfo {
    /// 以 UTF-8 表示的文件内容（编辑器统一使用 UTF-8）
    pub content: String,
    /// 检测到的原始编码名称
    pub encoding: String,
    /// 检测到的换行符类型：LF / CRLF / CR / MIXED
    pub eol: String,
    /// 文件大小（字节）
    pub size: u64,
}

#[derive(Serialize)]
pub struct WriteResult {
    pub bytes_written: usize,
}

/// 文件树节点
#[derive(Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

fn has_bom(bytes: &[u8]) -> (bool, Option<&'static str>) {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (true, Some("UTF-8 BOM"))
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        (true, Some("UTF-16LE"))
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (true, Some("UTF-16BE"))
    } else {
        (false, None)
    }
}

/// 依次尝试解码：UTF-8 -> GBK -> Big5 -> Shift_JIS -> EUC-JP -> Latin-1
fn decode(bytes: &[u8]) -> (String, String) {
    let (_, bom_enc) = has_bom(bytes);
    if let Some(name) = bom_enc {
        let enc = match name {
            "UTF-16LE" => UTF_16LE,
            "UTF-16BE" => UTF_16BE,
            _ => encoding_rs::UTF_8,
        };
        let (text, _, _) = enc.decode(bytes);
        return (text.into_owned().replace('\u{FEFF}', ""), name.to_string());
    }
    if std::str::from_utf8(bytes).is_ok() {
        let (text, _, _) = encoding_rs::UTF_8.decode(bytes);
        return (text.into_owned(), "UTF-8".to_string());
    }
    for enc in [GBK, BIG5, SHIFT_JIS, EUC_JP] {
        let (text, _, had_errors) = enc.decode(bytes);
        if !had_errors {
            return (text.into_owned(), enc.name().to_string());
        }
    }
    let (text, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
    (text.into_owned(), "Windows-1252".to_string())
}

fn detect_eol(content: &str) -> String {
    let crlf = content.matches("\r\n").count();
    let lf = content.matches('\n').count() - crlf;
    let cr = content.matches('\r').count() - crlf;
    if crlf > 0 && lf == 0 && cr == 0 {
        "CRLF".into()
    } else if lf > 0 && crlf == 0 && cr == 0 {
        "LF".into()
    } else if cr > 0 && crlf == 0 && lf == 0 {
        "CR".into()
    } else {
        "MIXED".into()
    }
}

/// 读取文本文件（自动识别编码），内容统一以 UTF-8 返回给前端
#[tauri::command]
fn read_text_file(path: String) -> Result<TextFileInfo, String> {
    let bytes = fs::read(&path).map_err(|e| format!("无法读取文件 {path}: {e}"))?;
    let size = bytes.len() as u64;
    if size > 20 * 1024 * 1024 {
        return Err(format!("文件过大（{} MB），NotePlus+ 暂不支持编辑超过 20MB 的文件", size / 1024 / 1024));
    }
    let (content, encoding) = decode(&bytes);
    let eol = detect_eol(&content);
    Ok(TextFileInfo { content, encoding, eol, size })
}

/// 保存文本文件：按指定编码写入，并把换行符归一化为指定类型
#[tauri::command]
fn write_text_file(
    path: String,
    content: String,
    encoding: String,
    eol: String,
) -> Result<WriteResult, String> {
    // 归一化换行符
    let mut text = content.replace("\r\n", "\n").replace('\r', "\n");
    text = match eol.as_str() {
        "CRLF" => text.replace('\n', "\r\n"),
        "CR" => text.replace('\n', "\r"),
        _ => text, // LF 保持不变
    };

    let bom = has_bom_default(&encoding);
    let enc = encoding_rs::Encoding::for_label(encoding.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    // 写入时编码失败则回退 UTF-8，避免丢失内容
    let (bytes, _, had_errors) = enc.encode(&text);
    let bytes = if had_errors && enc != encoding_rs::UTF_8 {
        encoding_rs::UTF_8.encode(&text).0.into_owned()
    } else {
        bytes.into_owned()
    };
    let mut out = Vec::with_capacity(bytes.len() + 3);
    if bom {
        out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
    }
    out.extend_from_slice(&bytes);
    fs::write(&path, &out).map_err(|e| format!("无法写入文件 {path}: {e}"))?;
    Ok(WriteResult { bytes_written: out.len() })
}

fn has_bom_default(encoding: &str) -> bool {
    encoding.eq_ignore_ascii_case("UTF-8 BOM")
}

/// 读取目录树（懒加载，depth 控制展开层级）
#[tauri::command]
fn read_dir_tree(path: String, depth: u32, show_hidden: bool) -> Result<FileNode, String> {
    read_node(Path::new(&path), depth, show_hidden).map_err(|e| format!("无法读取目录 {path}: {e}"))
}

fn read_node(p: &Path, depth: u32, show_hidden: bool) -> std::io::Result<FileNode> {
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.to_string_lossy().into_owned());
    let meta = fs::metadata(p)?;
    let path_str = p.to_string_lossy().into_owned();

    if !meta.is_dir() || depth == 0 {
        return Ok(FileNode {
            name,
            path: path_str,
            is_dir: meta.is_dir(),
            children: None,
            size: Some(meta.len()),
        });
    }

    let mut entries: Vec<_> = fs::read_dir(p)?
        .filter_map(|e| e.ok())
        .collect();
    // 目录优先，其余按名称排序（不区分大小写）
    entries.sort_by(|a, b| {
        let (ka, kb) = (a.file_type().map(|t| !t.is_dir()).unwrap_or(true), b.file_type().map(|t| !t.is_dir()).unwrap_or(true));
        ka.cmp(&kb).then_with(|| {
            a.file_name().to_string_lossy().to_lowercase().cmp(&b.file_name().to_string_lossy().to_lowercase())
        })
    });

    let mut children = Vec::new();
    for e in entries {
        let ename = e.file_name().to_string_lossy().into_owned();
        if !show_hidden && ename.starts_with('.') {
            continue;
        }
        // 符号链接目录不展开（避免环）
        let is_symlink_dir = e.file_type().map(|t| t.is_symlink()).unwrap_or(false)
            && fs::metadata(e.path()).map(|m| m.is_dir()).unwrap_or(false);
        let child = if is_symlink_dir {
            FileNode {
                name: ename,
                path: e.path().to_string_lossy().into_owned(),
                is_dir: true,
                children: None,
                size: None,
            }
        } else if let Ok(node) = read_node(&e.path(), depth - 1, show_hidden) {
            node
        } else {
            continue;
        };
        children.push(child);
        if children.len() >= 5000 {
            break; // 单目录上限，防止超大目录卡死
        }
    }

    Ok(FileNode {
        name,
        path: path_str,
        is_dir: true,
        children: Some(children),
        size: None,
    })
}

/// 在 Finder 中显示文件
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 打开（或聚焦）macOS 风格的「查找和替换」独立窗口
#[tauri::command]
fn open_find_window(app: tauri::AppHandle, dark: bool) -> Result<(), String> {
    let theme = if dark {
        Some(tauri::Theme::Dark)
    } else {
        Some(tauri::Theme::Light)
    };

    if let Some(win) = app.get_webview_window("find") {
        let _ = win.set_theme(theme);
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        let _ = app.emit_to("find", "find:focus", true);
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(&app, "find", WebviewUrl::App("index.html".into()))
        .title("查找和替换")
        .inner_size(400.0, 220.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false);

    // 作为主窗口的子窗口：跟随主窗显示、不全局置顶
    if let Some(main) = app.get_webview_window("main") {
        builder = builder
            .parent(&main)
            .map_err(|e| format!("无法设置查找窗口父窗口: {e}"))?;
    }

    let win = builder
        .build()
        .map_err(|e| format!("无法创建查找窗口: {e}"))?;

    let _ = win.set_theme(theme);
    set_follow_app(&win);
    let _ = win.set_focus();
    let _ = app.emit_to("find", "find:focus", true);
    Ok(())
}

/// 让查找窗口随应用一起隐藏 / 恢复（macOS 原生 hidesOnDeactivate）
#[cfg(target_os = "macos")]
fn set_follow_app(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    if let Ok(ns_window) = win.ns_window() {
        let obj = ns_window as *mut AnyObject;
        unsafe {
            let _: () = msg_send![obj, setHidesOnDeactivate: true];
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn set_follow_app(_win: &tauri::WebviewWindow) {}

/// 读取 macOS 系统是否处于深色外观（浅色模式时该键不存在）
#[cfg(target_os = "macos")]
fn read_system_dark() -> bool {
    match Command::new("defaults")
        .args(["read", "-g", "AppleInterfaceStyle"])
        .output()
    {
        Ok(out) => String::from_utf8_lossy(&out.stdout)
            .trim()
            .eq_ignore_ascii_case("dark"),
        Err(_) => true,
    }
}

/// 轮询系统外观变化并广播给所有窗口。
/// WKWebView 的 prefers-color-scheme change 事件在 macOS 上不可靠，这里做兜底。
#[cfg(target_os = "macos")]
fn spawn_system_theme_watcher(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut last = read_system_dark();
        SYSTEM_DARK.store(last, Ordering::Relaxed);
        loop {
            std::thread::sleep(std::time::Duration::from_millis(1500));
            let now = read_system_dark();
            if now != last {
                last = now;
                SYSTEM_DARK.store(now, Ordering::Relaxed);
                let _ = app.emit("system:theme-changed", now);
            }
        }
    });
}

#[cfg(not(target_os = "macos"))]
fn spawn_system_theme_watcher(_app: tauri::AppHandle) {}

/// 供前端读取真实系统外观（跟随系统主题用）
#[tauri::command]
fn get_system_dark() -> bool {
    SYSTEM_DARK.load(Ordering::Relaxed)
}

/// 关闭查找窗口（Esc / 自定义关闭按钮使用，避免依赖前端权限）
#[tauri::command]
fn close_find_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("find") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 同步查找窗口标题栏外观（深色 / 浅色）
#[tauri::command]
fn set_find_theme(app: tauri::AppHandle, dark: bool) {
    if let Some(win) = app.get_webview_window("find") {
        let _ = win.set_theme(if dark {
            Some(tauri::Theme::Dark)
        } else {
            Some(tauri::Theme::Light)
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            SYSTEM_DARK.store(read_system_dark(), Ordering::Relaxed);
            spawn_system_theme_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            read_dir_tree,
            reveal_in_finder,
            open_find_window,
            close_find_window,
            set_find_theme,
            get_system_dark
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                match window.label() {
                    // 主窗口关闭时一并关闭查找窗口
                    "main" => {
                        if let Some(find) = window.get_webview_window("find") {
                            let _ = find.close();
                        }
                    }
                    // 查找窗口关闭（点击红绿灯 / Esc）时通知主窗口清理高亮
                    "find" => {
                        let _ = window.app_handle().emit_to("main", "find:closing", ());
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
