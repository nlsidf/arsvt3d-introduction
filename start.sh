#!/bin/bash

echo "启动 arsvt3d 项目介绍网站..."

# 检查是否有Python
if command -v python3 >/dev/null 2>&1; then
    echo "使用Python3启动本地服务器..."
    cd "$(dirname "$0")"
    python3 -m http.server 8080
    echo "网站已在 http://localhost:8080 启动"
elif command -v python >/dev/null 2>&1; then
    echo "使用Python启动本地服务器..."
    cd "$(dirname "$0")"
    python -m http.server 8080
    echo "网站已在 http://localhost:8080 启动"
elif command -v node >/dev/null 2>&1; then
    echo "尝试使用Node.js serve包..."
    if command -v npx >/dev/null 2>&1; then
        cd "$(dirname "$0")"
        npx serve -l 8080
        echo "网站已在 http://localhost:8080 启动"
    else
        echo "请安装serve包: npm install -g serve"
    fi
else
    echo "未找到合适的HTTP服务器。请安装Python3或Node.js。"
    echo "或者直接在浏览器中打开 index.html 文件。"
fi