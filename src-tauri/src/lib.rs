use encoding_rs::{BIG5, EUC_JP, GBK, SHIFT_JIS, UTF_16BE, UTF_16LE};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

/// 真实系统外观缓存（由 Rust 侧维护，前端不依赖 WKWebView 媒体查询）
static SYSTEM_DARK: AtomicBool = AtomicBool::new(true);

/// 「关闭窗口时退出程序」：由前端设置同步过来，默认关闭（即默认隐藏驻留 Dock）
static EXIT_ON_CLOSE: AtomicBool = AtomicBool::new(false);

/// 创建子进程命令；Windows 上 GUI 程序启动 curl / cmd 等控制台程序会闪出黑框，需加 CREATE_NO_WINDOW
fn hidden_command(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

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

/// 原生对话框结果转换（避免把 FilePath 直接跨 IPC 传递）
#[allow(dead_code)]
fn dialog_path(p: Option<tauri_plugin_dialog::FilePath>) -> Option<String> {
    p.and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}
#[allow(dead_code)]
fn dialog_paths(p: Option<Vec<tauri_plugin_dialog::FilePath>>) -> Option<Vec<String>> {
    p.map(|list| {
        list.into_iter()
            .filter_map(|p| p.into_path().ok())
            .map(|p| p.to_string_lossy().into_owned())
            .collect()
    })
}

/// 对话框最长等待时间：用户可能长时间不操作，但绝不能让前端 invoke 永久挂起
#[allow(dead_code)]
const DIALOG_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(600);

/// rfd 返回 PathBuf，统一转字符串
#[allow(dead_code)]
fn path_string(p: std::path::PathBuf) -> String {
    p.to_string_lossy().into_owned()
}

/**
 * Windows「保存文件」对话框：直接调用 rfd 同步 API。
 *
 * tauri-plugin-dialog 的实现是 run_on_main_thread → AsyncFileDialog → 新线程 block_on
 * 三层线程链；WebView2 主线程繁忙时回调会丢失，前端 invoke 永久挂起（点保存没反应），
 * COM 单元不匹配时则崩溃（panic=abort 下直接闪退）。
 *
 * rfd 同步 save_file() 会在调用线程内自行 CoInitializeEx(STA)，
 * 这里放到专用 std 线程执行，结果经同步 channel 回传，并有超时兜底。
 */
#[allow(dead_code)]
async fn np_save_file_windows(
    title: String,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("np-save-dialog".into())
            .spawn(move || {
                let mut dialog = rfd::FileDialog::new().set_title(&title);
                if let Some(dp) = default_path.as_deref() {
                    let p = Path::new(dp);
                    match (p.parent(), p.file_name()) {
                        (Some(parent), Some(name)) if !parent.as_os_str().is_empty() => {
                            dialog = dialog
                                .set_directory(parent)
                                .set_file_name(name.to_string_lossy().as_ref());
                        }
                        _ => dialog = dialog.set_file_name(dp),
                    }
                }
                let result = dialog.save_file().map(path_string);
                let _ = tx.send(result);
            })
            .map_err(|e| e.to_string())?;
        rx.recv_timeout(DIALOG_TIMEOUT)
            .map_err(|e| format!("保存对话框等待失败: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

/** macOS「保存文件」对话框：插件回调方案已验证稳定，保持不变 */
#[allow(dead_code)]
async fn np_save_file_macos(
    app: AppHandle,
    window: tauri::Window,
    title: String,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let mut builder = app.dialog().file().set_title(title);
    if let Some(dp) = default_path {
        let p = Path::new(&dp);
        if let (Some(parent), Some(name)) = (p.parent(), p.file_name()) {
            if parent.components().count() > 0 {
                builder = builder.set_directory(parent);
            }
            builder = builder.set_file_name(name.to_string_lossy());
        } else {
            builder = builder.set_file_name(dp);
        }
    }
    let builder = builder.set_parent(&window);
    builder.save_file(move |p| {
        let _ = tx.try_send(dialog_path(p));
    });
    Ok(rx.recv().await.unwrap_or(None))
}

#[tauri::command]
async fn np_save_file(
    app: AppHandle,
    window: tauri::Window,
    title: String,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    return np_save_file_windows(title, default_path).await;
    #[cfg(not(target_os = "windows"))]
    return np_save_file_macos(app, window, title, default_path).await;
}

/** Windows「打开」对话框：同保存对话框，走 rfd 同步 API */
#[allow(dead_code)]
async fn np_open_dialog_windows(
    title: String,
    multiple: bool,
    directory: bool,
) -> Result<Option<Vec<String>>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("np-open-dialog".into())
            .spawn(move || {
                let dialog = rfd::FileDialog::new().set_title(&title);
                let result = if directory && multiple {
                    dialog
                        .pick_folders()
                        .map(|list| list.into_iter().map(path_string).collect())
                } else if directory {
                    dialog.pick_folder().map(|p| vec![path_string(p)])
                } else if multiple {
                    dialog
                        .pick_files()
                        .map(|list| list.into_iter().map(path_string).collect())
                } else {
                    dialog.pick_file().map(|p| vec![path_string(p)])
                };
                let _ = tx.send(result);
            })
            .map_err(|e| e.to_string())?;
        rx.recv_timeout(DIALOG_TIMEOUT)
            .map_err(|e| format!("打开对话框等待失败: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

/** macOS「打开」对话框：保持原实现 */
#[allow(dead_code)]
async fn np_open_dialog_macos(
    app: AppHandle,
    window: tauri::Window,
    title: String,
    multiple: bool,
    directory: bool,
) -> Result<Option<Vec<String>>, String> {
    let (tx, mut rx) = tauri::async_runtime::channel(1);
    let builder = app.dialog().file().set_title(title).set_parent(&window);
    if directory && multiple {
        builder.pick_folders(move |p| {
            let _ = tx.try_send(dialog_paths(p));
        });
    } else if directory {
        builder.pick_folder(move |p| {
            let _ = tx.try_send(dialog_path(p).map(|s| vec![s]));
        });
    } else if multiple {
        builder.pick_files(move |p| {
            let _ = tx.try_send(dialog_paths(p));
        });
    } else {
        builder.pick_file(move |p| {
            let _ = tx.try_send(dialog_path(p).map(|s| vec![s]));
        });
    }
    Ok(rx.recv().await.unwrap_or(None))
}

#[tauri::command]
async fn np_open_dialog(
    app: AppHandle,
    window: tauri::Window,
    title: String,
    multiple: bool,
    directory: bool,
) -> Result<Option<Vec<String>>, String> {
    #[cfg(target_os = "windows")]
    return np_open_dialog_windows(title, multiple, directory).await;
    #[cfg(not(target_os = "windows"))]
    return np_open_dialog_macos(app, window, title, multiple, directory).await;
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
    if crlf == 0 && lf == 0 && cr == 0 {
        "LF".into() // 空文件 / 单行无换行，默认 LF 而非「混合」
    } else if crlf > 0 && lf == 0 && cr == 0 {
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
    // 无 BOM 且开头含 NUL 字节视为二进制文件，按文本解码只会得到乱码，保存还会破坏原文件
    if !has_bom(&bytes).0 && bytes.iter().take(8192).any(|&b| b == 0) {
        return Err(format!("「{path}」是二进制文件，NotePlus+ 无法以文本方式打开"));
    }
    let (content, encoding) = decode(&bytes);
    let eol = detect_eol(&content);
    Ok(TextFileInfo { content, encoding, eol, size })
}

/// 读取二进制文件原始字节（图片预览用），以 ArrayBuffer 返回给前端
#[tauri::command]
fn read_binary_file(path: String) -> Result<tauri::ipc::Response, String> {
    let size = fs::metadata(&path)
        .map_err(|e| format!("无法读取文件 {path}: {e}"))?
        .len();
    if size > 50 * 1024 * 1024 {
        return Err(format!("文件过大（{} MB），暂不支持预览超过 50MB 的文件", size / 1024 / 1024));
    }
    let bytes = fs::read(&path).map_err(|e| format!("无法读取文件 {path}: {e}"))?;
    Ok(tauri::ipc::Response::new(bytes))
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

    // encoding_rs 对 UTF-16LE/BE 的 encode 按 WHATWG 规范「编码器未定义」，
    // 会静默输出 UTF-8 字节（实测 err=false），因此必须手动逐码点编码；
    // encode_utf16 正确处理代理对（如 emoji）
    let mut out = Vec::with_capacity(text.len() * 2 + 3);
    if let Some(bom) = bom_for(&encoding) {
        out.extend_from_slice(bom);
    }
    if encoding.eq_ignore_ascii_case("UTF-16LE") {
        for unit in text.encode_utf16() {
            out.extend_from_slice(&unit.to_le_bytes());
        }
    } else if encoding.eq_ignore_ascii_case("UTF-16BE") {
        for unit in text.encode_utf16() {
            out.extend_from_slice(&unit.to_be_bytes());
        }
    } else {
        let enc = encoding_rs::Encoding::for_label(encoding.as_bytes())
            .unwrap_or(encoding_rs::UTF_8);
        // 写入时编码失败则回退 UTF-8，避免丢失内容
        let (bytes, _, had_errors) = enc.encode(&text);
        if had_errors && enc != encoding_rs::UTF_8 {
            let (fb, _, _) = encoding_rs::UTF_8.encode(&text);
            out.extend_from_slice(&fb);
        } else {
            out.extend_from_slice(&bytes);
        }
    }
    fs::write(&path, &out).map_err(|e| format!("无法写入文件 {path}: {e}"))?;
    Ok(WriteResult { bytes_written: out.len() })
}

/// 写入时随编码附带的 BOM；与读取端 has_bom() 的识别保持一致
fn bom_for(encoding: &str) -> Option<&'static [u8]> {
    if encoding.eq_ignore_ascii_case("UTF-8 BOM") {
        Some(&[0xEF, 0xBB, 0xBF])
    } else if encoding.eq_ignore_ascii_case("UTF-16LE") {
        Some(&[0xFF, 0xFE])
    } else if encoding.eq_ignore_ascii_case("UTF-16BE") {
        Some(&[0xFE, 0xFF])
    } else {
        None
    }
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

/// 在 Finder / 资源管理器中显示文件（按平台调用对应文件管理器）
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    // explorer 不认 Rust 默认对含空格参数整体加引号的写法（"/select,C:\a b"），
    // 只能手动拼成 /select,"C:\a b"
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// 发布资源（安装包）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAsset {
    pub name: String,
    pub size: u64,
    pub download_url: String,
}

/// 发布信息（供更新中心展示）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseInfo {
    pub tag: String,
    pub name: String,
    pub body: String,
    pub published_at: String,
    pub html_url: String,
    pub prerelease: bool,
    pub assets: Vec<ReleaseAsset>,
}

/// 拉取仓库 releases 列表（GitHub / Gitee），返回归一化后的数组
#[tauri::command]
fn fetch_releases(source: String) -> Result<Vec<ReleaseInfo>, String> {
    let url = match source.as_str() {
        "github" => "https://api.github.com/repos/jingxuehui/NotePlus-Plus/releases",
        "gitee" => "https://gitee.com/api/v5/repos/jingxuehui/NotePlus-Plus/releases",
        _ => return Err("未知的更新源".into()),
    };
    let output = hidden_command("curl")
        .args(["-sS", "-L", "-m", "15", "-H", "Accept: application/json", url])
        .output()
        .map_err(|e| format!("请求发布信息失败: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "请求发布信息失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let list: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("解析发布信息失败: {e}"))?;
    let arr = list
        .as_array()
        .ok_or_else(|| "发布信息格式错误".to_string())?;

    let mut releases: Vec<ReleaseInfo> = arr
        .iter()
        .map(|r| {
            let tag = r["tag_name"].as_str().unwrap_or_default().to_string();
            // Gitee 只返回 created_at，没有 published_at
            let published_at = r["published_at"]
                .as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| r["created_at"].as_str())
                .unwrap_or_default()
                .to_string();
            // Gitee 不返回 html_url，用 tag 拼出发布页地址
            let html_url = r["html_url"]
                .as_str()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| match source.as_str() {
                    "gitee" => format!("https://gitee.com/jingxuehui/NotePlus-Plus/releases/tag/{tag}"),
                    _ => format!("https://github.com/jingxuehui/NotePlus-Plus/releases/tag/{tag}"),
                });
            let assets: Vec<ReleaseAsset> = r["assets"]
                .as_array()
                .map(|list| {
                    list.iter()
                        .filter_map(|a| {
                            let name = a["name"].as_str().unwrap_or_default();
                            let download_url = a["browser_download_url"]
                                .as_str()
                                .unwrap_or_default();
                            if name.is_empty() || download_url.is_empty() {
                                return None;
                            }
                            Some(ReleaseAsset {
                                name: name.to_string(),
                                size: a["size"].as_u64().unwrap_or(0),
                                download_url: download_url.to_string(),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            ReleaseInfo {
                tag,
                name: r["name"].as_str().unwrap_or_default().to_string(),
                body: r["body"].as_str().unwrap_or_default().to_string(),
                published_at,
                html_url,
                prerelease: r["prerelease"].as_bool().unwrap_or(false),
                assets,
            }
        })
        .collect();
    // 统一按发布时间倒序展示
    releases.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    Ok(releases)
}

/// 已下载的安装包
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedAsset {
    pub path: String,
    pub name: String,
    pub size: u64,
}

/// 下载 release 安装包到应用缓存目录，已下载过则直接复用
#[tauri::command]
fn download_asset(app: AppHandle, url: String, name: String) -> Result<DownloadedAsset, String> {
    if !url.starts_with("https://") {
        return Err("下载地址不安全".into());
    }
    let safe_name: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '+') {
                c
            } else {
                '_'
            }
        })
        .collect();
    if safe_name.is_empty() || safe_name == "." || safe_name == ".." {
        return Err("安装包文件名无效".into());
    }
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("updates");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(&safe_name);
    if let Ok(meta) = fs::metadata(&path) {
        if meta.is_file() && meta.len() > 0 {
            return Ok(DownloadedAsset {
                path: path.to_string_lossy().to_string(),
                name: safe_name,
                size: meta.len(),
            });
        }
    }
    let path_str = path.to_string_lossy().to_string();
    let output = hidden_command("curl")
        .args([
            "-fL", "-sS", "--retry", "2", "-m", "300", "-o", &path_str, &url,
        ])
        .output()
        .map_err(|e| format!("下载安装包失败: {e}"))?;
    if !output.status.success() {
        let _ = fs::remove_file(&path);
        return Err(format!(
            "下载安装包失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let size = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    Ok(DownloadedAsset {
        path: path_str,
        name: safe_name,
        size,
    })
}

/// 打开已下载的安装包并退出应用，由系统安装流程完成更新
#[tauri::command]
fn restart_and_update(app: AppHandle, path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_file() {
        return Err("安装包不存在".into());
    }
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(p)
        .spawn()
        .map_err(|e| format!("打开安装包失败: {e}"))?;
    #[cfg(target_os = "windows")]
    hidden_command("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("打开安装包失败: {e}"))?;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    Command::new("xdg-open")
        .arg(p)
        .spawn()
        .map_err(|e| format!("打开安装包失败: {e}"))?;
    app.exit(0);
    Ok(())
}

/// 用系统默认浏览器打开外部链接（仓库主页）
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("仅支持 https 链接".into());
    }
    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "windows")]
    hidden_command("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

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

/// 前端设置变化时同步：关闭窗口是否直接退出（否则隐藏驻留 Dock）
#[tauri::command]
fn set_exit_on_close(enabled: bool) {
    EXIT_ON_CLOSE.store(enabled, Ordering::Relaxed);
}

/// 把应用内语言写入 macOS 用户默认（AppleLanguages）。
/// 重启后原生菜单 / 系统对话框等跟随应用内设置的语言（Info.plist 已声明 CFBundleLocalizations）。
#[cfg(target_os = "macos")]
#[tauri::command]
fn set_app_language(lang: String) {
    use objc2_foundation::{NSArray, NSUserDefaults, NSString};

    let defs = NSUserDefaults::standardUserDefaults();
    let value = NSString::from_str(&lang);
    let arr = NSArray::from_slice(&[&*value]);
    unsafe {
        defs.setObject_forKey(Some(&arr), &NSString::from_str("AppleLanguages"));
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_app_language(_lang: String) {}

/// 切换 Dock 图标样式：默认彩色图标 / 黑色底板图标
#[cfg(target_os = "macos")]
#[tauri::command]
fn set_icon_style(black: bool) {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    // Tauri 的命令处理器运行在主线程，这里与 tauri 内部设置图标的方式一致
    let mtm = unsafe { MainThreadMarker::new_unchecked() };
    let app = NSApplication::sharedApplication(mtm);
    if !black {
        // 默认样式交还系统从 bundle 中读取的图标（多尺寸 icns），
        // 避免用单张 512 PNG 替换后 Dock 缩放渲染产生白边
        unsafe { app.setApplicationIconImage(None) };
        return;
    }
    let bytes: &[u8] = include_bytes!("../icons/icon_black_round.png");
    let data = NSData::with_bytes(bytes);
    if let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe { app.setApplicationIconImage(Some(&icon)) };
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_icon_style(_black: bool) {}

fn session_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法定位应用数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用数据目录: {e}"))?;
    Ok(dir.join("session.json"))
}

/// 保存会话快照（前端序列化好的 JSON）：标签页、未保存内容、活动标签、打开的文件夹
#[tauri::command]
fn save_session(app: AppHandle, json: String) -> Result<(), String> {
    let path = session_path(&app)?;
    fs::write(&path, json).map_err(|e| format!("无法写入会话文件: {e}"))
}

/// 读取上次会话快照；不存在时返回 None
#[tauri::command]
fn load_session(app: AppHandle) -> Result<Option<String>, String> {
    let path = session_path(&app)?;
    if path.exists() {
        fs::read_to_string(&path)
            .map(Some)
            .map_err(|e| format!("无法读取会话文件: {e}"))
    } else {
        Ok(None)
    }
}

/// 清除会话快照（全部标签关闭时调用，避免残留内容下次又被恢复）
#[tauri::command]
fn clear_session(app: AppHandle) -> Result<(), String> {
    let path = session_path(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("无法删除会话文件: {e}"))?;
    }
    Ok(())
}

/// 重新显示主窗口（点击 Dock 图标 / 关闭后再次唤起时使用）
#[cfg(target_os = "macos")]
fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        // set_focus 会同时激活应用（activateIgnoringOtherApps），无需额外 unhide
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Windows release 为 panic=abort，任何 panic 都会静默闪退。
/// 把 panic 信息落盘，便于定位对话框等原生调用导致的崩溃。
fn install_panic_hook() {
    let dir = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("APPDATA").map(std::path::PathBuf::from))
        .unwrap_or_else(std::env::temp_dir)
        .join("NotePlus+");
    let _ = fs::create_dir_all(&dir);
    let log = dir.join("panic.log");
    std::panic::set_hook(Box::new(move |info| {
        use std::io::Write;
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log) {
            let _ = writeln!(f, "=== {secs} ===\n{info}");
        }
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_hook();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            // 系统外观读取放到后台线程，避免同步 defaults 子进程阻塞窗口创建
            spawn_system_theme_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            read_binary_file,
            write_text_file,
            np_save_file,
            np_open_dialog,
            read_dir_tree,
            reveal_in_finder,
            fetch_releases,
            download_asset,
            restart_and_update,
            open_external,
            get_system_dark,
            set_exit_on_close,
            set_icon_style,
            set_app_language,
            save_session,
            load_session,
            clear_session
        ])
        .on_window_event(|window, event| match event {
            // 「关闭窗口时退出程序」关闭时：点红绿灯只隐藏主窗口，程序驻留 Dock；
            // 开启时不拦截，最后一个窗口销毁后应用退出。
            tauri::WindowEvent::CloseRequested { api, .. }
                if window.label() == "main"
                    && cfg!(target_os = "macos")
                    && !EXIT_ON_CLOSE.load(Ordering::Relaxed) =>
            {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        // 点击 Dock 图标（或应用被重新激活）时恢复主窗口
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => show_main_window(_app_handle),
        // 「关闭窗口时退出程序」关闭时，所有窗口都被销毁也不退出
        // （仅 Cmd+Q / 主动 exit 才真正退出）
        tauri::RunEvent::ExitRequested { code, api, .. } => {
            // 仅 macOS 在关窗后驻留；Windows/Linux 关窗即退出
            if code.is_none()
                && cfg!(target_os = "macos")
                && !EXIT_ON_CLOSE.load(Ordering::Relaxed)
            {
                api.prevent_exit();
            }
        }
        _ => {}
    });
}
