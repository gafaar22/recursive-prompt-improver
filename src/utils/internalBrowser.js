/**
 * Internal Browser Utility
 * Opens HTML/Text/PDF content in popup windows
 * Uses pdfjs-dist for PDF rendering (works in both web and Electron)
 */

import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Check if running in Electron environment
 */
const isElectron = () => {
  return typeof window !== "undefined" && window.__RPI_ELECTRON__ !== undefined;
};

/**
 * Open HTML content in a new sandboxed browser window
 * @param {string} htmlContent - The HTML content to display
 * @param {object} options - Configuration options
 * @param {string} options.title - Window title (default: "HTML Preview")
 * @param {number} options.width - Window width (default: 800)
 * @param {number} options.height - Window height (default: 600)
 */
export const openHtmlPreview = (htmlContent, options = {}) => {
  const { title = "HTML Preview", width = 800, height = 600 } = options;

  if (isElectron() && window.electronAPI?.openHtmlPreview) {
    window.electronAPI.openHtmlPreview(htmlContent, options);
  } else {
    openWebPreview(htmlContent, { title, width, height });
  }
};

/**
 * Open HTML preview in a new browser window (web environment)
 * Uses a sandboxed iframe for security
 * @param {string} htmlContent - The HTML content to display
 * @param {object} options - Window options
 */
const openWebPreview = (htmlContent, options) => {
  const { title, width, height } = options;

  // Calculate center position
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  // Open new window
  const popup = window.open(
    "",
    "_blank",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  );

  if (!popup) {
    console.error("Failed to open popup window. Popup blocker may be active.");
    return;
  }

  // Write sandboxed HTML content
  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; script-src 'none';">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f4f4f4;
          }
          .preview-container {
            width: 100%;
            height: 100vh;
            overflow: auto;
            background: white;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="preview-container">
          <iframe 
            sandbox="allow-same-origin" 
            srcdoc="${htmlContent.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"
          ></iframe>
        </div>
      </body>
    </html>
  `);

  // Fix: properly set srcdoc after document is ready
  popup.document.close();
  const iframe = popup.document.querySelector("iframe");
  if (iframe) {
    iframe.srcdoc = htmlContent;
  }
};

/**
 * Open a text file in a new browser window with syntax highlighting
 * @param {string} textContent - The text content to display
 * @param {object} options - Configuration options
 * @param {string} options.title - Window title (default: "Text Preview")
 * @param {number} options.width - Window width (default: 800)
 * @param {number} options.height - Window height (default: 600)
 */
export const openTextPreview = (textContent, options = {}) => {
  const { title = "Text Preview", width = 800, height = 600 } = options;

  // Escape HTML to prevent XSS and display content correctly
  const escapedContent = textContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 1rem;
            line-height: 1.5;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            tab-size: 2;
          }
        </style>
      </head>
      <body>
        <pre>${escapedContent}</pre>
      </body>
    </html>
  `;

  openHtmlPreview(htmlContent, { title, width, height });
};

/**
 * Open a PDF file in a new browser window using PDF.js
 * Renders PDF pages to canvas elements
 * @param {string} pdfData - Base64 data URL of the PDF
 * @param {object} options - Configuration options
 * @param {string} options.title - Window title (default: "PDF Preview")
 * @param {number} options.width - Window width (default: 900)
 * @param {number} options.height - Window height (default: 700)
 */
export const openPdfPreview = async (pdfData, options = {}) => {
  const { title = "PDF Preview", width = 900, height = 700 } = options;

  // Calculate center position
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  // Open popup window
  const popup = window.open(
    "",
    "_blank",
    `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
  );

  if (!popup) {
    console.error("Failed to open popup window. Popup blocker may be active.");
    return;
  }

  // Write initial loading HTML with zoom controls
  popup.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; overflow: hidden; background: #525659; }
          #toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 40px;
            background: #3d3d3d;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          #toolbar button {
            background: #525659;
            border: 1px solid #666;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 36px;
          }
          #toolbar button:hover {
            background: #6a6a6a;
          }
          #toolbar button:active {
            background: #4a4a4a;
          }
          #toolbar button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          #zoom-level {
            color: white;
            font-size: 14px;
            min-width: 60px;
            text-align: center;
          }
          #viewer { 
            width: 100%; 
            height: calc(100% - 40px);
            margin-top: 40px;
            overflow: auto; 
            display: flex; 
            flex-direction: column; 
            align-items: center;
            padding: 10px;
            gap: 10px;
          }
          canvas { 
            display: block; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            background: white;
          }
          #loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: sans-serif;
            font-size: 18px;
          }
          #error {
            color: #ff6b6b;
            font-family: sans-serif;
            padding: 20px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div id="toolbar" style="display: none;">
          <button id="zoom-out" title="Zoom Out">−</button>
          <button id="zoom-fit" title="Fit to Width">Fit</button>
          <span id="zoom-level">100%</span>
          <button id="zoom-in" title="Zoom In">+</button>
          <button id="zoom-reset" title="Reset Zoom">Reset</button>
        </div>
        <div id="loading">Loading PDF...</div>
        <div id="viewer"></div>
      </body>
    </html>
  `);
  popup.document.close();

  try {
    // Extract base64 data from data URL
    let base64Data = pdfData;
    if (pdfData.startsWith("data:")) {
      const commaIndex = pdfData.indexOf(",");
      if (commaIndex !== -1) {
        base64Data = pdfData.substring(commaIndex + 1);
      }
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load PDF using pdfjs-dist with standard font fallback
    const pdf = await pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
      standardFontDataUrl: null, // Disable standard font loading
      disableFontFace: true, // Don't try to load custom fonts
    }).promise;

    // Hide loading indicator and show toolbar
    const loadingEl = popup.document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = "none";

    const toolbar = popup.document.getElementById("toolbar");
    if (toolbar) toolbar.style.display = "flex";

    const viewer = popup.document.getElementById("viewer");
    const zoomLevelEl = popup.document.getElementById("zoom-level");

    // Zoom state
    let currentZoom = 1.0;
    const minZoom = 0.25;
    const maxZoom = 4.0;
    const zoomStep = 0.25;
    const baseScale = 1.5; // Base rendering scale for quality

    // Store page data for re-rendering
    const pageDataCache = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      pageDataCache.push(page);
    }

    // Update zoom level display
    const updateZoomDisplay = () => {
      if (zoomLevelEl) {
        zoomLevelEl.textContent = Math.round(currentZoom * 100) + "%";
      }
    };

    // Render all pages at current zoom level
    const renderPages = async () => {
      // Clear existing canvases
      viewer.innerHTML = "";

      const scale = baseScale * currentZoom;
      const outputScale = window.devicePixelRatio || 1;

      for (const page of pageDataCache) {
        const viewport = page.getViewport({ scale });

        const canvas = popup.document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        await page.render({
          canvasContext: context,
          viewport,
          transform,
        }).promise;

        viewer.appendChild(canvas);
      }

      updateZoomDisplay();
    };

    // Fit to width calculation
    const fitToWidth = () => {
      if (pageDataCache.length === 0) return;
      const firstPage = pageDataCache[0];
      const viewport = firstPage.getViewport({ scale: baseScale });
      const viewerWidth = viewer.clientWidth - 40; // Account for padding
      currentZoom = viewerWidth / viewport.width;
      currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom));
      renderPages();
    };

    // Zoom controls
    const zoomIn = () => {
      currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
      renderPages();
    };

    const zoomOut = () => {
      currentZoom = Math.max(minZoom, currentZoom - zoomStep);
      renderPages();
    };

    const zoomReset = () => {
      currentZoom = 1.0;
      renderPages();
    };

    // Bind zoom controls
    popup.document.getElementById("zoom-in").onclick = zoomIn;
    popup.document.getElementById("zoom-out").onclick = zoomOut;
    popup.document.getElementById("zoom-reset").onclick = zoomReset;
    popup.document.getElementById("zoom-fit").onclick = fitToWidth;

    // Keyboard shortcuts
    popup.document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          zoomReset();
        }
      }
    });

    // Initial render with fit to width
    fitToWidth();
  } catch (error) {
    console.error("PDF Preview Error:", error);
    const loadingEl = popup.document.getElementById("loading");
    if (loadingEl) {
      loadingEl.id = "error";
      loadingEl.textContent = `Error loading PDF: ${error.message}`;
    }
  }
};

export default {
  openHtmlPreview,
  openTextPreview,
  openPdfPreview,
  isElectron,
};
