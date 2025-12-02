/**
 * Speech utilities for speech-to-text and text-to-speech functionality
 * - Browser: Uses native Web Speech API (requires internet)
 * - Electron: Uses Vosk for offline speech recognition (downloads model on first use)
 */

import * as Vosk from "vosk-browser";

/**
 * Check if running in Electron environment
 * @returns {boolean} True if running in Electron
 */
const isElectron = () => {
  return typeof window !== "undefined" && window.__RPI_ELECTRON__;
};

/**
 * Check if speech recognition is supported in the browser
 * @returns {boolean} True if speech recognition is supported
 */
export const isSpeechRecognitionSupported = () => {
  // In Electron, we use Vosk (always available)
  if (isElectron()) {
    return true;
  }
  // In browser, check for Web Speech API
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
};

/**
 * Check if speech synthesis is supported in the browser
 * @returns {boolean} True if speech synthesis is supported
 */
export const isSpeechSynthesisSupported = () => {
  return "speechSynthesis" in window;
};

// Vosk model cache
let voskModel = null;
let voskModelLoading = false;

/**
 * Load Vosk model for speech recognition
 * Loads the pre-bundled model from the public folder
 * @param {string} lang - Language code (default: 'en-US')
 * @returns {Promise<Object>} Vosk model instance
 */
const loadVoskModel = async (lang = "en-US") => {
  if (voskModel) {
    return voskModel;
  }

  if (voskModelLoading) {
    // Wait for existing load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (voskModel) {
          clearInterval(checkInterval);
          resolve(voskModel);
        }
      }, 100);
    });
  }

  voskModelLoading = true;

  try {
    // Map language codes to local model paths
    const modelPaths = {
      "en-US": "/vosk-models/vosk-model-small-en-us-0.15.zip",
      "en-GB": "/vosk-models/vosk-model-small-en-us-0.15.zip",
      en: "/vosk-models/vosk-model-small-en-us-0.15.zip",
      // Add more languages as needed
    };

    const modelPath = modelPaths[lang] || modelPaths["en-US"];
    const modelUrl = `${window.location.origin}${modelPath}`;

    console.log(`Loading Vosk model from ${modelUrl}...`);
    voskModel = await Vosk.createModel(modelUrl);
    console.log("Vosk model loaded successfully");

    voskModelLoading = false;
    return voskModel;
  } catch (error) {
    voskModelLoading = false;
    console.error("Failed to load Vosk model:", error);
    throw new Error(`Failed to load speech recognition model: ${error.message}`);
  }
};

/**
 * Create Vosk-based speech recognizer for Electron
 * @param {Object} callbacks - Event callbacks
 * @param {Object} options - Recognition options
 * @returns {Promise<Object>} Object with start/stop methods
 */
const createVoskRecognizer = async (callbacks = {}, options = {}) => {
  try {
    const model = await loadVoskModel(options.lang);

    let recognizer = null;
    let mediaRecorder = null;
    let audioContext = null;
    let isRunning = false;

    const start = async () => {
      if (isRunning) return;

      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Create audio context
        audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);

        // Create Vosk recognizer with sample rate
        recognizer = new model.KaldiRecognizer(16000);

        recognizer.on("result", (message) => {
          const result = message.result;
          if (result && callbacks.onResult) {
            callbacks.onResult({
              finalTranscript: result.text || "",
              interimTranscript: "",
              isFinal: true,
            });
          }
        });

        recognizer.on("partialresult", (message) => {
          const result = message.result;
          if (result && callbacks.onResult && options.interimResults !== false) {
            callbacks.onResult({
              finalTranscript: "",
              interimTranscript: result.partial || "",
              isFinal: false,
            });
          }
        });

        // Try to use AudioWorkletNode, fall back to ScriptProcessorNode if not supported
        let processorNode = null;

        try {
          // Load the audio worklet module
          await audioContext.audioWorklet.addModule("/vosk-audio-processor.js");

          // Create AudioWorkletNode
          processorNode = new AudioWorkletNode(audioContext, "vosk-audio-processor");

          // Handle audio messages from the worklet
          processorNode.port.onmessage = (event) => {
            if (event.data.type === "audio" && recognizer && isRunning) {
              try {
                // Convert Float32Array to AudioBuffer for Vosk
                const audioData = event.data.data;
                const buffer = audioContext.createBuffer(
                  1,
                  audioData.length,
                  audioContext.sampleRate
                );
                buffer.copyToChannel(audioData, 0);
                recognizer.acceptWaveform(buffer);
              } catch (error) {
                console.error("acceptWaveform failed:", error);
              }
            }
          };
        } catch (error) {
          console.warn("AudioWorklet not supported, falling back to ScriptProcessorNode:", error);

          // Fallback to ScriptProcessorNode
          processorNode = audioContext.createScriptProcessor(4096, 1, 1);
          processorNode.onaudioprocess = (event) => {
            if (recognizer && isRunning) {
              try {
                // Vosk acceptWaveform expects AudioBuffer
                recognizer.acceptWaveform(event.inputBuffer);
              } catch (error) {
                console.error("acceptWaveform failed:", error);
              }
            }
          };
        }

        source.connect(processorNode);
        processorNode.connect(audioContext.destination);

        mediaRecorder = { stream, processorNode };
        isRunning = true;
      } catch (error) {
        console.error("Vosk recognizer start error:", error);
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      }
    };

    const stop = () => {
      if (!isRunning) return;

      isRunning = false;

      if (recognizer) {
        try {
          // In continuous mode, send final result before cleanup
          if (options.continuous && callbacks.onResult) {
            // Trigger a final result by sending a small silence buffer
            const silenceBuffer = audioContext.createBuffer(1, 4096, audioContext.sampleRate);
            try {
              recognizer.acceptWaveform(silenceBuffer);
            } catch (e) {
              // Ignore errors on final buffer
            }
          }
          recognizer.remove();
          recognizer = null;
        } catch (error) {
          console.error("Error removing recognizer:", error);
        }
      }

      if (mediaRecorder) {
        if (mediaRecorder.processorNode) {
          mediaRecorder.processorNode.disconnect();
        }
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        }
        mediaRecorder = null;
      }

      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }

      if (callbacks.onEnd) {
        callbacks.onEnd();
      }
    };

    return { start, stop, recognition: { isVosk: true } };
  } catch (error) {
    console.error("Failed to create Vosk recognizer:", error);
    if (callbacks.onError) {
      callbacks.onError(error);
    }
    return { start: () => {}, stop: () => {}, recognition: null };
  }
};

/**
 * Create a speech recognition instance
 * @param {Object} options - Configuration options
 * @param {string} options.lang - Language code (default: 'en-US')
 * @param {boolean} options.continuous - Whether to continue listening after pause (default: false)
 * @param {boolean} options.interimResults - Whether to return interim results (default: true)
 * @param {number} options.maxAlternatives - Max number of alternatives to return (default: 1)
 * @returns {Object|null} SpeechRecognition instance or null if not supported
 */
export const createSpeechRecognition = (options = {}) => {
  if (!isSpeechRecognitionSupported()) {
    console.warn(
      isElectron()
        ? "Speech recognition not available in Electron. Ensure microphone permissions are granted."
        : "Speech recognition not supported in this browser."
    );
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // Set default options
  recognition.lang = options.lang || "en-US";
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = options.maxAlternatives || 1;

  // Log environment info
  if (isElectron()) {
    console.log("Using Web Speech API in Electron environment");
  }

  return recognition;
};

/**
 * Start speech recognition and return a promise that resolves with the transcript
 * Uses Vosk for Electron, Web Speech API for browsers
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onResult - Called when interim or final results are available
 * @param {Function} callbacks.onError - Called when an error occurs
 * @param {Function} callbacks.onEnd - Called when recognition ends
 * @param {Object} options - Recognition options (passed to createSpeechRecognition)
 * @returns {Promise<Object>} Object with start/stop methods and recognition instance
 */
export const startSpeechRecognition = async (callbacks = {}, options = {}) => {
  // Use Vosk for Electron
  if (isElectron()) {
    console.log("Using Vosk for speech recognition in Electron");
    return await createVoskRecognizer(callbacks, options);
  }

  // Use Web Speech API for browser
  console.log("Using Web Speech API for browser");
  return createWebSpeechRecognizer(callbacks, options);
};

/**
 * Create Web Speech API recognizer for browser
 * @param {Object} callbacks - Event callbacks
 * @param {Object} options - Recognition options
 * @returns {Object} Object with start/stop methods and recognition instance
 */
const createWebSpeechRecognizer = (callbacks = {}, options = {}) => {
  const recognition = createSpeechRecognition(options);

  if (!recognition) {
    const error = new Error("Speech recognition not supported in this browser");
    if (callbacks.onError) {
      callbacks.onError(error);
    }
    return { recognition: null, start: () => {}, stop: () => {} };
  }

  // Handle results
  recognition.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (callbacks.onResult) {
      callbacks.onResult({
        finalTranscript,
        interimTranscript,
        isFinal: finalTranscript.length > 0,
      });
    }
  };

  // Handle errors
  recognition.onerror = (event) => {
    const errorMessage = event.error || "Unknown error";
    let userFriendlyMessage = errorMessage;

    // Provide user-friendly error messages
    switch (errorMessage) {
      case "not-allowed":
        userFriendlyMessage =
          "Microphone access denied. Please allow microphone permissions in your browser settings.";
        break;
      case "no-speech":
        userFriendlyMessage = "No speech detected. Please try again.";
        break;
      case "audio-capture":
        userFriendlyMessage =
          "Microphone not found or not working. Please check your microphone connection.";
        break;
      case "network":
        userFriendlyMessage = "Network error occurred. Please check your internet connection.";
        break;
      case "aborted":
        userFriendlyMessage = "Speech recognition was aborted.";
        break;
      case "bad-grammar":
        userFriendlyMessage = "Speech recognition grammar error.";
        break;
      case "language-not-supported":
        userFriendlyMessage = "The selected language is not supported.";
        break;
      default:
        userFriendlyMessage = `Speech recognition error: ${errorMessage}`;
    }

    const error = new Error(userFriendlyMessage);
    error.code = errorMessage; // Preserve original error code
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  };

  // Handle end of recognition
  recognition.onend = () => {
    if (callbacks.onEnd) {
      callbacks.onEnd();
    }
  };

  // Start recognition
  const start = () => {
    try {
      recognition.start();
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  };

  // Stop recognition
  const stop = () => {
    try {
      recognition.stop();
    } catch (error) {
      // Ignore errors when stopping
    }
  };

  return { recognition, start, stop };
};

/**
 * Convert text to speech using the Web Speech API
 * @param {string} text - Text to speak
 * @param {Object} options - Speech synthesis options
 * @param {string} options.lang - Language code (default: 'en-US')
 * @param {number} options.rate - Speech rate (0.1 to 10, default: 1)
 * @param {number} options.pitch - Speech pitch (0 to 2, default: 1)
 * @param {number} options.volume - Speech volume (0 to 1, default: 1)
 * @param {string} options.voiceURI - Specific voice URI to use (optional)
 * @param {Function} options.onEnd - Called when speech ends
 * @param {Function} options.onError - Called when an error occurs
 * @returns {Object} Object with speak/cancel methods and utterance instance
 */
export const textToSpeech = (text, options = {}) => {
  if (!isSpeechSynthesisSupported()) {
    const error = new Error("Speech synthesis not supported in this browser");
    if (options.onError) {
      options.onError(error);
    }
    return { utterance: null, speak: () => {}, cancel: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Set options
  utterance.lang = options.lang || "en-US";
  utterance.rate = options.rate || 1;
  utterance.pitch = options.pitch || 1;
  utterance.volume = options.volume || 1;

  // Set voice if specified
  if (options.voiceURI) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.voiceURI === options.voiceURI);
    if (voice) {
      utterance.voice = voice;
    }
  }

  // Handle events
  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }

  if (options.onError) {
    utterance.onerror = (event) => {
      const error = new Error(`Speech synthesis error: ${event.error}`);
      options.onError(error);
    };
  }

  const speak = () => {
    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    window.speechSynthesis.cancel();
  };

  return { utterance, speak, cancel };
};

/**
 * Get available voices for speech synthesis
 * @returns {Promise<Array>} Array of available voice objects
 */
export const getAvailableVoices = () => {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      resolve([]);
      return;
    }

    let voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
    } else {
      // Some browsers load voices asynchronously
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        resolve(voices);
      };
    }
  });
};

/**
 * Stop all ongoing speech synthesis
 */
export const stopAllSpeech = () => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
};
