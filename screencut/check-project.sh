#!/bin/bash

# ScreenCut 项目完整性检查脚本

echo "🔍 ScreenCut 项目完整性检查"
echo "=========================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0

# 检查函数
check_file() {
    local file_path=$1
    local description=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -f "$file_path" ]; then
        echo -e "✅ ${GREEN}$description${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "❌ ${RED}$description (缺失: $file_path)${NC}"
    fi
}

check_dir() {
    local dir_path=$1
    local description=$2
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ -d "$dir_path" ]; then
        echo -e "✅ ${GREEN}$description${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "❌ ${RED}$description (缺失: $dir_path)${NC}"
    fi
}

echo "📁 检查目录结构..."
check_dir "popup" "弹窗模块目录"
check_dir "content" "内容脚本目录"
check_dir "background" "后台脚本目录"
check_dir "utils" "工具函数目录"
check_dir "lib" "第三方库目录"
check_dir "icons" "图标资源目录"

echo ""
echo "📄 检查核心文件..."
check_file "manifest.json" "Chrome扩展配置文件"

echo ""
echo "🎨 检查UI文件..."
check_file "popup/popup.html" "弹窗HTML页面"
check_file "popup/popup.css" "弹窗样式文件"
check_file "popup/popup.js" "弹窗交互脚本"

echo ""
echo "🔧 检查功能模块..."
check_file "content/content.js" "内容注入脚本"
check_file "content/overlay.css" "截图框样式"
check_file "background/background.js" "后台服务脚本"

echo ""
echo "⚙️ 检查工具库..."
check_file "utils/capture.js" "截图捕获工具"
check_file "utils/ratio-calculator.js" "比例计算工具"
check_file "lib/html2canvas.min.js" "html2canvas库"

echo ""
echo "🎯 检查图标文件..."
check_file "icons/icon16.png" "16x16px图标"
check_file "icons/icon48.png" "48x48px图标"
check_file "icons/icon128.png" "128x128px图标"

echo ""
echo "📚 检查文档..."
check_file "README.md" "项目说明文档"
check_file "产品需求文档.md" "产品需求文档"
check_file "开发文档.md" "开发文档"
check_file "test-extension.md" "测试指南"

echo ""
echo "🛠️ 检查工具..."
check_file "install-dependencies.sh" "依赖安装脚本"
check_file "create-simple-icons.html" "图标生成器"

echo ""
echo "==============================="
echo -e "📊 检查结果: ${PASSED_CHECKS}/${TOTAL_CHECKS} 项通过"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "🎉 ${GREEN}项目完整性检查通过！${NC}"
    echo "🚀 可以开始测试扩展了"
    echo ""
    echo "📋 下一步操作："
    echo "1. 如缺少图标，运行: open create-simple-icons.html"
    echo "2. 在Chrome中加载扩展: chrome://extensions/"
    echo "3. 参考测试指南: cat test-extension.md"
else
    echo -e "⚠️ ${YELLOW}发现 $((TOTAL_CHECKS - PASSED_CHECKS)) 个问题${NC}"
    echo "📝 请根据上述提示补充缺失文件"
    
    # 提供解决方案
    if [ ! -f "lib/html2canvas.min.js" ]; then
        echo ""
        echo "💡 解决html2canvas缺失问题:"
        echo "   运行: ./install-dependencies.sh"
    fi
    
    if [ ! -f "icons/icon16.png" ] || [ ! -f "icons/icon48.png" ] || [ ! -f "icons/icon128.png" ]; then
        echo ""
        echo "💡 解决图标缺失问题:"
        echo "   用浏览器打开: create-simple-icons.html"
        echo "   按照页面指示下载并重命名图标文件"
    fi
fi

echo "" 