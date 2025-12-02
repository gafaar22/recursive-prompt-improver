import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { loadOutputFromLocalStorage } from "@utils/storageUtils";

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState("");
  const [logs, setLogs] = useState("");
  const [currentIteration, setCurrentIteration] = useState(0);

  // Load saved logs from storage on initial render
  useEffect(() => {
    const loadSavedLogs = async () => {
      const savedLogs = await loadOutputFromLocalStorage();
      if (savedLogs) {
        setLogs(savedLogs);
      }
    };
    loadSavedLogs();
  }, []);

  const logger = useCallback((value, subvalue = "") => {
    const newOutput = (prevLogs) =>
      `${prevLogs || ""}\n${value}\n${subvalue}\n__________________________________________\n`;

    setLogs((prevLogs) => {
      return newOutput(prevLogs);
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs("");
  }, []);

  // Show global loading overlay with optional message
  const showGlobalLoading = useCallback((message = "Loading...") => {
    setGlobalLoadingMessage(message);
    setIsGlobalLoading(true);
  }, []);

  // Hide global loading overlay
  const hideGlobalLoading = useCallback(() => {
    setIsGlobalLoading(false);
    setGlobalLoadingMessage("");
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        setIsLoading,
        isGlobalLoading,
        globalLoadingMessage,
        showGlobalLoading,
        hideGlobalLoading,
        logs,
        logger,
        clearLogs,
        currentIteration,
        setCurrentIteration,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};
