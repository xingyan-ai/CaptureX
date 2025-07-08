/**
 * ScreenCut Content Script - Final Singleton Version
 * This ensures the core logic is initialized only once, preventing all state conflicts.
 */

// 1. Check if the core module is already on the page.
if (typeof window.screenCutModule === 'undefined') {

    // 2. If not, define the entire module (state, DOM, functions).
    window.screenCutModule = {
        state: {
            isActive: false,
            isResizable: true,
            currentRatio: null,
            frameRect: { x: 0, y: 0, width: 400, height: 229 },
            isDragging: false,
            isResizing: false,
            resizeHandle: null,
            dragStart: { x: 0, y: 0 },
            frameStart: { x: 0, y: 0, width: 0, height: 0 },
            pendingUpdate: false,
        },

        dom: {
            overlay: null,
            frame: null,
            toolbar: null,
            info: null,
            shrouds: { top: null, bottom: null, left: null, right: null },
        },

        util: {
            clamp: (value, min, max) => Math.min(Math.max(value, min), max),
            getPageBounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
        },

        initialize: function(config) {
            console.log('[ScreenCut] Initializing with config:', config);
            if (this.state.isActive) this.cleanup();

            if (!config || typeof config !== 'object') {
                console.error('[ScreenCut] Invalid config.'); return;
            }

            this.state.isActive = true;
            this.state.isResizable = config.type === 'ratio';
            
            // 保存配置信息用于文件命名
            this.currentConfigName = config.name || `${config.type}_${config.ratio || config.width + 'x' + config.height}`;

            const dimensions = this.calculateInitialDimensions(config);
            if (!dimensions || isNaN(dimensions.width) || isNaN(dimensions.height)) {
                console.error('[ScreenCut] Invalid dimensions.', dimensions); return;
            }

            const pageBounds = this.util.getPageBounds();
            this.state.frameRect = {
                width: dimensions.width,
                height: dimensions.height,
                x: this.util.clamp((pageBounds.width - dimensions.width) / 2, 0, pageBounds.width - dimensions.width),
                y: this.util.clamp((pageBounds.height - dimensions.height) / 2, 0, pageBounds.height - dimensions.height),
            };

            if (this.state.isResizable) this.state.currentRatio = config.ratio;

            this.createDOM();
            this.addEventListeners();
            this.scheduleUpdate();
            console.log('[ScreenCut] Initialization complete.');
        },

        cleanup: function() {
            console.log('[ScreenCut] Cleaning up.');
            if (this.dom.overlay) this.dom.overlay.remove();
            this.removeEventListeners();
            // Reset all DOM references
            this.dom.overlay = this.dom.frame = this.dom.toolbar = this.dom.info = null;
            this.dom.shrouds = { top: null, bottom: null, left: null, right: null };
            this.state.isActive = false;
        },

        // ... other functions attached to 'this' ...

        createDOM: function() { /* ... as before ... */ },
        createToolbar: function() { /* ... as before ... */ },
        // ... and so on for all other functions
    };

    // --- Function Definitions (Copied inside the module) ---
    window.screenCutModule.createDOM = function() {
        this.dom.overlay = document.createElement('div');
        this.dom.overlay.className = 'screencut-overlay';
        for (const key in this.dom.shrouds) {
            const shroud = document.createElement('div');
            shroud.className = `screencut-shroud ${key}`;
            this.dom.shrouds[key] = shroud;
            this.dom.overlay.appendChild(shroud);
        }
        this.dom.frame = document.createElement('div');
        this.dom.frame.className = 'screencut-frame';
        if (!this.state.isResizable) this.dom.frame.classList.add('not-resizable');
        if (this.state.isResizable) {
            const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
            handles.forEach(handleName => {
                const handle = document.createElement('div');
                handle.className = `screencut-handle ${handleName}`;
                handle.dataset.handle = handleName;
                this.dom.frame.appendChild(handle);
            });
        }
        this.dom.toolbar = this.createToolbar();
        this.dom.info = document.createElement('div');
        this.dom.info.className = 'screencut-info';
        this.dom.overlay.append(this.dom.frame, this.dom.toolbar, this.dom.info);
        document.body.appendChild(this.dom.overlay);
    };

    window.screenCutModule.createToolbar = function() {
        const toolbar = document.createElement('div');
        toolbar.className = 'screencut-toolbar';
        toolbar.innerHTML = `<button class="screencut-btn-download">下载</button><button class="screencut-btn-copy">复制</button><button class="screencut-btn-cancel">取消</button>`;
        toolbar.querySelector('.screencut-btn-download').addEventListener('click', () => this.confirmCapture('download'));
        toolbar.querySelector('.screencut-btn-copy').addEventListener('click', () => this.confirmCapture('copy'));
        toolbar.querySelector('.screencut-btn-cancel').addEventListener('click', () => this.cancelCapture());
        return toolbar;
    };
    
    window.screenCutModule.updateFrameDisplay = function() { /* ... */ };
    window.screenCutModule.scheduleUpdate = function() { /* ... */ };
    window.screenCutModule.handleMouseDown = function(e) { /* ... */ };
    window.screenCutModule.handleMouseMove = function(e) { /* ... */ };
    window.screenCutModule.handleMouseUp = function() { /* ... */ };
    window.screenCutModule.handleKeyDown = function(e) { /* ... */ };
    window.screenCutModule.confirmCapture = async function(captureType) { /* ... */ };
    window.screenCutModule.cancelCapture = function() { /* ... */ };
    window.screenCutModule.addEventListeners = function() { /* ... */ };
    window.screenCutModule.removeEventListeners = function() { /* ... */ };
    window.screenCutModule.calculateInitialDimensions = function(config) { /* ... */ };

    // --- Full implementations of all helper functions ---
    // Note: `this` now refers to `window.screenCutModule`
    const module = window.screenCutModule;
    module.updateFrameDisplay = function() {
        if (!this.state.isActive || !this.dom.frame) return;
        const { x, y, width, height } = this.state.frameRect;
        this.dom.frame.style.transform = `translate(${x}px, ${y}px)`;
        this.dom.frame.style.width = `${width}px`;
        this.dom.frame.style.height = `${height}px`;
        const pageBounds = this.util.getPageBounds();
        this.dom.shrouds.top.style.height = `${y}px`;
        this.dom.shrouds.bottom.style.top = `${y + height}px`;
        this.dom.shrouds.bottom.style.height = `${pageBounds.height - (y + height)}px`;
        this.dom.shrouds.left.style.top = `${y}px`;
        this.dom.shrouds.left.style.height = `${height}px`;
        this.dom.shrouds.left.style.width = `${x}px`;
        this.dom.shrouds.right.style.top = `${y}px`;
        this.dom.shrouds.right.style.height = `${height}px`;
        this.dom.shrouds.right.style.left = `${x + width}px`;
        this.dom.shrouds.right.style.width = `${pageBounds.width - (x + width)}px`;
        let toolbarX, toolbarY;
        const toolbarHeight = this.dom.toolbar.offsetHeight;
        const toolbarWidth = this.dom.toolbar.offsetWidth;

        // 尝试将工具栏放置在截图框下方
        let proposedToolbarY = y + height + 10;

        if (proposedToolbarY + toolbarHeight > pageBounds.height) {
            // 如果下方空间不足，则放置在截图框内部右下角
            toolbarX = x + width - toolbarWidth - 10; // 距离右侧10px
            toolbarY = y + height - toolbarHeight - 10; // 距离底部10px
        } else {
            // 否则，放置在截图框下方
            toolbarX = x;
            toolbarY = proposedToolbarY;
        }
        this.dom.toolbar.style.transform = `translate(${toolbarX}px, ${toolbarY}px)`;
        let infoX = x; let infoY = y - 30;
        if (infoY < 10) infoY = y + 10;
        this.dom.info.style.transform = `translate(${infoX}px, ${infoY}px)`;
        this.dom.info.textContent = `${Math.round(width)}x${Math.round(height)}px`;
        this.state.pendingUpdate = false;
    };
    module.scheduleUpdate = function() { if (!this.state.pendingUpdate) { this.state.pendingUpdate = true; requestAnimationFrame(() => this.updateFrameDisplay()); } };
    module.addEventListeners = function() { this.boundMouseDown = this.handleMouseDown.bind(this); this.boundKeyDown = this.handleKeyDown.bind(this); this.dom.frame.addEventListener('mousedown', this.boundMouseDown); window.addEventListener('keydown', this.boundKeyDown); };
    module.removeEventListeners = function() { if (this.dom.frame) this.dom.frame.removeEventListener('mousedown', this.boundMouseDown); window.removeEventListener('keydown', this.boundKeyDown); window.removeEventListener('mousemove', this.boundMouseMove); window.removeEventListener('mouseup', this.boundMouseUp); };
    module.handleMouseDown = function(e) { e.preventDefault(); e.stopPropagation(); if (this.state.isResizable && e.target.dataset.handle) { this.state.isResizing = true; this.state.resizeHandle = e.target.dataset.handle; } else if (e.target === this.dom.frame) { this.state.isDragging = true; } this.state.dragStart = { x: e.clientX, y: e.clientY }; this.state.frameStart = { ...this.state.frameRect }; this.boundMouseMove = this.handleMouseMove.bind(this); this.boundMouseUp = this.handleMouseUp.bind(this); window.addEventListener('mousemove', this.boundMouseMove); window.addEventListener('mouseup', this.boundMouseUp); };
    module.handleMouseMove = function(e) { if (!this.state.isDragging && !this.state.isResizing) return; const deltaX = e.clientX - this.state.dragStart.x; const deltaY = e.clientY - this.state.dragStart.y; if (this.state.isDragging) { const { x, y, width, height } = this.state.frameStart; const pageBounds = this.util.getPageBounds(); this.state.frameRect.x = this.util.clamp(x + deltaX, 0, pageBounds.width - width); this.state.frameRect.y = this.util.clamp(y + deltaY, 0, pageBounds.height - height); } else if (this.state.isResizing) { const { x, y, width, height } = this.state.frameStart; let newWidth = width, newHeight = height, newX = x, newY = y; const aspect = this.state.currentRatio; if (this.state.resizeHandle.includes('right')) newWidth = width + deltaX; else if (this.state.resizeHandle.includes('left')) newWidth = width - deltaX; if (this.state.resizeHandle.includes('bottom')) newHeight = height + deltaY; else if (this.state.resizeHandle.includes('top')) newHeight = height - deltaY; if (this.state.resizeHandle.includes('left') || this.state.resizeHandle.includes('right')) newHeight = newWidth / aspect; else newWidth = newHeight * aspect; if (this.state.resizeHandle.includes('left')) newX = x + (width - newWidth); if (this.state.resizeHandle.includes('top')) newY = y + (height - newHeight); const minWidth = 50; if (newWidth < minWidth) { newWidth = minWidth; newHeight = newWidth / aspect; if (this.state.resizeHandle.includes('left')) newX = x + (width - newWidth); if (this.state.resizeHandle.includes('top')) newY = y + (height - newHeight); } const pageBounds = this.util.getPageBounds(); if (newX < 0) newX = 0; if (newY < 0) newY = 0; if (newX + newWidth > pageBounds.width) { newWidth = pageBounds.width - newX; newHeight = newWidth / aspect; } if (newY + newHeight > pageBounds.height) { newHeight = pageBounds.height - newY; newWidth = newHeight * aspect; } this.state.frameRect = { x: newX, y: newY, width: newWidth, height: newHeight }; } this.scheduleUpdate(); };
    module.handleMouseUp = function() { this.state.isDragging = false; this.state.isResizing = false; window.removeEventListener('mousemove', this.boundMouseMove); window.removeEventListener('mouseup', this.boundMouseUp); };
    module.handleKeyDown = function(e) { if (!this.state.isActive) return; if (e.key === 'Escape') this.cancelCapture(); if (e.key === 'Enter') this.confirmCapture('download'); };
    module.cancelCapture = function() { this.cleanup(); chrome.runtime.sendMessage({ action: 'captureCancelled' }); };
    module.confirmCapture = async function(captureType) { 
        if (!this.state.isActive) return; 
        
        if (typeof html2canvas === 'undefined') { 
            console.error('[ScreenCut] html2canvas missing!'); 
            this.cleanup(); 
            return; 
        } 
        
        console.log('[ScreenCut] Starting capture with type:', captureType);
        
        // 隐藏覆盖层
        this.dom.overlay.style.display = 'none'; 
        await new Promise(r => setTimeout(r, 100)); 
        
        try { 
            console.log('[ScreenCut] Capturing area:', this.state.frameRect);
            
            const canvas = await html2canvas(document.body, { 
                x: this.state.frameRect.x, 
                y: this.state.frameRect.y, 
                width: this.state.frameRect.width, 
                height: this.state.frameRect.height, 
                scale: window.devicePixelRatio || 1, 
                useCORS: true, 
                allowTaint: true, 
                backgroundColor: null, 
                ignoreElements: (el) => el.classList.contains('screencut-overlay'), 
            }); 
            
            // 收集dimensions数据
            const dimensions = {
                width: this.state.frameRect.width,
                height: this.state.frameRect.height,
                configName: this.currentConfigName || 'screenshot',
                ratio: this.state.currentRatio || null
            };
            
            console.log('[ScreenCut] Capture successful, sending to background:', {
                captureType,
                dimensions,
                imageDataLength: canvas.toDataURL('image/png').length
            });
            
            chrome.runtime.sendMessage({ 
                action: 'captureComplete', 
                data: { 
                    captureType, 
                    imageData: canvas.toDataURL('image/png'),
                    dimensions: dimensions
                } 
            }); 
        } catch (error) { 
            console.error('ScreenCut Capture Error:', error); 
            chrome.runtime.sendMessage({ action: 'captureError', error: error.message }); 
        } finally { 
            this.cleanup(); 
        } 
    };
    module.calculateInitialDimensions = function(config) { 
        console.log('[ScreenCut] calculateInitialDimensions called with:', config);
        const type = config.type || 'ratio'; 
        
        if (type === 'pixels' && config.width && config.height) {
            console.log('[ScreenCut] Using pixels mode:', config.width, 'x', config.height);
            return { width: config.width, height: config.height }; 
        } 
        
        if (type === 'ratio' && config.ratio) {
            const dimensions = { width: 400, height: Math.round(400 / config.ratio) };
            console.log('[ScreenCut] Using ratio mode:', config.ratio, '->', dimensions);
            return dimensions;
        } 
        
        console.log('[ScreenCut] Using default dimensions');
        return { width: 400, height: 200 }; 
    };

    console.log('ScreenCut Module defined and loaded.');
}

// 3. The message listener is outside the module definition.
// It will be added every time the script is injected, but it will always call the *single* module.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ScreenCut Content] Received message:', message);
    
    if (message.action === 'activateCapture') {
        console.log('[ScreenCut Content] Config received:', message.data?.config);
        if (message.data?.config) {
            window.screenCutModule.initialize(message.data.config);
            sendResponse({ success: true });
        } else {
            console.error('[ScreenCut Content] No config in message data!');
            sendResponse({ success: false, error: 'No config provided' });
        }
    } else if (message.action === 'deactivateCapture' || message.action === 'captureCancelled') {
        window.screenCutModule.cleanup();
        sendResponse({ success: true });
    }
    return true; // Keep channel open for async responses
});
