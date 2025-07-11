chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'cropImage') {
    const { dataUrl, cropRegion } = message;
    const dpr = cropRegion.dpr || 1;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Adjust crop region coordinates and dimensions for device pixel ratio
      const finalX = cropRegion.x * dpr;
      const finalY = cropRegion.y * dpr;
      const finalWidth = cropRegion.width * dpr;
      const finalHeight = cropRegion.height * dpr;

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Draw the cropped portion of the image onto the canvas
      ctx.drawImage(
        img,
        finalX, // source X
        finalY, // source Y
        finalWidth, // source width
        finalHeight, // source height
        0, // destination X
        0, // destination Y
        finalWidth, // destination width
        finalHeight // destination height
      );

      // Get the cropped image as a data URL
      const croppedDataUrl = canvas.toDataURL('image/png');
      sendResponse({ success: true, dataUrl: croppedDataUrl });
    };

    img.onerror = (err) => {
      console.error('Offscreen script: Image failed to load.', err);
      sendResponse({ success: false, error: 'Image could not be loaded in offscreen document.' });
    };

    img.src = dataUrl;
    return true; // Indicates that the response is sent asynchronously
  }
});