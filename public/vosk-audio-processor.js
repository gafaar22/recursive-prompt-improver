/**
 * Audio Worklet Processor for Vosk speech recognition
 * Processes audio data and sends it to the main thread for recognition
 */
class VoskAudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (input && input.length > 0) {
      const audioData = input[0]; // Get first channel

      if (audioData) {
        // Send audio data to main thread
        this.port.postMessage({
          type: "audio",
          data: audioData,
        });
      }
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("vosk-audio-processor", VoskAudioProcessor);
