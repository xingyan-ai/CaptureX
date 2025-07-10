chrome.runtime.onInstalled.addListener(() => {
  console.log('CaptureX extension installed.');
});

// ============================================================================
// Command Listener (for Keyboard Shortcuts)
// ============================================================================
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command "${command}" triggered`);

  // Ensure we have a valid tab object
  if (!tab || !tab.id) {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (!tab || !tab.id) {
    console.error('Could not get active tab for command.');
    return;
  }

  switch (command) {
    case 'capture_fullscreen':
      initiateFullPageCapture(tab.id);
      break;
    case 'start_capture':
      // Get the last used config from storage. Note: popup.js must save this.
      chrome.storage.sync.get('selectedConfig', ({ selectedConfig }) => {
        if (selectedConfig) {
          activateCapture(tab.id, selectedConfig);
        } else {
          // If no config is saved, open the popup for the user to choose.
          chrome.action.openPopup();
          console.log('No saved config found. Opening popup for user selection.');
        }
      });
      break;
    // _execute_action (Alt+X) is handled automatically by Chrome to open the popup.
  }
});


// ============================================================================
// Message Listener (from popup or content scripts)
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let tabId;
  if (message.action === 'activateCapture') {
    tabId = message.data?.tabId; // For activateCapture, tabId is nested in data
  } else {
    tabId = message.tabId || sender.tab?.id; // For other actions, it's directly on message or from sender
  }

  if (!tabId) {
    console.error('Background: Could not determine tab ID.');
    sendResponse({ success: false, error: 'Could not determine tab ID' });
    return true;
  }

  switch (message.action) {
    case 'activateCapture':
      activateCapture(tabId, message.data.config, sendResponse);
      break;
    case 'initiateFullPageCapture':
      initiateFullPageCapture(tabId, sendResponse);
      break;
    case 'captureComplete':
      console.log('Background: Capture completed:', message);
      if (message.copied) {
        if (message.fallback) {
          console.log('Background: Image data copied as text to clipboard (fallback method)');
        } else {
          console.log('Background: Image copied to clipboard successfully');
        }
        // 可以在这里添加通知或其他处理
      }
      sendResponse({ success: true });
      break;
    case 'captureError':
      console.error('Background: Capture error:', message.error);
      sendResponse({ success: false });
      break;
    default:
      // Handle other messages if any
      return false; // No async response
  }
  
  return true; // Indicates that the response is (potentially) sent asynchronously
});


// ============================================================================
// Reusable Core Functions
// ============================================================================

/**
 * Activates the selection capture mode in the content script.
 * @param {number} tabId - The ID of the target tab.
 * @param {object} config - The capture configuration object.
 * @param {function} [sendResponse] - Optional response callback for message passing.
 */
function activateCapture(tabId, config, sendResponse) {
  console.log('Background: Activating capture for tab:', tabId);

  // 1. Inject content.js first to ensure it's running
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content/content.js']
  })
  .then(() => {
    console.log('Background: content.js injected.');
    // 2. Then inject html2canvas.min.js (if not already injected by full page capture)
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/html2canvas.min.js']
    });
  })
  .then(() => {
    console.log('Background: html2canvas.min.js injected.');
    // 3. Send ping to ensure content script is ready and responsive
    return chrome.tabs.sendMessage(tabId, { action: 'ping' });
  })
  .then((pingResponse) => {
    console.log('Background: Content script is responsive:', pingResponse);
    // 4. Send the actual initialization message
    return chrome.tabs.sendMessage(tabId, {
      action: 'initializeCapture',
      config: config
    });
     })
   .then((initResponse) => {
     console.log('Background: Sent initialization message, received response:', initResponse);
     console.log('Background: Response details - success:', initResponse?.success, 'error:', initResponse?.error);
     if (sendResponse) sendResponse(initResponse); // Directly pass the response
   })
  .catch(err => {
    console.error('Background: Failed to activate capture.', err);
    // Improved error handling for restricted pages or other issues
    if (err.message.includes('Could not establish connection') || err.message.includes('Extension context invalidated')) {
      chrome.tabs.get(tabId).then((tab) => {
        if (tab && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('file://'))) {
          if (sendResponse) sendResponse({
            success: false,
            error: '无法在此页面使用截图功能，请在普通网页上使用'
          });
        } else {
          if (sendResponse) sendResponse({
            success: false,
            error: '内容脚本未加载，请刷新页面后重试'
          });
        }
      }).catch(() => {
        if (sendResponse) sendResponse({ success: false, error: err.message });
      });
    } else {
      if (sendResponse) sendResponse({ success: false, error: err.message });
    }
  });
}

/**
 * Initiates a full-page capture.
 * @param {number} tabId - The ID of the target tab.
 * @param {function} [sendResponse] - Optional response callback for message passing.
 */
function initiateFullPageCapture(tabId, sendResponse) {
  console.log('Background: Initiating full page capture for tab:', tabId);

  // 1. Inject content.js first
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content/content.js']
  })
  .then(() => {
    console.log('Background: content.js injected for full page capture.');
    // 2. Then inject html2canvas.min.js
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/html2canvas.min.js']
    });
  })
  .then(() => {
    console.log('Background: html2canvas.min.js injected for full page capture.');
    // 3. Send message to content script to start the capture
    return chrome.tabs.sendMessage(tabId, { action: 'captureFullPage' });
  })
  .then((response) => {
    console.log('Background: Full page capture initiated and content script responded.', response);
    if (sendResponse) sendResponse(response);
  })
  .catch(err => {
    console.error('Background: Failed to initiate full page capture.', err);
    if (sendResponse) sendResponse({ success: false, error: err.message });
  });
}