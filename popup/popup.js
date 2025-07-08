/**
 * ScreenCut Popup 交互逻辑
 * 负责处理用户界面交互、尺寸选择、自定义尺寸管理、消息通信和状态管理
 */

// ============================================================================
// 全局变量和状态管理
// ============================================================================

let selectedConfig = null; // { type, ratio, width, height }
let isCapturing = false;
let customRatios = [];

// DOM 元素引用
const elements = {};

// ============================================================================
// 工具函数 & 存储
// ============================================================================

const storage = {
    get: () => chrome.storage.sync.get({ customRatios: [] }),
    set: (data) => chrome.storage.sync.set(data),
};

function showStatusMessage(message, type = 'info', duration = 3000) {
    const { statusMessage, statusText, statusIcon } = elements;
    statusMessage.classList.remove('success', 'error', 'info');
    statusText.textContent = message;
    statusMessage.classList.add(type);

    switch (type) {
        case 'success': statusIcon.textContent = '✅'; break;
        case 'error': statusIcon.textContent = '❌'; break;
        default: statusIcon.textContent = 'ℹ️'; break;
    }

    statusMessage.style.display = 'flex';

    if (duration) {
        setTimeout(() => statusMessage.style.display = 'none', duration);
    }
}

// ============================================================================
// 自定义尺寸管理
// ============================================================================

async function loadCustomRatios() {
    const data = await storage.get();
    customRatios = data.customRatios || [];
    renderCustomRatios();
}

function renderCustomRatios() {
    elements.customRatioContainer.innerHTML = '';
    customRatios.forEach((ratio, index) => {
        const btn = createRatioButton(ratio, index);
        elements.customRatioContainer.appendChild(btn);
    });
}

function createRatioButton(config, index) {
    const btn = document.createElement('button');
    btn.className = 'ratio-btn';
    btn.dataset.index = index;
    btn.dataset.type = config.type;

    let valueText;
    if (config.type === 'ratio') {
        btn.dataset.ratio = config.width / config.height;
        valueText = `${config.width}:${config.height}`;
    } else {
        btn.dataset.width = config.width;
        btn.dataset.height = config.height;
        valueText = `${config.width}x${config.height}px`;
    }

    btn.innerHTML = `
        <span class="ratio-name">${config.name}</span>
        <span class="ratio-value">${valueText}</span>
        <button class="delete-btn" title="删除此尺寸">×</button>
    `;

    btn.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            deleteCustomRatio(index);
        } else {
            selectRatio(btn);
        }
    });

    return btn;
}

async function saveCustomRatio(config) {
    customRatios.push(config);
    await storage.set({ customRatios });
    await loadCustomRatios();
    showStatusMessage('新尺寸已保存', 'success');
}

async function deleteCustomRatio(index) {
    customRatios.splice(index, 1);
    await storage.set({ customRatios });
    await loadCustomRatios();
    showStatusMessage('尺寸已删除', 'info');
    if (selectedConfig && selectedConfig.index === index) {
        resetSelection();
    }
}

function resetSelection() {
    selectedConfig = null;
    document.querySelectorAll('.ratio-btn.selected').forEach(b => b.classList.remove('selected'));
    elements.startCaptureBtn.disabled = true;
}

// ============================================================================
// UI 交互
// ============================================================================

/**
 * [核心修复] 更健壮的尺寸选择函数
 * 每次都创建一个全新的、经过严格校验的配置对象，防止状态污染。
 */
function selectRatio(btn) {
    console.log('[Popup] Selecting button:', btn.outerHTML);
    console.log('[Popup] Button dataset:', btn.dataset);
    
    document.querySelectorAll('.ratio-btn.selected').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const { type, ratio, width, height, index } = btn.dataset;
    let newConfig = null; // 1. 从 null 开始，确保纯净

    // 2. 根据类型，严格校验并创建对象
    if (type === 'ratio') {
        const ratioValue = parseFloat(ratio);
        console.log('[Popup] Processing ratio button, ratioValue:', ratioValue);
        if (!isNaN(ratioValue) && ratioValue > 0) {
            newConfig = {
                type: 'ratio',
                name: btn.querySelector('.ratio-name').textContent,
                ratio: ratioValue,
                index: index ? parseInt(index, 10) : null
            };
        }
    } else if (type === 'pixels') {
        const widthValue = parseInt(width, 10);
        const heightValue = parseInt(height, 10);
        console.log('[Popup] Processing pixels button, width:', widthValue, 'height:', heightValue);
        console.log('[Popup] Button width/height from dataset:', width, height);
        
        if (!isNaN(widthValue) && widthValue > 0 && !isNaN(heightValue) && heightValue > 0) {
            newConfig = {
                type: 'pixels',
                name: btn.querySelector('.ratio-name').textContent,
                width: widthValue,
                height: heightValue,
                index: index ? parseInt(index, 10) : null
            };
            console.log('[Popup] Created pixels config:', newConfig);
        } else {
            console.error('[Popup] Invalid pixels values:', { width, height, widthValue, heightValue });
        }
    }

    // 3. 只有在对象完全有效时才更新状态
    if (newConfig) {
        selectedConfig = newConfig;
        console.log('[Popup] Successfully generated config:', JSON.parse(JSON.stringify(selectedConfig)));
        elements.startCaptureBtn.disabled = false;
        showStatusMessage(`已选择: ${selectedConfig.name}`);
    } else {
        selectedConfig = null;
        console.error('[Popup] Failed to generate a valid config from button dataset:', btn.dataset);
        elements.startCaptureBtn.disabled = true;
        showStatusMessage('选择的尺寸数据无效', 'error');
    }
}


function toggleNewRatioForm(show = true) {
    elements.newRatioForm.style.display = show ? 'flex' : 'none';
    elements.addNewRatioBtn.style.display = show ? 'none' : 'flex';
}

function handleFormTypeChange() {
    const type = elements.newRatioForm.querySelector('[name="ratio-type"]:checked').value;
    elements.dimensionsRatio.style.display = type === 'ratio' ? 'flex' : 'none';
    elements.dimensionsPixels.style.display = type === 'pixels' ? 'flex' : 'none';
}

function handleFormSubmit(e) {
    e.preventDefault();
    const name = elements.newRatioName.value.trim();
    if (!name) {
        showStatusMessage('请输入名称', 'error');
        return;
    }

    const type = elements.newRatioForm.querySelector('[name="ratio-type"]:checked').value;
    let config = { name, type };

    if (type === 'ratio') {
        const width = parseInt(elements.ratioWidth.value, 10);
        const height = parseInt(elements.ratioHeight.value, 10);
        if (!width || !height || width <= 0 || height <= 0) {
            showStatusMessage('请输入有效的比例值', 'error');
            return;
        }
        config.width = width;
        config.height = height;
    } else {
        const width = parseInt(elements.pixelWidth.value, 10);
        const height = parseInt(elements.pixelHeight.value, 10);
        if (!width || !height || width <= 0 || height <= 0) {
            showStatusMessage('请输入有效的像素值', 'error');
            return;
        }
        config.width = width;
        config.height = height;
    }

    saveCustomRatio(config);
    elements.newRatioForm.reset();
    handleFormTypeChange();
    toggleNewRatioForm(false);
}

// ============================================================================
// 截图功能
// ============================================================================

async function startCapture() {
    if (!selectedConfig) {
        showStatusMessage('请先选择一个尺寸', 'error');
        return;
    }

    console.log('[Popup] Starting capture with config:', selectedConfig);

    try {
        isCapturing = true;
        updateUICapturingState(true);

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('无法获取当前标签页');

        console.log('[Popup] Current tab:', tab.id, tab.url);

        const messageToSend = {
            action: 'activateCapture',
            data: { config: selectedConfig, tabId: tab.id }
        };
        
        console.log('[Popup] Sending message to background:', messageToSend);

        const response = await chrome.runtime.sendMessage(messageToSend);
        
        console.log('[Popup] Response from background:', response);

        if (!response || !response.success) {
            throw new Error(response?.error || '启动截图失败');
        }
        
        showStatusMessage('截图已激活，请在页面上操作', 'success');
        // Don't close the popup, allow user to see status
        // window.close(); 
    } catch (error) {
        console.error('启动截图失败:', error);
        showStatusMessage(`启动失败: ${error.message}`, 'error');
        resetCaptureState();
    }
}

function cancelCapture() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab) chrome.tabs.sendMessage(tab.id, { action: 'cancelCapture' });
    });
    resetCaptureState();
    showStatusMessage('已取消截图', 'info');
}

function resetCaptureState() {
    isCapturing = false;
    updateUICapturingState(false);
}

function updateUICapturingState(isCapturing) {
    elements.startCaptureBtn.style.display = isCapturing ? 'none' : 'block';
    elements.cancelCaptureBtn.style.display = isCapturing ? 'block' : 'none';
}

// ============================================================================
// 初始化和事件绑定
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    Object.assign(elements, {
        ratioSelector: document.querySelector('.ratio-selector'),
        customRatioContainer: document.getElementById('custom-ratio-container'),
        addNewRatioBtn: document.getElementById('add-new-ratio-btn'),
        newRatioForm: document.getElementById('new-ratio-form'),
        newRatioName: document.getElementById('new-ratio-name'),
        dimensionsRatio: document.getElementById('dimensions-ratio'),
        dimensionsPixels: document.getElementById('dimensions-pixels'),
        ratioWidth: document.getElementById('ratio-width'),
        ratioHeight: document.getElementById('ratio-height'),
        pixelWidth: document.getElementById('pixel-width'),
        pixelHeight: document.getElementById('pixel-height'),
        cancelNewRatioBtn: document.getElementById('cancel-new-ratio-btn'),
        startCaptureBtn: document.getElementById('start-capture'),
        cancelCaptureBtn: document.getElementById('cancel-capture'),
        statusMessage: document.getElementById('status-message'),
        statusText: document.querySelector('.status-text'),
        statusIcon: document.querySelector('.status-icon'),
    });

    // IMPORTANT: Attach listener to the parent, but call selectRatio on the button itself
    elements.ratioSelector.addEventListener('click', (e) => {
        const button = e.target.closest('.ratio-btn');
        if (button) {
            selectRatio(button);
        }
    });

    elements.addNewRatioBtn.addEventListener('click', () => toggleNewRatioForm(true));
    elements.cancelNewRatioBtn.addEventListener('click', () => toggleNewRatioForm(false));
    elements.newRatioForm.addEventListener('submit', handleFormSubmit);
    elements.newRatioForm.querySelectorAll('[name="ratio-type"]').forEach(radio => {
        radio.addEventListener('change', handleFormTypeChange);
    });

    elements.startCaptureBtn.addEventListener('click', startCapture);
    elements.cancelCaptureBtn.addEventListener('click', cancelCapture);

    loadCustomRatios();
    handleFormTypeChange();
});

// ============================================================================
// 消息监听器
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Popup] Received runtime message:', message);
    
    switch (message.action) {
        case 'captureComplete':
            if (message.success) {
                if (message.filename) {
                    showStatusMessage(`截图已保存: ${message.filename}`, 'success');
                } else if (message.copied) {
                    showStatusMessage('截图已复制到剪贴板', 'success');
                } else {
                    showStatusMessage('截图完成', 'success');
                }
            } else {
                showStatusMessage('截图失败', 'error');
            }
            resetCaptureState();
            break;
        case 'captureCancelled':
            resetCaptureState();
            showStatusMessage('已取消截图', 'info');
            break;
        case 'captureError':
            showStatusMessage(`截图失败: ${message.error}`, 'error');
            resetCaptureState();
            break;
        default:
            console.log('[Popup] Unknown message action:', message.action);
    }
    sendResponse({ success: true });
});