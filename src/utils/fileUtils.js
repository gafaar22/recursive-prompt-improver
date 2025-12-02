/**
 * File utility functions
 */

import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Set the worker source for pdf.js (use local node_modules)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ---------------------------------------------------------
// OCR Function using Tesseract.js
// ---------------------------------------------------------

/**
 * Run OCR on a canvas element using Tesseract.js
 * @param {HTMLCanvasElement} canvas - Canvas with rendered PDF page
 * @param {string} lang - Language for OCR (default: 'eng')
 * @returns {Promise<string>} - Extracted text
 */
async function runOCR(canvas, lang = "eng") {
  const result = await Tesseract.recognize(canvas, lang);
  return result.data.text;
}

// ---------------------------------------------------------
// PDF Detection: check if page is text (native) or image (scanned)
// ---------------------------------------------------------

/**
 * Detects if extracted text is likely garbled due to encoding / bad fonts.
 * Returns the reason if garbled, or null if text looks normal.
 */
function textLooksGarbled(text) {
  if (!text || text.length === 0) return null;

  // Normalize weird characters
  const cleaned = text.replace(/\s+/g, " ").trim();

  // Check 1: detect extremely high ratio of unusual symbols
  const weird = cleaned.match(/[^\w\s.,;:!?()'"%-]/g) || [];
  if (weird.length > cleaned.length * 0.2) {
    return `High ratio of unusual symbols: ${weird.length}/${cleaned.length} (${((weird.length / cleaned.length) * 100).toFixed(1)}%)`;
  }

  // Check 2: check vowel ratio (per language-neutral threshold)
  const letters = cleaned.match(/[A-Za-z]/g) || [];
  const vowels = cleaned.match(/[AEIOUaeiou]/g) || [];

  if (letters.length > 25) {
    const ratio = vowels.length / letters.length;
    // natural languages vary from 30% to 50%
    if (ratio < 0.2 || ratio > 0.65) {
      return `Abnormal vowel ratio: ${(ratio * 100).toFixed(1)}% (expected 20-65%)`;
    }
  }

  // Check 3: detect long runs of uppercase WITHOUT spaces (indicative of encoding issues)
  // Legitimate titles like "DICHIARAZIONE SOSTITUTIVA DI CERTIFICAZIONE" have spaces
  // Garbled text like "KWWSVXQLPROHVVHFLQHFD" doesn't
  const uppercaseMatch = cleaned.match(/[A-Z]{30,}/);
  if (uppercaseMatch) {
    return `Long uppercase run without spaces detected: "${uppercaseMatch[0].substring(0, 30)}..."`;
  }

  return null;
}

/**
 * Determines if a PDF page requires OCR:
 * - No text (scanned image)
 * - Very little text (likely scanned)
 * - Garbled text (bad encoding)
 * Returns { needsOCR: boolean, reason: string }
 */
function pageNeedsOCR(textItems) {
  // Case 1: no PDF text at all → scanned
  if (!textItems || textItems.length === 0) {
    return { needsOCR: true, reason: "No text elements found (scanned page)" };
  }

  const combinedText = textItems
    .map((x) => x.str)
    .join(" ")
    .trim();

  // Case 2: too few characters to be a "real" page
  // (headers, footers, page numbers)
  const totalChars = combinedText.length;
  if (totalChars < 25) {
    return { needsOCR: true, reason: `Too few characters: ${totalChars} (minimum 25)` };
  }

  // Case 3: text exists but it's broken → OCR needed
  const garbledReason = textLooksGarbled(combinedText);
  if (garbledReason) {
    return { needsOCR: true, reason: `Garbled text - ${garbledReason}` };
  }

  return { needsOCR: false, reason: "Text extraction OK" };
}

// ---------------------------------------------------------
// Render PDF page to canvas
// ---------------------------------------------------------

/**
 * Render a PDF page to a canvas element
 * @param {Object} page - PDF.js page object
 * @returns {Promise<HTMLCanvasElement>} - Canvas with rendered page
 */
async function renderPageToCanvas(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// ---------------------------------------------------------
// PDF Text Extraction
// ---------------------------------------------------------

/**
 * Extract text from a PDF file (supports both native text and scanned PDFs via OCR)
 * @param {File} file - PDF file to extract text from
 * @param {Object} options - Options for extraction
 * @param {string} options.ocrLang - Language for OCR (default: 'eng')
 * @param {function} options.onProgress - Callback for progress updates (pageNumber, totalPages)
 * @returns {Promise<{text: string, usedOCR: boolean}>} - Extracted text content and OCR usage flag
 */
export async function extractTextFromPdf(file, options = {}) {
  const { ocrLang = "eng", onProgress } = options;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let finalText = "";
  let usedOCR = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) {
      onProgress(i, pdf.numPages);
    }

    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const { needsOCR, reason } = pageNeedsOCR(content.items);

    console.log(`[PDF] Page ${i}/${pdf.numPages}: ${reason}${needsOCR ? " → Using OCR" : ""}`);

    if (!needsOCR) {
      // Native PDF → text already extractable
      const pageText = content.items.map((x) => x.str).join(" ");
      finalText += pageText + "\n\n";
    } else {
      // Scanned PDF or garbled text → OCR
      usedOCR = true;
      const canvas = await renderPageToCanvas(page);
      const ocrText = await runOCR(canvas, ocrLang);
      finalText += ocrText + "\n\n";
    }
  }

  return { text: finalText.trim(), usedOCR };
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "1.5 KB", "2.3 MB")
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

/**
 * Read file content as text
 * @param {File} file - File object to read
 * @returns {Promise<string>} - File content as text
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

/**
 * Read file content as base64 data URL
 * @param {File} file - File object to read
 * @returns {Promise<string>} - File content as base64 data URL
 */
export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

/**
 * Estimate the number of tokens an image will use in multimodal models
 * Uses patch-based calculation (14x14 pixel patches) common across major providers
 * (OpenAI, Anthropic, Gemini, LLaVA, MiniCPM-V, Moondream, etc.)
 *
 * @param {Object} dimensions - Image dimensions after resize
 * @param {number} dimensions.width - Image width in pixels
 * @param {number} dimensions.height - Image height in pixels
 * @returns {number} Estimated token count
 * @throws {Error} If dimensions are invalid
 */
export const estimateImageTokens = (dimensions) => {
  const { width, height } = dimensions || {};

  // Validate inputs
  if (typeof width !== "number" || typeof height !== "number" || isNaN(width) || isNaN(height)) {
    throw new Error("Invalid dimensions: width and height must be valid numbers");
  }

  if (width <= 0 || height <= 0) {
    throw new Error("Invalid dimensions: width and height must be positive numbers");
  }

  // Calculate patches (14x14 pixel patches, minimum 1 per dimension)
  const patchW = Math.max(1, Math.ceil(width / 14));
  const patchH = Math.max(1, Math.ceil(height / 14));
  const patchTokens = patchW * patchH;

  // Add overhead for CLS token, metadata, embeddings, and provider differences
  const overheadTokens = 50;

  return patchTokens + overheadTokens;
};

/**
 * Resize an image to have a maximum dimension (width or height)
 * Maintains aspect ratio. If image is smaller than maxSize, returns original.
 * @param {File} file - Image file to resize
 * @param {number} maxSize - Maximum dimension in pixels (default: 1024)
 * @param {string} outputFormat - Output format (default: same as input or 'image/jpeg')
 * @param {number} quality - JPEG quality 0-1 (default: 0.9)
 * @returns {Promise<{dataUrl: string, mimeType: string, wasResized: boolean, width: number, height: number}>}
 */
export const resizeImage = (file, maxSize = 1024, outputFormat = null, quality = 0.9) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const { width, height } = img;

        // Check if resize is needed
        if (width <= maxSize && height <= maxSize) {
          // No resize needed, return original data URL with dimensions
          resolve({
            dataUrl: e.target.result,
            mimeType: file.type || "image/png",
            wasResized: false,
            width: width,
            height: height,
          });
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        let newWidth, newHeight;
        if (width > height) {
          newWidth = maxSize;
          newHeight = Math.round((height / width) * maxSize);
        } else {
          newHeight = maxSize;
          newWidth = Math.round((width / height) * maxSize);
        }

        // Create canvas and resize
        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");

        // Use better image smoothing for quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Determine output format
        const mimeType = outputFormat || file.type || "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve({
          dataUrl,
          mimeType,
          wasResized: true,
          width: newWidth,
          height: newHeight,
        });
      };

      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Download content as a file
 * @param {string} content - Content to download (text or base64 data URL)
 * @param {string} fileName - Name of the file
 * @param {string} mimeType - MIME type of the file (default: "text/plain")
 */
export const downloadAsFile = (content, fileName, mimeType = "text/plain") => {
  const link = document.createElement("a");

  // Check if content is a base64 data URL
  if (typeof content === "string" && content.startsWith("data:")) {
    // Use data URL directly - browser handles the conversion
    link.href = content;
  } else {
    // Create blob for text content
    const blob = new Blob([content], { type: mimeType });
    link.href = URL.createObjectURL(blob);
  }

  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke object URL if we created one (not for data URLs)
  if (!content.startsWith("data:")) {
    URL.revokeObjectURL(link.href);
  }
};

/**
 * Download a file
 * @param {Object|string} fileOrContent - File object with name/content/type, or content string
 * @param {string} [fileName] - Name of the file (if first param is content string)
 * @param {string} [mimeType] - MIME type (if first param is content string)
 */
export const downloadFile = (fileOrContent, fileName, mimeType) => {
  if (typeof fileOrContent === "object" && fileOrContent !== null && "content" in fileOrContent) {
    // Called with file object: downloadFile({ name, content, type })
    downloadAsFile(fileOrContent.content, fileOrContent.name, fileOrContent.type || "text/plain");
  } else {
    // Called with separate arguments: downloadFile(content, name, type)
    downloadAsFile(fileOrContent, fileName, mimeType || "text/plain");
  }
};

/**
 * Get file extension from filename
 * @param {string} fileName - Name of the file
 * @returns {string} - File extension (lowercase, without dot)
 */
export const getFileExtension = (fileName) => {
  if (!fileName) return "";
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
};

/**
 * Check if a file is a PDF
 * @param {string} fileName - Name of the file
 * @returns {boolean} - True if the file is a PDF
 */
export const isPdfFile = (fileName) => {
  return getFileExtension(fileName) === "pdf";
};

/**
 * Check if a file type is supported for text reading
 * @param {string} fileName - Name of the file
 * @returns {boolean} - True if the file type is supported
 */
export const isTextFile = (fileName) => {
  const textExtensions = [
    "txt",
    "md",
    "json",
    "csv",
    "xml",
    "html",
    "js",
    "ts",
    "jsx",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "css",
    "scss",
    "sass",
    "less",
    "yaml",
    "yml",
    "ini",
    "conf",
    "cfg",
    "log",
    "sh",
    "bash",
    "zsh",
    "sql",
    "graphql",
    "gql",
  ];
  const ext = getFileExtension(fileName);
  return textExtensions.includes(ext);
};

/**
 * Read file content - handles both text files and PDFs
 * For PDFs, returns object with both original data and extracted text
 * @param {File} file - File object to read
 * @param {Object} options - Options for reading
 * @param {string} options.ocrLang - Language for OCR when reading scanned PDFs (default: 'eng')
 * @param {function} options.onProgress - Callback for PDF progress updates (pageNumber, totalPages)
 * @returns {Promise<{content: string, originalData?: string}>} - Object with text content and optional original data
 */
export const readFileContent = async (file, options = {}) => {
  if (isPdfFile(file.name)) {
    // For PDFs, return both the extracted text and original binary data
    const [pdfResult, originalData] = await Promise.all([
      extractTextFromPdf(file, options),
      readFileAsDataURL(file),
    ]);
    return {
      content: pdfResult.text,
      originalData: originalData,
      usedOCR: pdfResult.usedOCR,
    };
  }
  // For text files, just return the text content
  const textContent = await readFileAsText(file);
  return {
    content: textContent,
  };
};

/**
 * Accepted file extensions for knowledge base uploads (includes PDF)
 */
export const ACCEPTED_FILE_EXTENSIONS =
  ".pdf,.txt,.html,.md,.json,.csv,.xml,.yaml,.js,.ts,.py,.java,.c,.cpp,.h,.css,.scss,.yml";
