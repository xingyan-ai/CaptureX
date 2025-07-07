/**
 * ScreenCut Content Script - Final Corrected Version
 * Reusable, with all helper functions restored.
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  isActive: false,
  currentRatio: null,
  frameRect: { x: 0, y: 0, width: 400, height: 229 },
  isDragging: false,
  isResizing: false,
  resizeHandle: null,
  dragStart: { x: 0, y: 0 },
  frameStart: { x: 0, y: 0, width: 0, height: 0 },
  pendingUpdate: false,
};

// ============================================================================
// DOM Elements
// ============================================================================
const dom = {
  overlay: null,
  frame: null,
  toolbar: null,
  info: null,
  shrouds: { // For the focus effect
    top: null,
    bottom: null,
    left: null,
    right: null
  }
};

// ============================================================================
// Utility Functions
// ============================================================================
const util = {
  clamp: (value, min, max) => Math.min(Math.max(value, min), max),
  getPageBounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
};

// ============================================================================
// DOM Creation
// ============================================================================
function createDOM() {
  dom.overlay = document.createElement('div');
  dom.overlay.className = 'screencut-overlay';

  // Create shrouds for the focus effect
  for (const key in dom.shrouds) {
    const shroud = document.createElement('div');
    // CRITICAL FIX: Add the specific class (`top`, `bottom`, etc.) to each shroud
    shroud.className = `screencut-shroud ${key}`;
    dom.shrouds[key] = shroud;
    dom.overlay.appendChild(shroud);
  }

  dom.frame = document.createElement('div');
  dom.frame.className = 'screencut-frame';

  const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  handles.forEach(handleName => {
    const handle = document.createElement('div');
    handle.className = `screencut-handle ${handleName}`;
    handle.dataset.handle = handleName;
    dom.frame.appendChild(handle);
  });

  dom.toolbar = createToolbar();
  dom.info = createInfoPanel();

  // Append frame and tools last so they appear on top of the shrouds
  dom.overlay.append(dom.frame, dom.toolbar, dom.info);
  document.body.appendChild(dom.overlay);
}

function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'screencut-toolbar';

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '下载';
    downloadBtn.className = 'screencut-btn-download';
    downloadBtn.addEventListener('click', () => confirmCapture('download'));

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制';
    copyBtn.className = 'screencut-btn-copy';
    copyBtn.addEventListener('click', () => confirmCapture('copy'));

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'screencut-btn-cancel';
    cancelBtn.addEventListener('click', cancelCapture);

    toolbar.append(downloadBtn, copyBtn, cancelBtn);
    return toolbar;
}

function createInfoPanel() {
    const info = document.createElement('div');
    info.className = 'screencut-info';
    return info;
}

// ============================================================================
// Frame Update and Rendering
// ============================================================================
function updateFrameDisplay() {
  if (!state.isActive) return;

  const { x, y, width, height } = state.frameRect;
  const pageBounds = util.getPageBounds();

  // Update frame position and size
  dom.frame.style.transform = `translate(${x}px, ${y}px)`;
  dom.frame.style.width = `${width}px`;
  dom.frame.style.height = `${height}px`;

  // Update shrouds to cover areas outside the frame
  dom.shrouds.top.style.height = `${y}px`;

  dom.shrouds.bottom.style.top = `${y + height}px`;
  dom.shrouds.bottom.style.height = `${pageBounds.height - (y + height)}px`;

  dom.shrouds.left.style.top = `${y}px`;
  dom.shrouds.left.style.height = `${height}px`;
  dom.shrouds.left.style.width = `${x}px`;

  dom.shrouds.right.style.top = `${y}px`;
  dom.shrouds.right.style.height = `${height}px`;
  dom.shrouds.right.style.left = `${x + width}px`;
  dom.shrouds.right.style.width = `${pageBounds.width - (x + width)}px`;

  // Update toolbar position
  let toolbarX = x;
  let toolbarY = y + height + 10;
  if (toolbarY + 50 > pageBounds.height) {
    toolbarY = y - 50;
  }
  dom.toolbar.style.transform = `translate(${toolbarX}px, ${toolbarY}px)`;

  // Update info panel position
  let infoX = x;
  let infoY = y - 30;
  if (infoY < 10) {
      infoY = y + 10;
  }
  dom.info.style.transform = `translate(${infoX}px, ${infoY}px)`;
  dom.info.textContent = `${Math.round(width)}x${Math.round(height)}px`;

  state.pendingUpdate = false;
}

function scheduleUpdate() {
  if (!state.pendingUpdate) {
    state.pendingUpdate = true;
    requestAnimationFrame(updateFrameDisplay);
  }
}

// ============================================================================
// Event Handlers
// ============================================================================
function handleMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();

  if (e.target.dataset.handle) {
    state.isResizing = true;
    state.resizeHandle = e.target.dataset.handle;
  } else if (e.target === dom.frame) {
    state.isDragging = true;
  } else {
    return;
  }

  state.dragStart = { x: e.clientX, y: e.clientY };
  state.frameStart = { ...state.frameRect };

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(e) {
  if (!state.isDragging && !state.isResizing) return;

  const deltaX = e.clientX - state.dragStart.x;
  const deltaY = e.clientY - state.dragStart.y;

  if (state.isDragging) {
    handleDrag(deltaX, deltaY);
  } else if (state.isResizing) {
    handleResize(deltaX, deltaY);
  }

  scheduleUpdate();
}

function handleMouseUp() {
  state.isDragging = false;
  state.isResizing = false;
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
}

function handleKeyDown(e) {
    if (!state.isActive) return;
    if (e.key === 'Escape') cancelCapture();
    if (e.key === 'Enter') confirmCapture('download');
}

// ============================================================================
// Interaction Logic
// ============================================================================
function handleDrag(deltaX, deltaY) {
  const { x, y, width, height } = state.frameStart;
  const pageBounds = util.getPageBounds();
  state.frameRect.x = util.clamp(x + deltaX, 0, pageBounds.width - width);
  state.frameRect.y = util.clamp(y + deltaY, 0, pageBounds.height - height);
}

function handleResize(deltaX, deltaY) {
    const { x, y, width, height } = state.frameStart;
    let newWidth = width;
    let newHeight = height;
    let newX = x;
    let newY = y;

    const aspect = state.currentRatio;

    if (state.resizeHandle.includes('right')) {
        newWidth = width + deltaX;
    } else if (state.resizeHandle.includes('left')) {
        newWidth = width - deltaX;
    }

    if (state.resizeHandle.includes('bottom')) {
        newHeight = height + deltaY;
    } else if (state.resizeHandle.includes('top')) {
        newHeight = height - deltaY;
    }

    if (state.resizeHandle.includes('left') || state.resizeHandle.includes('right')) {
        newHeight = newWidth / aspect;
    } else {
        newWidth = newHeight * aspect;
    }
    
    if (state.resizeHandle.includes('left')) {
        newX = x + (width - newWidth);
    }
    if (state.resizeHandle.includes('top')) {
        newY = y + (height - newHeight);
    }

    const minWidth = 100;
    if (newWidth < minWidth) {
        newWidth = minWidth;
        newHeight = newWidth / aspect;
        if (state.resizeHandle.includes('left')) {
            newX = x + (width - newWidth);
        }
        if (state.resizeHandle.includes('top')) {
            newY = y + (height - newHeight);
        }
    }

    const pageBounds = util.getPageBounds();
    if (newX < 0) { newX = 0; }
    if (newY < 0) { newY = 0; }
    if (newX + newWidth > pageBounds.width) {
        newWidth = pageBounds.width - newX;
        newHeight = newWidth / aspect;
    }
    if (newY + newHeight > pageBounds.height) {
        newHeight = pageBounds.height - newY;
        newWidth = newHeight * aspect;
    }

    state.frameRect = { x: newX, y: newY, width: newWidth, height: newHeight };
}

// ============================================================================
// Capture Logic
// ============================================================================
async function confirmCapture(captureType) {
  if (!state.isActive) return;

  dom.overlay.style.display = 'none';
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    const canvas = await html2canvas(document.body, {
      x: state.frameRect.x,
      y: state.frameRect.y,
      width: state.frameRect.width,
      height: state.frameRect.height,
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      ignoreElements: (element) => {
        return element.tagName === 'SCRIPT' || element.tagName === 'IFRAME';
      }
    });
    const imageData = canvas.toDataURL('image/png');

    chrome.runtime.sendMessage({
      action: 'captureComplete',
      data: {
        captureType,
        imageData,
        dimensions: { ...state.frameRect, ratio: state.currentRatio },
      }
    });
  } catch (error) {
    console.error('ScreenCut Capture Error:', error);
    chrome.runtime.sendMessage({ action: 'captureError', error: error.message });
  } finally {
    cleanup();
  }
}

function cancelCapture() {
  cleanup();
  chrome.runtime.sendMessage({ action: 'captureCancelled' });
}

// ============================================================================
// Initialization and Cleanup
// ============================================================================
function initialize(ratio, dimensions) {
  if (state.isActive) cleanup();
  state.isActive = true;
  state.currentRatio = ratio;

  const pageBounds = util.getPageBounds();
  state.frameRect = {
      width: dimensions.width,
      height: dimensions.height,
      x: util.clamp((pageBounds.width - dimensions.width) / 2, 0, pageBounds.width - dimensions.width),
      y: util.clamp((pageBounds.height - dimensions.height) / 2, 0, pageBounds.height - dimensions.height),
  };

  createDOM();
  addEventListeners();
  scheduleUpdate();
}

function cleanup() {
  if (dom.overlay) {
    dom.overlay.remove();
  }
  removeEventListeners();

  // CRITICAL FIX: Reset DOM references explicitly and carefully to preserve object structure.
  dom.overlay = null;
  dom.frame = null;
  dom.toolbar = null;
  dom.info = null;
  // Reset the nested shroud properties, but NOT the shroud object itself.
  for (const key in dom.shrouds) {
      dom.shrouds[key] = null;
  }

  state.isActive = false;
}

// RESTORED HELPER FUNCTIONS
function addEventListeners() {
    dom.frame.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
}

function removeEventListeners() {
    if (dom.frame) {
        dom.frame.removeEventListener('mousedown', handleMouseDown);
    }
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}

function calculateInitialDimensions(ratio) {
  const defaultWidth = 400;
  return {
    width: defaultWidth,
    height: Math.round(defaultWidth / ratio),
  };
}

// ============================================================================
// Message Listener (Permanent)
// ============================================================================
if (!window.screenCutListenerAdded) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'activateCapture':
        if (!state.isActive) {
          initialize(message.ratio, calculateInitialDimensions(message.ratio));
        }
        sendResponse({ success: true, status: 'initialized' });
        break;
      case 'deactivateCapture':
      case 'captureCancelled':
        if (state.isActive) {
          cleanup();
        }
        sendResponse({ success: true });
        break;
      case 'ping':
        sendResponse({ success: true, status: 'pong' });
        break;
    }
    return true;
  });
  window.screenCutListenerAdded = true;
}

console.log('ScreenCut Content Script Loaded (Reusable, Corrected)');