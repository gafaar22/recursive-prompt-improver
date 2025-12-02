# Vosk Speech Recognition Models

This directory contains pre-bundled Vosk models for offline speech recognition in Electron.

## Current Models

- **vosk-model-small-en-us-0.15.zip** (~40MB)
  - Language: English (US)
  - Size: Small (optimized for speed)
  - Source: <https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip>

## Usage

These models are automatically loaded by the application when running in Electron mode. The app will:

1. Detect that it's running in Electron
2. Load the model from `/vosk-models/vosk-model-small-en-us-0.15.zip`
3. Initialize the Vosk recognizer
4. Provide fully offline speech recognition

## Adding New Language Models

To add support for additional languages:

1. Download the model from <https://alphacephei.com/vosk/models>
2. Place the .zip file in this directory
3. Update `src/utils/speechUtils.js`:
   - Add the language code to the `modelPaths` object in `loadVoskModel()`
   - Map it to the corresponding .zip file

Example:

```javascript
const modelPaths = {
  "en-US": "/vosk-models/vosk-model-small-en-us-0.15.zip",
  "es-ES": "/vosk-models/vosk-model-small-es-0.42.zip", // Spanish
  "fr-FR": "/vosk-models/vosk-model-small-fr-0.22.zip", // French
};
```

## Model Sizes

Vosk provides different model sizes:

- **Small models** (~40-50MB): Fast, good for general use
- **Large models** (~1-2GB): More accurate, slower
- **Lightweight models** (~10-20MB): Very fast, less accurate

Choose based on your needs. The current implementation uses small models for a good balance of speed and accuracy.

## License

Vosk models are provided by Alpha Cephei under the Apache 2.0 license.
See <https://alphacephei.com/vosk/> for more information.
