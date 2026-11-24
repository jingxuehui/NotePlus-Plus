#!/bin/bash
# 双击运行：清除 macOS 隔离属性并重新签名，然后启动 NotePlus+
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/NotePlus+.app"
[ -d "$APP" ] || APP="/Applications/NotePlus+.app"
if [ ! -d "$APP" ]; then
  echo "未找到 NotePlus+.app：请先把它拖入右侧的「Applications（应用程序）」文件夹，再运行本脚本。"
  echo ""
  read -n 1 -s -r -p "按任意键关闭窗口..."
  exit 1
fi
echo "正在修复 macOS 安全限制（约几秒）..."
xattr -cr "$APP"
codesign --force --deep --sign - "$APP" 2>/dev/null
open "$APP"
echo "修复完成，NotePlus+ 已启动！"
sleep 1
