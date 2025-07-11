
chrome.runtime.onInstalled.addListener(() => {
  console.log('CaptureX extension installed.');
});

// ============================================================================
// Offscreen Document Management
// ============================================================================

let creating; // A promise that resolves when the offscreen document is created

async function hasOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const matchedClients = await self.clients.matchAll();
  return matchedClients.some(c => c.url === offscreenUrl);
}

async function setupOffscreenDocument(path) {
  if (await hasOffscreenDocument(path)) {
    return;
  }
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['BLOBS'],
      justification: 'Needed for fetching and processing blob data for clipboard.',
    });
    await creating;
    creating = null;
  }
}


// ============================================================================
// Command Listener (for Keyboard Shortcuts)
// ============================================================================
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log(`Command "${command}" triggered`);

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
      chrome.storage.sync.get('selectedConfig', ({ selectedConfig }) => {
        if (selectedConfig) {
          activateCapture(tab.id, selectedConfig);
        } else {
          chrome.action.openPopup();
        }
      });
      break;
  }
});


// ============================================================================
// Message Listener (from popup or content scripts)
// ============================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let tabId;
  // Correctly determine the tabId based on the message source and action
  if (message.action === 'activateCapture') {
    tabId = message.data?.tabId;
  } else {
    tabId = message.tabId || sender.tab?.id;
  }

  // Now, perform the check, ignoring special actions that don't need a tabId
  if (!tabId && message.action !== 'cropImage' && message.action !== 'downloadImage') {
    console.error('Background: Could not determine tab ID for action:', message.action);
    sendResponse({ success: false, error: 'Could not determine tab ID' });
    return true;
  }

  switch (message.action) {
    case 'activateCapture':
      activateCapture(tabId, message.data.config, sendResponse);
      break;
    case 'initiateSelectionCapture':
      handleInitiateSelectionCapture(tabId, message.cropRegion, sendResponse);
      break;
    case 'initiateFullPageCapture':
      initiateFullPageCapture(tabId, sendResponse);
      break;
    case 'downloadImage':
      handleDownloadImage(message.dataUrl, sendResponse);
      break;
    case 'copyImageToClipboard':
       handleCopyImageToClipboard(tabId, message.dataUrl, sendResponse);
       break;
    case 'captureError':
      console.error('Background: Capture error:', message.error);
      sendResponse({ success: false });
      break;
    default:
      return false; // No async response
  }
  
  return true; // Indicates that the response is (potentially) sent asynchronously
});

// ============================================================================
// Core Capture Functions
// ============================================================================

/**
 * Handles the new, fast selection capture process.
 */
async function handleInitiateSelectionCapture(tabId, cropRegion, sendResponse) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    await setupOffscreenDocument('offscreen/offscreen.html');
    
    const croppedDataUrl = await chrome.runtime.sendMessage({
      action: 'cropImage',
      dataUrl,
      cropRegion
    });

    if (croppedDataUrl && croppedDataUrl.success) {
      sendResponse({ success: true, dataUrl: croppedDataUrl.dataUrl });
    } else {
      throw new Error(croppedDataUrl.error || 'Failed to crop image in offscreen document.');
    }
  } catch (error) {
    console.error('Error during selection capture:', error);
    sendResponse({ success: false, error: error.message });
  } finally {
    // Notify popup that capture has ended
    chrome.runtime.sendMessage({ action: 'captureEnded' });
  }
}

/**
 * Downloads the given image data URL.
 */
function handleDownloadImage(dataUrl, sendResponse) {
    const safeFilename = `CaptureX-selection-${new Date().toISOString().replace(/:/g, '-')}.png`;
    chrome.downloads.download({
        url: dataUrl,
        filename: safeFilename,
        saveAs: false
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
            console.log('Download successful, ID:', downloadId);
            sendResponse({ success: true, downloadId: downloadId });
        }
    });
}

/**
 * Copies the given image data URL to the clipboard by sending it back to the content script.
 */
async function handleCopyImageToClipboard(tabId, dataUrl, sendResponse) {
    try {
        await setupOffscreenDocument('offscreen/offscreen.html');
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'copyToClipboard',
            dataUrl: dataUrl
        });
        sendResponse(response);
    } catch (e) {
        console.error('Failed to send copy command to content script:', e);
        sendResponse({ success: false, error: e.message });
    }
}


/**
 * Activates the selection UI in the content script.
 */
function activateCapture(tabId, config, sendResponse) {
  console.log('Background: Activating capture for tab:', tabId);
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content/content.js']
  })
  .then(() => {
    return chrome.tabs.sendMessage(tabId, { action: 'ping' });
  })
  .then(() => {
    return chrome.tabs.sendMessage(tabId, {
      action: 'initializeCapture',
      config: config
    });
  })
  .then((initResponse) => {
     if (sendResponse) sendResponse(initResponse);
  })
  .catch(err => {
    console.error('Background: Failed to activate capture.', err);
    if (sendResponse) sendResponse({ success: false, error: err.message });
  });
}

/**
 * Initiates a full-page capture using the original html2canvas method.
 */
function initiateFullPageCapture(tabId, sendResponse) {
  console.log('Background: Initiating full page capture for tab:', tabId);
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content/content.js']
  })
  .then(() => {
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/html2canvas.min.js']
    });
  })
  .then(() => {
    return chrome.tabs.sendMessage(tabId, { action: 'captureFullPage' });
  })
  .then((response) => {
    if (sendResponse) sendResponse(response);
  })
  .catch(err => {
    console.error('Background: Failed to initiate full page capture.', err);
    if (sendResponse) sendResponse({ success: false, error: err.message });
  });
}
