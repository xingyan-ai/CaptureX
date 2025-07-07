/**
 * ScreenCut Background Service Worker (Final Version)
 */

// ============================================================================
// 全局状态管理
// ============================================================================

let extensionState = {
  isActive: false,
  currentTabId: null,
  selectedRatio: null,
};

// ============================================================================
// 消息通信处理
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 使用一个异步的IIFE（立即调用函数表达式）来处理消息，确保sendResponse总能被调用
  (async () => {
    try {
      const { action, data } = message;
      console.log(`Background received action: ${action}`, data || '');

      // 关键修复：根据消息来源确定 tabId
      // activateCapture 来自 popup，tabId 在 data 中。
      // 其他消息来自 content script，tabId 在 sender.tab 中。
      const tabId = action === 'activateCapture' ? data.tabId : sender.tab.id;

      if (!tabId) {
        throw new Error(`Could not determine tab ID for action: ${action}`);
      }

      switch (action) {
        case 'activateCapture':
          const result = await activateCapture(data, tabId);
          sendResponse({ success: true, data: result });
          break;
        case 'captureComplete':
          await handleCaptureComplete(data, tabId);
          sendResponse({ success: true });
          break;
        case 'deactivateCapture':
        case 'captureCancelled':
          await deactivateCapture(tabId);
          sendResponse({ success: true });
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error handling message: ${message.action}`, error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  // 返回 true 表示我们将异步地发送响应
  return true;
});

// ============================================================================
// 核心功能
// ============================================================================

async function activateCapture(data, tabId) {
  if (!tabId) {
    throw new Error('No valid tab ID provided for activation.');
  }

  console.log(`Activating capture on tab ${tabId} with ratio ${data.ratio}`);

  // Ping the content script to see if it's already injected.
  let needsInjection = false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    if (!response || response.status !== 'pong') {
      needsInjection = true;
    }
  } catch (e) {
    // An error means the content script isn't there, so we need to inject.
    console.log('Ping failed, content script needs injection.');
    needsInjection = true;
  }

  // Inject scripts only if necessary.
  if (needsInjection) {
    console.log(`Injecting scripts into tab ${tabId}`);
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content/overlay.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          'lib/html2canvas.min.js',
          'utils/ratio-calculator.js',
          'content/content.js'
        ]
      });
    } catch (e) {
      console.error(`Failed to inject scripts into tab ${tabId}.`, e);
      throw new Error('Cannot inject scripts into this page.');
    }
  }

  // Now that we're sure the script is there, send the activation command.
  await chrome.tabs.sendMessage(tabId, {
    action: 'activateCapture',
    ratio: data.ratio
  });

  // Update state and icon
  extensionState.isActive = true;
  extensionState.currentTabId = tabId;
  extensionState.selectedRatio = data.ratio;
  updateIcon('active', tabId);

  return { status: 'activation_sent', injected: needsInjection };
}

async function handleCaptureComplete(data, tabId) {
  console.log('Handling capture complete.', data);
  
  try {
    const { captureType, imageData, dimensions } = data;
    
    if (captureType === 'download') {
      // 处理下载功能
      console.log('正在准备下载截图...');
      
      // 生成文件名：ScreenCut_比例_时间戳.png
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const ratio = dimensions.ratio || 'unknown';
      const filename = `ScreenCut_${ratio.toString().replace('.', '-')}_${timestamp}.png`;
      
      // 创建下载
      await chrome.downloads.download({
        url: imageData,
        filename: filename,
        saveAs: false // 直接下载到默认下载文件夹
      });
      
      console.log(`截图已保存为: ${filename}`);
      
    } else if (captureType === 'copy') {
      // 处理复制到剪贴板功能
      console.log('正在复制到剪贴板...');
      
      // 将base64转换为blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      console.log('截图已复制到剪贴板');
    }
    
  } catch (error) {
    console.error('处理截图失败:', error);
  }

  // 截图完成后，自动停用
  await deactivateCapture(tabId);
}

async function deactivateCapture(tabId) {
  if (!tabId) return;

  console.log(`Deactivating capture on tab ${tabId}`);
  
  // 通知 content script 清理UI
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'deactivateCapture' });
  } catch (e) {
    // 如果content script已经不存在，这会报错，可以安全地忽略
    console.warn(`Could not send deactivation message to tab ${tabId}, it might have been closed.`, e);
  }

  // 重置状态和图标
  resetExtensionState();
  updateIcon('inactive', tabId);
}

// ============================================================================
// 工具函数
// ============================================================================

function resetExtensionState() {
  extensionState.isActive = false;
  extensionState.currentTabId = null;
  extensionState.selectedRatio = null;
}

function updateIcon(state, tabId) {
  // 暂时统一使用基础图标，避免激活状态图标文件缺失的问题
  const iconPaths = {
      '16': '/icons/icon16.png',
      '48': '/icons/icon48.png',
      '128': '/icons/icon128.png'
  };

  chrome.action.setIcon({
    path: iconPaths,
    ...(tabId && { tabId })
  }).catch(e => console.error('Failed to set icon:', e));
  
  // 可以在控制台输出状态，方便调试
  console.log(`Icon updated to ${state} state for tab ${tabId || 'all tabs'}`);
}

console.log('ScreenCut Background Service Worker loaded.');