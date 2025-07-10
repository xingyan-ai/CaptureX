/**
 * ScreenCut Content Script
 * Handles injecting UI, capturing screenshots, and communicating with background.
 */

console.log('ScreenCut: Content script loaded on:', window.location.href);

// 检查页面环境
if (window.location.protocol === 'chrome-extension:' || 
    window.location.protocol === 'chrome:' || 
    window.location.protocol === 'moz-extension:') {
    console.log('ScreenCut: Skipping initialization on restricted page');
} else {
    console.log('ScreenCut: Page is valid for content script');
}

class ScreenCutManager {
    constructor() {
        console.log('ScreenCut: Constructor called');
        this.state = {
            isActive: false,
            isDragging: false,
            isResizing: false,
            dragStartX: 0,
            dragStartY: 0,
            frameRect: { x: 0, y: 0, width: 0, height: 0 },
            resizeHandle: null,
            currentRatio: null, // For fixed ratio selection
            isFixedRatio: false,
        };
        this.dom = {};
        console.log('ScreenCut: Injecting CSS...');
        this.injectCSS(); // 注入CSS样式
        console.log('ScreenCut: Creating DOM...');
        this.createDOM(); // Create overlay and other elements once
        console.log('ScreenCut: Resetting state...');
        this.resetState(); // Initialize state and hide UI
        console.log('ScreenCut: Constructor completed');
    }

    injectCSS() {
        console.log('ScreenCut: Injecting CSS...');
        // 检查是否已经注入过CSS
        if (document.getElementById('screencut-styles')) {
            console.log('ScreenCut: CSS already injected');
            return;
        }

        // 创建style元素并注入CSS
        const styleEl = document.createElement('style');
        styleEl.id = 'screencut-styles';
        styleEl.textContent = `
/* ============================================================================
   ScreenCut Overlay Styles - "Linear Light" Theme
   ============================================================================ */

/* Root Variables */
:root {
  --screencut-bg: rgba(255, 255, 255, 0.5);
  --screencut-frame-bg: rgba(255, 255, 255, 0.2);
  --screencut-frame-border: #000000;
  --screencut-handle-bg: #000000;
  --screencut-toolbar-bg: #f0f0f0;
  --screencut-toolbar-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  --screencut-button-bg: #e0e0e0;
  --screencut-button-hover-bg: #d0d0d0;
  --screencut-button-text: #333333;
  --screencut-info-bg: #f0f0f0;
  --screencut-info-text: #333333;
  --screencut-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --screencut-blue: #007bff; /* Blue for download button */
  --screencut-blue-hover: #0056b3;
}

/* Overlay */
.screencut-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647; /* Max z-index */
    pointer-events: none; /* Allow clicks to pass through the overlay container */
}

.screencut-shroud {
    position: absolute;
    background-color: rgba(17, 17, 19, 0.7);
    pointer-events: auto; /* Ensure shrouds are visible and can receive events */
}

/* --- Correct Shroud Positioning --- */
.screencut-shroud.top {
    top: 0;
    left: 0;
    width: 100%;
    /* height is set by JS */
}

.screencut-shroud.bottom {
    left: 0;
    width: 100%;
    /* top and height are set by JS */
}

.screencut-shroud.left {
    /* top, left, width, height are set by JS */
}

.screencut-shroud.right {
    /* top, left, width, height are set by JS */
}

.screencut-frame {
    position: absolute;
    border: 1px solid rgba(94, 106, 210, 0.8);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: all;
    cursor: move;
}

.screencut-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background-color: #5e6ad2;
    border: 1px solid #fff;
    border-radius: 50%;
    pointer-events: all;
}

.screencut-handle.top-left {
    top: -5px;
    left: -5px;
    cursor: nwse-resize;
}

.screencut-handle.top-right {
    top: -5px;
    right: -5px;
    cursor: nesw-resize;
}

.screencut-handle.bottom-left {
    bottom: -5px;
    left: -5px;
    cursor: nesw-resize;
}

.screencut-handle.bottom-right {
    bottom: -5px;
    right: -5px;
    cursor: nwse-resize;
}

.screencut-toolbar, .screencut-info {
    position: absolute;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: all;
    user-select: none;
    transition: opacity 0.2s ease-in-out; /* Fade in/out */
    z-index: 2147483647; /* Ensure it's above the frame */
}

.screencut-toolbar {
    background-color: #1a1a1c; /* Dark, slightly transparent background */
    color: #e4e4e6; /* Light text */
    border: 1px solid rgba(255, 255, 255, 0.08); /* Subtle border */
    border-radius: 8px; /* Rounded corners */
    padding: 6px 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); /* Deeper shadow for depth */
}

.screencut-toolbar {
    display: flex;
    gap: 8px; /* More spacing */
}

.screencut-btn-download, .screencut-btn-copy, .screencut-btn-cancel {
    background-color: #2a2a2c; /* Button color */
    color: #e4e4e6;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px; /* Softer corners */
    padding: 5px 10px;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
}

.screencut-btn-download:hover, .screencut-btn-copy:hover, .screencut-btn-cancel:hover {
    background-color: #3a3a3c; /* Hover effect */
    border-color: rgba(255, 255, 255, 0.15);
}

.screencut-btn-download:active, .screencut-btn-copy:active, .screencut-btn-cancel:active {
    transform: scale(0.96); /* Click effect */
}

.screencut-btn-download {
  background: var(--screencut-blue);
  color: #ffffff;
}

.screencut-btn-download:hover {
  background: var(--screencut-blue-hover);
}

.screencut-btn-copy:hover, .screencut-btn-cancel:hover {
  background: var(--screencut-button-hover-bg);
}

/* Info Panel */
.screencut-info {
  position: absolute;
  padding: 4px 8px;
  background: var(--screencut-info-bg);
  color: var(--screencut-info-text);
  font-family: var(--screencut-font);
  font-size: 12px;
  border-radius: 4px;
}
        `;
        document.head.appendChild(styleEl);
        console.log('ScreenCut: CSS injected successfully');
    }

    resetState() {
        this.state.isActive = false;
        this.state.isDragging = false;
        this.state.isResizing = false;
        this.state.dragStartX = 0;
        this.state.dragStartY = 0;
        this.state.frameRect = { x: 0, y: 0, width: 0, height: 0 };
        this.state.resizeHandle = null;
        this.state.currentRatio = null;
        this.state.isFixedRatio = false;
        this.hideUI();
    }

    initialize(config) {
        console.log('ScreenCut: Initializing with config:', config);
        this.state.isActive = true;
        this.state.isFixedRatio = config.type === 'ratio';
        this.state.currentRatio = config.ratio;
        this.addEscListener();
        this.addMouseListeners();
        this.showUI();
        this.setupInitialFrame(config);
        
        // 显示开始提示
        this._showToast('🎯 拖拽调整选区，点击按钮截图', 'info', 3000);
        
        console.log('ScreenCut: Initialization complete.');
    }

    cleanup() {
        this.resetState();
        this.removeEscListener();
        this.removeMouseListeners();
    }

    addEscListener() {
        document.addEventListener('keydown', this.handleEscKey);
    }

    removeEscListener() {
        document.removeEventListener('keydown', this.handleEscKey);
    }

    handleEscKey = (e) => {
        if (e.key === 'Escape' && this.state.isActive) {
            this._showToast('✋ 截图已取消', 'info');
            this.cleanup();
            chrome.runtime.sendMessage({ action: 'captureCancelled' });
        }
    }

    createDOM() {
        // Main overlay container
        if (!this.dom.overlay) {
            this.dom.overlay = document.createElement('div');
            this.dom.overlay.className = 'screencut-overlay';
            document.body.appendChild(this.dom.overlay);
        }

        // Shrouds (the dimmed areas around the selection)
        this.dom.shrouds = {};
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const shroud = document.createElement('div');
            shroud.className = `screencut-shroud ${pos}`;
            this.dom.overlay.appendChild(shroud);
            this.dom.shrouds[pos] = shroud;
        });

        // Selection Frame
        this.dom.frame = document.createElement('div');
        this.dom.frame.className = 'screencut-frame';
        this.dom.overlay.appendChild(this.dom.frame);

        // Resize Handles
        this.dom.handles = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `screencut-handle ${pos}`;
            handle.dataset.handle = pos;
            this.dom.frame.appendChild(handle);
            this.dom.handles[pos] = handle;
        });

        // Toolbar
        this.dom.toolbar = document.createElement('div');
        this.dom.toolbar.className = 'screencut-toolbar';
        this.dom.frame.appendChild(this.dom.toolbar);

        this.dom.downloadBtn = document.createElement('button');
        this.dom.downloadBtn.className = 'screencut-btn-download';
        this.dom.downloadBtn.textContent = '下载';
        this.dom.toolbar.appendChild(this.dom.downloadBtn);

        this.dom.copyBtn = document.createElement('button');
        this.dom.copyBtn.className = 'screencut-btn-copy';
        this.dom.copyBtn.textContent = '复制';
        this.dom.toolbar.appendChild(this.dom.copyBtn);

        this.dom.cancelBtn = document.createElement('button');
        this.dom.cancelBtn.className = 'screencut-btn-cancel';
        this.dom.cancelBtn.textContent = '取消';
        this.dom.toolbar.appendChild(this.dom.cancelBtn);

        // Info (dimensions)
        this.dom.info = document.createElement('div');
        this.dom.info.className = 'screencut-info';
        this.dom.frame.appendChild(this.dom.info);

        // Event Listeners for toolbar buttons
        this.dom.downloadBtn.addEventListener('click', () => this.captureSelection('download'));
        this.dom.copyBtn.addEventListener('click', () => this.captureSelection('copy'));
        this.dom.cancelBtn.addEventListener('click', () => {
            this._showToast('✋ 截图已取消', 'info');
            this.cleanup();
            chrome.runtime.sendMessage({ action: 'captureCancelled' });
        });
    }

    showUI() {
        this.dom.overlay.style.display = 'block';
        this.dom.frame.style.display = 'block';
        Object.values(this.dom.shrouds).forEach(s => s.style.display = 'block');
        Object.values(this.dom.handles).forEach(h => h.style.display = 'block');
        this.dom.toolbar.style.display = 'flex';
        this.dom.info.style.display = 'block';
    }

    hideUI() {
        this.dom.overlay.style.display = 'none';
        this.dom.frame.style.display = 'none';
        Object.values(this.dom.shrouds).forEach(s => s.style.display = 'none');
        Object.values(this.dom.handles).forEach(h => h.style.display = 'none');
        this.dom.toolbar.style.display = 'none';
        this.dom.info.style.display = 'none';
    }

    setupInitialFrame(config) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let initialWidth, initialHeight;

        if (config.type === 'pixels') {
            initialWidth = config.width;
            initialHeight = config.height;
        } else if (config.type === 'ratio') {
            initialWidth = viewportWidth * 0.5;
            initialHeight = initialWidth / config.ratio;

            if (initialHeight > viewportHeight * 0.8) {
                initialHeight = viewportHeight * 0.8;
                initialWidth = initialHeight * config.ratio;
            }
        } else {
            initialWidth = viewportWidth * 0.6;
            initialHeight = viewportHeight * 0.6;
        }

        initialWidth = Math.min(initialWidth, viewportWidth - 40);
        initialHeight = Math.min(initialHeight, viewportHeight - 40);
        initialWidth = Math.max(initialWidth, 50);
        initialHeight = Math.max(initialHeight, 50);

        this.state.frameRect.width = initialWidth;
        this.state.frameRect.height = initialHeight;
        this.state.frameRect.x = (viewportWidth - initialWidth) / 2;
        this.state.frameRect.y = (viewportHeight - initialHeight) / 2;

        this.updateUI();
    }

    updateUI() {
        const { x, y, width, height } = this.state.frameRect;

        this.dom.frame.style.left = `${x}px`;
        this.dom.frame.style.top = `${y}px`;
        this.dom.frame.style.width = `${width}px`;
        this.dom.frame.style.height = `${height}px`;

        this.dom.shrouds.top.style.height = `${y}px`;
        this.dom.shrouds.bottom.style.top = `${y + height}px`;
        this.dom.shrouds.bottom.style.height = `${window.innerHeight - (y + height)}px`;
        this.dom.shrouds.left.style.top = `${y}px`;
        this.dom.shrouds.left.style.width = `${x}px`;
        this.dom.shrouds.left.style.height = `${height}px`;
        this.dom.shrouds.right.style.top = `${y}px`;
        this.dom.shrouds.right.style.left = `${x + width}px`;
        this.dom.shrouds.right.style.width = `${window.innerWidth - (x + width)}px`;
        this.dom.shrouds.right.style.height = `${height}px`;

        this.dom.toolbar.style.top = `${height + 10}px`;
        this.dom.toolbar.style.left = `0px`;

        this.dom.info.textContent = `${Math.round(width)} x ${Math.round(height)} px`;
        this.dom.info.style.top = `-25px`;
        this.dom.info.style.left = `0px`;
    }

    addMouseListeners() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        this.dom.frame.addEventListener('mousedown', this.handleMouseDown);
        Object.values(this.dom.handles).forEach(handle => {
            handle.addEventListener('mousedown', this.handleMouseDown);
        });
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    removeMouseListeners() {
        this.dom.frame.removeEventListener('mousedown', this.handleMouseDown);
        Object.values(this.dom.handles).forEach(handle => {
            handle.removeEventListener('mousedown', this.handleMouseDown);
        });
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    handleMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;

        if (e.target === this.dom.frame) {
            this.state.isDragging = true;
            this.dom.frame.style.cursor = 'grabbing';
        } else if (e.target.dataset.handle) {
            this.state.isResizing = true;
            this.state.resizeHandle = e.target.dataset.handle;
        }
    }

    handleMouseMove(e) {
        if (!this.state.isDragging && !this.state.isResizing) return;

        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - this.state.dragStartX;
        const dy = e.clientY - this.state.dragStartY;

        let { x, y, width, height } = this.state.frameRect;

        if (this.state.isDragging) {
            x += dx;
            y += dy;
        } else if (this.state.isResizing) {
            const newX = x;
            const newY = y;
            const newWidth = width;
            const newHeight = height;

            switch (this.state.resizeHandle) {
                case 'top-left':
                    x += dx; width -= dx;
                    y += dy; height -= dy;
                    break;
                case 'top-right':
                    width += dx;
                    y += dy; height -= dy;
                    break;
                case 'bottom-left':
                    x += dx; width -= dx;
                    height += dy;
                    break;
                case 'bottom-right':
                    width += dx;
                    height += dy;
                    break;
            }

            if (this.state.isFixedRatio && this.state.currentRatio) {
                const newRatio = width / height;
                if (Math.abs(newRatio - this.state.currentRatio) > 0.01) { // Allow small deviation
                    if (this.state.resizeHandle.includes('left') || this.state.resizeHandle.includes('right')) {
                        height = width / this.state.currentRatio;
                    } else {
                        width = height * this.state.currentRatio;
                    }
                }
            }
        }

        width = Math.max(width, 50);
        height = Math.max(height, 50);

        x = Math.max(0, Math.min(x, window.innerWidth - width));
        y = Math.max(0, Math.min(y, window.innerHeight - height));

        this.state.frameRect = { x, y, width, height };
        this.updateUI();

        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
    }

    handleMouseUp(e) {
        if (this.state.isDragging) {
            this.state.isDragging = false;
            this.dom.frame.style.cursor = 'grab';
        } else if (this.state.isResizing) {
            this.state.isResizing = false;
            this.state.resizeHandle = null;
        }
    }

    async captureSelection(actionType) {
        const { x, y, width, height } = this.state.frameRect;

        this.hideUI(); // Temporarily hide UI elements before capture

        try {
            const canvas = await html2canvas(document.body, {
                x: x + window.scrollX,
                y: y + window.scrollY,
                width: width,
                height: height,
                useCORS: true,
                allowTaint: true,
                logging: true,
                backgroundColor: null, // Transparent background
            });

            const dataUrl = canvas.toDataURL('image/png');

            if (actionType === 'download') {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `CaptureX-selection-${new Date().toISOString()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this._showToast('📥 截图已保存到下载文件夹', 'success');
                chrome.runtime.sendMessage({ action: 'captureComplete', success: true, filename: link.download });
            } else if (actionType === 'copy') {
                // 检查剪贴板API可用性
                const isSecureContext = window.isSecureContext;
                const hasClipboard = !!navigator.clipboard;
                
                console.log('ScreenCut: Clipboard environment check:', {
                    isSecureContext,
                    hasClipboard,
                    protocol: window.location.protocol,
                    host: window.location.host
                });

                try {
                    if (isSecureContext && hasClipboard) {
                        // 方法1: 使用现代Clipboard API（仅在安全上下文中）
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        console.log('ScreenCut: Image copied to clipboard successfully');
                        this._showToast('✅ 截图已复制到剪贴板', 'success');
                        chrome.runtime.sendMessage({ action: 'captureComplete', success: true, copied: true });
                    } else {
                        // 方法2: 创建临时图片元素让用户手动复制
                        console.log('ScreenCut: Using fallback copy method due to security restrictions');
                        this._showToast('⚠️ 请在弹窗中手动复制图片', 'warning', 4000);
                        this._showCopyFallback(dataUrl);
                        chrome.runtime.sendMessage({ action: 'captureComplete', success: true, copied: false, manual: true });
                    }
                } catch (clipboardError) {
                    console.error('ScreenCut: Clipboard operation failed:', clipboardError);
                    // 方法3: 兜底 - 显示图片让用户手动复制
                    this._showToast('❌ 自动复制失败，请手动复制', 'error', 4000);
                    this._showCopyFallback(dataUrl);
                    chrome.runtime.sendMessage({ action: 'captureComplete', success: true, copied: false, manual: true });
                }
            }
        } catch (error) {
            console.error('Error capturing selection:', error);
            
            // 显示错误提示
            this._showToast('❌ 截图失败：' + error.message, 'error', 5000);
            
            chrome.runtime.sendMessage({ action: 'captureError', error: error.message });
        } finally {
            this.cleanup(); // Clean up after capture or error
        }
    }

    _showToast(message, type = 'success', duration = 3000) {
        try {
            // 创建一个简洁的Toast提示
            const toast = document.createElement('div');
            
            // 设置基础样式
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.right = '20px';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '6px';
            toast.style.color = 'white';
            toast.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = '500';
            toast.style.zIndex = '999999';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            toast.style.maxWidth = '300px';
            toast.style.wordWrap = 'break-word';

            // 根据类型设置颜色
            if (type === 'success') {
                toast.style.background = '#10b981'; // 绿色
            } else if (type === 'error') {
                toast.style.background = '#ef4444'; // 红色
            } else if (type === 'warning') {
                toast.style.background = '#f59e0b'; // 橙色
            } else if (type === 'info') {
                toast.style.background = '#3b82f6'; // 蓝色
            } else {
                toast.style.background = '#6b7280'; // 灰色
            }

            toast.textContent = message;
            document.body.appendChild(toast);

            // 动画显示
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    toast.style.opacity = '1';
                    toast.style.transform = 'translateX(0)';
                }
            }, 100);

            // 自动隐藏
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (document.body.contains(toast)) {
                            document.body.removeChild(toast);
                        }
                    }, 300);
                }
            }, duration);
        } catch (error) {
            // 如果Toast出错，至少在控制台记录消息
            console.log('ScreenCut Toast:', message);
        }
    }

    _showCopyFallback(dataUrl) {
        // 创建一个模态框显示截图，让用户手动复制
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            max-width: 90%;
            max-height: 90%;
            overflow: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        const title = document.createElement('h3');
        title.style.cssText = `
            margin: 0 0 15px 0;
            color: #333;
            font-size: 18px;
        `;
        title.textContent = '截图已生成 - 请手动复制';

        const description = document.createElement('p');
        description.style.cssText = `
            margin: 0 0 15px 0;
            color: #666;
            font-size: 14px;
        `;
        description.textContent = '由于浏览器安全限制，无法自动复制到剪贴板。请右键下方图片选择"复制图像"';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = `
            max-width: 100%;
            max-height: 400px;
            border: 1px solid #ddd;
            border-radius: 4px;
            display: block;
            margin: 0 auto 15px auto;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            justify-content: center;
        `;

        const downloadBtn = document.createElement('button');
        downloadBtn.style.cssText = `
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        downloadBtn.textContent = '下载图片';
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `CaptureX-screenshot-${new Date().toISOString()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this._showToast('📥 图片已保存到下载文件夹', 'success');
        };

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = `
            padding: 8px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        closeBtn.textContent = '关闭';
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
        };

        buttonContainer.appendChild(downloadBtn);
        buttonContainer.appendChild(closeBtn);

        container.appendChild(title);
        container.appendChild(description);
        container.appendChild(img);
        container.appendChild(buttonContainer);
        modal.appendChild(container);

        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        document.body.appendChild(modal);

        // 5秒后自动关闭（可选）
        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        }, 10000);
    }

    _preprocessGradientText() {
        const elementsToRestore = [];
        document.querySelectorAll('*').forEach(el => {
            try {
                const style = window.getComputedStyle(el);
                const isGradientText = (style.webkitBackgroundClip === 'text' || style.backgroundClip === 'text') && style.backgroundImage.includes('gradient');

                if (isGradientText && el.textContent.trim()) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;

                    const outerHTML = el.outerHTML;
                    const svg = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
                            <foreignObject width="100%" height="100%">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%;">${outerHTML}</div>
                            </foreignObject>
                        </svg>`;
                    
                    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                    
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.style.width = `${rect.width}px`;
                    img.style.height = `${rect.height}px`;
                    img.style.position = 'absolute';
                    img.style.top = `${rect.top + window.scrollY}px`;
                    img.style.left = `${rect.left + window.scrollX}px`;
                    const zIndex = style.zIndex;
                    img.style.zIndex = zIndex === 'auto' ? '9999' : String(Number(zIndex) + 1);


                    document.body.appendChild(img);
                    
                    const originalVisibility = el.style.visibility;
                    el.style.visibility = 'hidden';

                    elementsToRestore.push(() => {
                        el.style.visibility = originalVisibility;
                        img.remove();
                    });
                }
            } catch (e) {
                console.error("Error preprocessing element:", el, e);
            }
        });

        return () => {
            elementsToRestore.forEach(restore => restore());
        };
    }

    async captureFullPage() {
        const cleanupGradientText = this._preprocessGradientText();
        await new Promise(resolve => setTimeout(resolve, 200));

        const originalUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';

        const width = document.documentElement.scrollWidth;
        const height = document.documentElement.scrollHeight;
        
        const originalScrollX = window.scrollX;
        const originalScrollY = window.scrollY;
        window.scrollTo(0, 0);

        try {
            // 显示开始提示
            this._showToast('📸 正在生成全屏截图...', 'info', 2000);
            
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                logging: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
                backgroundColor: '#ffffff',
                width: width,
                height: height,
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `CaptureX-fullscreen-${new Date().toISOString()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 显示成功提示
            this._showToast('📥 全屏截图已保存到下载文件夹', 'success');
            
            return { success: true };
        } catch (error) {
            console.error('Error capturing full page:', error);
            
            // 显示错误提示
            this._showToast('❌ 全屏截图失败：' + error.message, 'error', 5000);
            
            return { success: false, error: error.message };
        } finally {
            cleanupGradientText();
            document.body.style.userSelect = originalUserSelect;
            window.scrollTo(originalScrollX, originalScrollY);
        }
    }
}

// Ensure a single instance - only on valid pages
if (window.location.protocol !== 'chrome-extension:' && 
    window.location.protocol !== 'chrome:' && 
    window.location.protocol !== 'moz-extension:') {
    
    if (!window.screenCut) {
        console.log('ScreenCut: Creating new ScreenCutManager instance');
        window.screenCut = new ScreenCutManager();
        console.log('ScreenCut: ScreenCutManager instance created:', window.screenCut);
    } else {
        console.log('ScreenCut: Using existing ScreenCutManager instance');
    }
} else {
    console.log('ScreenCut: Skipping instance creation on restricted page');
}

// The message listener will now only handle initialization logic
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ScreenCut: Received message:', message, 'on page:', window.location.href);
    
    // Check if we're on a restricted page
    if (window.location.protocol === 'chrome-extension:' || 
        window.location.protocol === 'chrome:' || 
        window.location.protocol === 'moz-extension:') {
        console.log('ScreenCut: Cannot operate on restricted page');
        sendResponse({ success: false, error: 'Cannot operate on restricted page' });
        return true;
    }
    
    if (message.action === 'ping') {
        console.log('ScreenCut: Responding to ping');
        sendResponse({ success: true, ready: true });
    } else if (message.action === 'initializeCapture') {
        console.log('ScreenCut: Received initializeCapture message.');
        try {
            if (message.config && window.screenCut) {
                console.log('ScreenCut: Starting initialization...');
                window.screenCut.initialize(message.config);
                console.log('ScreenCut: Initialization successful, sending response.');
                sendResponse({ success: true });
            } else if (!window.screenCut) {
                console.error('ScreenCut: ScreenCutManager not initialized');
                sendResponse({ success: false, error: 'ScreenCutManager not initialized' });
            } else {
                console.error('ScreenCut: No config provided');
                sendResponse({ success: false, error: 'No config provided' });
            }
        } catch (e) {
            console.error('ScreenCut: Error during initializeCapture:', e);
            sendResponse({ success: false, error: e.message });
        }
        return true; // Indicates that the response is sent asynchronously
    } else if (message.action === 'cancelCapture') {
        if (window.screenCut) {
            window.screenCut.cleanup(); // Use cleanup for full reset
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'ScreenCutManager not available' });
        }
    } else if (message.action === 'captureFullPage') {
        if (window.screenCut) {
            window.screenCut.captureFullPage().then(sendResponse);
            return true; // Indicates that the response is sent asynchronously
        } else {
            sendResponse({ success: false, error: 'ScreenCutManager not available' });
        }
    }
    return true;
});