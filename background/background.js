/**
 * ScreenCut Background Script
 * Handles script injection, communication, and download functionality
 */

console.log('ScreenCut Background Script loaded');

// 全局状态管理
const tabStates = new Map();

/**
 * 更新图标状态
 */
function updateIcon(state, tabId) {
  // 统一使用基础图标，避免激活状态图标文件缺失的问题
  const iconPaths = {
      '16': '/icons/icon16.png',
      '48': '/icons/icon48.png',
      '128': '/icons/icon128.png'
  };

  chrome.action.setIcon({
    path: iconPaths,
    ...(tabId && { tabId })
  }).catch(e => console.error('Failed to set icon:', e));
  
  console.log(`Icon updated to ${state} state for tab ${tabId || 'all tabs'}`);
}

/**
 * 激活截图功能
 */
async function activateCapture(data, tabId) {
  if (!tabId) {
    throw new Error('No valid tab ID provided for activation.');
  }

  console.log(`Activating capture on tab ${tabId} with config:`, data.config);
  
  // 并行注入脚本和CSS以提高速度
  try {
    console.log('正在并行注入CSS和JavaScript文件...');
    
    await Promise.all([
      chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content/overlay.css']
      }),
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          'lib/html2canvas.min.js',
          'content/content.js'
        ]
      })
    ]);
    
    console.log('所有文件注入成功');
  } catch (e) {
    console.error(`Failed to inject scripts or CSS into tab ${tabId}. This might be a restricted page.`, e);
    
    // 检查是否是受保护的页面
    if (e.message && e.message.includes('chrome://')) {
      throw new Error('无法在Chrome内部页面使用截图功能。请切换到普通网页（如百度、谷歌等）再试。');
    } else if (e.message && e.message.includes('chrome-extension://')) {
      throw new Error('无法在扩展页面使用截图功能。请切换到普通网页再试。');
    } else {
      throw new Error('无法在此页面注入脚本，可能是受保护的页面。请尝试普通网页。');
    }
  }

  // 等待一小段时间确保脚本加载完成
  await new Promise(resolve => setTimeout(resolve, 50));

  console.log('正在向content script发送激活指令...');
  
  // 注入成功后，向content script发送启动指令
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'activateCapture',
      data: { config: data.config }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送消息到content script失败:', chrome.runtime.lastError.message);
        reject(new Error(`Communication failed: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      if (response && response.success) {
        console.log('截图功能激活成功');
        tabStates.set(tabId, { active: true, config: data.config });
        updateIcon('active', tabId);
        resolve(response);
      } else {
        console.error('Content script响应失败:', response);
        reject(new Error(response?.error || 'Content script activation failed'));
      }
    });
  });
}

/**
 * 停用截图功能
 */
async function deactivateCapture(tabId) {
  if (!tabId) return;
  
  console.log(`Deactivating capture on tab ${tabId}`);
  
  try {
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, {
        action: 'deactivateCapture'
      }, (response) => {
        // 不管是否成功都继续，因为可能tab已经关闭或脚本已经卸载
        resolve();
      });
    });
  } catch (e) {
    console.log('Failed to send deactivate message, but continuing cleanup');
  }
  
  tabStates.delete(tabId);
  updateIcon('inactive', tabId);
}

/**
 * 处理截图完成
 */
async function handleCaptureComplete(data, tabId) {
  console.log('Handling capture complete.', data);
  
  try {
    const { captureType, imageData, dimensions } = data;
    
    if (captureType === 'download') {
      // 处理下载功能
      console.log('正在准备下载截图...');
      
      // 生成文件名：ScreenCut_配置_时间戳.png
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const configName = dimensions.configName || 'screenshot';
      const filename = `ScreenCut_${configName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${timestamp}.png`;
      
      // 创建下载
      await chrome.downloads.download({
        url: imageData,
        filename: filename,
        saveAs: false // 直接下载到默认下载文件夹
      });
      
      console.log(`截图已保存为: ${filename}`);
      
      // 通知popup下载成功
      chrome.runtime.sendMessage({
        action: 'captureComplete',
        success: true,
        filename: filename
      });
      
    } else if (captureType === 'copy') {
      // 处理复制到剪贴板功能
      console.log('正在复制截图到剪贴板...');
      
      try {
        // 在content script中执行复制操作
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: async (imageData) => {
            try {
              // 将base64转换为blob
              const response = await fetch(imageData);
              const blob = await response.blob();
              
              // 复制到剪贴板
              await navigator.clipboard.write([
                new ClipboardItem({
                  'image/png': blob
                })
              ]);
              
              console.log('截图已复制到剪贴板');
              return { success: true };
            } catch (err) {
              console.error('复制到剪贴板失败:', err);
              return { success: false, error: err.message };
            }
          },
          args: [imageData]
        });
        
        console.log('截图复制完成');
        
        // 通知popup复制成功
        chrome.runtime.sendMessage({
          action: 'captureComplete',
          success: true,
          copied: true
        });
        
      } catch (error) {
        console.error('复制到剪贴板执行失败:', error);
        
        // 通知popup出错了
        chrome.runtime.sendMessage({
          action: 'captureError',
          error: '复制到剪贴板失败: ' + error.message
        });
      }
    }
    
  } catch (error) {
    console.error('处理截图完成时出错:', error);
    
    // 通知popup出错了
    chrome.runtime.sendMessage({
      action: 'captureError',
      error: error.message
    });
  }

  // 截图完成后，自动停用
  await deactivateCapture(tabId);
}

/**
 * 主消息监听器
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received action:', message.action, message);
  
  const tabId = sender.tab?.id || message.data?.tabId;
  
  switch (message.action) {
    case 'activateCapture':
      activateCapture(message.data, tabId)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => {
          console.error('Activation failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开启
      
    case 'deactivateCapture':
    case 'captureCancelled':
      deactivateCapture(tabId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'captureComplete':
      handleCaptureComplete(message.data, tabId);
      sendResponse({ success: true });
      break;
      
    case 'captureError':
      console.error('Capture error from content script:', message.error);
      deactivateCapture(tabId);
      
      // 转发错误给popup
      chrome.runtime.sendMessage({
        action: 'captureError',
        error: message.error
      });
      
      sendResponse({ success: true });
      break;
      
    default:
      console.log('Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return false;
});

/**
 * 处理标签页关闭
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates.has(tabId)) {
    console.log(`Tab ${tabId} closed, cleaning up state`);
    tabStates.delete(tabId);
  }
});

/**
 * 处理标签页更新
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tabStates.has(tabId)) {
    // 页面重新加载时清理状态
    console.log(`Tab ${tabId} reloading, cleaning up capture state`);
    tabStates.delete(tabId);
    updateIcon('inactive', tabId);
  }
});

console.log('ScreenCut Background Script initialized');