/**
 * ScreenCut Content Script (Optimized for chrome.tabs.captureVisibleTab)
 * Handles injecting UI, sending coordinates to the background, and receiving final image for clipboard.
 */

console.log('ScreenCut: Content script loaded on:', window.location.href);

if (window.location.protocol !== 'chrome-extension:' && 
    window.location.protocol !== 'chrome:' && 
    window.location.protocol !== 'moz-extension:') {
    console.log('ScreenCut: Page is valid for content script');
}

class ScreenCutManager {
    constructor() {
        this.state = {
            isActive: false,
            isDragging: false,
            isResizing: false,
            dragStartX: 0,
            dragStartY: 0,
            frameRect: { x: 0, y: 0, width: 0, height: 0 },
            resizeHandle: null,
            currentRatio: null,
            isFixedRatio: false,
        };
        this.dom = {};
        this.animationFrameId = null;
        this.injectCSS();
        this.createDOM();
        this.resetState();
    }

    injectCSS() {
        if (document.getElementById('screencut-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'screencut-styles';
        styleEl.textContent = `
            :root {
              --screencut-primary-blue: #3b82f6;
              --screencut-primary-blue-hover: #2563eb;
            }
            .screencut-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483647; pointer-events: none; }
            .screencut-shroud { position: absolute; background-color: rgba(17, 17, 19, 0.7); pointer-events: auto; }
            .screencut-shroud.top { top: 0; left: 0; width: 100%; }
            .screencut-shroud.bottom { left: 0; width: 100%; }
            .screencut-frame { position: absolute; border: 1px solid rgba(94, 106, 210, 0.8); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); pointer-events: all; cursor: move; }
            .screencut-handle { position: absolute; width: 10px; height: 10px; background-color: #5e6ad2; border: 1px solid #fff; border-radius: 50%; pointer-events: all; }
            .screencut-handle.top-left { top: -5px; left: -5px; cursor: nwse-resize; }
            .screencut-handle.top-right { top: -5px; right: -5px; cursor: nesw-resize; }
            .screencut-handle.bottom-left { bottom: -5px; left: -5px; cursor: nesw-resize; }
            .screencut-handle.bottom-right { bottom: -5px; right: -5px; cursor: nwse-resize; }
            .screencut-toolbar, .screencut-info { position: absolute; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; pointer-events: all; user-select: none; z-index: 2147483647; }
            .screencut-toolbar { background-color: #1a1a1c; color: #e4e4e6; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 6px 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); display: flex; gap: 8px; }
            .screencut-btn-download, .screencut-btn-copy, .screencut-btn-cancel { color: #e4e4e6; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 5px 10px; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
            .screencut-btn-copy, .screencut-btn-cancel { background-color: #2a2a2c; }
            .screencut-btn-copy:hover, .screencut-btn-cancel:hover { background-color: #3a3a3c; }
            .screencut-btn-download { background-color: var(--screencut-primary-blue); font-weight: 500; }
            .screencut-btn-download:hover { background-color: var(--screencut-primary-blue-hover); }
            .screencut-btn-download:active, .screencut-btn-copy:active, .screencut-btn-cancel:active { transform: scale(0.96); }
            .screencut-info { padding: 4px 8px; background: #1a1a1c; color: #e4e4e6; border-radius: 4px; }
        `;
        document.head.appendChild(styleEl);
    }

    resetState() {
        this.state = { ...this.state, isActive: false, isDragging: false, isResizing: false, frameRect: { x: 0, y: 0, width: 0, height: 0 } };
        this.hideUI();
    }

    initialize(config) {
        this.state.isActive = true;
        this.state.isFixedRatio = config.type === 'ratio';
        this.state.currentRatio = config.ratio;
        this.addEscListener();
        this.addMouseListeners();
        this.showUI();
        this.setupInitialFrame(config);
        this._showToast('🎯 请拖拽选区或点击按钮', 'info', 3000);
    }

    cleanup() {
        this.resetState();
        this.removeEscListener();
        this.removeMouseListeners();
    }

    addEscListener() { document.addEventListener('keydown', this.handleEscKey); }
    removeEscListener() { document.removeEventListener('keydown', this.handleEscKey); }
    handleEscKey = (e) => {
        if (e.key === 'Escape' && this.state.isActive) {
            this._showToast('✋ Capture cancelled.', 'info');
            this.cleanup();
            chrome.runtime.sendMessage({ action: 'captureCancelled' });
        }
    }

    createDOM() {
        if (this.dom.overlay) return;
        this.dom.overlay = document.createElement('div');
        this.dom.overlay.className = 'screencut-overlay';
        document.body.appendChild(this.dom.overlay);

        this.dom.shrouds = {};
        ['top', 'bottom', 'left', 'right'].forEach(pos => {
            const shroud = document.createElement('div');
            shroud.className = `screencut-shroud ${pos}`;
            this.dom.overlay.appendChild(shroud);
            this.dom.shrouds[pos] = shroud;
        });

        this.dom.frame = document.createElement('div');
        this.dom.frame.className = 'screencut-frame';
        this.dom.overlay.appendChild(this.dom.frame);

        this.dom.handles = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `screencut-handle ${pos}`;
            handle.dataset.handle = pos;
            this.dom.frame.appendChild(handle);
            this.dom.handles[pos] = handle;
        });

        this.dom.toolbar = document.createElement('div');
        this.dom.toolbar.className = 'screencut-toolbar';
        this.dom.frame.appendChild(this.dom.toolbar);

        this.dom.downloadBtn = this.createButton('下载', 'screencut-btn-download', () => this.captureSelection('download'));
        this.dom.copyBtn = this.createButton('复制', 'screencut-btn-copy', () => this.captureSelection('copy'));
        this.dom.cancelBtn = this.createButton('取消', 'screencut-btn-cancel', () => {
            this._showToast('✋ 操作已取消', 'info');
            this.cleanup();
            chrome.runtime.sendMessage({ action: 'captureCancelled' });
        });
        this.dom.toolbar.append(this.dom.downloadBtn, this.dom.copyBtn, this.dom.cancelBtn);

        this.dom.info = document.createElement('div');
        this.dom.info.className = 'screencut-info';
        this.dom.frame.appendChild(this.dom.info);
    }
    
    createButton(text, className, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = className;
        btn.addEventListener('click', onClick);
        return btn;
    }

    showUI() { this.dom.overlay.style.display = 'block'; }
    hideUI() { if(this.dom.overlay) this.dom.overlay.style.display = 'none'; }

    setupInitialFrame(config) {
        const vpWidth = window.innerWidth;
        const vpHeight = window.innerHeight;
        let initialWidth, initialHeight;

        if (config.type === 'pixels') {
            initialWidth = config.width;
            initialHeight = config.height;
        } else if (config.type === 'ratio') {
            initialWidth = vpWidth * 0.5;
            initialHeight = initialWidth / config.ratio;
            if (initialHeight > vpHeight * 0.8) {
                initialHeight = vpHeight * 0.8;
                initialWidth = initialHeight * config.ratio;
            }
        } else {
            initialWidth = vpWidth * 0.6;
            initialHeight = vpHeight * 0.6;
        }

        this.state.frameRect.width = Math.max(50, Math.min(initialWidth, vpWidth - 40));
        this.state.frameRect.height = Math.max(50, Math.min(initialHeight, vpHeight - 40));
        this.state.frameRect.x = (vpWidth - this.state.frameRect.width) / 2;
        this.state.frameRect.y = (vpHeight - this.state.frameRect.height) / 2;

        this.updateUI();
    }

    updateUI() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            const { x, y, width, height } = this.state.frameRect;
            this.dom.frame.style.cssText = `left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px;`;
            this.dom.shrouds.top.style.height = `${y}px`;
            this.dom.shrouds.bottom.style.cssText = `top: ${y + height}px; height: ${window.innerHeight - (y + height)}px;`;
            this.dom.shrouds.left.style.cssText = `top: ${y}px; width: ${x}px; height: ${height}px;`;
            this.dom.shrouds.right.style.cssText = `top: ${y}px; left: ${x + width}px; width: ${window.innerWidth - (x + width)}px; height: ${height}px;`;
            this.dom.toolbar.style.cssText = `top: ${height + 10}px; left: 0;`;
            this.dom.info.style.cssText = `top: -25px; left: 0;`;
            this.dom.info.textContent = `${Math.round(width)} x ${Math.round(height)} px`;
        });
    }

    addMouseListeners() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.dom.overlay.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    removeMouseListeners() {
        this.dom.overlay.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    handleMouseDown(e) {
        e.preventDefault(); e.stopPropagation();
        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
        if (e.target.dataset.handle) {
            this.state.isResizing = true;
            this.state.resizeHandle = e.target.dataset.handle;
        } else if (e.target === this.dom.frame) {
            this.state.isDragging = true;
        }
    }

    handleMouseMove(e) {
        if (!this.state.isDragging && !this.state.isResizing) return;
        e.preventDefault(); e.stopPropagation();
        const dx = e.clientX - this.state.dragStartX;
        const dy = e.clientY - this.state.dragStartY;
        let { x, y, width, height } = this.state.frameRect;

        if (this.state.isDragging) {
            x += dx;
            y += dy;
        } else if (this.state.isResizing) {
            switch (this.state.resizeHandle) {
                case 'top-left': x += dx; width -= dx; y += dy; height -= dy; break;
                case 'top-right': width += dx; y += dy; height -= dy; break;
                case 'bottom-left': x += dx; width -= dx; height += dy; break;
                case 'bottom-right': width += dx; height += dy; break;
            }
            if (this.state.isFixedRatio) {
                const newRatio = width / height;
                if (this.state.resizeHandle.includes('left') || this.state.resizeHandle.includes('right')) {
                    height = width / this.state.currentRatio;
                } else {
                    width = height * this.state.currentRatio;
                }
            }
        }

        this.state.frameRect = { 
            width: Math.max(50, width),
            height: Math.max(50, height),
            x: Math.max(0, Math.min(x, window.innerWidth - Math.max(50, width))),
            y: Math.max(0, Math.min(y, window.innerHeight - Math.max(50, height)))
        };
        
        this.updateUI();
        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
    }

    handleMouseUp(e) {
        this.state.isDragging = false;
        this.state.isResizing = false;
    }

    async captureSelection(actionType) {
        this.hideUI();
        const cropRegion = { ...this.state.frameRect, dpr: window.devicePixelRatio || 1 };

        try {
            const response = await chrome.runtime.sendMessage({ action: 'initiateSelectionCapture', cropRegion });
            if (!response || !response.success) throw new Error(response.error || 'Capture failed');
            const { dataUrl } = response;

            if (actionType === 'download') {
                const dlResponse = await chrome.runtime.sendMessage({ action: 'downloadImage', dataUrl });
                if (dlResponse.success) this._showToast('📥 截图已保存至下载目录', 'success');
                else throw new Error(dlResponse.error || '下载失败');
            } else if (actionType === 'copy') {
                const copyResponse = await this.copyDataUrlToClipboard(dataUrl);
                if (copyResponse.success) this._showToast('✅ 截图已复制到剪贴板', 'success');
                else throw new Error(copyResponse.error || '复制失败');
            }
        } catch (error) {
            console.error('Capture selection error:', error);
            this._showToast(`❌ Error: ${error.message}`, 'error', 5000);
        } finally {
            this.cleanup();
        }
    }

    async copyDataUrlToClipboard(dataUrl) {
        try {
            if (!navigator.clipboard || !window.isSecureContext) {
                this._showCopyFallback(dataUrl);
                return { success: true, fallback: true }; // Fallback is a form of success
            }
            const blob = await (await fetch(dataUrl)).blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return { success: true };
        } catch (error) {
            console.error('Clipboard API failed:', error);
            this._showCopyFallback(dataUrl);
            return { success: true, fallback: true, error: error.message };
        }
    }

    async captureFullPage() {
        this._showToast('📸 正在生成全屏截图...', 'info', 2000);
        try {
            // This still uses html2canvas, as captureVisibleTab cannot handle scrolling pages.
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                logging: false, // Reduce console noise
                scrollX: 0,
                scrollY: 0,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight,
            });
            const dataUrl = canvas.toDataURL('image/png');
            const dlResponse = await chrome.runtime.sendMessage({ action: 'downloadImage', dataUrl });
            if (dlResponse.success) {
                this._showToast('📥 全屏截图已保存', 'success');
            } else {
                throw new Error(dlResponse.error || '下载失败');
            }
            return { success: true };
        } catch (error) {
            this._showToast(`❌ 全屏截图失败: ${error.message}`, 'error', 5000);
            return { success: false, error: error.message };
        } finally {
            chrome.runtime.sendMessage({ action: 'captureEnded' });
        }
    }

    _showToast(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        
        // Apply styles individually to be more robust than using cssText
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '999999',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            maxWidth: '300px'
        });

        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        toast.style.background = colors[type] || '#6b7280';
        
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    _showCopyFallback(dataUrl) {
        const modal = document.createElement('div');
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`;
        modal.innerHTML = `
            <div style="background: #2a2a2c; color: #e4e4e6; padding: 25px; border-radius: 12px; text-align: center; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
                <h3 style="margin: 0 0 15px; font-weight: 500;">请手动复制</h3>
                <p style="margin: 0 0 20px; color: #9ca3af; font-size: 14px;">请右键点击图片并选择“复制图片”</p>
                <img src="${dataUrl}" style="max-width: 100%; max-height: 400px; border: 1px solid #4b5563; border-radius: 8px;"/>
                <button id="fallback-close" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">关闭</button>
            </div>
        `;
        modal.onclick = (e) => { if (e.target === modal || e.target.id === 'fallback-close') modal.remove(); };
        document.body.appendChild(modal);
    }
}

// --- Global Instance and Message Listener ---
if (window.location.protocol.startsWith('http')) {
    if (!window.screenCut) {
        window.screenCut = new ScreenCutManager();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!window.screenCut) {
        if (window.location.protocol.startsWith('http')){
            window.screenCut = new ScreenCutManager();
        } else {
            sendResponse({ success: false, error: 'Script not loaded on this page.' });
            return;
        }
    }

    switch (message.action) {
        case 'ping':
            sendResponse({ success: true, ready: true });
            break;
        case 'initializeCapture':
            window.screenCut.initialize(message.config);
            sendResponse({ success: true });
            break;
        case 'cancelCapture':
            window.screenCut.cleanup();
            sendResponse({ success: true });
            break;
        case 'copyToClipboard': // Note: This is now handled inside captureSelection
            window.screenCut.copyDataUrlToClipboard(message.dataUrl).then(sendResponse);
            return true; // Async
        case 'captureFullPage': // Keep old full page capture for now
             window.screenCut.captureFullPage().then(sendResponse);
             return true; // Async
        default:
            // Not logging to avoid console spam on pages
            break;
    }
    return true;
});
