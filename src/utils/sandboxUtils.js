/**
 * Sandbox utilities for executing JavaScript code in isolated environments
 * Provides multiple sandboxing strategies with different isolation levels
 */

/**
 * Sandbox execution mode configuration
 * Options: "simple" | "iframe" | "webworker"
 * - "simple": Uses AsyncFunction constructor (fastest, least isolated)
 * - "iframe": Uses sandboxed iframe (good isolation, works in browser)
 * - "webworker": Uses Web Worker (best isolation, separate thread)
 */
const SANDBOX_MODE = "webworker";

/**
 * AsyncFunction constructor for creating async functions dynamically
 * @private
 */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Create and execute a sandboxed async function with given code and arguments
 * Uses simple AsyncFunction constructor - fastest but least isolated
 *
 * @param {string} code - The JavaScript code to execute (function body without declaration)
 * @param {Object} args - Arguments object with key-value pairs to pass to the function
 * @param {Object} env - Environment variables object to inject
 * @returns {Promise<any>} - The result of the function execution
 */
const runInSimpleSandbox = (code, args = {}, env = {}) => {
  const paramNames = Object.keys(args);
  const paramValues = Object.values(args);

  // Add 'env' as an additional parameter
  paramNames.push("env");
  paramValues.push(env);

  // Create the sandboxed async function
  const sandboxedFunction = new AsyncFunction(...paramNames, `"use strict";\n${code}`);

  // Execute and return the promise
  return sandboxedFunction(...paramValues);
};

/**
 * Create and execute a sandboxed async function using an iframe for enhanced isolation
 * This provides stronger sandboxing than runInSimpleSandbox by running code in an isolated iframe context
 *
 * @param {string} code - The JavaScript code to execute (function body without declaration)
 * @param {Object} args - Arguments object with key-value pairs to pass to the function
 * @param {Object} env - Environment variables object to inject
 * @returns {Promise<any>} - The result of the function execution
 */
const runInIframeSandbox = (code, args = {}, env = {}) => {
  return new Promise((resolve, reject) => {
    // Create a sandboxed iframe
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    // Sandbox attribute restricts iframe capabilities
    // allow-scripts is required to run JavaScript
    iframe.sandbox = "allow-scripts";

    // Generate a unique message ID for this execution
    const messageId = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Message handler to receive result from iframe
    const messageHandler = (event) => {
      // Verify the message is from our iframe and has our messageId
      if (event.data && event.data.messageId === messageId) {
        // Clean up
        window.removeEventListener("message", messageHandler);
        document.body.removeChild(iframe);

        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };

    window.addEventListener("message", messageHandler);

    // Create the script to run inside the iframe
    const paramNames = Object.keys(args);
    const argsJson = JSON.stringify(args);
    const envJson = JSON.stringify(env);

    const iframeScript = `
      <script>
        (async function() {
          try {
            const args = ${argsJson};
            const env = ${envJson};
            const paramNames = ${JSON.stringify(paramNames)};
            const paramValues = paramNames.map(name => args[name]);
            
            // Add env as last parameter
            paramNames.push("env");
            paramValues.push(env);
            
            // Create async function from code
            const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
            const sandboxedFunction = new AsyncFunction(...paramNames, "use strict";\\n${code.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")});
            
            // Execute and get result
            const result = await sandboxedFunction(...paramValues);
            
            // Send result back to parent
            parent.postMessage({
              messageId: "${messageId}",
              success: true,
              result: result
            }, "*");
          } catch (error) {
            parent.postMessage({
              messageId: "${messageId}",
              success: false,
              error: error.message || String(error)
            }, "*");
          }
        })();
      </script>
    `;

    // Set iframe content using srcdoc (data URI alternative that works with sandbox)
    iframe.srcdoc = `<!DOCTYPE html><html><head></head><body>${iframeScript}</body></html>`;

    // Append iframe to document to start execution
    document.body.appendChild(iframe);
  });
};

/**
 * Create and execute a sandboxed async function using a Web Worker for enhanced isolation
 * This provides stronger sandboxing than runInSimpleSandbox by running code in an isolated worker thread
 *
 * @param {string} code - The JavaScript code to execute (function body without declaration)
 * @param {Object} args - Arguments object with key-value pairs to pass to the function
 * @param {Object} env - Environment variables object to inject
 * @param {number} timeout - Maximum execution time in milliseconds (default: 60000ms)
 * @returns {Promise<any>} - The result of the function execution
 */
const runInWebWorkerSandbox = (code, args = {}, env = {}, timeout = 60000) => {
  return new Promise((resolve, reject) => {
    // Create the worker script as a blob
    const workerScript = `
      self.onmessage = async function(event) {
        const { code, args, env } = event.data;
        
        try {
          const paramNames = Object.keys(args);
          const paramValues = paramNames.map(name => args[name]);
          
          // Add env as last parameter
          paramNames.push("env");
          paramValues.push(env);
          
          // Create async function from code
          const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
          const sandboxedFunction = new AsyncFunction(...paramNames, '"use strict";\\n' + code);
          
          // Execute and get result
          const result = await sandboxedFunction(...paramValues);
          
          // Send result back to main thread
          self.postMessage({ success: true, result: result });
        } catch (error) {
          self.postMessage({ success: false, error: error.message || String(error) });
        }
      };
    `;

    // Create a blob URL for the worker
    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    let worker;
    let timeoutId;
    let hasResolved = false;

    try {
      worker = new Worker(workerUrl);
    } catch (error) {
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`Failed to create Web Worker: ${error.message}`));
      return;
    }

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error(`Execution timeout: Function exceeded ${timeout}ms time limit`));
      }
    }, timeout);

    // Handle messages from worker
    worker.onmessage = (event) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };

    // Handle worker errors
    worker.onerror = (error) => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error(error.message || "Worker execution failed"));
      }
    };

    // Send data to worker to start execution
    worker.postMessage({ code, args, env });
  });
};

/**
 * Dispatcher function that executes code in a sandbox using the configured mode
 * The sandbox mode is determined by the SANDBOX_MODE constant at the top of this file
 * Includes timeout protection and returns a standardized result object
 *
 * @param {string} code - The JavaScript code to execute (function body without declaration)
 * @param {Object} args - Arguments object with key-value pairs to pass to the function
 * @param {Object} env - Environment variables object to inject
 * @param {number} timeout - Maximum execution time in milliseconds (default: 60000ms)
 * @returns {Promise<Object>} - Returns { success: boolean, result: any, error: string }
 */
export const runInSandbox = async (code, args = {}, env = {}, timeout = 60000) => {
  return new Promise((resolve) => {
    let timeoutId;
    let hasResolved = false;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        resolve({
          success: false,
          result: null,
          error: `Execution timeout: Function exceeded ${timeout}ms time limit`,
        });
      }
    }, timeout);

    // Select sandbox implementation based on mode
    let executionPromise;
    switch (SANDBOX_MODE) {
      case "iframe":
        executionPromise = runInIframeSandbox(code, args, env);
        break;
      case "webworker":
        executionPromise = runInWebWorkerSandbox(code, args, env, timeout);
        break;
      case "simple":
      default:
        executionPromise = runInSimpleSandbox(code, args, env);
        break;
    }

    // Handle the execution result
    executionPromise
      .then((result) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: true,
            result: result,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeoutId);
          resolve({
            success: false,
            result: null,
            error: error.message || String(error),
          });
        }
      });
  });
};
