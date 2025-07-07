/**
 * ScreenCut Popup 交互逻辑
 * 负责处理用户界面交互、比例选择、消息通信和状态管理
 */

// ============================================================================
// 全局变量和状态管理
// ============================================================================

let selectedRatio = null; // 当前选择的比例 (1.75 或 2.35)
let isCapturing = false;  // 是否正在截图
let capturedImageData = null; // 截图数据

// DOM 元素引用
let elements = {};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 根据比例计算默认尺寸
 * @param {number} ratio - 比例值 (1.75 或 2.35)
 * @param {number} defaultWidth - 默认宽度，默认400px
 * @returns {Object} 包含width和height的对象
 */
function calculateDimensions(ratio, defaultWidth = 400) {
  return {
    width: defaultWidth,
    height: Math.round(defaultWidth / ratio)
  };
}

/**
 * 显示状态消息
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('info', 'success', 'error')
 */
function showStatusMessage(message, type = 'info') {
  const statusMessage = elements.statusMessage;
  const statusText = elements.statusText;
  const statusIcon = elements.statusIcon;
  
  // 移除旧的类型类
  statusMessage.classList.remove('success', 'error', 'info');

  // 设置消息文本
  statusText.textContent = message;
  
  // 根据类型添加新的类和图标
  statusMessage.classList.add(type);
  switch (type) {
    case 'success':
      statusIcon.textContent = '✅';
      break;
    case 'error':
      statusIcon.textContent = '❌';
      break;
    default:
      statusIcon.textContent = 'ℹ️';
  }
  
  // 显示消息
  statusMessage.style.display = 'flex';
  
  // 3秒后自动隐藏（除非是错误消息）
  if (type !== 'error') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}

/**
 * 隐藏状态消息
 */
function hideStatusMessage() {
  elements.statusMessage.style.display = 'none';
}

/**
 * 更新像素显示
 * @param {number} ratio - 比例值
 */
function updatePixelDisplay(ratio) {
  const dimensions = calculateDimensions(ratio);
  const pixelElements = document.querySelectorAll('.ratio-pixels');
  
  pixelElements.forEach(element => {
    const btnRatio = parseFloat(element.closest('.ratio-btn').dataset.ratio);
    if (btnRatio === ratio) {
      element.textContent = `${dimensions.width}×${dimensions.height}px`;
    }
  });
}

// ============================================================================
// 比例选择功能
// ============================================================================

/**
 * 处理比例选择
 * @param {number} ratio - 选择的比例值
 */
function selectRatio(ratio) {
  // 更新全局状态
  selectedRatio = ratio;
  
  // 更新UI状态
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  // 标记选中的按钮
  const selectedBtn = document.querySelector(`[data-ratio="${ratio}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('selected');
  }
  
  // 启用开始截图按钮
  elements.startCaptureBtn.disabled = false;
  
  // 更新像素显示
  updatePixelDisplay(ratio);
  
  // 显示提示消息
  const dimensions = calculateDimensions(ratio);
  const ratioName = ratio === 1.75 ? '博客横幅' : '公众号封面';
  showStatusMessage(`已选择 ${ratio}:1 比例 (${ratioName})，尺寸：${dimensions.width}×${dimensions.height}px`);
  
  console.log(`用户选择了比例: ${ratio}:1, 尺寸: ${dimensions.width}×${dimensions.height}px`);
}

// ============================================================================
// 截图功能
// ============================================================================

/**
 * 开始截图流程
 */
async function startCapture() {
  try {
    if (!selectedRatio) {
      showStatusMessage('请先选择截图比例', 'error');
      return;
    }
    
    // 更新UI状态
    isCapturing = true;
    elements.startCaptureBtn.style.display = 'none';
    elements.cancelCaptureBtn.style.display = 'block';
    
    showStatusMessage('正在准备截图框...', 'info');
    
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.id) {
      throw new Error('无法获取当前标签页ID');
    }

    // 向 background script 发送激活请求
    const response = await chrome.runtime.sendMessage({
      action: 'activateCapture',
      data: { 
        ratio: selectedRatio,
        tabId: tab.id // 明确传递 tabId
      }
    });
    
    if (response && response.success) {
      showStatusMessage('请在页面上调整截图框，然后点击确认截图', 'success');
      // 弹窗保持打开状态，等待用户操作
    } else {
      throw new Error(response?.error || '启动截图失败');
    }
    
  } catch (error) {
    console.error('开始截图失败:', error);
    showStatusMessage(`启动截图失败: ${error.message}`, 'error');
    resetCaptureState();
  }
}

/**
 * 取消截图
 */
async function cancelCapture() {
  try {
    // 向内容脚本发送取消消息
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'cancelCapture'
      });
    }
    
    resetCaptureState();
    showStatusMessage('已取消截图', 'info');
    
  } catch (error) {
    console.error('取消截图失败:', error);
    resetCaptureState();
  }
}

/**
 * 重置截图状态
 */
function resetCaptureState() {
  isCapturing = false;
  elements.startCaptureBtn.style.display = 'block';
  elements.cancelCaptureBtn.style.display = 'none';
}

// ============================================================================
// 初始化和事件绑定
// ============================================================================

/**
 * DOM加载完成后的初始化
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('ScreenCut Popup 初始化开始');
  
  // 获取DOM元素引用
  elements = {
    // 比例选择按钮
    ratio175Btn: document.getElementById('ratio-1-75'),
    ratio235Btn: document.getElementById('ratio-2-35'),
    
    // 操作按钮
    startCaptureBtn: document.getElementById('start-capture'),
    cancelCaptureBtn: document.getElementById('cancel-capture'),
    
    // 状态消息
    statusMessage: document.getElementById('status-message'),
    statusText: document.querySelector('.status-text'),
    statusIcon: document.querySelector('.status-icon'),
    
    // 结果区域
    resultSection: document.getElementById('result-section'),
    resultImage: document.getElementById('result-image'),
    downloadBtn: document.getElementById('download-image'),
    copyBtn: document.getElementById('copy-image'),
    newCaptureBtn: document.getElementById('new-capture')
  };
  
  // 绑定比例选择事件
  elements.ratio175Btn.addEventListener('click', () => selectRatio(1.75));
  elements.ratio235Btn.addEventListener('click', () => selectRatio(2.35));
  
  // 绑定操作按钮事件
  elements.startCaptureBtn.addEventListener('click', startCapture);
  elements.cancelCaptureBtn.addEventListener('click', cancelCapture);
  
  // 初始化像素显示
  updatePixelDisplay(1.75);
  updatePixelDisplay(2.35);
  
  console.log('ScreenCut Popup 初始化完成');
}); 