#!/bin/bash

# ScreenCut 扩展依赖安装脚本

echo "🚀 ScreenCut 扩展依赖安装"
echo "=========================="

# 创建lib目录
echo "📁 创建lib目录..."
mkdir -p lib

# 下载html2canvas库
echo "📦 下载html2canvas库..."
curl -L "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" -o "lib/html2canvas.min.js"

if [ $? -eq 0 ]; then
    echo "✅ html2canvas下载成功"
else
    echo "❌ html2canvas下载失败，请手动下载"
    echo "   下载地址: https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
    echo "   保存位置: lib/html2canvas.min.js"
fi

# 创建简单的图标（如果不存在）
echo "🎨 检查图标文件..."
if [ ! -f "icons/icon16.png" ]; then
    echo "📌 图标文件缺失，请参考 icons/README.md 创建图标"
    echo "   临时方案：使用任意16x16、48x48、128x128的PNG图片"
    echo "   重命名为 icon16.png、icon48.png、icon128.png"
fi

echo ""
echo "✨ 安装完成！"
echo "📋 下一步："
echo "   1. 准备图标文件（参考 icons/README.md）"
echo "   2. 在Chrome中加载扩展（参考 test-extension.md）"
echo "   3. 开始测试截图功能"
echo "" 