#!/bin/bash

# 创建图片目录
mkdir -p images

echo "正在从gitee下载游戏截图图片..."

# 从gitee下载游戏截图
curl -L -o "images/screenshot1.png" "https://gitee.com/nlsidf/arsvt/raw/main/photos/游戏截图3.png"
curl -L -o "images/screenshot2.png" "https://gitee.com/nlsidf/arsvt/raw/main/photos/游戏截图2.png"
curl -L -o "images/screenshot3.png" "https://gitee.com/nlsidf/arsvt/raw/main/photos/游戏截图4.png"
curl -L -o "images/screenshot4.png" "https://gitee.com/nlsidf/arsvt/raw/main/photos/arsvt3d.png"
curl -L -o "images/screenshot5.png" "https://gitee.com/nlsidf/arsvt/raw/main/photos/游戏截图.png"

echo "游戏截图下载完成！"

# 创建图片预览页面
cat > image_gallery.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>arsvt3d 游戏截图</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: #FAF8F3;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 2rem;
        }
        
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        
        .gallery-item {
            background: white;
            border: 1px solid #E5E5E5;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .gallery-item:hover {
            transform: translateY(-5px);
        }
        
        .gallery-item img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .caption {
            padding: 1rem;
            text-align: center;
            font-size: 0.9rem;
            color: #666;
        }
        
        .nav {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .nav a {
            color: #8B4513;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border: 1px solid #8B4513;
            border-radius: 4px;
            transition: all 0.3s ease;
        }
        
        .nav a:hover {
            background-color: #8B4513;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav">
            <a href="index.html">← 返回主页</a>
        </div>
        
        <h1>arsvt3d 游戏截图</h1>
        
        <div class="gallery">
            <div class="gallery-item">
                <img src="images/screenshot1.png" alt="游戏截图1" loading="lazy">
                <div class="caption">游戏主界面</div>
            </div>
            
            <div class="gallery-item">
                <img src="images/screenshot2.png" alt="游戏截图2" loading="lazy">
                <div class="caption">彩色墙壁效果</div>
            </div>
            
            <div class="gallery-item">
                <img src="images/screenshot3.png" alt="游戏截图3" loading="lazy">
                <div class="caption">3D渲染效果</div>
            </div>
            
            <div class="gallery-item">
                <img src="images/screenshot4.png" alt="游戏截图4" loading="lazy">
                <div class="caption">终端运行界面</div>
            </div>
            
            <div class="gallery-item">
                <img src="images/screenshot5.png" alt="游戏截图5" loading="lazy">
                <div class="caption">详细游戏界面</div>
            </div>
        </div>
    </div>
</body>
</html>
EOF

echo "图片预览页面已创建: image_gallery.html"