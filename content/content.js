/**
 * ScreenCut Content Script - Simplified
 */

class ScreenCutManager {
    constructor() {
        this.state = {};
        this.dom = {};
        this.resetState();
        // Immediately create the overlay when the script is loaded
        this.createDOM();
    }

    resetState() {
        this.state = {
            isActive: false,
            isResizable: true,
            currentRatio: null,
            frameRect: { x: 0, y: 0, width: 400, height: 229 },
        };
    }

    initialize(config) {
        // This will now be called after the overlay is already in DOM
        this.state.isActive = true;
        // ... other initialization logic ...
    }

    cleanup() {
        // No need to remove overlay here, it's always present for testing
        this.resetState();
    }

    createDOM() {
        if (!this.dom.overlay) {
            this.dom.overlay = document.createElement('div');
            this.dom.overlay.className = 'screencut-overlay';
            document.body.appendChild(this.dom.overlay);
        }
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

        // --- Start of new implementation ---
        const originalUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none';

        const width = document.documentElement.scrollWidth;
        const height = document.documentElement.scrollHeight;
        // --- End of new implementation ---

        try {
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                logging: true,
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight,
                backgroundColor: '#ffffff',
                // --- Start of new implementation ---
                width: width,
                height: height,
                // --- End of new implementation ---
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `CaptureX-fullscreen-${new Date().toISOString()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return { success: true };
        } catch (error) {
            console.error('Error capturing full page:', error);
            return { success: false, error: error.message };
        } finally {
            cleanupGradientText();
            // --- Start of new implementation ---
            document.body.style.userSelect = originalUserSelect;
            // --- End of new implementation ---
        }
    }
}

// Ensure a single instance
if (!window.screenCut) {
    window.screenCut = new ScreenCutManager();
}

// The message listener will now only handle initialization logic
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'initializeCapture') {
        if (message.config) {
            window.screenCut.initialize(message.config);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No config provided' });
        }
    } else if (message.action === 'cancelCapture') {
        // For testing, we just reset state, not remove overlay
        window.screenCut.resetState();
        sendResponse({ success: true });
    } else if (message.action === 'captureFullPage') {
        window.screenCut.captureFullPage().then(sendResponse);
        return true; // Indicates that the response is sent asynchronously
    }
    return true;
});