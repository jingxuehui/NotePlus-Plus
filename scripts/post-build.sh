#!/usr/bin/env bash
# tauri build 之后的后处理（由 pnpm release 自动调用）：
#   1. 对 NotePlus+.app 做完整 ad-hoc 签名（修复 Tauri 默认产物只有
#      linker-signed 签名、Sealed Resources 缺失导致的「已损坏」提示）
#   2. 重新打包 dmg，附带「一键修复脚本」和「首次打开说明」
# 没有付费 Apple 开发者账号时，浏览器下载的文件仍带隔离属性，
# 首次打开需按 dmg 内说明处理一次（详见 dmg-assets/首次打开说明.txt）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/src-tauri/target/release/bundle/macos/NotePlus+.app"
DMG_DIR="$ROOT/src-tauri/target/release/bundle/dmg"
CONF="$ROOT/src-tauri/tauri.conf.json"
ASSETS="$ROOT/scripts/dmg-assets"

[ -d "$APP" ] || { echo "未找到 $APP，请先执行 tauri build"; exit 1; }
[ -x "$(command -v codesign)" ] || { echo "未找到 codesign"; exit 1; }

VERSION=$(sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' "$CONF" | head -1)
DMG_OUT="$DMG_DIR/NotePlus+_${VERSION}_aarch64.dmg"

echo "==> 0/3 声明应用支持的本地化语言（原生菜单/对话框跟随应用内语言设置）"
PLIST="$APP/Contents/Info.plist"
if [ -x /usr/libexec/PlistBuddy ] && [ -f "$PLIST" ]; then
  PB=/usr/libexec/PlistBuddy
  "$PB" -c "Delete :CFBundleLocalizations" "$PLIST" 2>/dev/null || true
  "$PB" -c "Add :CFBundleLocalizations array" "$PLIST" || true
  "$PB" -c "Add :CFBundleLocalizations:0 string zh-CN" "$PLIST" || true
  "$PB" -c "Add :CFBundleLocalizations:1 string zh-TW" "$PLIST" || true
  "$PB" -c "Add :CFBundleLocalizations:2 string en" "$PLIST" || true
else
  echo "    跳过：未找到 PlistBuddy 或 Info.plist"
fi

echo "==> 1/3 对 NotePlus+.app 做完整 ad-hoc 签名"
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "    签名校验通过（Sealed Resources 已生成）"

echo "==> 2/3 组装 dmg 内容"
STAGING=$(mktemp -d -t noteplus-dmg)
trap 'rm -rf "$STAGING"' EXIT
cp -R "$APP" "$STAGING/"
ln -s /Applications "$STAGING/Applications"
cp "$ASSETS/双击修复打不开.command" "$STAGING/"
cp "$ASSETS/首次打开说明.txt" "$STAGING/"
chmod +x "$STAGING/双击修复打不开.command"

echo "==> 3/3 重新生成 $DMG_OUT"
rm -f "$DMG_OUT"
BUNDLE_DMG="$DMG_DIR/bundle_dmg.sh"
if [ -x "$BUNDLE_DMG" ] &&
   "$BUNDLE_DMG" \
     --volname "NotePlus+" \
     --icon "NotePlus+.app" 160 200 \
     --icon "双击修复打不开.command" 400 200 \
     --app-drop-link 620 200 \
     "$DMG_OUT" "$STAGING" >/dev/null 2>&1; then
  echo "    使用 Tauri bundle_dmg.sh 生成（保留图标布局）"
else
  rm -f "$DMG_OUT"
  hdiutil create -volname "NotePlus+" -srcfolder "$STAGING" -format UDZO -o "$DMG_OUT" >/dev/null
  echo "    使用 hdiutil 生成"
fi

ls -lh "$DMG_OUT"
echo "完成: $DMG_OUT"

rm -f "$DMG_DIR"/rw.*.dmg 2>/dev/null || true
echo "    清理 hdiutil 残留临时文件"
