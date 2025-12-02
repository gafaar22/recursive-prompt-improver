import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { loadSettings, saveSettings } from "@utils/storageUtils";

// Create the settings context
const SettingsContext = createContext();

// Custom hook to use the settings context
export const useSettings = () => useContext(SettingsContext);

// Helper function to deeply compare settings objects
const areSettingsEqual = (settings1, settings2) => {
  return JSON.stringify(settings1) === JSON.stringify(settings2);
};

// Provider component for the settings context
export const SettingsProvider = ({ children }) => {
  // State for settings with initial empty values
  const [settings, setSettings] = useState({
    providers: [],
    defaultProviderId: null,
    max_tokens: 0,
    time_limit: 0,
    temperature: 0,
    environmentVariables: [],
    default: true,
  });

  // State to track the original saved settings
  const [savedSettings, setSavedSettings] = useState(settings);

  // State to track if the app has finished initial loading
  const [isAppReady, setIsAppReady] = useState(false);

  // Load settings from storage on component mount
  useEffect(() => {
    const loadInitialSettings = async () => {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
      // Set saved settings to the loaded settings as well
      setSavedSettings(loadedSettings);
      // Mark app as ready after settings are loaded
      setIsAppReady(true);
    };
    loadInitialSettings();
  }, []);

  // Function to update settings in state only (no storage save)
  const updateSettings = (newSettings) => {
    // Update state
    setSettings((prevSettings) => ({
      ...prevSettings,
      ...newSettings,
    }));
  };

  // Function to save all current settings to storage
  const saveSettingsToStorage = async () => {
    const success = await saveSettings(settings);
    if (success) {
      // Update saved settings reference after successful save
      setSavedSettings(settings);
    }
    return success;
  };

  // Function to update and save settings atomically (for imports)
  // This avoids the race condition where saveSettings() uses stale state
  const updateAndSaveSettings = async (newSettings) => {
    const mergedSettings = { ...settings, ...newSettings };
    const success = await saveSettings(mergedSettings);
    if (success) {
      // Update both states atomically
      setSettings(mergedSettings);
      setSavedSettings(mergedSettings);
    }
    return success;
  };

  // Function to check if settings have been modified
  const hasUnsavedChanges = useCallback(() => {
    return !areSettingsEqual(settings, savedSettings);
  }, [settings, savedSettings]);

  // Function to reset settings to last saved state
  const resetSettings = useCallback(() => {
    setSettings(savedSettings);
  }, [savedSettings]);

  // Value object to be provided to consumers
  const value = {
    settings,
    updateSettings,
    updateAndSaveSettings,
    saveSettings: saveSettingsToStorage,
    hasUnsavedChanges,
    resetSettings,
    isAppReady,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
