/**
 * CaptureX Popup Interaction Logic (Chinese, Optimized)
 * Manages UI, state, custom sizes, settings, and message passing.
 */

// ============================================================================
// Global State & DOM Elements
// ============================================================================

let selectedConfig = null;
let isCapturing = false;
let customRatios = [];
const elements = {};

// ============================================================================
// Storage Utility
// ============================================================================

const storage = {
    get: (keys) => chrome.storage.sync.get(keys),
    set: (data) => chrome.storage.sync.set(data),
};

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    assignDOMElements();
    loadDataFromStorage();
    attachEventListeners();
    handleFormTypeChange();
});

function assignDOMElements() {
    Object.assign(elements, {
        ratioSelector: document.querySelector('.ratio-selector'),
        customRatioContainer: document.getElementById('custom-ratio-container'),
        addNewRatioBtn: document.getElementById('add-new-ratio-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        startCaptureBtn: document.getElementById('start-capture'),
        captureFullPageBtn: document.getElementById('capture-full-page'),
        cancelCaptureBtn: document.getElementById('cancel-capture'),
        cancelNewRatioBtn: document.getElementById('cancel-new-ratio-btn'),
        newRatioForm: document.getElementById('new-ratio-form'),
        settingsPanel: document.getElementById('settings-panel'),
        newRatioName: document.getElementById('new-ratio-name'),
        dimensionsRatio: document.getElementById('dimensions-ratio'),
        dimensionsPixels: document.getElementById('dimensions-pixels'),
        ratioWidth: document.getElementById('ratio-width'),
        ratioHeight: document.getElementById('ratio-height'),
        pixelWidth: document.getElementById('pixel-width'),
        pixelHeight: document.getElementById('pixel-height'),
        shortcutsList: document.getElementById('shortcuts-list'),
        manageShortcutsLink: document.getElementById('manage-shortcuts-link'),
        statusMessage: document.getElementById('status-message'),
        statusText: document.querySelector('.status-text'),
        statusIcon: document.querySelector('.status-icon'),
    });
}

function loadDataFromStorage() {
    storage.get({ customRatios: [], selectedConfig: null }).then(data => {
        customRatios = data.customRatios || [];
        selectedConfig = data.selectedConfig;
        renderCustomRatios();
        if (selectedConfig) {
            document.querySelectorAll('.ratio-btn').forEach(btn => {
                if (btn.querySelector('.ratio-name').textContent === selectedConfig.name) {
                    btn.classList.add('selected');
                    elements.startCaptureBtn.disabled = false;
                }
            });
        }
    });
    loadShortcuts();
}

function attachEventListeners() {
    elements.ratioSelector.addEventListener('click', (e) => {
        const button = e.target.closest('.ratio-btn');
        if (button) selectRatio(button);
    });

    elements.addNewRatioBtn.addEventListener('click', () => toggleNewRatioForm(true));
    elements.cancelNewRatioBtn.addEventListener('click', () => toggleNewRatioForm(false));
    elements.newRatioForm.addEventListener('submit', handleFormSubmit);
    elements.newRatioForm.querySelectorAll('[name="ratio-type"]').forEach(radio => {
        radio.addEventListener('change', handleFormTypeChange);
    });

    elements.settingsBtn.addEventListener('click', () => toggleSettingsPanel());
    elements.manageShortcutsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    elements.startCaptureBtn.addEventListener('click', startCapture);
    elements.captureFullPageBtn.addEventListener('click', captureFullPage);
    elements.cancelCaptureBtn.addEventListener('click', cancelCapture);
}

// ============================================================================
// UI Panels & Toggles
// ============================================================================

function toggleNewRatioForm(show) {
    elements.newRatioForm.style.display = show ? 'flex' : 'none';
    if (show) toggleSettingsPanel(false);
}

function toggleSettingsPanel(forceState) {
    const shouldShow = forceState !== undefined ? forceState : elements.settingsPanel.style.display === 'none';
    elements.settingsPanel.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) toggleNewRatioForm(false);
}

// ============================================================================
// Settings & Shortcuts
// ============================================================================

async function loadShortcuts() {
    const commands = await chrome.commands.getAll();
    const commandMap = {
        '_execute_action': '打开插件面板',
        'capture_fullscreen': '一键截全屏',
        'start_capture': '开始截图',
    };

    elements.shortcutsList.innerHTML = '';
    commands.forEach(command => {
        const name = commandMap[command.name];
        if (name) {
            const li = document.createElement('li');
            const shortcut = command.shortcut || '未设置';
            li.innerHTML = `<span>${name}</span><kbd>${shortcut}</kbd>`;
            elements.shortcutsList.appendChild(li);
        }
    });
}

// ============================================================================
// Custom Ratio Management
// ============================================================================

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

    btn.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomRatio(index);
    });
    return btn;
}

async function saveCustomRatio(config) {
    customRatios.push(config);
    await storage.set({ customRatios });
    renderCustomRatios();
    showStatusMessage('新尺寸已保存', 'success');
}

async function deleteCustomRatio(index) {
    customRatios.splice(index, 1);
    await storage.set({ customRatios });
    renderCustomRatios();
    showStatusMessage('尺寸已删除', 'info');
    if (selectedConfig && selectedConfig.index === index) {
        resetSelection();
    }
}

function resetSelection() {
    selectedConfig = null;
    storage.set({ selectedConfig: null });
    document.querySelectorAll('.ratio-btn.selected').forEach(b => b.classList.remove('selected'));
    elements.startCaptureBtn.disabled = true;
}

function selectRatio(btn) {
    document.querySelectorAll('.ratio-btn.selected').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const { type, ratio, width, height, index } = btn.dataset;
    const name = btn.querySelector('.ratio-name').textContent;
    let newConfig = { name, type, index: index ? parseInt(index, 10) : null };

    if (type === 'ratio') newConfig.ratio = parseFloat(ratio);
    else { newConfig.width = parseInt(width, 10); newConfig.height = parseInt(height, 10); }

    selectedConfig = newConfig;
    storage.set({ selectedConfig });
    elements.startCaptureBtn.disabled = false;
    showStatusMessage(`已选择: ${name}`);
}

function handleFormTypeChange() {
    const type = elements.newRatioForm.querySelector('[name="ratio-type"]:checked').value;
    elements.dimensionsRatio.style.display = type === 'ratio' ? 'flex' : 'none';
    elements.dimensionsPixels.style.display = type === 'pixels' ? 'flex' : 'none';
}

function handleFormSubmit(e) {
    e.preventDefault();
    const name = elements.newRatioName.value.trim();
    if (!name) return showStatusMessage('请输入名称', 'error');

    const type = elements.newRatioForm.querySelector('[name="ratio-type"]:checked').value;
    let config = { name, type };

    if (type === 'ratio') {
        const width = parseInt(elements.ratioWidth.value, 10);
        const height = parseInt(elements.ratioHeight.value, 10);
        if (!width || !height || width <= 0 || height <= 0) return showStatusMessage('请输入有效的比例值', 'error');
        config.width = width; config.height = height;
    } else {
        const width = parseInt(elements.pixelWidth.value, 10);
        const height = parseInt(elements.pixelHeight.value, 10);
        if (!width || !height || width <= 0 || height <= 0) return showStatusMessage('请输入有效的像素值', 'error');
        config.width = width; config.height = height;
    }

    saveCustomRatio(config);
    elements.newRatioForm.reset();
    handleFormTypeChange();
    toggleNewRatioForm(false);
}

// ============================================================================
// Capture Actions
// ============================================================================

async function startCapture() {
    if (!selectedConfig) return showStatusMessage('请先选择一个尺寸', 'error');
    isCapturing = true;
    updateUICapturingState(true);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('无法获取当前标签页');
        
        const response = await chrome.runtime.sendMessage({ action: 'activateCapture', data: { config: selectedConfig, tabId: tab.id } });
        
        if (!response || !response.success) {
            throw new Error(response?.error || '启动截图失败');
        }
        showStatusMessage('截图已激活', 'success');
        setTimeout(() => window.close(), 500);
    } catch (error) {
        showStatusMessage(`启动失败: ${error.message}`, 'error');
        resetCaptureState();
    }
}

async function captureFullPage() {
    showStatusMessage('正在准备截取全屏...', 'info', null);
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('无法获取当前标签页');
        const response = await chrome.runtime.sendMessage({ action: 'initiateFullPageCapture', tabId: tab.id });
        if (!response || !response.success) throw new Error(response?.error || '启动全屏截图失败');
    } catch (error) {
        showStatusMessage(`启动失败: ${error.message}`, 'error');
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
// Message Listener
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'captureEnded':
        case 'captureCancelled':
            resetCaptureState();
            showStatusMessage('操作已完成', 'info');
            break;
        case 'captureError':
            showStatusMessage(`截图失败: ${message.error}`, 'error');
            resetCaptureState();
            break;
    }
    sendResponse({ success: true });
});

// ============================================================================
// Utility Functions
// ============================================================================

function showStatusMessage(message, type = 'info', duration = 3000) {
    const { statusMessage, statusText, statusIcon } = elements;
    statusMessage.classList.remove('success', 'error', 'info');
    statusText.textContent = message;
    statusMessage.classList.add(type);
    statusIcon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    statusMessage.style.display = 'flex';
    if (duration) {
        setTimeout(() => statusMessage.style.display = 'none', duration);
    }
}