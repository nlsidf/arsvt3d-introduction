#!/bin/bash

# arsvt3d 自动安装脚本

set -e

echo "正在检测您的平台..."

PLATFORM=""
ARCH=""

# 检测操作系统
case "$(uname -s)" in
    Linux*)
        OS="linux"
        ;;
    Darwin*)
        OS="macos"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        OS="windows"
        ;;
    *)
        echo "不支持的操作系统: $(uname -s)"
        exit 1
        ;;
esac

# 检测架构
case "$(uname -m)" in
    x86_64|amd64)
        ARCH="x64"
        ;;
    i386|i686)
        ARCH="x86"
        ;;
    armv7l)
        ARCH="arm"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "不支持的架构: $(uname -m)"
        exit 1
        ;;
esac

# 检测Android
if [ -f /system/build.prop ] || [ -d /system/app ]; then
    OS="android"
    ARCH="arm64"
fi

echo "检测到平台: $OS-$ARCH"

# 确定文件名
FILENAME="arsvt3d"
if [ "$OS" = "windows" ]; then
    FILENAME="arsvt3d.exe"
fi

# 下载URL（这里使用GitHub releases作为示例）
BASE_URL="https://github.com/nlsidf/arsvt/releases/latest/download"
DOWNLOAD_URL="$BASE_URL/arsvt3d-$OS-$ARCH"

echo "正在从 $DOWNLOAD_URL 下载..."

# 使用curl或wget下载
if command -v curl >/dev/null 2>&1; then
    if curl --output /dev/null --silent --head --fail "$DOWNLOAD_URL"; then
        curl -L -o "$FILENAME" "$DOWNLOAD_URL"
    else
        echo "无法从GitHub下载，尝试备用源..."
        # 备用下载地址（可以是CDN或其他镜像）
        FALLBACK_URL="https://gitee.com/nlsidf/arsvt/releases/latest/download/arsvt3d-$OS-$ARCH"
        if curl --output /dev/null --silent --head --fail "$FALLBACK_URL"; then
            curl -L -o "$FILENAME" "$FALLBACK_URL"
        else
            echo "所有下载源都不可用，请手动下载"
            echo "访问 https://github.com/nlsidf/arsvt 获取最新版本"
            exit 1
        fi
    fi
elif command -v wget >/dev/null 2>&1; then
    if wget --spider "$DOWNLOAD_URL" 2>/dev/null; then
        wget -O "$FILENAME" "$DOWNLOAD_URL"
    else
        echo "无法从GitHub下载，尝试备用源..."
        FALLBACK_URL="https://gitee.com/nlsidf/arsvt/releases/latest/download/arsvt3d-$OS-$ARCH"
        if wget --spider "$FALLBACK_URL" 2>/dev/null; then
            wget -O "$FILENAME" "$FALLBACK_URL"
        else
            echo "所有下载源都不可用，请手动下载"
            echo "访问 https://github.com/nlsidf/arsvt 获取最新版本"
            exit 1
        fi
    fi
else
    echo "错误: 需要安装 curl 或 wget"
    exit 1
fi

# 检查文件是否存在
if [ ! -f "$FILENAME" ]; then
    echo "下载失败，请手动下载"
    exit 1
fi

# 设置执行权限
if [ "$OS" != "windows" ]; then
    chmod +x "$FILENAME"
fi

echo "安装完成! 运行 ./$FILENAME 开始游戏"
