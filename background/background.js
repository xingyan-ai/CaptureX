chrome.runtime.onInstalled.addListener(() => {
  console.log('CaptureX extension installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activateCapture') {
    const { config, tabId } = message.data;

    if (!tabId) {
      console.error('Background: No tabId provided.');
      sendResponse({ success: false, error: 'No tabId provided' });
      return true;
    }

    // Inject the content script and then send a message to it.
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    }).then(() => {
      console.log('Background: Injected content script.');
      // Add a small delay to ensure content script is ready
      return new Promise(resolve => setTimeout(resolve, 100)).then(() => {
        // After injecting, send a message to the content script to initialize
        return chrome.tabs.sendMessage(tabId, {
          action: 'initializeCapture',
          config: config
        });
      });
    }).then(() => {
        console.log('Background: Sent initialization message to content script.');
        sendResponse({ success: true });
    }).catch(err => {
      console.error('Background: Failed to activate capture.', err);
      sendResponse({ success: false, error: err.message });
    });

    return true; // Indicates that the response is sent asynchronously
  } else if (message.action === 'initiateFullPageCapture') {
    const { tabId } = message;
    if (!tabId) {
        console.error('Background: No tabId provided for full page capture.');
        sendResponse({ success: false, error: 'No tabId provided' });
        return true;
    }

    // 1. Inject html2canvas library
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/html2canvas.min.js']
    })
    .then(() => {
        console.log('Background: Injected html2canvas.');
        // 2. Inject the content script
        return chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });
    })
    .then(() => {
        console.log('Background: Injected content script for full page capture.');
        // 3. Send message to content script to start the capture
        return chrome.tabs.sendMessage(tabId, { action: 'captureFullPage' });
    })
    .then((response) => {
        console.log('Background: Full page capture initiated and content script responded.', response);
        // Pass the content script's response back to the popup
        sendResponse(response);
    })
    .catch(err => {
        console.error('Background: Failed to initiate full page capture.', err);
        sendResponse({ success: false, error: err.message });
    });

    return true; // Indicates that the response is sent asynchronously
  }
});