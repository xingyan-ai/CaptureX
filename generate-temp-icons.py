#!/usr/bin/env python3
"""
临时图标生成器
生成ScreenCut扩展所需的16px、48px、128px图标
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """创建指定尺寸的图标"""
    # 创建画布
    img = Image.new('RGBA', (size, size), (59, 130, 246, 255))  # 蓝色背景
    draw = ImageDraw.Draw(img)
    
    # 画一个简单的截图框图标
    margin = size // 8
    inner_size = size - 2 * margin
    
    # 绘制白色边框矩形
    draw.rectangle([margin, margin, size-margin, size-margin], 
                  outline=(255, 255, 255, 255), 
                  width=max(1, size//20))
    
    # 在中心画一个小十字
    center = size // 2
    cross_size = size // 8
    draw.line([center-cross_size, center, center+cross_size, center], 
              fill=(255, 255, 255, 200), width=max(1, size//40))
    draw.line([center, center-cross_size, center, center+cross_size], 
              fill=(255, 255, 255, 200), width=max(1, size//40))
    
    # 保存图标
    img.save(filename, 'PNG')
    print(f"✅ 已生成 {filename} ({size}x{size})")

def main():
    """主函数"""
    print("🎨 正在生成ScreenCut临时图标...")
    
    # 确保icons目录存在
    os.makedirs('icons', exist_ok=True)
    
    # 生成三种尺寸的图标
    sizes = [16, 48, 128]
    for size in sizes:
        filename = f'icons/icon{size}.png'
        create_icon(size, filename)
    
    print("🎉 图标生成完成！")
    print("现在可以重新加载Chrome扩展了")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("❌ 需要安装PIL库: pip install Pillow")
    except Exception as e:
        print(f"❌ 生成图标时出错: {e}") 