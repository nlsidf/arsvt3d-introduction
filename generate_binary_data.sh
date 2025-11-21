#!/bin/bash

# 创建二进制文件的base64编码JavaScript文件
echo "// arsvt3d 二进制文件的base64编码数据" > binary_data.js
echo "// 这个文件包含了所有平台的预编译二进制文件" >> binary_data.js
echo "const binaryData = {" >> binary_data.js

# 处理Windows x64二进制文件
if [ -f "/root/crates/arsvt/target/x86_64-pc-windows-gnu/release/arsvt3d.exe" ]; then
    echo "处理Windows x64二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/x86_64-pc-windows-gnu/release/arsvt3d.exe" > temp.b64
    echo "  'windows-x64': '$(cat temp.b64)'," >> binary_data.js
else
    echo "Windows x64二进制文件未找到"
fi

# 处理Windows x86二进制文件
if [ -f "/root/crates/arsvt/target/i686-pc-windows-gnu/release/arsvt3d.exe" ]; then
    echo "处理Windows x86二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/i686-pc-windows-gnu/release/arsvt3d.exe" > temp.b64
    echo "  'windows-x86': '$(cat temp.b64)'," >> binary_data.js
else
    echo "Windows x86二进制文件未找到"
fi

# 处理Linux x64二进制文件
if [ -f "/root/crates/arsvt/target/x86_64-unknown-linux-gnu/arsvt3d" ]; then
    echo "处理Linux x64二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/x86_64-unknown-linux-gnu/arsvt3d" > temp.b64
    echo "  'linux-x64': '$(cat temp.b64)'," >> binary_data.js
else
    echo "Linux x64二进制文件未找到"
fi

# 处理Linux ARM64二进制文件
if [ -f "/root/crates/arsvt/aarch64-linux-android/arsvt3d" ]; then
    echo "处理Linux ARM64二进制文件..."
    base64 -w 0 "/root/crates/arsvt/aarch64-linux-android/arsvt3d" > temp.b64
    echo "  'linux-arm64': '$(cat temp.b64)'," >> binary_data.js
else
    echo "Linux ARM64二进制文件未找到"
fi

# 处理macOS Intel二进制文件
if [ -f "/root/crates/arsvt/target/x86_64-apple-darwin/arsvt3d" ]; then
    echo "处理macOS Intel二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/x86_64-apple-darwin/arsvt3d" > temp.b64
    echo "  'macos-x64': '$(cat temp.b64)'," >> binary_data.js
else
    echo "macOS Intel二进制文件未找到"
fi

# 处理macOS Apple Silicon二进制文件
if [ -f "/root/crates/arsvt/target/aarch64-apple-darwin/arsvt3d" ]; then
    echo "处理macOS Apple Silicon二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/aarch64-apple-darwin/arsvt3d" > temp.b64
    echo "  'macos-arm64': '$(cat temp.b64)'," >> binary_data.js
else
    echo "macOS Apple Silicon二进制文件未找到"
fi

# 处理Android ARM64二进制文件
if [ -f "/root/crates/arsvt/target/aarch64-linux-android/arsvt3d" ]; then
    echo "处理Android ARM64二进制文件..."
    base64 -w 0 "/root/crates/arsvt/target/aarch64-linux-android/arsvt3d" > temp.b64
    echo "  'android-arm64': '$(cat temp.b64)'" >> binary_data.js
else
    echo "Android ARM64二进制文件未找到"
fi

echo "};" >> binary_data.js

# 清理临时文件
rm -f temp.b64

echo "二进制文件base64编码完成，保存到 binary_data.js"

# 创建curl下载脚本
cat > install.sh << 'EOF'
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
EOF

chmod +x install.sh
echo "curl安装脚本已创建: install.sh"